import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useSite } from "../context/SiteContext.jsx";
import ProductCard from "../components/ProductCard.jsx";

export default function Shop() {
  const { categories } = useSite();
  const [params, setParams] = useSearchParams();
  const category = params.get("category") || "";
  const sort = params.get("sort") || "newest";
  const urlQuery = params.get("q") || "";
  const [q, setQ] = useState(urlQuery);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next);
  };

  // Debounce the search box so we don't hit the API on every keystroke
  useEffect(() => {
    if (q.trim() === urlQuery) return;
    const t = setTimeout(() => update("q", q.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q]);

  useEffect(() => {
    setLoading(true);
    api
      .products({ category, sort, q: urlQuery })
      .then((data) => { setProducts(data); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [category, sort, urlQuery]);

  return (
    <div className="container section">
      <h1 className="page-title">Shop</h1>

      <div className="toolbar">
        <div className="pills" role="group" aria-label="Section">
          <button className={`pill ${!category ? "is-active" : ""}`} onClick={() => update("category", "")}>All</button>
          {categories.map((c) => (
            <button key={c.slug} className={`pill ${c.slug === category ? "is-active" : ""}`} onClick={() => update("category", c.slug)}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="toolbar__right">
          <input className="field" type="search" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
          <select className="field" value={sort} onChange={(e) => update("sort", e.target.value)} aria-label="Sort">
            <option value="newest">Newest</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </div>
      </div>

      {error && <p className="notice notice--error">{error}</p>}
      {loading ? (
        <div className="grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" />)}</div>
      ) : products.length === 0 ? (
        <p className="empty">Nothing matches that search. Try another name or choose All.</p>
      ) : (
        <div className="grid">{products.map((p) => <ProductCard key={p._id} product={p} />)}</div>
      )}
    </div>
  );
}
