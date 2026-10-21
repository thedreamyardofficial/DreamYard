import { Link } from "react-router-dom";
import { useSite } from "../context/SiteContext.jsx";

export default function Footer() {
  const { settings } = useSite();
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <p className="footer__brand">{settings.storeName}</p>
        {settings.footerNote && <p>{settings.footerNote}</p>}
        {(settings.contactEmail || settings.contactPhone) && (
          <p>{[settings.contactEmail, settings.contactPhone].filter(Boolean).join("  ·  ")}</p>
        )}
        <nav className="footer__policies" aria-label="Policies and support">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy-policy">Privacy</Link>
          <Link to="/shipping-returns">Shipping and returns</Link>
          <Link to="/contact">Contact and grievances</Link>
        </nav>
        <p className="footer__fine">© {new Date().getFullYear()} {settings.storeName}</p>
      </div>
    </footer>
  );
}
