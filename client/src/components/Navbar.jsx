import { Link, NavLink } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import { useSite } from "../context/SiteContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Navbar() {
  const { count, setOpen } = useCart();
  const { user, openAuth } = useAuth();
  const { settings, categories } = useSite();
  return (
    <>
      {settings.announcement && <div className="announce">{settings.announcement}</div>}
      <header className="nav">
        <div className="container nav__inner">
          <Link to="/" className="nav__logo">{settings.storeName}</Link>
          <nav className="nav__links" aria-label="Main">
            <NavLink to="/shop" end>Shop</NavLink>
            {categories.slice(0, 3).map((c) => (
              <NavLink key={c.slug} to={`/shop?category=${c.slug}`}>{c.name}</NavLink>
            ))}
          </nav>
          <div className="nav__actions">
            {user ? (
              <Link className="nav__signin" to="/account">{user.name.split(" ")[0]}</Link>
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
