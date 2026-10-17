import { Link } from "react-router-dom";
import { rupees, imgSrc } from "../api/client.js";

export default function ProductCard({ product }) {
  return (
    <Link to={`/product/${product.slug}`} className="card">
      <div className="card__media">
        {product.image ? <img src={imgSrc(product.image)} alt={product.name} loading="lazy" /> : <div className="card__ph" />}
        {product.stock === 0 && <span className="card__badge">Sold out</span>}
      </div>
      <div className="card__body">
        <h3 className="card__name">{product.name}</h3>
        {product.fabric && <p className="card__fabric">{product.fabric}</p>}
        <p className="card__price">{rupees(product.price)}</p>
      </div>
    </Link>
  );
}
