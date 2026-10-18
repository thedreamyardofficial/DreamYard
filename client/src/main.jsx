import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import StartupIntro from "./components/StartupIntro.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { SiteProvider } from "./context/SiteContext.jsx";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/startupIntro.css";
import "./styles/pages.css";
import "./styles/admin.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <SiteProvider>
        <CartProvider>
          <>
            <StartupIntro />
            <App />
          </>
        </CartProvider>
      </SiteProvider>
    </BrowserRouter>
  </React.StrictMode>
);
