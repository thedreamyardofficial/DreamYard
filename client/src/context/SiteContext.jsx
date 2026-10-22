import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client.js";

const DEFAULTS = {
  storeName: "DreamYard",
  announcement: "",
  heroTitle: "Wear it oversized.",
  heroSubtitle: "Oversized tees and hoodies, made for men.",
  footerNote: "",
  contactEmail: "",
  contactPhone: "",
};

const SiteContext = createContext(null);

export function SiteProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.settings().then((s) => setSettings({ ...DEFAULTS, ...s })).catch(() => {});
    api.categories().then(setCategories).catch(() => {});
  }, []);

  const categoryName = (slug) => categories.find((c) => c.slug === slug)?.name || slug;

  return <SiteContext.Provider value={{ settings, categories, categoryName }}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);
