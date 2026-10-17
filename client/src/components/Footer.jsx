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
        <p className="footer__fine">© {new Date().getFullYear()} {settings.storeName}</p>
      </div>
    </footer>
  );
}
