import { useEffect, useState } from "react";
import { api } from "../../api/client.js";
import { adminApi } from "../adminApi.js";

const FIELDS = [
  ["storeName", "Store name", "input"],
  ["announcement", "Announcement bar (leave empty to hide)", "input"],
  ["heroTitle", "Home page headline", "input"],
  ["heroSubtitle", "Home page sub-headline", "textarea"],
  ["footerNote", "Footer note", "input"],
  ["contactEmail", "Contact email", "input"],
  ["contactPhone", "Contact phone", "input"],
];

export default function SettingsAdmin() {
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.settings().then(setForm).catch((e) => setError(e.message)); }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setError("");
    try {
      setForm(await adminApi.saveSettings(form));
      setMsg("Saved. Reload the store to see the changes.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!form) return error ? <p className="notice notice--error">{error}</p> : <p className="adm__muted">Loading…</p>;

  return (
    <>
      <h1 className="adm__title">Site settings</h1>
      <form className="adm__card adm__form" onSubmit={save}>
        {FIELDS.map(([key, label, type]) => (
          <label key={key} className="label">{label}
            {type === "textarea"
              ? <textarea className="field" rows="3" value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              : <input className="field" value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />}
          </label>
        ))}
        {error && <p className="notice notice--error">{error}</p>}
        {msg && <p className="notice">{msg}</p>}
        <button className="a-btn a-btn--primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
      </form>
    </>
  );
}
