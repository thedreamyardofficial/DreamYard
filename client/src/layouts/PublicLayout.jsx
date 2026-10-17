import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import CartDrawer from "../components/CartDrawer.jsx";

export default function PublicLayout() {
  const { pathname } = useLocation();
  useEffect(() =>{ window.scrollTo(0, 0)}, [pathname]);
  return (
    <>
      <Navbar />
      <main><Outlet /></main>
      <Footer />
      <CartDrawer />
    </>
  );
}
