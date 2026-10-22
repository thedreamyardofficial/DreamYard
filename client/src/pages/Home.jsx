import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useSite } from "../context/SiteContext.jsx";
import ProductCard from "../components/ProductCard.jsx";
import Swatch from "../components/Swatch.jsx";

const TILE_SWATCHES = [
  { base: "#03045e", accent: "#48cae4", pattern: "ikat" },
  { base: "#caf0f8", accent: "#0096c7", pattern: "stripe" },
  { base: "#0077b6", accent: "#ade8f4", pattern: "check" },
  { base: "#eaf8fc", accent: "#023e8a", pattern: "ikat" },
  { base: "#00b4d8", accent: "#03045e", pattern: "stripe" },
  { base: "#023e8a", accent: "#90e0ef", pattern: "check" },
];
const MARQUEE = ["Oversized tees", "Hoodies", "Menswear", "New drops", "Delivered across India"];

export default function Home() {
  const { settings, categories } = useSite();
  const [featured, setFeatured] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.products({ featured: true }).then(setFeatured).catch((e) => setError(e.message));
  }, []);

  const words = (settings.heroTitle || "").trim().split(" ");
  const last = words.pop();

  return (
    <>
      <section className="hero">
        <div className="hero__fabric" aria-hidden="true">
          <Swatch swatch={{ base: "#eaf8fc", accent: "#0096c7", pattern: "stripe" }} />
        </div>
        <div className="container hero__inner">
          <div className="hero__copy">
            <h1>{words.join(" ")} <em>{last}</em></h1>
            <p>{settings.heroSubtitle}</p>
            <div className="hero__cta">
              <Link to="/shop" className="btn btn--solid">Shop now <span aria-hidden="true">→</span></Link>
            </div>
          </div>
          {categories.length > 0 && (
            <nav className="hero__cats" aria-label="Shop by section">
              {categories.slice(0, 5).map((c) => <Link key={c._id} to={`/shop?category=${c.slug}`}>{c.name}</Link>)}
            </nav>
          )}
        </div>
      </section>

      <div className="marquee eyebrow" aria-hidden="true">
        <div className="marquee__track">
          {[...MARQUEE, ...MARQUEE, ...MARQUEE, ...MARQUEE].map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>

      {categories.length > 0 && (
        <section className="container section">
          <div className="section__head">
            <div><p className="eyebrow">Shop by section</p><h2 className="section__title">Find your <em>fit</em></h2></div>
          </div>
          <div className="bento">
            {categories.map((c, i) => (
              <Link key={c._id} to={`/shop?category=${c.slug}`} className="tile">
                <Swatch swatch={TILE_SWATCHES[i % TILE_SWATCHES.length]} className="tile__swatch" />
                <span className="tile__label"><span>{c.name}</span><b aria-hidden="true">→</b></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="container section">
        <div className="section__head">
          <div><p className="eyebrow">Featured</p><h2 className="section__title">New <em>drops</em></h2></div>
          <Link to="/shop" className="link-btn">View all</Link>
        </div>
        {error && <p className="notice notice--error">{error}</p>}
        {!error && featured.length === 0 && <p className="empty">Featured pieces will appear here.</p>}
        <div className="grid">{featured.map((p) => <ProductCard key={p._id} product={p} />)}</div>
      </section>

      <section className="container section why">
        <div className="why__card why__card--tint"><span className="eyebrow">01</span><h3>Oversized fit</h3><p>Relaxed, roomy silhouettes for men who like space to move.</p></div>
        <div className="why__card why__card--navy"><span className="eyebrow">02</span><h3>Tees &amp; hoodies</h3><p>The everyday staples, done properly and built to be worn on repeat.</p></div>
        <div className="why__card"><span className="eyebrow">03</span><h3>Delivered across India</h3><p>Straight to your door, with simple returns. See our policy for details.</p></div>
      </section>
    </>
  );
}
