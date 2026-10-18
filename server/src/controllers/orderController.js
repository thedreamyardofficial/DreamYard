import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

export async function createOrder(req, res) {
  const { addressId, items } = req.body || {};
  if (!addressId || !Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error("Select a delivery address and add at least one item.");
  }
  const account = await User.findById(req.user.id);
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
  const customer = address.toObject();
  delete customer._id;
  delete customer.createdAt;
  delete customer.updatedAt;
  const order = await Order.create({ user: account._id, customer, items: orderItems, total });
  res.status(201).json({ _id: order._id, total: order.total, customer: { name: order.customer.name } });
}
