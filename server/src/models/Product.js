import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    category: { type: String, required: true, index: true }, // Category slug
    price: { type: Number, required: true, min: 0 },
    fabric: { type: String, default: "" },
    description: { type: String, default: "" },
    sizes: { type: [String], default: ["S", "M", "L", "XL"] },
    image: { type: String, default: "" }, // URL or /uploads/... path
    stock: { type: Number, default: 0, min: 0 },
    featured: { type: Boolean, default: false },
    published: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
