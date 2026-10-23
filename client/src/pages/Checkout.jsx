import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, rupees } from "../api/client.js";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const EMPTY_ADDRESS = { name: "", email: "", phone: "", address: "", city: "", pincode: "" };
const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";
const ADDRESS_FIELDS = [
  ["name", "Recipient name", "text"],
  ["email", "Recipient email", "email"],
  ["phone", "Phone number", "tel"],
  ["address", "Street address", "text"],
  ["city", "City", "text"],
  ["pincode", "Pincode", "text"],
];

const PENDING_PAYMENT_KEY = "dream-yard-pending-payment";
const PENDING_PAYMENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Remembers a checkout that has been opened so an order whose confirmation never reached the browser can still be found.
function rememberPendingPayment(razorpayOrderId) {
  try {
    window.localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify({ id: razorpayOrderId, at: Date.now() }));
  } catch { /* storage may be unavailable; the server and webhooks still protect the payment */ }
}

function forgetPendingPayment() {
  try { window.localStorage.removeItem(PENDING_PAYMENT_KEY); } catch { /* ignore */ }
}

function recallPendingPayment() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PENDING_PAYMENT_KEY) || "null");
    if (saved?.id && Date.now() - saved.at < PENDING_PAYMENT_MAX_AGE_MS) return saved.id;
  } catch { /* ignore */ }
  return "";
}

let razorpayScriptPromise;

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = RAZORPAY_SCRIPT_URL;
      script.async = true;
      script.onload = () => window.Razorpay ? resolve() : reject(new Error("Secure checkout could not be loaded."));
      script.onerror = () => reject(new Error("Secure checkout could not be loaded."));
      document.body.appendChild(script);
    }).catch((error) => {
      razorpayScriptPromise = null;
      throw error;
    });
  }
  return razorpayScriptPromise;
}

