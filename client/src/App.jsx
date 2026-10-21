import { Routes, Route } from "react-router-dom";
import { ADMIN_PATH } from "./config.js";
import PublicLayout from "./layouts/PublicLayout.jsx";
import Home from "./pages/Home.jsx";
import Shop from "./pages/Shop.jsx";
import ProductPage from "./pages/ProductPage.jsx";
import Checkout from "./pages/Checkout.jsx";
import Account from "./pages/Account.jsx";
import LegalPage from "./pages/LegalPage.jsx";
import AdminApp from "./admin/AdminApp.jsx";

export default function App() {
  return (
    <Routes>
      {/* Hidden admin area: no link to it exists anywhere on the public site */}
      <Route path={`${ADMIN_PATH}/*`} element={<AdminApp />} />

      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/product/:slug" element={<ProductPage />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/account" element={<Account />} />
        <Route path="/terms" element={<LegalPage pageKey="termsContent" title="Terms and Conditions" />} />
        <Route path="/privacy-policy" element={<LegalPage pageKey="privacyContent" title="Privacy Policy" />} />
        <Route path="/shipping-returns" element={<LegalPage pageKey="shippingReturnsContent" title="Shipping, Returns and Refunds" />} />
        <Route path="/contact" element={<LegalPage pageKey="contactGrievanceContent" title="Contact and Grievance Officer" />} />
        <Route path="*" element={<p className="empty">That page doesn't exist.</p>} />
      </Route>
    </Routes>
  );
}
