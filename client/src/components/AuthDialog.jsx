import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext.jsx";

const EMPTY = { name: "", email: "", password: "" };
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default function AuthDialog() {
  const { authOpen, authMode, closeAuth, openAuth, signIn, register, googleSignIn } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [registerAgeConfirmed, setRegisterAgeConfirmed] = useState(false);
  const [registerPoliciesAccepted, setRegisterPoliciesAccepted] = useState(false);
  const [googleConsentOpen, setGoogleConsentOpen] = useState(false);
  const [googleAgeConfirmed, setGoogleAgeConfirmed] = useState(false);
  const [googlePoliciesAccepted, setGooglePoliciesAccepted] = useState(false);
  const [googleButtonWidth, setGoogleButtonWidth] = useState(320);
  const googleHostRef = useRef(null);
  const isRegistering = authMode === "register";

  useEffect(() => {
    if (!authOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (googleConsentOpen) setGoogleConsentOpen(false);
        else closeAuth();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [authOpen, closeAuth, googleConsentOpen]);

  useEffect(() => {
    if (authOpen) {
      setForm(EMPTY);
      setError("");
      setRegisterAgeConfirmed(false);
      setRegisterPoliciesAccepted(false);
      setGoogleConsentOpen(false);
      setGoogleAgeConfirmed(false);
      setGooglePoliciesAccepted(false);
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
    if (isRegistering && (!registerAgeConfirmed || !registerPoliciesAccepted)) {
      setError("Confirm your age and accept the Terms and Privacy Policy to create an account.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (isRegistering) {
        await register({ ...form, ageConfirmed: registerAgeConfirmed, acceptedPolicies: registerPoliciesAccepted });
      }
      else await signIn({ email: form.email, password: form.password });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitGoogleCredential = async (credential) => {
    if (!googleAgeConfirmed || !googlePoliciesAccepted) {
      setError("Confirm your age and accept the Terms and Privacy Policy to continue.");
      return;
    }
    if (!credential) {
      setError("Google did not return a sign-in credential. Please try again.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await googleSignIn({ credential });
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
          {isRegistering && (
            <>
              <label className="auth-consent">
                <input type="checkbox" required checked={registerAgeConfirmed} onChange={(event) => setRegisterAgeConfirmed(event.target.checked)} />
                <span>I confirm that I am at least 13 years old.</span>
              </label>
              <label className="auth-consent">
                <input type="checkbox" required checked={registerPoliciesAccepted} onChange={(event) => setRegisterPoliciesAccepted(event.target.checked)} />
                <span>By creating an account, I agree to the <Link to="/terms" target="_blank" rel="noreferrer">Terms and Conditions</Link> and <Link to="/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</Link>.</span>
              </label>
            </>
          )}
          {error && <p className="notice notice--error" role="alert">{error}</p>}
          <button className="btn btn--solid btn--block" disabled={busy}>
            {busy ? "Please wait…" : isRegistering ? "Create account" : "Sign in"}
          </button>
        </form>
        <div className="auth-divider"><span>or continue with</span></div>
        <div className="auth-google" ref={googleHostRef}>
          <button className="auth-google-button" type="button" onClick={() => { setGoogleConsentOpen(true); setError(""); }}>
            <span className="auth-google-mark" aria-hidden="true">G</span>
            Continue with Google
          </button>
        </div>
        <p className="auth-dialog__switch">
          {isRegistering ? "Already have an account?" : "New to DreamYard?"}{" "}
          <button className="link-btn" type="button" onClick={() => openAuth(isRegistering ? "login" : "register")}>
            {isRegistering ? "Sign in" : "Create an account"}
          </button>
        </p>
        {googleConsentOpen && (
          <div className="auth-consent-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setGoogleConsentOpen(false); }}>
            <section className="auth-consent-dialog" role="dialog" aria-modal="true" aria-labelledby="google-consent-title">
              <h3 id="google-consent-title">Before continuing with Google</h3>
              <label className="auth-consent">
                <input type="checkbox" checked={googleAgeConfirmed} onChange={(event) => setGoogleAgeConfirmed(event.target.checked)} />
                <span>I confirm that I am at least 13 years old.</span>
              </label>
              <label className="auth-consent">
                <input type="checkbox" checked={googlePoliciesAccepted} onChange={(event) => setGooglePoliciesAccepted(event.target.checked)} />
                <span>I agree to the <Link to="/terms" target="_blank" rel="noreferrer">Terms and Conditions</Link> and <Link to="/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</Link>.</span>
              </label>
              {!GOOGLE_CLIENT_ID && <p className="notice notice--error">Google sign-in is not configured on this site.</p>}
              <div className="auth-consent-dialog__actions">
                <button className="a-btn" type="button" onClick={() => setGoogleConsentOpen(false)}>Cancel</button>
                {GOOGLE_CLIENT_ID && googleAgeConfirmed && googlePoliciesAccepted && (
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
                )}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}