import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ADMIN_BASE } from "../../config.js";
import { adminApi, tokenStore } from "../adminApi.js";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { token } = await adminApi.login(form.email, form.password);
      tokenStore.set(token);
      navigate(ADMIN_BASE, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm__login">
      <form onSubmit={submit} className="adm__card adm__login-card">
        <h1>Admin sign in</h1>
        <label className="label">Email
          <input className="field" type="email" required autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="label">Password
          <input className="field" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        {error && <p className="notice notice--error">{error}</p>}
        <button className="a-btn a-btn--primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
