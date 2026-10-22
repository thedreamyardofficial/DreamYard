import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import { useSite } from "../context/SiteContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import Logo from "./Logo.jsx";

export default function Navbar() {
  const { count, setOpen, flushCart } = useCart();
  const { user, openAuth, signOut } = useAuth();
  const { settings, categories } = useSite();
  const navigate = useNavigate();
  const accountMenuRef = useRef(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const closeOnPointerDown = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
    };
    const closeOnKeyDown = (event) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
        accountMenuRef.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnKeyDown);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnKeyDown);
    };
  }, [accountMenuOpen]);

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError("");
    try {
      await flushCart();
      signOut();
      setAccountMenuOpen(false);
      navigate("/");
    } catch {
      setSignOutError("Your bag could not be synced. Please try signing out again.");
    } finally {
      setSigningOut(false);
    }
  };

  const closeAccountMenu = () => setAccountMenuOpen(false);

  return (
    <>
      {settings.announcement && <div className="announce">{settings.announcement}</div>}
      <header className="nav">
        <div className="container nav__inner">
          <Link to="/" className="nav__logo" aria-label={settings.storeName}><Logo variant="word" /></Link>
          <nav className="nav__links" aria-label="Main">
            <NavLink to="/shop" end>Shop</NavLink>
            {categories.slice(0, 3).map((c) => (
              <NavLink key={c.slug} to={`/shop?category=${c.slug}`}>{c.name}</NavLink>
            ))}
          </nav>
          <div className="nav__actions">
            {user ? (
              <div className="nav__account" ref={accountMenuRef}>
                <button
                  className="nav__signin nav__account-trigger"
                  type="button"
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="true"
                  aria-controls="nav-account-menu"
                  onClick={() => setAccountMenuOpen((open) => !open)}
                >
                  {user.name.split(" ")[0]}
                </button>
                {accountMenuOpen && (
                  <div className="nav__account-menu" id="nav-account-menu" aria-label="Account options">
                    <Link to="/account" onClick={closeAccountMenu}>Your account</Link>
                    <Link to="/account#orders" onClick={closeAccountMenu}>Your orders</Link>
                    <Link to="/account#delivery-addresses" onClick={closeAccountMenu}>Your addresses</Link>
                    {signOutError && <p className="nav__account-error" role="alert">{signOutError}</p>}
                    <button type="button" className="nav__account-signout" onClick={handleSignOut} disabled={signingOut}>
                      {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="nav__signin" onClick={() => openAuth("login")}>Sign in</button>
            )}
            <button className="nav__bag" onClick={() => setOpen(true)} aria-label={`Open bag, ${count} items`}>
              Bag <span className="nav__count">{count}</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
