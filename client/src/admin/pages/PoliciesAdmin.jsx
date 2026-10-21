import { useEffect, useState } from "react";
import { api } from "../../api/client.js";
import { adminApi } from "../adminApi.js";

const POLICY_FIELDS = [
  ["termsContent", "Terms and Conditions"],
  ["privacyContent", "Privacy Policy"],
  ["shippingReturnsContent", "Shipping, Returns and Refunds"],
  ["contactGrievanceContent", "Contact and Grievance Officer"],
];

export default function PoliciesAdmin() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.settings().then(setSettings).catch((loadError) => setError(loadError.message));
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setSettings(await adminApi.saveSettings(settings));
      setMessage("Legal pages saved.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  };

  if (!settings) return error ? <p className="notice notice--error">{error}</p> : <p className="adm__muted">Loading legal pages...</p>;

  return (
    <>
      <h1 className="adm__title">Legal pages</h1>
      <p className="adm__muted">Edit the content shown on the public policy pages. Replace bracketed placeholders and have legal wording reviewed before publishing.</p>
      <form className="adm__card adm__policy-form" onSubmit={save}>
        {POLICY_FIELDS.map(([key, label]) => (
          <label key={key} className="label adm__policy-field">{label}
            <textarea
              className="field"
              rows="14"
              maxLength="20000"
              value={settings[key] || ""}
              onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.value }))}
            />
          </label>
        ))}
        {error && <p className="notice notice--error" role="alert">{error}</p>}
        {message && <p className="notice" role="status">{message}</p>}
        <button className="a-btn a-btn--primary" disabled={busy}>{busy ? "Saving..." : "Save legal pages"}</button>
      </form>
    </>
  );
}