import { useEffect, useRef, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext.jsx";

const EMPTY = { name: "", email: "", password: "" };
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default function AuthDialog() {
  const { authOpen, authMode, closeAuth, openAuth, signIn, register, googleSignIn } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [googleButtonWidth, setGoogleButtonWidth] = useState(320);
  const googleHostRef = useRef(null);
  const isRegistering = authMode === "register";

  useEffect(() => {
    if (!authOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeAuth();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [authOpen, closeAuth]);

  useEffect(() => {
    if (authOpen) {
      setForm(EMPTY);
      setError("");
    }
  }, [authOpen, authMode]);

  useEffect(() => {
    if (!authOpen || !GOOGLE_CLIENT_ID || !googleHostRef.current) return undefined;
    const host = googleHostRef.current;
    const resize = () => setGoogleButtonWidth(Math.max(200, Math.min(320, Math.floor(host.clientWidth))));
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    return () => observer.disconnect();
  }, [authOpen]);

  if (!authOpen) return null;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (isRegistering) await register(form);
      else await signIn({ email: form.email, password: form.password });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitGoogleCredential = async (credential) => {
    if (!credential) {
      setError("Google did not return a sign-in credential. Please try again.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await googleSignIn(credential);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAuth(); }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-dialog__close" type="button" onClick={closeAuth} aria-label="Close sign in">×</button>
        <p className="auth-dialog__eyebrow">DreamYard account</p>
        <h2 id="auth-title">{isRegistering ? "Create your account" : "Welcome back"}</h2>
        <form className="auth-form" onSubmit={submit}>
          {isRegistering && (
            <label className="label">Name
              <input className="field" autoComplete="name" maxLength="100" required value={form.name} onChange={update("name")} />
            </label>
          )}
          <label className="label">Email address
            <input className="field" type="email" autoComplete="email" maxLength="254" required value={form.email} onChange={update("email")} />
          </label>
          <label className="label">Password
            <input className="field" type="password" autoComplete={isRegistering ? "new-password" : "current-password"} minLength="8" maxLength="128" required value={form.password} onChange={update("password")} />
          </label>
          {error && <p className="notice notice--error" role="alert">{error}</p>}
          <button className="btn btn--solid btn--block" disabled={busy}>
            {busy ? "Please wait…" : isRegistering ? "Create account" : "Sign in"}
          </button>
        </form>
        <div className="auth-divider"><span>or continue with</span></div>
        <div className="auth-google" ref={googleHostRef}>
          {GOOGLE_CLIENT_ID ? (
            <GoogleLogin
              onSuccess={(response) => submitGoogleCredential(response.credential)}
              onError={() => setError("Google sign-in failed. Please try again.")}
              theme="outline"
              size="large"
              shape="rectangular"
              text="continue_with"
              logo_alignment="left"
              width={String(googleButtonWidth)}
            />
          ) : (
            <button className="auth-google-placeholder" type="button" disabled title="Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in">
              <span className="auth-google-mark" aria-hidden="true">G</span>
              Continue with Google
            </button>
          )}
        </div>
        <p className="auth-dialog__switch">
          {isRegistering ? "Already have an account?" : "New to DreamYard?"}{" "}
          <button className="link-btn" type="button" onClick={() => openAuth(isRegistering ? "login" : "register")}>
            {isRegistering ? "Sign in" : "Create an account"}
          </button>
        </p>
      </section>
    </div>
  );
}