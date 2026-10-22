import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.jsx";
import StartupIntro from "./components/StartupIntro.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SiteProvider } from "./context/SiteContext.jsx";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/startupIntro.css";
import "./styles/pages.css";
import "./styles/premium.css";
import "./styles/admin.css";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const app = (
  <SiteProvider>
    <AuthProvider>
      <CartProvider>
        <>
          <StartupIntro />
          <App />
        </>
      </CartProvider>
    </AuthProvider>
  </SiteProvider>
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      {googleClientId ? <GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider> : app}
    </BrowserRouter>
  </React.StrictMode>
);
