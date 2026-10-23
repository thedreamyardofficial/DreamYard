import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import PaymentAttempt from "../models/PaymentAttempt.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import { env } from "../config/env.js";
import { razorpay } from "../config/razorpay.js";
import { releaseStock, tryReserveStock } from "../utils/stock.js";
import {
  finalizePayment,
  gatewayError,
  isGatewayId,
  orderSummary,
  readSettlement,
  syncAttempt,
  toHttpError,
  toPaise,
  waitForSettlement,
  fetchPayment,
} from "../utils/payments.js";

const MAX_LINES = 50;

export const paymentConfig = (_req, res) => res.json({ enabled: env.razorpayEnabled, keyId: env.razorpayKeyId });

async function prepareOrder(res, userId, addressId, items) {
  if (typeof addressId !== "string" || !Array.isArray(items) || items.length === 0 || items.length > MAX_LINES) {
    res.status(400);
    throw new Error("Select a delivery address and add at least one item.");
  }
  if (items.some((i) => !i || typeof i.productId !== "string" || !mongoose.isValidObjectId(i.productId))) {
    res.status(400);
    throw new Error("One of the items in your bag is not valid.");
  }
  const account = await User.findById(userId);
  const address = account?.addresses.id(addressId);
  if (!account || !address) {
    res.status(400);
    throw new Error("Choose one of your saved delivery addresses.");
  }

  // Never trust prices from the client: rebuild the order from the database.
  const products = await Product.find({ _id: { $in: items.map((i) => i.productId) }, published: true });
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const orderItems = items.map((i) => {
    const p = byId.get(String(i.productId));
    if (!p) {
      res.status(400);
      throw new Error("One of the items in your bag is no longer available.");
    }
    const size = typeof i.size === "string" ? i.size : "";
    if (p.sizes.length && !p.sizes.includes(size)) {
      res.status(400);
      throw new Error(`Size ${size || "(none)"} is no longer available for ${p.name}. Please update your bag.`);
    }
    const qty = Math.min(10, Math.max(1, Math.trunc(Number(i.qty)) || 1));
    return { product: p._id, name: p.name, size, qty, price: p.price };
  });

  const total = orderItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const customer = address.toObject();
  delete customer._id;
  delete customer.createdAt;
  delete customer.updatedAt;
  return { account, customer, orderItems, total };
}

async function reserveStock(items, res) {
  const result = await tryReserveStock(items);
  if (!result.ok) {
    res.status(400);
    throw new Error(`${result.item.name} doesn't have enough stock for your order.`);
  }
  return result.reserved;
}

export async function createOrder(req, res) {
  if (env.razorpayEnabled) {
    res.status(400);
    throw new Error("Complete Razorpay payment before placing an order.");
  }
  const { addressId, items } = req.body || {};
  const { account, customer, orderItems, total } = await prepareOrder(res, req.user.id, addressId, items);
  const reserved = await reserveStock(orderItems, res);
  try {
    const order = await Order.create({ user: account._id, customer, items: orderItems, total });
    res.status(201).json({ _id: order._id, total: order.total, customer: { name: order.customer.name } });
  } catch (error) {
    await releaseStock(reserved);
    throw error;
  }
}

function requireRazorpay(res) {
  if (!env.razorpayEnabled || !razorpay) {
    res.status(404);
    throw new Error("Online payments are not enabled.");
  }
}

export async function createRazorpayOrder(req, res) {
  requireRazorpay(res);
  const { addressId, items } = req.body || {};
  const { account, customer, orderItems, total } = await prepareOrder(res, req.user.id, addressId, items);
  const amount = toPaise(total);
  if (!Number.isSafeInteger(amount) || amount < 100) {
    res.status(400);
    throw new Error("This order cannot be paid online.");
  }

  let gatewayOrder;
  try {
    gatewayOrder = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `dy_${Date.now()}_${randomBytes(5).toString("hex")}`,
      notes: { app: "dreamyard", user: String(account._id) },
    });
  } catch (error) {
    throw toHttpError(res, gatewayError(error, "order create"));
  }
  await PaymentAttempt.create({
    user: account._id,
    customer,
    items: orderItems,
    total,
    razorpayOrderId: gatewayOrder.id,
  });
  res.status(201).json({
    keyId: env.razorpayKeyId,
    orderId: gatewayOrder.id,
    amount: gatewayOrder.amount,
    currency: gatewayOrder.currency,
  });
}

