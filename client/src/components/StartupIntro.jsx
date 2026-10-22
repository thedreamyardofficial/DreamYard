import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ADMIN_BASE, SHOW_INTRO } from "../config.js";
import Logo from "./Logo.jsx";

export default function StartupIntro() {
  const { pathname } = useLocation();
  const isAdmin = pathname === ADMIN_BASE || pathname.startsWith(`${ADMIN_BASE}/`);
  const [visible, setVisible] = useState(SHOW_INTRO);

  useEffect(() => {
    if (!SHOW_INTRO) return;
    const timeout = window.setTimeout(() => setVisible(false), 2800);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!visible || isAdmin) return null;

  return (
    <div className="startup-intro" role="status" aria-label="Dream Yard is loading">
      <div className="startup-intro__logo lockup">
        <span className="lockup__the">the</span>
        <Logo variant="word" draw />
        <span className="lockup__store">store</span>
      </div>
      <p className="startup-intro__sub eyebrow">Menswear</p>
    </div>
  );
}
