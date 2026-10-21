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
  const inputImages = Array.isArray(body.images) && body.images.length
    ? body.images
    : body.image
    ? [body.image]
    : [];
  const images = [...new Set(inputImages.map((image) => typeof image === "string" ? image.trim() : "").filter(Boolean))];
  if (images.length < 1 || images.length > 10) {
    res.status(400);
    throw new Error("Add between 1 and 10 product images.");
  }
  const fields = {
    name: body.name?.trim(),
    category: body.category,
    price: Number(body.price),
    fabric: body.fabric?.trim() || "",
    description: body.description?.trim() || "",
    sizes: parseSizes(body.sizes),
    image: images[0],
    images,
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
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error("Product not found."); }
  const previousImages = [...new Set([product.image, ...(product.images || [])].filter(Boolean))];
  Object.assign(product, fields);
  await product.save();
  const removedImages = previousImages.filter((image) => !fields.images.includes(image));
  await Promise.all(removedImages.map(deleteFromCloudinary));
  res.json(product);
}

export async function remove(req, res) {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error("Product not found."); }

  const images = [...new Set([product.image, ...(product.images || [])].filter(Boolean))];
  await Promise.all(images.map(deleteFromCloudinary));

  await Product.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}
