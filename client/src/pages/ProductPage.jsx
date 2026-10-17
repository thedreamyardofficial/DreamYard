import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, rupees, imgSrc } from "../api/client.js";
import { useCart } from "../context/CartContext.jsx";
import { useSite } from "../context/SiteContext.jsx";

export default function ProductPage() {
  const { slug } = useParams();
  const { add } = useCart();
  const { categoryName } = useSite();
  const [product, setProduct] = useState(null);
  const [size, setSize] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setProduct(null);
    setError("");
    api.product(slug)
      .then((p) => { setProduct(p); setSize(p.sizes[0]); })
      .catch((e) => setError(e.message));
  }, [slug]);

  if (error) return <p className="empty">{error} <Link to="/shop" className="link-btn">Back to shop</Link></p>;
  if (!product) return <div className="container section"><div className="skeleton skeleton--tall" /></div>;

  const soldOut = product.stock === 0;

  return (
    <div className="container section product">
      <div className="product__media">
        {product.image ? <img src={imgSrc(product.image)} alt={product.name} /> : <div className="card__ph" />}
      </div>
      <div className="product__info">
        <Link to={`/shop?category=${product.category}`} className="link-btn">← {categoryName(product.category)}</Link>
        <h1>{product.name}</h1>
        <p className="product__price">{rupees(product.price)}</p>
        {product.fabric && <p className="product__fabric">{product.fabric}</p>}
        {product.description && <p className="product__desc">{product.description}</p>}

        <fieldset className="sizes">
          <legend>Size</legend>
          {product.sizes.map((s) => (
            <button key={s} type="button" className={`pill ${s === size ? "is-active" : ""}`} onClick={() => setSize(s)}>{s}</button>
          ))}
        </fieldset>

        <button
          className="btn btn--solid"
          disabled={soldOut}
          onClick={() => add({ productId: product._id, name: product.name, price: product.price, size, image: product.image })}
        >
          {soldOut ? "Sold out" : "Add to bag"}
        </button>
        {!soldOut && product.stock < 6 && <p className="notice">Only {product.stock} left.</p>}
      </div>
    </div>
  );
}
