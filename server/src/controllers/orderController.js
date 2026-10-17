import Order from "../models/Order.js";
import Product from "../models/Product.js";

export async function createOrder(req, res) {
  const { customer: c, items } = req.body || {};
  if (!c || !Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error("Add at least one item and your delivery details.");
  }
  const bad =
    !c.name?.trim() || !/^\S+@\S+\.\S+$/.test(c.email || "") ||
    !/^[0-9+\-\s]{8,15}$/.test(c.phone || "") || !c.address?.trim() ||
    !c.city?.trim() || !/^[0-9]{6}$/.test(c.pincode || "");
  if (bad) {
    res.status(400);
    throw new Error("Check your delivery details: a valid email, 8-15 digit phone and 6-digit pincode are required.");
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

  // Take stock atomically; undo if any item can't be fulfilled
  const taken = [];
  for (const item of orderItems) {
    const { modifiedCount } = await Product.updateOne(
      { _id: item.product, stock: { $gte: item.qty } },
      { $inc: { stock: -item.qty } }
    );
    if (!modifiedCount) {
      await Promise.all(taken.map((t) => Product.updateOne({ _id: t.product }, { $inc: { stock: t.qty } })));
      res.status(400);
      throw new Error(`${item.name} doesn't have enough stock for your order.`);
    }
    taken.push(item);
  }

  const total = orderItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const order = await Order.create({ customer: c, items: orderItems, total });
  res.status(201).json({ _id: order._id, total: order.total, customer: { name: order.customer.name } });
}
