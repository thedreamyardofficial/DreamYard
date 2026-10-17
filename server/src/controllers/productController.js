import Product from "../models/Product.js";

const SORTS = { newest: { createdAt: -1 }, "price-asc": { price: 1 }, "price-desc": { price: -1 } };
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function listProducts(req, res) {
  const { category, q, sort = "newest", featured } = req.query;
  const filter = { published: true };
  if (category) filter.category = String(category);
  if (featured === "true") filter.featured = true;
  if (q) filter.name = { $regex: escapeRegex(String(q).trim()), $options: "i" };
  res.json(await Product.find(filter).sort(SORTS[sort] || SORTS.newest));
}

export async function getProduct(req, res) {
  const product = await Product.findOne({ slug: req.params.slug, published: true });
  if (!product) {
    res.status(404);
    throw new Error("We couldn't find that product.");
  }
  res.json(product);
}
