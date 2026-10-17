import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import { deleteFromCloudinary } from "../../config/cloudinary.js";
import { uniqueSlug } from "../../utils/slugify.js";

const parseSizes = (v) => {
  const list = Array.isArray(v) ? v : String(v || "").split(",");
  const clean = list.map((s) => String(s).trim()).filter(Boolean);
  return clean.length ? clean : ["Free"];
};

async function buildFields(body, res) {
  const fields = {
    name: body.name?.trim(),
    category: body.category,
    price: Number(body.price),
    fabric: body.fabric?.trim() || "",
    description: body.description?.trim() || "",
    sizes: parseSizes(body.sizes),
    image: body.image?.trim() || "",
    stock: Math.max(0, Math.floor(Number(body.stock) || 0)),
    featured: Boolean(body.featured),
    published: body.published !== false,
  };
  if (!fields.name) { res.status(400); throw new Error("Give the product a name."); }
  if (!Number.isFinite(fields.price) || fields.price < 0) { res.status(400); throw new Error("Enter a valid price."); }
  if (!(await Category.exists({ slug: fields.category }))) {
    res.status(400);
    throw new Error("Choose a section for this product. Create sections first if you have none.");
  }
  return fields;
}

export const listAll = async (_req, res) => res.json(await Product.find().sort({ createdAt: -1 }));

export async function create(req, res) {
  const fields = await buildFields(req.body, res);
  const product = await Product.create({ ...fields, slug: await uniqueSlug(Product, fields.name) });
  res.status(201).json(product);
}

export async function update(req, res) {
  const fields = await buildFields(req.body, res);
  const product = await Product.findByIdAndUpdate(req.params.id, fields, { new: true, runValidators: true });
  if (!product) { res.status(404); throw new Error("Product not found."); }
  res.json(product);
}

export async function remove(req, res) {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error("Product not found."); }

  if (product.image) {
    await deleteFromCloudinary(product.image);
  }

  await Product.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}
