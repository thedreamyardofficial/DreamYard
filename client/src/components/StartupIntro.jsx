import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ADMIN_BASE, SHOW_INTRO } from "../config.js";

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
    <div className="startup-intro" role="status" aria-label="DreamYard is loading">
      <div className="startup-intro__lockup" aria-label="the dream yard store">
        <span className="startup-intro__the">the</span>
        <span className="startup-intro__dream">dream</span>
        <span className="startup-intro__yard">yard</span>
        <span className="startup-intro__store">store</span>
      </div>
    </div>
  );
}