export default function Checkout() {
  const { lines, total, clear, changeQty, remove } = useCart();
  const { token, user, loading, openAuth, addAddress } = useAuth();
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);
  const [paymentConfig, setPaymentConfig] = useState(null);

  useEffect(() => {
    let active = true;
    api.paymentConfig()
      .then((config) => { if (active) setPaymentConfig(config); })
      .catch((err) => { if (active) { setPaymentConfig({ error: err.message }); setError(err.message); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!selectedAddressId && user.addresses.length) setSelectedAddressId(user.addresses[0]._id);
    if (!user.addresses.length) {
      setForm((current) => ({ ...current, name: current.name || user.name, email: current.email || user.email }));
    }
  }, [user, selectedAddressId]);

  // If a payment went through but the browser never heard back (closed tab, lost connection),
  // the server (webhook) still creates the order. Look for it when the customer returns.
  useEffect(() => {
    if (!token || !user) return undefined;
    const pendingId = recallPendingPayment();
    if (!pendingId) return undefined;
    let active = true;
    api.paymentStatus(pendingId, token)
      .then((result) => {
        if (!active) return;
        if (result.status === "completed") {
          forgetPendingPayment();
          setOrder(result.order);
          clear();
        } else if (result.status === "refunded" || result.status === "released") {
          forgetPendingPayment();
          setError(result.message);
        }
      })
      .catch((err) => { if (active && err.status === 404) forgetPendingPayment(); });
    return () => { active = false; };
  }, [token, user?._id]);

  // Polls the server until it has finished the order for a payment that has already been made.
  const waitForOrder = async (razorpayOrderId, tries = 10) => {
    for (let i = 0; i < tries; i += 1) {
      try {
        const result = await api.paymentStatus(razorpayOrderId, token);
        if (result.status === "completed") return { order: result.order };
        if (result.status === "refunded" || result.status === "released") return { message: result.message };
      } catch { /* the server may be restarting; keep trying */ }
      await sleep(3000);
    }
    return null;
  };

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
      if (!paymentConfig || paymentConfig.error) throw new Error(paymentConfig?.error || "Payment options are still loading. Please try again.");
      const checkoutDetails = {
        addressId: selectedAddressId,
        items: lines.map((l) => ({ productId: l.productId, size: l.size, qty: l.qty })),
      };

      if (paymentConfig.enabled) {
        const gatewayOrder = await api.createPaymentOrder(checkoutDetails, token);
        rememberPendingPayment(gatewayOrder.orderId);
        await loadRazorpayScript();
        let paymentFailed = false;
        let paymentSubmitted = false;
        const address = user.addresses.find((entry) => entry._id === selectedAddressId);
        const checkout = new window.Razorpay({
          key: gatewayOrder.keyId,
          amount: gatewayOrder.amount,
          currency: gatewayOrder.currency,
          name: "DreamYard",
          description: "Complete your order",
          order_id: gatewayOrder.orderId,
          prefill: {
            name: address?.name || user.name,
            email: address?.email || user.email,
            contact: address?.phone || "",
          },
          theme: { color: "#1b2559" },
          handler: async (payment) => {
            paymentSubmitted = true;
            try {
              let placed;
              try {
                placed = await api.verifyPayment({
                  razorpayOrderId: payment.razorpay_order_id,
                  razorpayPaymentId: payment.razorpay_payment_id,
                  razorpaySignature: payment.razorpay_signature,
                }, token);
              } catch (verifyError) {
                // Network trouble, a server error or "still being confirmed": the money may already be taken,
                // so ask the server what happened before telling the customer anything.
                const recoverable = !verifyError.status || verifyError.status >= 500 || verifyError.status === 409;
                if (!recoverable) {
                  forgetPendingPayment();
                  throw verifyError;
                }
                const outcome = await waitForOrder(gatewayOrder.orderId);
                if (outcome?.order) {
                  placed = outcome.order;
                } else if (outcome?.message) {
                  forgetPendingPayment();
                  throw new Error(outcome.message);
                } else if (verifyError.status === 409) {
                  throw verifyError;
                } else {
                  throw new Error("We are still confirming your payment. If money was deducted, your order will appear in your account shortly or the amount will be refunded automatically. Please do not pay again.");
                }
              }
              forgetPendingPayment();
              setError("");
              setOrder(placed);
              clear();
            } catch (err) {
              setError(err.message);
            } finally {
              setBusy(false);
            }
          },
          modal: {
            ondismiss: () => {
              if (paymentSubmitted) return;
              setBusy(false);
              if (!paymentFailed) setError("Payment was cancelled. No order was placed. You can try again.");
            },
          },
        });
        checkout.on("payment.failed", (event) => {
          paymentFailed = true;
          const detail = event?.error?.description;
          setError(detail
            ? `Payment failed: ${detail}. No order was placed. Please try again.`
            : "Payment failed. No order was placed. Please try again.");
          setBusy(false);
        });
        checkout.open();
        return;
      }

      const placed = await api.createOrder(checkoutDetails, token);
      setOrder(placed);
      clear();
      setBusy(false);
    } catch (err) {
      setError(paymentConfig?.enabled ? `${err.message} No order was placed. Please try again.` : err.message);
      setBusy(false);
    }
  };

  if (order) {
    return (
      <div className="container section confirm">
        <h1>Order placed</h1>
        <p>Thank you, {order.customer.name}. Your order <strong>#{order._id.slice(-6)}</strong> for {rupees(order.total)} is being packed.</p>
        <p>Tracking details will be added here after your order is shipped.</p>
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
        {user.addresses.length < 20 && !showAddressForm && (
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
        {user.addresses.length < 20 && showAddressForm && (
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
        <button className="btn btn--solid" disabled={busy || !selectedAddressId || !paymentConfig || Boolean(paymentConfig.error)}>
          {busy ? (paymentConfig?.enabled ? "Opening secure checkout…" : "Placing order…")
            : paymentConfig?.enabled ? `Pay with Razorpay · ${rupees(total)}`
              : paymentConfig ? `Place order · ${rupees(total)}` : "Loading payment options…"}
        </button>
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
        <p className="summary__note">
          {paymentConfig?.enabled ? "Secure online payment with Razorpay."
            : paymentConfig ? "Pay on delivery."
              : "Loading payment options…"}
        </p>
      </aside>
    </div>
  );
}
