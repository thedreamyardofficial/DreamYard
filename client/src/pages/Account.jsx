import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api, rupees } from "../api/client.js";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const EMPTY_ADDRESS = { name: "", email: "", phone: "", address: "", city: "", pincode: "" };
const ORDER_STAGES = ["placed", "shipped", "delivered"];
const ADDRESS_FIELDS = [
  ["name", "Recipient name", "text", "name"],
  ["email", "Recipient email", "email", "email"],
  ["phone", "Phone number", "tel", "tel"],
  ["address", "Street address", "text", "street-address"],
  ["city", "City", "text", "address-level2"],
  ["pincode", "Pincode", "text", "postal-code"],
];

export default function Account() {
  const location = useLocation();
  const { user, token, loading, openAuth, signOut, addAddress, updateAddress, removeAddress } = useAuth();
  const { flushCart } = useCart();
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [visibleCancellationReasons, setVisibleCancellationReasons] = useState({});
  const [ordersError, setOrdersError] = useState("");
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    if (!user || !token) return undefined;
    let active = true;
    api.orders(token)
      .then(({ orders: history }) => { if (active) setOrders(history); })
      .catch((err) => { if (active) setOrdersError(err.message); });
    return () => { active = false; };
  }, [user?._id, token]);

  useEffect(() => setAvatarFailed(false), [user?.googleAvatarUrl]);

  useEffect(() => {
    if (!location.hash || loading) return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, loading]);

  if (loading) return <p className="empty">Loading your account…</p>;
  if (!user) {
    return (
      <section className="container section account-gate">
        <h1 className="page-title">Your account</h1>
        <p>Sign in to manage your delivery addresses and see your orders.</p>
        <button className="btn btn--solid" onClick={() => openAuth("login")}>Sign in</button>
      </section>
    );
  }

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submitAddress = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (editingAddressId) {
        await updateAddress(editingAddressId, form);
      } else {
        await addAddress(form);
      }
      setForm(EMPTY_ADDRESS);
      setShowAddressForm(false);
      setEditingAddressId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteAddress = async (addressId) => {
    setError("");
    try {
      await removeAddress(addressId);
    } catch (err) {
      setError(err.message);
    }
  };

  const editAddress = (address) => {
    setForm(Object.fromEntries(ADDRESS_FIELDS.map(([key]) => [key, address[key] || ""])));
    setEditingAddressId(address._id);
    setShowAddressForm(true);
    setError("");
  };

  const cancelAddressForm = () => {
    setForm(EMPTY_ADDRESS);
    setEditingAddressId(null);
    setShowAddressForm(false);
    setError("");
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError("");
    try {
      await flushCart();
      signOut();
    } catch {
      setSignOutError("Your bag could not be synced. Please try signing out again.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="container section account">
      <header className="account__header">
        <div className="account__profile">
          <span className="account__avatar" role="img" aria-label={user.googleAvatarUrl && !avatarFailed ? "Google profile photo" : "Default profile avatar"}>
            {user.googleAvatarUrl && !avatarFailed ? (
              <img src={user.googleAvatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)} />
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
            )}
          </span>
          <div>
            <p className="account__eyebrow">Your DreamYard account</p>
            <h1 className="page-title">Hello, {user.name}</h1>
            <p className="account__email">{user.email}</p>
          </div>
        </div>
        <button className="btn account__signout" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? "Saving bag…" : "Sign out"}
        </button>
      </header>
      {signOutError && <p className="notice notice--error" role="alert">{signOutError}</p>}

      <section className="account__section" id="delivery-addresses">
        <div className="account__section-head">
          <div><h2>Delivery addresses</h2></div>
        </div>
        {user.addresses.length > 0 && (
          <ul className="address-list">
            {user.addresses.map((address) => (
              <li className="address-item" key={address._id}>
                <div>
                  <strong>{address.name}</strong>
                  <p>{address.email} · {address.phone}</p>
                  <p>{address.address}, {address.city} {address.pincode}</p>
                </div>
                <div className="address-item__actions">
                  <button className="link-btn" type="button" onClick={() => editAddress(address)}>Edit</button>
                  <button className="link-btn" type="button" onClick={() => deleteAddress(address._id)}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {user.addresses.length < 20 && !showAddressForm && (
          <button
            className="address-add"
            type="button"
            onClick={() => setShowAddressForm(true)}
            aria-label="Add delivery address"
          >
            <span className="address-add__plus" aria-hidden="true">+</span>
            <span>Add address</span>
          </button>
        )}
        {showAddressForm && (user.addresses.length < 20 || editingAddressId) && (
          <form className="address-form" onSubmit={submitAddress}>
            <h3>{editingAddressId ? "Edit delivery address" : user.addresses.length ? "Add another address" : "Add your first address"}</h3>
            <div className="address-form__grid">
              {ADDRESS_FIELDS.map(([key, label, type, autocomplete]) => (
                <label className={`label address-form__${key}`} key={key}>{label}
                  <input
                    className="field"
                    type={type}
                    autoComplete={autocomplete}
                    maxLength={key === "address" ? 300 : key === "pincode" ? 6 : 100}
                    pattern={key === "pincode" ? "[0-9]{6}" : undefined}
                    required
                    value={form[key]}
                    onChange={update(key)}
                  />
                </label>
              ))}
            </div>
            {error && <p className="notice notice--error" role="alert">{error}</p>}
            <div className="address-form__actions">
              <button className="btn btn--solid" disabled={busy}>{busy ? "Saving…" : editingAddressId ? "Save changes" : "Save address"}</button>
              <button className="btn account__signout" type="button" disabled={busy} onClick={cancelAddressForm}>Cancel</button>
            </div>
          </form>
        )}
        {error && user.addresses.length === 20 && <p className="notice notice--error" role="alert">{error}</p>}
      </section>

      <section className="account__section" id="orders">
        <div className="account__section-head"><div><h2>Order history</h2><p>Your recent purchases.</p></div></div>
        {ordersError && <p className="notice notice--error">{ordersError}</p>}
        {!ordersError && orders.length === 0 ? (
          <p className="account__empty">No orders yet. <Link className="link-btn" to="/shop">Explore the shop</Link></p>
        ) : (
          <ul className="order-list">
            {orders.map((order) => (
              <li className="order-item" key={order._id}>
                <div className="order-item__top">
                  <strong>Order #{order._id.slice(-6)}</strong>
                  <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
                <p>{order.items.map((item) => `${item.name} (${item.size}) × ${item.qty}`).join(", ")}</p>
                <div className="order-item__bottom">
                  {order.status === "cancelled" ? (
                    <div className="order-progress__cancelled-wrap">
                      <div className="order-progress__cancelled-row">
                        <p className="order-progress__cancelled">Cancelled</p>
                        <button
                          className="link-btn order-progress__reason-toggle"
                          type="button"
                          aria-expanded={Boolean(visibleCancellationReasons[order._id])}
                          onClick={() => setVisibleCancellationReasons((current) => ({ ...current, [order._id]: !current[order._id] }))}
                        >
                          Click to know why
                        </button>
                      </div>
                      {visibleCancellationReasons[order._id] && (
                        <p className="order-progress__reason">{order.cancellationReason || "No cancellation reason was provided."}</p>
                      )}
                    </div>
                  ) : (
                    <div
                      className="order-progress"
                      role="list"
                      aria-label={`Order status: ${order.status}`}
                      style={{ "--progress": `${(ORDER_STAGES.indexOf(order.status) / (ORDER_STAGES.length - 1)) * 100}%` }}
                    >
                      <span className="order-progress__track" aria-hidden="true" />
                      {ORDER_STAGES.map((stage, index) => (
                        <span className={`order-progress__step${index <= ORDER_STAGES.indexOf(order.status) ? " is-reached" : ""}`} role="listitem" key={stage}>
                          <span className="order-progress__dot" aria-hidden="true" />
                          <span>{stage}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <strong>{rupees(order.total)}</strong>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}