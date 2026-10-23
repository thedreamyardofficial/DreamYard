import Order from "../models/Order.js";
import PaymentAttempt from "../models/PaymentAttempt.js";
import { razorpay } from "../config/razorpay.js";
import { releaseStock, tryReserveStock } from "./stock.js";

// A claimed payment that has not finished after this long is assumed to belong to a crashed worker.
const STALE_PROCESSING_MS = 2 * 60 * 1000;
// Reconciliation checks each unpaid checkout at these ages, then stops asking Razorpay.
const RECONCILE_DELAYS_MS = [10 * 60 * 1000, 60 * 60 * 1000, 6 * 60 * 60 * 1000, 24 * 60 * 60 * 1000, 72 * 60 * 60 * 1000];
const RECONCILE_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export const toPaise = (rupees) => Math.round(Number(rupees) * 100);
export const isGatewayId = (prefix, value) => typeof value === "string" && new RegExp(`^${prefix}_[A-Za-z0-9]{8,40}$`).test(value);

// The Razorpay SDK rejects with plain objects, not Errors. Log the detail, expose nothing sensitive.
export function gatewayError(error, action) {
  const detail = error?.error?.description || error?.message || "unknown error";
  console.error(`[payments] Razorpay ${action} failed (${error?.statusCode || "no status"}): ${detail}`);
  const wrapped = new Error("The payment gateway is unavailable right now. Please try again in a moment.");
  wrapped.status = 502;
  return wrapped;
}

async function gateway(action, call) {
  try {
    return await call();
  } catch (error) {
    throw gatewayError(error, action);
  }
}

// Sets the HTTP status from an error raised outside a controller and hands it back to throw.
export function toHttpError(res, error) {
  res.status(error?.status || 500);
  return error instanceof Error ? error : new Error("Something went wrong on our side. Please try again.");
}

export const fetchPayment = (paymentId) => gateway("payment fetch", () => razorpay.payments.fetch(paymentId));

export const orderSummary = (order) => ({ _id: order._id, total: order.total, customer: { name: order.customer.name } });

async function capturePayment(payment) {
  try {
    return await razorpay.payments.capture(payment.id, payment.amount, payment.currency);
  } catch (error) {
    // Automatic capture may have won the race; that is a success, not a failure.
    const current = await razorpay.payments.fetch(payment.id).catch(() => null);
    if (current?.status === "captured") return current;
    throw gatewayError(error, "capture");
  }
}

async function refundPayment(payment, attempt, reason) {
  try {
    return await razorpay.payments.refund(payment.id, {
      amount: payment.amount,
      speed: "normal",
      receipt: `rf_${attempt._id}`,
      notes: { reason: reason.slice(0, 200), attempt: String(attempt._id) },
    });
  } catch (error) {
    // A previous run may already have refunded it before we could save that fact.
    const current = await razorpay.payments.fetch(payment.id).catch(() => null);
    if (current && current.amount_refunded >= current.amount) return { id: undefined };
    throw gatewayError(error, "refund");
  }
}

// Turns an attempt that already reached a final state into the same result shape finalizePayment returns.
export async function readSettlement(attempt) {
  if (attempt.status === "completed") {
    const order = attempt.completedOrder
      ? await Order.findById(attempt.completedOrder)
      : await Order.findOne({ razorpayOrderId: attempt.razorpayOrderId });
    return { outcome: "completed", order };
  }
  if (attempt.status === "refunded") return { outcome: "refunded", reason: attempt.failureReason };
  if (attempt.status === "released") return { outcome: "released", reason: attempt.failureReason };
  return null;
}

// The customer paid but we cannot ship: give the money back (or never take it) and record why.
async function settleUnfulfillable(attempt, payment, reason) {
  if (payment.status === "captured") {
    const refund = await refundPayment(payment, attempt, reason);
    await PaymentAttempt.updateOne(
      { _id: attempt._id },
      { $set: { status: "refunded", refundId: refund.id, failureReason: reason, stockReserved: false } }
    );
    console.warn(`[payments] ${payment.id} refunded automatically: ${reason}`);
    return { outcome: "refunded", reason };
  }
  // Authorized but never captured: Razorpay releases the hold by itself, so no money moves.
  await PaymentAttempt.updateOne(
    { _id: attempt._id },
    { $set: { status: "released", failureReason: reason, stockReserved: false } }
  );
  console.warn(`[payments] ${payment.id} left uncaptured: ${reason}`);
  return { outcome: "released", reason };
}

/**
 * The single place where a successful Razorpay payment becomes an Order.
 * The browser verify call, the webhooks and the reconciliation job all end up here,
 * so it is safe to call any number of times, in any order, from any of them.
 *
 * `payment` must be a payment entity fetched from the Razorpay API, never data from the browser.
 * `source` only labels the log line ("browser verify", "webhook", "status check", "reconcile job").
 */
