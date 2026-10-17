import { useEffect, useState } from "react";
import { adminApi } from "../adminApi.js";
import { rupees, imgSrc } from "../../api/client.js";
import ProductForm from "../ProductForm.jsx";

export default function ProductsAdmin() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null); // null | "new" | product
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const load = () =>
    Promise.all([adminApi.products(), adminApi.categories()])
      .then(([p, c]) => { setProducts(p); setCategories(c); })
      .catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const sectionName = (slug) => categories.find((c) => c.slug === slug)?.name || slug;

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This can't be undone.`)) return;
    try { await adminApi.deleteProduct(p._id); load(); } catch (e) { setError(e.message); }
  };

  const toggle = async (p) => {
    try { await adminApi.saveProduct(p._id, { ...p, published: !p.published }); load(); } catch (e) { setError(e.message); }
  };

  const shown = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="adm__row-head">
        <h1 className="adm__title">Products</h1>
        <button className="a-btn a-btn--primary" onClick={() => setEditing("new")}>Add product</button>
      </div>
      {error && <p className="notice notice--error">{error}</p>}

      <div className="adm__card">
        <input className="field adm__search" placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
        {shown.length === 0 ? (
          <p className="adm__muted">No products yet. Add your first one.</p>
        ) : (
          <div className="adm__scroll">
            <table className="adm__table">
              <thead><tr><th></th><th>Name</th><th>Section</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p._id}>
                    <td>{p.image ? <img className="adm__thumb" src={imgSrc(p.image)} alt="" /> : <div className="adm__thumb" />}</td>
                    <td><strong>{p.name}</strong>{p.featured && <span className="badge badge--featured">Featured</span>}</td>
                    <td>{sectionName(p.category)}</td>
                    <td>{rupees(p.price)}</td>
                    <td className={p.stock <= 5 ? "low" : ""}>{p.stock}</td>
                    <td><span className={`badge ${p.published ? "badge--delivered" : "badge--cancelled"}`}>{p.published ? "Live" : "Hidden"}</span></td>
                    <td className="adm__actions">
                      <button className="link-btn" onClick={() => setEditing(p)}>Edit</button>
                      <button className="link-btn" onClick={() => toggle(p)}>{p.published ? "Hide" : "Show"}</button>
                      <button className="link-btn danger" onClick={() => remove(p)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          categories={categories}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}
