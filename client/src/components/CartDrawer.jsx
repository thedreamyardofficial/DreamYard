import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import { rupees, imgSrc } from "../api/client.js";

export default function CartDrawer() {
  const { open, setOpen, lines, total, changeQty, remove } = useCart();
  const navigate = useNavigate();

  const goCheckout = () => {
    setOpen(false);
    navigate("/checkout");
  };

  return (
    <>
      <div className={`scrim ${open ? "is-open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`drawer ${open ? "is-open" : ""}`} aria-hidden={!open} aria-label="Your bag">
        <div className="drawer__head">
          <h2>Your bag</h2>
          <button className="link-btn" onClick={() => setOpen(false)}>Close</button>
        </div>

        {lines.length === 0 ? (
          <p className="empty">Your bag is empty. Pick something from the shop to start.</p>
        ) : (
          <ul className="drawer__list">
            {lines.map((l) => (
              <li key={l.id} className="line">
                {l.image ? <img className="line__img" src={imgSrc(l.image)} alt="" /> : <div className="line__img" />}
                <div className="line__info">
                  <p className="line__name">{l.name}</p>
                  <p className="line__meta">Size {l.size} · {rupees(l.price)}</p>
                  <div className="qty">
                    <button onClick={() => changeQty(l.id, -1)} aria-label="Decrease quantity">−</button>
                    <span>{l.qty}</span>
                    <button onClick={() => changeQty(l.id, 1)} aria-label="Increase quantity">+</button>
                    <button className="link-btn" onClick={() => remove(l.id)}>Remove</button>
                  </div>
                </div>
                <p className="line__total">{rupees(l.price * l.qty)}</p>
              </li>
            ))}
          </ul>
        )}

        {lines.length > 0 && (
          <div className="drawer__foot">
            <p className="drawer__total"><span>Subtotal</span><strong>{rupees(total)}</strong></p>
            <button className="btn btn--solid btn--block" onClick={goCheckout}>Go to checkout</button>
          </div>
        )}
      </aside>
    </>
  );
}