export async function finalizePayment(attemptId, payment, { signature, source = "unknown" } = {}) {
  const attempt = await PaymentAttempt.findById(attemptId);
  if (!attempt) return { outcome: "unknown_attempt" };

  if (
    payment.order_id !== attempt.razorpayOrderId
    || payment.amount !== toPaise(attempt.total)
    || payment.currency !== "INR"
  ) {
    console.error(`[payments] MISMATCH payment ${payment.id}: expected ${attempt.razorpayOrderId} ${toPaise(attempt.total)} INR, got ${payment.order_id} ${payment.amount} ${payment.currency}`);
    return { outcome: "mismatch" };
  }
  if (!["authorized", "captured"].includes(payment.status)) return { outcome: "not_paid", status: payment.status };

  const existing = await Order.findOne({ razorpayPaymentId: payment.id });
  if (existing) {
    if (attempt.status !== "completed") {
      await PaymentAttempt.updateOne({ _id: attempt._id }, { $set: { status: "completed", completedOrder: existing._id } });
    }
    return { outcome: "completed", order: existing };
  }
  const settled = await readSettlement(attempt);
  if (settled) return settled;

  const now = new Date();
  const claimed = await PaymentAttempt.findOneAndUpdate(
    {
      _id: attempt._id,
      $or: [
        { status: "pending" },
        { status: "processing", processingStartedAt: { $lt: new Date(now.getTime() - STALE_PROCESSING_MS) } },
        { status: "processing", processingStartedAt: { $exists: false } },
      ],
    },
    { $set: { status: "processing", processingStartedAt: now, razorpayPaymentId: payment.id } },
    { new: true }
  );
  if (!claimed) return { outcome: "in_progress" };

  let reservedHere = false;
  let order = null;
  try {
    if (!claimed.stockReserved) {
      const stock = await tryReserveStock(claimed.items);
      if (!stock.ok) return await settleUnfulfillable(claimed, payment, `${stock.item.name} is out of stock`);
      reservedHere = true;
      await PaymentAttempt.updateOne({ _id: claimed._id }, { $set: { stockReserved: true } });
    }

    const paid = payment.status === "authorized" ? await capturePayment(payment) : payment;
    if (paid.status !== "captured") throw new Error("Payment capture did not complete.");

    try {
      order = await Order.create({
        user: claimed.user,
        customer: claimed.customer,
        items: claimed.items,
        total: claimed.total,
        paymentMethod: "razorpay",
        razorpayOrderId: claimed.razorpayOrderId,
        razorpayPaymentId: payment.id,
        razorpaySignature: signature,
        razorpayMethod: paid.method,
        paymentAmount: paid.amount,
        paymentCurrency: paid.currency,
        paymentStatus: "captured",
      });
    } catch (error) {
      // Another worker created it a moment ago; the unique payment id index stopped the duplicate.
      if (error?.code !== 11000) throw error;
      order = await Order.findOne({ razorpayPaymentId: payment.id });
      if (!order) throw error;
    }

    await PaymentAttempt.updateOne(
      { _id: claimed._id },
      { $set: { status: "completed", completedOrder: order._id }, $unset: { failureReason: "" } }
    );
    console.log(`[payments] order ${order._id} created for ${payment.id} (source: ${source})`);
    return { outcome: "completed", order, created: true };
  } catch (error) {
    // Put everything back so the webhook retry or the reconciliation job can try again.
    if (!order) {
      if (reservedHere) await releaseStock(claimed.items).catch((e) => console.error("[payments] stock release failed:", e.message));
      await PaymentAttempt.updateOne(
        { _id: claimed._id },
        { $set: { status: "pending", failureReason: String(error.message).slice(0, 300), ...(reservedHere ? { stockReserved: false } : {}) } }
      ).catch((e) => console.error("[payments] attempt reset failed:", e.message));
      console.error(`[payments] NEEDS ATTENTION: payment ${payment.id} (${payment.status}) could not be turned into an order: ${error.message}`);
    }
    throw error;
  }
}

// Asks Razorpay what happened to an order's payments and finalizes the successful one, if any.
export async function syncAttempt(attempt, source = "sync") {
  const list = await gateway("order payments fetch", () => razorpay.orders.fetchPayments(attempt.razorpayOrderId));
  const payments = list?.items || [];
  const payment = payments.find((p) => p.status === "captured") || payments.find((p) => p.status === "authorized");
  if (!payment) return { outcome: "no_payment" };
  return finalizePayment(attempt._id, payment, { source });
}

// Waits briefly for another worker (usually the webhook) that is already finalizing the same payment.
export async function waitForSettlement(attemptId, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const attempt = await PaymentAttempt.findById(attemptId);
    const settled = attempt && await readSettlement(attempt);
    if (settled) return settled;
  }
  return { outcome: "in_progress" };
}

let reconciling = false;

// Safety net for missed webhooks (server down, webhook disabled, network loss).
export async function reconcilePendingPayments() {
  if (!razorpay || reconciling) return;
  reconciling = true;
  try {
    const now = Date.now();
    const seen = new Set();
    for (let stage = 0; stage < RECONCILE_DELAYS_MS.length; stage += 1) {
      const attempts = await PaymentAttempt.find({
        status: { $in: ["pending", "processing"] },
        reconcileCount: stage === 0 ? { $not: { $gte: 1 } } : stage,
        createdAt: { $lte: new Date(now - RECONCILE_DELAYS_MS[stage]), $gt: new Date(now - RECONCILE_MAX_AGE_MS) },
      }).sort({ createdAt: 1 }).limit(20);

      for (const attempt of attempts) {
        if (seen.has(String(attempt._id))) continue;
        seen.add(String(attempt._id));
        await PaymentAttempt.updateOne({ _id: attempt._id }, { $inc: { reconcileCount: 1 } });
        try {
          const result = await syncAttempt(attempt, "reconcile job");
          if (["completed", "refunded", "released"].includes(result.outcome)) {
            console.log(`[payments] reconciled ${attempt.razorpayOrderId}: ${result.outcome}`);
          }
        } catch (error) {
          console.error(`[payments] reconcile failed for ${attempt.razorpayOrderId}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error("[payments] reconcile run failed:", error.message);
  } finally {
    reconciling = false;
  }
}

export function startPaymentReconciler() {
  if (!razorpay) return () => {};
  const run = () => reconcilePendingPayments().catch((error) => console.error("[payments] reconcile error:", error.message));
  const first = setTimeout(run, 30 * 1000);
  const timer = setInterval(run, 5 * 60 * 1000);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
