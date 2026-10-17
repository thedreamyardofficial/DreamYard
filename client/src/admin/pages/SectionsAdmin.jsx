import { useEffect, useState } from "react";
import { adminApi } from "../adminApi.js";

export default function SectionsAdmin() {
  const [sections, setSections] = useState([]);
  const [counts, setCounts] = useState({});
  const [name, setName] = useState("");
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState("");

  const load = () =>
    Promise.all([adminApi.categories(), adminApi.products()])
      .then(([c, p]) => {
        setSections(c);
        setCounts(p.reduce((m, x) => ({ ...m, [x.category]: (m[x.category] || 0) + 1 }), {}));
        setDrafts({});
      })
      .catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const run = async (fn) => {
    setError("");
    try { await fn(); await load(); } catch (e) { setError(e.message); }
  };

  const add = (e) => {
    e.preventDefault();
    run(async () => { await adminApi.saveCategory(null, { name }); setName(""); });
  };

  return (
    <>
      <h1 className="adm__title">Sections</h1>
      <p className="adm__muted">Sections are the groups shoppers see in the menu and filters, such as Sarees or Shirts.</p>
      {error && <p className="notice notice--error">{error}</p>}

      <div className="adm__card">
        <form className="adm__inline" onSubmit={add}>
          <input className="field" required placeholder="New section name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="a-btn a-btn--primary">Add section</button>
        </form>

        <table className="adm__table">
          <thead><tr><th>Name</th><th>Order</th><th>Products</th><th></th></tr></thead>
          <tbody>
            {sections.map((s) => {
              const d = drafts[s._id] || {};
              const dirty = (d.name ?? s.name) !== s.name || Number(d.order ?? s.order) !== s.order;
              return (
                <tr key={s._id}>
                  <td><input className="field" value={d.name ?? s.name} onChange={(e) => setDrafts({ ...drafts, [s._id]: { ...d, name: e.target.value } })} /></td>
                  <td><input className="field adm__num" type="number" value={d.order ?? s.order} onChange={(e) => setDrafts({ ...drafts, [s._id]: { ...d, order: e.target.value } })} /></td>
                  <td>{counts[s.slug] || 0}</td>
                  <td className="adm__actions">
                    {dirty && <button className="link-btn" onClick={() => run(() => adminApi.saveCategory(s._id, { name: d.name ?? s.name, order: d.order ?? s.order }))}>Save</button>}
                    <button className="link-btn danger" onClick={() => window.confirm(`Delete "${s.name}"?`) && run(() => adminApi.deleteCategory(s._id))}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sections.length === 0 && <p className="adm__muted">No sections yet. Add one above, then you can add products to it.</p>}
      </div>
    </>
  );
}
