import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import { uploadToCloudinary } from "../../config/cloudinary.js";

export async function stats(_req, res) {
  const [products, hidden, lowStock, sections, orders, revenueAgg, recent] = await Promise.all([
    Product.countDocuments(),
    Product.countDocuments({ published: false }),
    Product.countDocuments({ stock: { $lte: 5 } }),
    Category.countDocuments(),
    Order.countDocuments(),
    Order.aggregate([{ $match: { status: { $ne: "cancelled" } } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
    Order.find().sort({ createdAt: -1 }).limit(5),
  ]);
  const newOrders = await Order.countDocuments({ status: "placed" });
  res.json({ products, hidden, lowStock, sections, orders, newOrders, revenue: revenueAgg[0]?.total || 0, recent });
}

export const upload = async (req, res) => {
  if (!req.file) { res.status(400); throw new Error("Choose an image to upload."); }

  const url = await uploadToCloudinary(req.file.buffer, req.file.originalname);
  res.status(201).json({ url });
};
