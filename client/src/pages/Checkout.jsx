import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, rupees } from "../api/client.js";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const EMPTY_ADDRESS = { name: "", email: "", phone: "", address: "", city: "", pincode: "" };
const ADDRESS_FIELDS = [
  ["name", "Recipient name", "text"],
  ["email", "Recipient email", "email"],
  ["phone", "Phone number", "tel"],
  ["address", "Street address", "text"],
  ["city", "City", "text"],
  ["pincode", "Pincode", "text"],
];

export default function Checkout() {
  const { lines, total, clear, changeQty, remove } = useCart();
  const { token, user, loading, openAuth, addAddress } = useAuth();
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (!user) return;
    if (!selectedAddressId && user.addresses.length) setSelectedAddressId(user.addresses[0]._id);
    if (!user.addresses.length) {
      setForm((current) => ({ ...current, name: current.name || user.name, email: current.email || user.email }));
    }
  }, [user, selectedAddressId]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const saveAddress = async () => {
    setBusy(true);
    setError("");
    try {
      const updatedUser = await addAddress(form);
      const address = updatedUser.addresses.at(-1);
      setSelectedAddressId(address?._id || "");
      setShowAddressForm(false);
      setForm(EMPTY_ADDRESS);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!selectedAddressId) throw new Error("Select or add a delivery address to continue.");
      const placed = await api.createOrder({
        addressId: selectedAddressId,
        items: lines.map((l) => ({ productId: l.productId, size: l.size, qty: l.qty })),
      }, token);
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
    return (
      <div className="container section checkout">
        <section className="checkout__empty">
          <h1 className="page-title">Your bag is empty</h1>
          <Link to="/shop" className="btn btn--solid">Go to the shop</Link>
        </section>
        <aside className="summary">
          <h2>Order summary</h2>
          <p className="summary__empty">Nothing in your order summary.</p>
        </aside>
      </div>
    );
  }

  if (loading) return <p className="empty">Checking your account…</p>;

  if (!user) {
    return (
      <section className="container section checkout-gate">
        <p className="account__eyebrow">One last step</p>
        <h1 className="page-title">Sign in to check out</h1>
        <p>Your bag will be here when you return.</p>
        <button className="btn btn--solid" onClick={() => openAuth("login")}>Sign in or create an account</button>
      </section>
    );
  }

  return (
    <div className="container section checkout">
      <form onSubmit={submit} className="checkout__form">
        <h1 className="page-title">Delivery details</h1>
        {user.addresses.length > 0 && (
          <fieldset className="checkout__addresses">
            <legend>Choose a recipient and address</legend>
            {user.addresses.map((address) => (
              <label className={`checkout-address ${selectedAddressId === address._id ? "is-selected" : ""}`} key={address._id}>
                <input
                  type="radio"
                  name="delivery-address"
                  value={address._id}
                  checked={selectedAddressId === address._id}
                  onChange={() => setSelectedAddressId(address._id)}
                />
                <span>
                  <strong>{address.name}</strong>
                  <span>{address.email} · {address.phone}</span>
                  <span>{address.address}, {address.city} {address.pincode}</span>
                </span>
              </label>
            ))}
            <Link className="link-btn" to="/account">Manage saved addresses</Link>
          </fieldset>
        )}
        {user.addresses.length < 3 && !showAddressForm && (
          <button
            className="address-add"
            type="button"
            onClick={() => setShowAddressForm(true)}
            aria-label="Add delivery address"
          >
            <span className="address-add__plus" aria-hidden="true">+</span>
            <span>{user.addresses.length ? "Add another address" : "Add address"}</span>
          </button>
        )}
        {user.addresses.length < 3 && showAddressForm && (
          <div className="checkout__new-address">
            <h2>{user.addresses.length ? "Add another address" : "Add your first address"}</h2>
            {ADDRESS_FIELDS.map(([key, label, type]) => (
              <label key={key} className="label">
                {label}
                <input
                  className="field"
                  type={type}
                  autoComplete={key === "name" ? "name" : key === "email" ? "email" : key === "phone" ? "tel" : undefined}
                  maxLength={key === "pincode" ? 6 : key === "address" ? 300 : 100}
                  pattern={key === "pincode" ? "[0-9]{6}" : undefined}
                  required
                  value={form[key]}
                  onChange={set(key)}
                />
              </label>
            ))}
            <div className="address-form__actions">
              <button className="btn btn--solid" type="button" disabled={busy} onClick={saveAddress}>{busy ? "Saving…" : "Save address"}</button>
              <button className="btn account__signout" type="button" disabled={busy} onClick={() => { setShowAddressForm(false); setError(""); }}>Cancel</button>
            </div>
          </div>
        )}
        {error && <p className="notice notice--error">{error}</p>}
        <button className="btn btn--solid" disabled={busy || !selectedAddressId}>{busy ? "Placing order…" : `Place order · ${rupees(total)}`}</button>
      </form>

      <aside className="summary">
        <h2>Order summary</h2>
        <ul>
          {lines.map((l) => (
            <li className="summary__item" key={l.id}>
              <div className="summary__item-info">
                <span>{l.name} ({l.size})</span>
                <div className="summary__controls" aria-label={`${l.name} quantity controls`}>
                  <button type="button" onClick={() => changeQty(l.id, -1)} aria-label={`Decrease ${l.name} quantity`}>−</button>
                  <span className="summary__qty" aria-live="polite">{l.qty}</span>
                  <button type="button" onClick={() => changeQty(l.id, 1)} aria-label={`Increase ${l.name} quantity`}>+</button>
                  <button type="button" className="link-btn" onClick={() => remove(l.id)}>Remove</button>
                </div>
              </div>
              <span>{rupees(l.price * l.qty)}</span>
            </li>
          ))}
        </ul>
        <p className="summary__total"><span>Total</span><strong>{rupees(total)}</strong></p>
        <p className="summary__note">Pay on delivery.</p>
      </aside>
    </div>
  );
}
