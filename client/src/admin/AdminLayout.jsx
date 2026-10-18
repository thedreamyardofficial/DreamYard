import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ADMIN_BASE } from "../config.js";
import { tokenStore } from "./adminApi.js";

const LINKS = [
  ["", "Dashboard", true],
  ["/products", "Products"],
  ["/sections", "Sections"],
  ["/orders", "Orders"],
  ["/users", "Users"],
  ["/settings", "Site settings"],
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const signOut = () => {
    tokenStore.clear();
    navigate(`${ADMIN_BASE}/login`);
  };

  return (
    <div className="adm__shell">
      <aside className="adm__side">
        <p className="adm__brand">Store admin</p>
        <nav className="adm__nav">
          {LINKS.map(([to, label, end]) => (
            <NavLink key={label} to={`${ADMIN_BASE}${to}`} end={end}>{label}</NavLink>
          ))}
        </nav>
        <div className="adm__side-foot">
          <a href="/" target="_blank" rel="noreferrer">View store</a>
          <button onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <main className="adm__main"><Outlet /></main>
    </div>
  );
}
