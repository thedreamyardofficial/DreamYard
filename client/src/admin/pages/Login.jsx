import Logo from "../../components/Logo.jsx";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ADMIN_BASE } from "../../config.js";
import { adminApi, tokenStore } from "../adminApi.js";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", remember: true });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { token } = await adminApi.login(form.email, form.password, form.remember);
      tokenStore.set(token, form.remember);
      navigate(ADMIN_BASE, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm__login">
      <div className="lockup adm__login-brand" aria-label="the dream yard store">
        <span className="lockup__the">the</span>
        <Logo variant="word" />
        <span className="lockup__store">store</span>
      </div>
      <form onSubmit={submit} className="adm__card adm__login-card">
        <h1>Admin sign in</h1>
        <label className="label">Email
          <input className="field" type="email" required autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="label">Password
          <input className="field" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={form.remember} onChange={(e) => setForm({ ...form, remember: e.target.checked })} />
          Remember me
        </label>
        {error && <p className="notice notice--error">{error}</p>}
        <button className="a-btn a-btn--primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
