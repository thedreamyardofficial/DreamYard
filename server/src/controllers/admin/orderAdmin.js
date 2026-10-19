import Order from "../../models/Order.js";
import Product from "../../models/Product.js";

const STATUSES = ["placed", "shipped", "delivered", "cancelled"];

export const list = async (_req, res) => res.json(await Order.find().sort({ createdAt: -1 }).limit(500));

export async function setStatus(req, res) {
  const { status, cancellationReason } = req.body || {};
  if (!STATUSES.includes(status)) { res.status(400); throw new Error("Unknown order status."); }
  const reason = typeof cancellationReason === "string" ? cancellationReason.trim() : "";
  if (status === "cancelled" && !reason) {
    res.status(400);
    throw new Error("Enter a reason for cancelling this order.");
  }
  if (reason.length > 500) {
    res.status(400);
    throw new Error("Cancellation reasons must be 500 characters or fewer.");
  }

  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error("Order not found."); }

  if (order.status !== "cancelled" && status === "cancelled") {
    await Promise.all(order.items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { stock: i.qty } })));
  } else if (order.status === "cancelled" && status !== "cancelled") {
    const reserved = [];
    for (const item of order.items) {
      const result = await Product.updateOne(
        { _id: item.product, stock: { $gte: item.qty } },
        { $inc: { stock: -item.qty } }
      );
      if (!result.modifiedCount) {
        await Promise.all(reserved.map((reservedItem) =>
          Product.updateOne({ _id: reservedItem.product }, { $inc: { stock: reservedItem.qty } })
        ));
        res.status(400);
        throw new Error(`Not enough stock to reopen this order (${item.name}).`);
      }
      reserved.push(item);
    }
  }

  order.status = status;
  order.cancellationReason = status === "cancelled" ? reason : "";
  await order.save();
  res.json(order);
}

export async function remove(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error("Order not found."); }

  if (order.status !== "cancelled") {
    await Promise.all(order.items.map((item) =>
      Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty } })
    ));
  }

  await Order.findByIdAndDelete(order._id);
  res.json({ ok: true });
}
