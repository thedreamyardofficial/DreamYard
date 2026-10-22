import { useState } from "react";
import { adminApi } from "./adminApi.js";
import { imgSrc, rupees } from "../api/client.js";

const MAX_IMAGES = 10;

const blank = (categories) => ({
  name: "", category: categories[0]?.slug || "", price: "", stock: 10, fabric: "",
  sizes: "S, M, L, XL", description: "", image: "", images: [], featured: false, published: true,
});

function initialForm(product, categories) {
  if (!product) return blank(categories);
  const currentImages = Array.isArray(product.images) && product.images.length ? product.images : [product.image];
  const images = [...new Set(currentImages.filter((image) => typeof image === "string" && image.trim()))];
  return { ...product, image: images[0] || "", images, sizes: product.sizes.join(", ") };
}

export default function ProductForm({ product, categories, onSaved, onCancel }) {
  const [form, setForm] = useState(() => initialForm(product, categories));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [preview, setPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(0);
  const [error, setError] = useState("");

  const set = (key) => (event) => setForm((current) => ({
    ...current,
    [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value,
  }));
  const setImages = (images) => setForm((current) => ({ ...current, images, image: images[0] || "" }));

  const onFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const remaining = MAX_IMAGES - form.images.length;
    if (files.length > remaining) {
      setError(`You can add ${remaining} more image${remaining === 1 ? "" : "s"}. The limit is ${MAX_IMAGES}.`);
      return;
    }

    setUploading(true);
    setError("");
    try {
      const uploadedImages = [...form.images];
      for (const file of files) {
        const { url } = await adminApi.upload(file);
        uploadedImages.push(url);
        setImages([...uploadedImages]);
      }
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
    }
  };

  const addImageUrl = () => {
    const value = imageUrl.trim();
    if (form.images.length >= MAX_IMAGES) {
      setError(`A product can have up to ${MAX_IMAGES} images.`);
      return;
    }
    try {
      const parsed = new URL(value);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      if (form.images.includes(value)) {
        setError("That image URL has already been added.");
        return;
      }
      setImages([...form.images, value]);
      setImageUrl("");
      setError("");
    } catch {
      setError("Enter a valid image URL starting with https:// or http://.");
    }
  };

  const moveImage = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= form.images.length) return;
    const images = [...form.images];
    [images[index], images[target]] = [images[target], images[index]];
    setImages(images);
    setPreviewImage(target);
  };

  const removeImage = (index) => {
    const images = form.images.filter((_, currentIndex) => currentIndex !== index);
    setImages(images);
    setPreviewImage(Math.max(0, Math.min(previewImage, images.length - 1)));
  };

  const saveProduct = async () => {
    if (form.images.length < 1 || form.images.length > MAX_IMAGES) {
      setError(`Add between 1 and ${MAX_IMAGES} images before saving.`);
      setPreview(false);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await adminApi.saveProduct(product?._id, { ...form, image: form.images[0], images: form.images });
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
      setPreview(false);
      setBusy(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (preview) return;
    void saveProduct();
  };

  const sizes = String(form.sizes || "").split(",").map((value) => value.trim()).filter(Boolean);
  const selectedCategory = categories.find((category) => category.slug === form.category)?.name || form.category || "Section";

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={product ? "Edit product" : "Add product"}>
      <form className={`modal__panel product-editor${preview ? " product-editor--preview" : ""}`} onSubmit={submit}>
        <div className="adm__row-head">
          <h2>{preview ? "Product page preview" : product ? "Edit product" : "Add product"}</h2>
          <button type="button" className="link-btn" onClick={onCancel}>Close</button>
        </div>

        {preview ? (
          <>
            <div className="product-preview">
              <div className="product-preview__gallery">
                <div className="product-preview__main">
                  {form.images[previewImage]
                    ? <img src={imgSrc(form.images[previewImage])} alt={form.name || "Product preview"} />
                    : <div className="card__ph" />}
                </div>
                {form.images.length > 1 && (
                  <div className="product-preview__thumbs">
                    {form.images.map((image, index) => (
                      <button
                        className={`product-preview__thumb${previewImage === index ? " is-active" : ""}`}
                        type="button"
                        key={`${image}-${index}`}
                        onClick={() => setPreviewImage(index)}
                        aria-label={`Show product image ${index + 1}`}
                      ><img src={imgSrc(image)} alt="" /></button>
                    ))}
                  </div>
                )}
              </div>
              <div className="product-preview__info">
                <p className="product-preview__category">{selectedCategory}</p>
                <h3>{form.name || "Product name"}</h3>
                <p className="product-preview__price">{form.price === "" ? "₹0" : rupees(form.price)}</p>
                {form.fabric && <p className="product__fabric">{form.fabric}</p>}
                {form.description && <p className="product__desc">{form.description}</p>}
                <fieldset className="sizes"><legend>Size</legend>
                  {sizes.length ? sizes.map((size, index) => <span className={`pill${index === 0 ? " is-active" : ""}`} key={`${size}-${index}`}>{size}</span>) : <span className="adm__muted">No sizes added</span>}
                </fieldset>
                <button className="btn btn--solid" type="button" disabled={Number(form.stock) === 0}>
                  {Number(form.stock) === 0 ? "Sold out" : "Add to bag"}
                </button>
                {Number(form.stock) > 0 && Number(form.stock) < 6 && <p className="notice">Only {form.stock} left.</p>}
                {!form.published && <p className="notice">This product is hidden from the store.</p>}
              </div>
            </div>
            {error && <p className="notice notice--error" role="alert">{error}</p>}
            <div className="modal__actions">
              <button type="button" className="a-btn" onClick={() => setPreview(false)}>Back to editing</button>
              <button type="button" className="a-btn a-btn--primary" disabled={busy || uploading} onClick={() => void saveProduct()}>{busy ? "Saving…" : "Save product"}</button>
            </div>
          </>
        ) : (
          <>
            <div className="form-grid">
              <label className="label span-2">Product name
                <input className="field" required maxLength="160" value={form.name} onChange={set("name")} />
              </label>
              <label className="label">Section
                <select className="field" required value={form.category} onChange={set("category")}>
                  {categories.length === 0 && <option value="">Create a section first</option>}
                  {categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
                </select>
              </label>
              <label className="label">Fabric
                <input className="field" value={form.fabric} onChange={set("fabric")} placeholder="100% cotton" />
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

              <section className="span-2 product-image-editor" aria-label="Product images">
                <div className="adm__row-head">
                  <div><h3>Product images</h3><p className="adm__muted">Add 1–10 images. The first image is the main catalog image.</p></div>
                  <span>{form.images.length} / {MAX_IMAGES}</span>
                </div>
                <div className="product-image-editor__actions">
                  <label className={`a-btn${uploading || form.images.length >= MAX_IMAGES ? " is-disabled" : ""}`}>
                    {uploading ? "Uploading…" : "Upload images"}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden disabled={uploading || form.images.length >= MAX_IMAGES} onChange={onFiles} />
                  </label>
                  <label className="product-image-editor__url">
                    <span>Image URL</span>
                    <input className="field" type="url" placeholder="https://example.com/product-image.jpg" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
                  </label>
                  <button className="a-btn" type="button" disabled={!imageUrl.trim() || form.images.length >= MAX_IMAGES} onClick={addImageUrl}>Add URL</button>
                </div>
                {form.images.length ? (
                  <ol className="product-image-list">
                    {form.images.map((image, index) => (
                      <li className="product-image-item" key={`${image}-${index}`}>
                        <img src={imgSrc(image)} alt={`Product image ${index + 1}`} />
                        <div className="product-image-item__info">
                          <strong>{index === 0 ? "Main image" : `Image ${index + 1}`}</strong>
                          <span title={image}>{image}</span>
                        </div>
                        <div className="product-image-item__actions">
                          <button className="link-btn" type="button" disabled={index === 0} onClick={() => moveImage(index, -1)}>Move up</button>
                          <button className="link-btn" type="button" disabled={index === form.images.length - 1} onClick={() => moveImage(index, 1)}>Move down</button>
                          <button className="link-btn danger" type="button" onClick={() => removeImage(index)}>Remove</button>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : <p className="adm__muted">Add at least one product image to continue.</p>}
              </section>
              <label className="check"><input type="checkbox" checked={form.published} onChange={set("published")} /> Visible in the store</label>
              <label className="check"><input type="checkbox" checked={form.featured} onChange={set("featured")} /> Show on the home page</label>
            </div>
            {error && <p className="notice notice--error" role="alert">{error}</p>}
            <div className="modal__actions">
              <button type="button" className="a-btn" onClick={onCancel}>Cancel</button>
              <button type="button" className="a-btn" disabled={uploading || !form.images.length} onClick={() => { setPreviewImage(0); setPreview(true); }}>Preview product page</button>
              <button type="submit" className="a-btn a-btn--primary" disabled={busy || uploading || !form.images.length}>{busy ? "Saving…" : "Save product"}</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}