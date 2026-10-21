import { useEffect } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ADMIN_BASE } from "../config.js";
import { tokenStore } from "./adminApi.js";
import AdminLayout from "./AdminLayout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ProductsAdmin from "./pages/ProductsAdmin.jsx";
import SectionsAdmin from "./pages/SectionsAdmin.jsx";
import OrdersAdmin from "./pages/OrdersAdmin.jsx";
import SettingsAdmin from "./pages/SettingsAdmin.jsx";
import PoliciesAdmin from "./pages/PoliciesAdmin.jsx";
import UsersAdmin from "./pages/UsersAdmin.jsx";

function RequireAdmin() {
  return tokenStore.get() ? <AdminLayout /> : <Navigate to={`${ADMIN_BASE}/login`} replace />;
}

export default function AdminApp() {
  // Keep the admin area out of search engines
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  return (
    <div className="adm">
      <Routes>
        <Route path="login" element={<Login />} />
        <Route element={<RequireAdmin />}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<ProductsAdmin />} />
          <Route path="sections" element={<SectionsAdmin />} />
          <Route path="orders" element={<OrdersAdmin />} />
          <Route path="users" element={<UsersAdmin />} />
          <Route path="settings" element={<SettingsAdmin />} />
          <Route path="policies" element={<PoliciesAdmin />} />
        </Route>
        <Route path="*" element={<Navigate to={ADMIN_BASE} replace />} />
      </Routes>
    </div>
  );
}
