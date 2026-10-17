import mongoose from "mongoose";

// One document that holds the editable site-wide content
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "site", unique: true },
    storeName: { type: String, default: "DreamYard" },
    announcement: { type: String, default: "Free delivery across India on orders above ₹2,000" },
    heroTitle: { type: String, default: "Cloth that remembers the loom." },
    heroSubtitle: {
      type: String,
      default: "Handloom cotton, linen and khadi, cut into clothes you'll wear for years.",
    },
    footerNote: { type: String, default: "Easy 7-day returns on unworn pieces." },
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Settings", settingsSchema);
