import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useSite } from "../context/SiteContext.jsx";
import ProductCard from "../components/ProductCard.jsx";
import Swatch from "../components/Swatch.jsx";

const TILE_SWATCHES = [
  { base: "#1B2559", accent: "#F2B632", pattern: "ikat" },
  { base: "#E8ECF4", accent: "#9AA6C8", pattern: "stripe" },
  { base: "#E3A92B", accent: "#1B2559", pattern: "ikat" },
  { base: "#4A5368", accent: "#8993AB", pattern: "check" },
  { base: "#243377", accent: "#F2B632", pattern: "check" },
  { base: "#8E2C25", accent: "#F4E3C1", pattern: "stripe" },
];

export default function Home() {
  const { settings, categories } = useSite();
  const [featured, setFeatured] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.products({ featured: true }).then(setFeatured).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__copy">
            <h1>{settings.heroTitle}</h1>
            <p>{settings.heroSubtitle}</p>
            <div className="hero__cta">
              <Link to="/shop" className="btn btn--accent">Shop the collection</Link>
            </div>
          </div>
          <div className="hero__cloth" aria-hidden="true">
            <Swatch swatch={TILE_SWATCHES[0]} className="fold fold--a" />
            <Swatch swatch={TILE_SWATCHES[5]} className="fold fold--b" />
            <Swatch swatch={TILE_SWATCHES[1]} className="fold fold--c" />
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="container section">
          <h2 className="section__title">Shop by section</h2>
          <div className="tiles">
            {categories.map((c, i) => (
              <Link key={c._id} to={`/shop?category=${c.slug}`} className="tile">
                <Swatch swatch={TILE_SWATCHES[i % TILE_SWATCHES.length]} className="tile__swatch" />
                <span className="tile__name">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="container section">
        <div className="section__head">
          <h2 className="section__title">Weaver's picks</h2>
          <Link to="/shop" className="link-btn">View all</Link>
        </div>
        {error && <p className="notice notice--error">{error}</p>}
        {!error && featured.length === 0 && <p className="empty">Featured pieces will appear here.</p>}
        <div className="grid">{featured.map((p) => <ProductCard key={p._id} product={p} />)}</div>
      </section>
    </>
  );
}
