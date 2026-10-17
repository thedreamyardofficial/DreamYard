import Order from "../../models/Order.js";
import Product from "../../models/Product.js";

const STATUSES = ["placed", "shipped", "delivered", "cancelled"];

export const list = async (_req, res) => res.json(await Order.find().sort({ createdAt: -1 }).limit(500));

export async function setStatus(req, res) {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) { res.status(400); throw new Error("Unknown order status."); }
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error("Order not found."); }
  if (order.status === "cancelled") { res.status(400); throw new Error("Cancelled orders can't be changed."); }

  if (status === "cancelled") {
    // Put the stock back
    await Promise.all(order.items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { stock: i.qty } })));
  }
  order.status = status;
  await order.save();
  res.json(order);
}

export async function remove(req, res) {
  const order = await Order.findByIdAndDelete(req.params.id);
  if (!order) { res.status(404); throw new Error("Order not found."); }
  res.json({ ok: true });
}
