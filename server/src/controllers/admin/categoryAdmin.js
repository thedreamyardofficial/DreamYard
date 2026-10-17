import Category from "../../models/Category.js";
import Product from "../../models/Product.js";
import { uniqueSlug } from "../../utils/slugify.js";

export const list = async (_req, res) => res.json(await Category.find().sort({ order: 1, name: 1 }));

export async function create(req, res) {
  const name = req.body?.name?.trim();
  if (!name) { res.status(400); throw new Error("Give the section a name."); }
  const order = await Category.countDocuments();
  res.status(201).json(await Category.create({ name, slug: await uniqueSlug(Category, name), order }));
}

export async function update(req, res) {
  const name = req.body?.name?.trim();
  if (!name) { res.status(400); throw new Error("Give the section a name."); }
  const patch = { name };
  if (Number.isFinite(Number(req.body.order))) patch.order = Number(req.body.order);
  const cat = await Category.findByIdAndUpdate(req.params.id, patch, { new: true });
  if (!cat) { res.status(404); throw new Error("Section not found."); }
  res.json(cat);
}

export async function remove(req, res) {
  const cat = await Category.findById(req.params.id);
  if (!cat) { res.status(404); throw new Error("Section not found."); }
  const inUse = await Product.countDocuments({ category: cat.slug });
  if (inUse) {
    res.status(400);
    throw new Error(`Move or delete the ${inUse} product${inUse > 1 ? "s" : ""} in this section first.`);
  }
  await cat.deleteOne();
  res.json({ ok: true });
}