// Checks the signature Razorpay Checkout hands to the browser (HMAC of "order_id|payment_id" with the key secret).
function hasValidSignature(orderId, paymentId, signature) {
  if (typeof signature !== "string" || !/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", env.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

const refundNote = (reason) => `${reason}. Your payment has been refunded and should reach your account within 5-7 working days.`;
const releaseNote = (reason) => `${reason}. You have not been charged; any amount held on your card or bank will be released automatically within a few days.`;

function sendOutcome(res, result) {
  switch (result.outcome) {
    case "completed":
      if (!result.order) {
        res.status(409);
        throw new Error("This payment has already been processed. Check your orders.");
      }
      return res.status(result.created ? 201 : 200).json(orderSummary(result.order));
    case "refunded":
      res.status(409);
      throw new Error(refundNote(result.reason || "We could not fulfil your order"));
    case "released":
      res.status(409);
      throw new Error(releaseNote(result.reason || "We could not fulfil your order"));
    case "in_progress":
      res.status(409);
      throw new Error("Your payment is still being confirmed. Check your orders in a minute before paying again.");
    case "not_paid":
      res.status(400);
      throw new Error("Payment was not successful. No order was placed.");
    default:
      res.status(400);
      throw new Error("Payment details did not match this checkout. No order was placed.");
  }
}

export async function verifyRazorpayPayment(req, res) {
  requireRazorpay(res);
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};
  if (
    !isGatewayId("order", razorpayOrderId)
    || !isGatewayId("pay", razorpayPaymentId)
    || !hasValidSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)
  ) {
    res.status(400);
    throw new Error("Payment could not be verified. No order was placed.");
  }

  const attempt = await PaymentAttempt.findOne({ razorpayOrderId, user: req.user.id });
  if (!attempt) {
    res.status(400);
    throw new Error("This payment does not match an active checkout.");
  }

  try {
    const payment = await fetchPayment(razorpayPaymentId);
    let result = await finalizePayment(attempt._id, payment, { signature: razorpaySignature, source: "browser verify" });
    if (result.outcome === "in_progress") result = await waitForSettlement(attempt._id);
    return sendOutcome(res, result);
  } catch (error) {
    if (res.statusCode >= 400 && res.statusCode !== 502) throw error;
    throw toHttpError(res, error);
  }
}

// Lets the browser find out what happened to a checkout even if the verify call never completed.
export async function razorpayPaymentStatus(req, res) {
  requireRazorpay(res);
  const { razorpayOrderId } = req.params;
  if (!isGatewayId("order", razorpayOrderId)) {
    res.status(400);
    throw new Error("That payment reference is not valid.");
  }
  const attempt = await PaymentAttempt.findOne({ razorpayOrderId, user: req.user.id });
  if (!attempt) {
    res.status(404);
    throw new Error("No checkout found for this payment.");
  }

  let result = await readSettlement(attempt);
  if (!result) {
    try {
      result = await syncAttempt(attempt, "status check");
    } catch {
      result = { outcome: "in_progress" };
    }
  }

  if (result.outcome === "completed" && result.order) return res.json({ status: "completed", order: orderSummary(result.order) });
  if (result.outcome === "refunded") return res.json({ status: "refunded", message: refundNote(result.reason || "We could not fulfil your order") });
  if (result.outcome === "released") return res.json({ status: "released", message: releaseNote(result.reason || "We could not fulfil your order") });
  res.json({ status: "pending" });
}
