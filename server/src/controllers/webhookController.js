import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import Order from "../models/Order.js";
import PaymentAttempt from "../models/PaymentAttempt.js";
import WebhookEvent from "../models/WebhookEvent.js";
import { env } from "../config/env.js";
import { razorpay } from "../config/razorpay.js";
import { fetchPayment, finalizePayment, isGatewayId } from "../utils/payments.js";

// Razorpay signs the exact bytes it sends: HMAC-SHA256(rawBody, webhookSecret), hex encoded.
function hasValidSignature(rawBody, signature) {
  if (typeof signature !== "string" || !/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", env.razorpayWebhookSecret).update(rawBody).digest();
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

// payment.authorized / payment.captured / order.paid: make sure an order exists for this payment.
async function onPaymentSuccess(event) {
  const paymentId = event.payload?.payment?.entity?.id;
  if (!isGatewayId("pay", paymentId)) return "ignored: no payment id";

  // The payload only tells us where to look; Razorpay's API is the source of truth.
  const payment = await fetchPayment(paymentId);
  if (!isGatewayId("order", payment.order_id)) return "ignored: payment has no order";

  const attempt = await PaymentAttempt.findOne({ razorpayOrderId: payment.order_id });
  if (!attempt) {
    if (payment.notes?.app === "dreamyard") {
      console.error(`[webhook] ORPHAN PAYMENT ${payment.id} (${payment.status}) for ${payment.order_id}: no checkout record. Review it in the Razorpay Dashboard.`);
    }
    return "ignored: unknown order";
  }

  const result = await finalizePayment(attempt._id, payment, { source: `webhook ${event.event}` });
  if (result.outcome === "in_progress") throw new Error("Payment is being finalized by another worker; retry later.");
  return result.outcome;
}

// payment.failed: remember the reason. The customer can retry on the same Razorpay order, so nothing is closed.
async function onPaymentFailed(event) {
  const entity = event.payload?.payment?.entity;
  if (!isGatewayId("order", entity?.order_id)) return "ignored: no order";
  const reason = String(entity.error_description || entity.error_reason || "Payment failed").slice(0, 300);
  await PaymentAttempt.updateOne({ razorpayOrderId: entity.order_id, status: "pending" }, { $set: { lastPaymentError: reason } });
  return "recorded failure";
}

// refund.created / refund.processed / refund.failed: keep the order's payment status in step with Razorpay.
async function onRefund(event) {
  const paymentId = event.payload?.refund?.entity?.payment_id || event.payload?.payment?.entity?.id;
  if (!isGatewayId("pay", paymentId)) return "ignored: no payment id";

  const payment = await fetchPayment(paymentId);
  const refunded = Number(payment.amount_refunded) || 0;
  const paymentStatus = refunded <= 0 ? "captured" : refunded >= payment.amount ? "refunded" : "partially_refunded";
  const { matchedCount } = await Order.updateOne(
    { razorpayPaymentId: payment.id },
    { $set: { paymentStatus, refundedAmount: refunded } }
  );
  return matchedCount ? `order marked ${paymentStatus}` : "ignored: no order for payment";
}

async function dispatch(type, event) {
  switch (type) {
    case "payment.authorized":
    case "payment.captured":
    case "order.paid":
      return onPaymentSuccess(event);
    case "payment.failed":
      return onPaymentFailed(event);
    case "refund.created":
    case "refund.processed":
    case "refund.failed":
      return onRefund(event);
    default:
      return "ignored: event not handled";
  }
}

export async function razorpayWebhook(req, res) {
  if (!env.razorpayEnabled || !razorpay) {
    res.status(404);
    throw new Error("Online payments are not enabled.");
  }

  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0 || !hasValidSignature(rawBody, req.get("x-razorpay-signature"))) {
    console.warn("[webhook] rejected: missing or invalid signature");
    res.status(400);
    throw new Error("Invalid webhook signature.");
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400);
    throw new Error("Invalid webhook payload.");
  }

  const type = typeof event?.event === "string" ? event.event.slice(0, 100) : "";
  const eventId = (req.get("x-razorpay-event-id") || "").slice(0, 100) || createHash("sha256").update(rawBody).digest("hex");

  const paymentEntity = event?.payload?.payment?.entity || null;
  const refundEntity = event?.payload?.refund?.entity || null;
  const razorpayPaymentId = paymentEntity?.id || refundEntity?.payment_id || null;
  const razorpayOrderId = paymentEntity?.order_id || null;

  let relatedAttempt = null;
  if (razorpayOrderId) {
    relatedAttempt = await PaymentAttempt.findOne({ razorpayOrderId: razorpayOrderId }).lean();
  } else if (razorpayPaymentId) {
    const payment = await fetchPayment(razorpayPaymentId).catch(() => null);
    if (payment?.order_id) {
      relatedAttempt = await PaymentAttempt.findOne({ razorpayOrderId: payment.order_id }).lean();
    }
  }

  const eventContext = {
    user: relatedAttempt?.user || undefined,
    order: relatedAttempt?.completedOrder || undefined,
    razorpayOrderId: razorpayOrderId || relatedAttempt?.razorpayOrderId || undefined,
    razorpayPaymentId: razorpayPaymentId || relatedAttempt?.razorpayPaymentId || undefined,
  };

  let record;
  try {
    record = await WebhookEvent.create({
      eventId,
      event: type,
      ...eventContext,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    // Seen before. Skip it if it finished, otherwise this is a retry of a failed delivery.
    record = await WebhookEvent.findOneAndUpdate(
      { eventId, status: { $ne: "processed" } },
      {
        $set: {
          status: "processing",
          ...eventContext,
        },
        $inc: { attempts: 1 },
      },
      { new: true }
    );
    if (!record) return res.json({ ok: true, duplicate: true });
  }

  try {
    const result = await dispatch(type, event);
    await WebhookEvent.updateOne(
      { _id: record._id },
      {
        $set: {
          status: "processed",
          result: String(result).slice(0, 200),
          ...(eventContext.user ? { user: eventContext.user } : {}),
          ...(eventContext.order ? { order: eventContext.order } : {}),
          ...(eventContext.razorpayOrderId ? { razorpayOrderId: eventContext.razorpayOrderId } : {}),
          ...(eventContext.razorpayPaymentId ? { razorpayPaymentId: eventContext.razorpayPaymentId } : {}),
        },
        $unset: { lastError: "" },
      }
    );
    console.log(`[webhook] ${type} ${eventId}: ${result}`);
    res.json({ ok: true });
  } catch (error) {
    await WebhookEvent.updateOne(
      { _id: record._id },
      {
        $set: {
          status: "failed",
          lastError: String(error.message).slice(0, 300),
          ...(eventContext.user ? { user: eventContext.user } : {}),
          ...(eventContext.order ? { order: eventContext.order } : {}),
          ...(eventContext.razorpayOrderId ? { razorpayOrderId: eventContext.razorpayOrderId } : {}),
          ...(eventContext.razorpayPaymentId ? { razorpayPaymentId: eventContext.razorpayPaymentId } : {}),
        },
      }
    ).catch(() => {});
    console.error(`[webhook] ${type} ${eventId} failed: ${error.message}`);
    // A non-2xx answer makes Razorpay retry with back-off for 24 hours.
    res.status(500);
    throw error;
  }
}
