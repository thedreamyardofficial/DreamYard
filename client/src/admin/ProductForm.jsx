import { useState } from "react";
import { adminApi } from "./adminApi.js";
import { imgSrc } from "../api/client.js";

const blank = (categories) => ({
  name: "", category: categories[0]?.slug || "", price: "", stock: 10, fabric: "",
  sizes: "S, M, L, XL", description: "", image: "", featured: false, published: true,
});

export default function ProductForm({ product, categories, onSaved, onCancel }) {
  const [form, setForm] = useState(
    product ? { ...product, sizes: product.sizes.join(", ") } : blank(categories)
  );
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { url } = await adminApi.upload(file);
      setForm((f) => ({ ...f, image: url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await adminApi.saveProduct(product?._id, form);
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={product ? "Edit product" : "Add product"}>
      <form className="modal__panel" onSubmit={submit}>
        <div className="adm__row-head">
          <h2>{product ? "Edit product" : "Add product"}</h2>
          <button type="button" className="link-btn" onClick={onCancel}>Close</button>
        </div>

        <div className="form-grid">
          <label className="label span-2">Product name
            <input className="field" required value={form.name} onChange={set("name")} />
          </label>
          <label className="label">Section
            <select className="field" required value={form.category} onChange={set("category")}>
              {categories.length === 0 && <option value="">Create a section first</option>}
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
          <label className="label">Fabric
            <input className="field" value={form.fabric} onChange={set("fabric")} placeholder="Handloom cotton" />
          </label>
          <label className="label">Price (₹)
            <input className="field" type="number" min="0" required value={form.price} onChange={set("price")} />
          </label>
          <label className="label">Stock
            <input className="field" type="number" min="0" required value={form.stock} onChange={set("stock")} />
          </label>
          <label className="label span-2">Sizes (comma separated)
            <input className="field" value={form.sizes} onChange={set("sizes")} />
          </label>
          <label className="label span-2">Description
            <textarea className="field" rows="4" value={form.description} onChange={set("description")} />
          </label>

          <div className="span-2 imgbox">
            <div className="imgbox__preview">
              {form.image ? <img src={imgSrc(form.image)} alt="Preview" /> : <span className="adm__muted">No image</span>}
            </div>
            <div className="imgbox__controls">
              <label className="a-btn">
                {uploading ? "Uploading…" : "Upload image"}
                <input type="file" accept="image/*" hidden onChange={onFile} />
              </label>
              <input className="field" placeholder="…or paste an image URL" value={form.image} onChange={set("image")} />
            </div>
          </div>

          <label className="check"><input type="checkbox" checked={form.published} onChange={set("published")} /> Visible in the store</label>
          <label className="check"><input type="checkbox" checked={form.featured} onChange={set("featured")} /> Show on the home page</label>
        </div>

        {error && <p className="notice notice--error">{error}</p>}
        <div className="modal__actions">
          <button type="button" className="a-btn" onClick={onCancel}>Cancel</button>
          <button className="a-btn a-btn--primary" disabled={busy || uploading}>{busy ? "Saving…" : "Save product"}</button>
        </div>
      </form>
    </div>
  );
}
