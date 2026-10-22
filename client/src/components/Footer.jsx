import { Link } from "react-router-dom";
import { useSite } from "../context/SiteContext.jsx";
import Logo from "./Logo.jsx";

export default function Footer() {
  const { settings, categories } = useSite();
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__ghost" aria-hidden="true"><Logo variant="word" /></div>
      </div>
      <div className="container footer__inner">
        <div className="footer__col">
          <p className="footer__tag">{settings.footerNote || "Wear it oversized."}</p>
        </div>
        <nav className="footer__col" aria-label="Shop">
          <h4>Shop</h4>
          <Link to="/shop">All pieces</Link>
          {categories.slice(0, 5).map((c) => <Link key={c.slug} to={`/shop?category=${c.slug}`}>{c.name}</Link>)}
        </nav>
        <nav className="footer__col footer__policies" aria-label="Policies and support">
          <h4>Support</h4>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy-policy">Privacy</Link>
          <Link to="/shipping-returns">Shipping and returns</Link>
          <Link to="/contact">Contact and grievances</Link>
        </nav>
        <div className="footer__col">
          <h4>Contact</h4>
          {settings.contactEmail && <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>}
          {settings.contactPhone && <a href={`tel:${settings.contactPhone}`}>{settings.contactPhone}</a>}
        </div>
        <p className="footer__fine">© {new Date().getFullYear()} {settings.storeName} · All rights reserved</p>
      </div>
    </footer>
  );
}
