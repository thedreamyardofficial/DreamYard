import { useState } from "react";
import { Link } from "react-router-dom";
import { api, rupees } from "../api/client.js";
import { useCart } from "../context/CartContext.jsx";

const EMPTY = { name: "", email: "", phone: "", address: "", city: "", pincode: "" };
const FIELDS = [
  ["name", "Full name", "text"],
  ["email", "Email", "email"],
  ["phone", "Phone", "tel"],
  ["address", "Address", "text"],
  ["city", "City", "text"],
  ["pincode", "Pincode", "text"],
];

export default function Checkout() {
  const { lines, total, clear } = useCart();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const placed = await api.createOrder({
        customer: form,
        items: lines.map((l) => ({ productId: l.productId, size: l.size, qty: l.qty })),
      });
      setOrder(placed);
      clear();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (order) {
    return (
      <div className="container section confirm">
        <h1>Order placed</h1>
        <p>Thank you, {order.customer.name}. Your order <strong>#{order._id.slice(-6)}</strong> for {rupees(order.total)} is being packed.</p>
        <Link to="/shop" className="btn btn--solid">Keep shopping</Link>
      </div>
    );
  }

  if (lines.length === 0) {
    return <p className="empty">Your bag is empty. <Link to="/shop" className="link-btn">Go to the shop</Link></p>;
  }

  return (
    <div className="container section checkout">
      <form onSubmit={submit} className="checkout__form">
        <h1 className="page-title">Delivery details</h1>
        {FIELDS.map(([key, label, type]) => (
          <label key={key} className="label">
            {label}
            <input className="field" type={type} required value={form[key]} onChange={set(key)} />
          </label>
        ))}
        {error && <p className="notice notice--error">{error}</p>}
        <button className="btn btn--solid" disabled={busy}>{busy ? "Placing order…" : `Place order · ${rupees(total)}`}</button>
      </form>

      <aside className="summary">
        <h2>Order summary</h2>
        <ul>
          {lines.map((l) => (
            <li key={l.id}><span>{l.name} ({l.size}) × {l.qty}</span><span>{rupees(l.price * l.qty)}</span></li>
          ))}
        </ul>
        <p className="summary__total"><span>Total</span><strong>{rupees(total)}</strong></p>
        <p className="summary__note">Pay on delivery.</p>
      </aside>
    </div>
  );
}
