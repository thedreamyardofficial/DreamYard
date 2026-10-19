import { createHmac, timingSafeEqual } from "node:crypto";
import Order from "../models/Order.js";
import PaymentAttempt from "../models/PaymentAttempt.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import { env } from "../config/env.js";
import { razorpay } from "../config/razorpay.js";

export const paymentConfig = (_req, res) => res.json({ enabled: env.razorpayEnabled, keyId: env.razorpayKeyId });

async function prepareOrder(res, userId, addressId, items) {
  if (!addressId || !Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error("Select a delivery address and add at least one item.");
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
    const qty = Math.min(10, Math.max(1, Number(i.qty) || 1));
    return { product: p._id, name: p.name, size: String(i.size || ""), qty, price: p.price };
  });

  const total = orderItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const customer = address.toObject();
  delete customer._id;
  delete customer.createdAt;
  delete customer.updatedAt;
  return { account, customer, orderItems, total };
}

async function reserveStock(items, res) {
  const reserved = [];
  for (const item of items) {
    const { modifiedCount } = await Product.updateOne(
      { _id: item.product, stock: { $gte: item.qty } },
      { $inc: { stock: -item.qty } }
    );
    if (!modifiedCount) {
      await Promise.all(reserved.map((reservedItem) =>
        Product.updateOne({ _id: reservedItem.product }, { $inc: { stock: reservedItem.qty } })
      ));
      res.status(400);
      throw new Error(`${item.name} doesn't have enough stock for your order.`);
    }
    reserved.push(item);
  }
  return reserved;
}

async function releaseStock(items) {
  await Promise.all(items.map((item) => Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty } })));
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

export async function createRazorpayOrder(req, res) {
  if (!env.razorpayEnabled || !razorpay) {
    res.status(404);
    throw new Error("Online payments are not enabled.");
  }
  const { addressId, items } = req.body || {};
  const { account, customer, orderItems, total } = await prepareOrder(res, req.user.id, addressId, items);
  const amount = Math.round(total * 100);
  if (amount <= 0) {
    res.status(400);
    throw new Error("This order cannot be paid online.");
  }

  const gatewayOrder = await razorpay.orders.create({
    amount,
    currency: "INR",
    receipt: `dy_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
  });
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

function hasValidSignature(orderId, paymentId, signature) {
  if (typeof signature !== "string" || !/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", env.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function verifyRazorpayPayment(req, res) {
  if (!env.razorpayEnabled || !razorpay) {
    res.status(404);
    throw new Error("Online payments are not enabled.");
  }
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};
  if (!razorpayOrderId || !razorpayPaymentId || !hasValidSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
    res.status(400);
    throw new Error("Payment could not be verified. No order was placed.");
  }

  const attempt = await PaymentAttempt.findOne({ razorpayOrderId, user: req.user.id });
  if (!attempt) {
    res.status(400);
    throw new Error("This payment does not match an active checkout.");
  }
  const existingOrder = await Order.findOne({ razorpayPaymentId });
  if (existingOrder) {
    attempt.status = "completed";
    attempt.completedOrder = existingOrder._id;
    await attempt.save();
    return res.json({ _id: existingOrder._id, total: existingOrder.total, customer: { name: existingOrder.customer.name } });
  }
  if (attempt.status === "completed") {
    const order = await Order.findById(attempt.completedOrder);
    if (order) return res.json({ _id: order._id, total: order.total, customer: { name: order.customer.name } });
  }

  const payment = await razorpay.payments.fetch(razorpayPaymentId);
  if (
    payment.order_id !== razorpayOrderId
    || payment.amount !== Math.round(attempt.total * 100)
    || payment.currency !== "INR"
  ) {
    res.status(400);
    throw new Error("Payment details did not match this checkout. No order was placed.");
  }
  if (!["authorized", "captured"].includes(payment.status)) {
    res.status(400);
    throw new Error("Payment was not successful. No order was placed.");
  }

  const claimedAttempt = await PaymentAttempt.findOneAndUpdate(
    { _id: attempt._id, status: "pending" },
    { $set: { status: "processing" } },
    { new: true }
  );
  if (!claimedAttempt) {
    res.status(409);
    throw new Error("This payment is already being finalized. Please retry in a moment.");
  }

  let reserved = [];
  let order;
  try {
    reserved = await reserveStock(attempt.items);
    const capturedPayment = payment.status === "authorized"
      ? await razorpay.payments.capture(payment.id, payment.amount, payment.currency)
      : payment;
    if (capturedPayment.status !== "captured") throw new Error("Payment capture did not complete. Please try again.");

    order = await Order.create({
      user: attempt.user,
      customer: attempt.customer,
      items: attempt.items,
      total: attempt.total,
      paymentMethod: "razorpay",
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      razorpayMethod: capturedPayment.method,
      paymentAmount: capturedPayment.amount,
      paymentCurrency: capturedPayment.currency,
    });
    attempt.status = "completed";
    attempt.completedOrder = order._id;
    await attempt.save();
  } catch (error) {
    if (reserved.length && !order) await releaseStock(reserved);
    if (!order) {
      attempt.status = "pending";
      await attempt.save();
    }
    throw error;
  }

  res.status(201).json({ _id: order._id, total: order.total, customer: { name: order.customer.name } });
}
