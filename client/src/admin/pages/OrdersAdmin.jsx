import { Fragment, useEffect, useState } from "react";
import { adminApi } from "../adminApi.js";
import { rupees } from "../../api/client.js";
import TrackingDetails from "../../components/TrackingDetails.jsx";

const STATUSES = ["placed", "shipped", "delivered", "cancelled"];
const TRACKING_REFRESH_INTERVAL_MS = 3 * 60 * 1000;

const formatDateTime = (value) => value ? new Date(value).toLocaleString("en-IN") : "Not available";
const showValue = (value) => value == null || value === "" ? "Not available" : value;
const PAYMENT_STATUS_LABELS = { captured: "Captured", partially_refunded: "Partially refunded", refunded: "Refunded" };
const paymentStatusLabel = (order) => order.paymentMethod === "razorpay" ? PAYMENT_STATUS_LABELS[order.paymentStatus] || "Captured" : "Due on delivery";
const paiseToText = (paise) => (Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OrdersAdmin() {
  const [orders, setOrders] = useState([]);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");
  const [cancellationEdits, setCancellationEdits] = useState({});
  const [savingOrder, setSavingOrder] = useState(null);
  const [trackingEdits, setTrackingEdits] = useState({});
  const [existingTrackerEdits, setExistingTrackerEdits] = useState({});
  const [trackingCarrierEdits, setTrackingCarrierEdits] = useState({});
  const [trackingUrlEdits, setTrackingUrlEdits] = useState({});
  const [trackingModes, setTrackingModes] = useState({});
  const [trackingBusy, setTrackingBusy] = useState(null);
  const [trackingVisibilityBusy, setTrackingVisibilityBusy] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(null);
  const [trackingMessages, setTrackingMessages] = useState({});
  const [trackingConfirmation, setTrackingConfirmation] = useState(null);
  const [swapTrackingModal, setSwapTrackingModal] = useState(false);
  const [swapSelection, setSwapSelection] = useState({ firstOrderId: "", secondOrderId: "" });
  const [swapBusy, setSwapBusy] = useState(false);
  const [swapError, setSwapError] = useState("");
  const [swapNotice, setSwapNotice] = useState("");

  const load = () => adminApi.orders().then(setOrders).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const trackableOrders = orders.filter((order) => order.tracking?.trackingNumber);
  const openedOrder = orders.find((order) => order._id === open);
  const openedTrackingNumber = openedOrder?.tracking?.trackingNumber || "";
  const openedTrackerId = openedOrder?.tracking?.trackerId || "";
  const swapDestination = orders.find((order) => order._id === swapSelection.secondOrderId);
  const swapWillExchange = Boolean(swapDestination?.tracking?.trackingNumber);

  useEffect(() => {
    if (!open || !openedTrackingNumber || !openedTrackerId) return undefined;
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      setTrackingLoading(open);
      try {
        const result = await adminApi.refreshTracking(open);
        if (!active) return;
        setOrders((current) => current.map((order) => order._id === open ? { ...order, tracking: result.tracking } : order));
        setTrackingMessages((current) => ({ ...current, [open]: "" }));
      } catch (refreshError) {
        if (active) setTrackingMessages((current) => ({ ...current, [open]: refreshError.message }));
      } finally {
        if (active) setTrackingLoading(null);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, TRACKING_REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [open, openedTrackingNumber, openedTrackerId]);

  const run = async (fn) => {
    setError("");
    try { await fn(); await load(); return true; } catch (e) { setError(e.message); return false; }
  };

  const changeStatus = async (id, status, reason = "") => {
    setSavingOrder(id);
    const saved = await run(() => adminApi.setOrderStatus(id, status, reason));
    if (saved) {
      setCancellationEdits((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
    setSavingOrder(null);
  };

  const confirmTracking = (order) => {
    const trackingNumber = (trackingEdits[order._id] ?? order.tracking?.trackingNumber ?? "").trim();
    if (!/^[A-Za-z0-9_./-]{5,50}$/.test(trackingNumber)) {
      setTrackingMessages((current) => ({ ...current, [order._id]: "Enter a valid Tracking ID (5 to 50 letters, numbers, or - _ / .)." }));
      return;
    }
    setTrackingConfirmation({ order, trackingNumber });
  };

  const saveConfirmedTracking = async () => {
    const { order, trackingNumber } = trackingConfirmation;
    setTrackingConfirmation(null);
    setTrackingBusy(order._id);
    setTrackingMessages((current) => ({ ...current, [order._id]: "" }));
    try {
      const result = await adminApi.confirmTracking(order._id, trackingNumber);
      setOrders((current) => current.map((item) => item._id === order._id ? { ...item, tracking: result.tracking } : item));
      setTrackingEdits((current) => ({ ...current, [order._id]: result.tracking?.trackingNumber || trackingNumber }));
      setTrackingMessages((current) => ({
        ...current,
        [order._id]: result.refreshError ? `Tracking ID saved, but the tracking provider could not refresh: ${result.refreshError}` : "Tracking ID saved and tracking started.",
      }));
    } catch (saveError) {
      setTrackingMessages((current) => ({ ...current, [order._id]: saveError.message }));
    } finally {
      setTrackingBusy(null);
    }
  };

  const useExistingTracker = async (order) => {
    const trackingNumber = (trackingEdits[order._id] ?? order.tracking?.trackingNumber ?? "").trim();
    const trackerId = (existingTrackerEdits[order._id] ?? "").trim();
    if (!/^[A-Za-z0-9_./-]{5,50}$/.test(trackingNumber)) {
      setTrackingMessages((current) => ({ ...current, [order._id]: "Enter a valid Tracking ID before fetching an existing tracker." }));
      return;
    }
    if (!/^[A-Za-z0-9_-]{8,120}$/.test(trackerId)) {
      setTrackingMessages((current) => ({ ...current, [order._id]: "Enter a valid tracking provider ID." }));
      return;
    }

    setTrackingBusy(order._id);
    setTrackingMessages((current) => ({ ...current, [order._id]: "" }));
    try {
      const result = await adminApi.useExistingTrackingRecord(order._id, trackingNumber, trackerId);
      setOrders((current) => current.map((item) => item._id === order._id ? { ...item, tracking: result.tracking } : item));
      setTrackingEdits((current) => ({ ...current, [order._id]: result.tracking?.trackingNumber || trackingNumber }));
      setTrackingMessages((current) => ({
        ...current,
        [order._id]: "Existing tracking record saved and data fetched.",
      }));
    } catch (fetchError) {
      setTrackingMessages((current) => ({ ...current, [order._id]: fetchError.message }));
    } finally {
      setTrackingBusy(null);
    }
  };

  const saveManualTracking = async (order) => {
    const trackingNumber = (trackingEdits[order._id] ?? order.tracking?.trackingNumber ?? "").trim();
    const carrierName = (trackingCarrierEdits[order._id] ?? order.tracking?.carrierName ?? "").trim();
    const trackingUrl = (trackingUrlEdits[order._id] ?? "").trim();
    if (!/^[A-Za-z0-9_./-]{5,50}$/.test(trackingNumber)) {
      setTrackingMessages((current) => ({ ...current, [order._id]: "Enter a valid Tracking ID." }));
      return;
    }
    if (!carrierName || carrierName.length > 100) {
      setTrackingMessages((current) => ({ ...current, [order._id]: "Enter a carrier name (up to 100 characters)." }));
      return;
    }
    try {
      const url = new URL(trackingUrl);
      if (!["https:", "http:"].includes(url.protocol)) throw new Error("Enter a tracking link starting with https:// or http://.");
    } catch (urlError) {
      setTrackingMessages((current) => ({
        ...current,
        [order._id]: urlError.message.startsWith("Enter a tracking link")
          ? urlError.message
          : "Enter a valid carrier tracking link starting with https:// or http://.",
      }));
      return;
    }

    setTrackingBusy(order._id);
    setTrackingMessages((current) => ({ ...current, [order._id]: "" }));
    try {
      const result = await adminApi.saveManualTracking(order._id, trackingNumber, carrierName, trackingUrl);
      setOrders((current) => current.map((item) => item._id === order._id ? { ...item, tracking: result.tracking } : item));
      setTrackingEdits((current) => ({ ...current, [order._id]: result.tracking?.trackingNumber || trackingNumber }));
      setTrackingCarrierEdits((current) => ({ ...current, [order._id]: result.tracking?.carrierName || carrierName }));
      setTrackingUrlEdits((current) => ({ ...current, [order._id]: result.tracking?.trackingUrl || trackingUrl }));
      setTrackingMessages((current) => ({ ...current, [order._id]: "Manual tracking details saved." }));
    } catch (saveError) {
      setTrackingMessages((current) => ({ ...current, [order._id]: saveError.message }));
    } finally {
      setTrackingBusy(null);
    }
  };

  const setTrackingVisibility = async (order, visible) => {
    setTrackingVisibilityBusy(order._id);
    setTrackingMessages((current) => ({ ...current, [order._id]: "" }));
    try {
      const result = await adminApi.setTrackingVisibility(order._id, visible);
      setOrders((current) => current.map((item) => item._id === order._id
        ? { ...item, trackingVisibleToCustomer: result.trackingVisibleToCustomer }
        : item));
      setTrackingMessages((current) => ({
        ...current,
        [order._id]: visible
          ? "Tracking visibility saved: visible to the customer."
          : "Tracking visibility saved: hidden from the customer.",
      }));
    } catch (visibilityError) {
      setTrackingMessages((current) => ({ ...current, [order._id]: visibilityError.message }));
    } finally {
      setTrackingVisibilityBusy(null);
    }
  };

  const openTrackingSwap = () => {
    const sourceOrderId = trackableOrders[0]?._id || "";
    setSwapSelection({
      firstOrderId: sourceOrderId,
      secondOrderId: orders.find((order) => order._id !== sourceOrderId)?._id || "",
    });
    setSwapError("");
    setSwapNotice("");
    setSwapTrackingModal(true);
  };

  const swapTrackingRecords = async () => {
    setSwapBusy(true);
    setSwapError("");
    try {
      const { orders: swappedOrders } = await adminApi.swapTrackingRecords(
        swapSelection.firstOrderId,
        swapSelection.secondOrderId
      );
      const trackingByOrder = new Map(swappedOrders.map((order) => [order._id, order.tracking]));
      setOrders((current) => current.map((order) => trackingByOrder.has(order._id)
        ? { ...order, tracking: trackingByOrder.get(order._id) }
        : order));
      setTrackingEdits((current) => ({
        ...current,
        ...Object.fromEntries([...trackingByOrder].map(([orderId, tracking]) => [orderId, tracking?.trackingNumber || ""])),
      }));
      setTrackingMessages((current) => ({
        ...current,
        [swapSelection.firstOrderId]: "",
        [swapSelection.secondOrderId]: "",
      }));
      setSwapTrackingModal(false);
      setSwapNotice(swapWillExchange
        ? "Tracking records were swapped. Customers will see the updated records on their next refresh."
        : "Tracking was moved to the selected order; the source order is now untracked.");
    } catch (swapRequestError) {
      setSwapError(swapRequestError.message);
    } finally {
      setSwapBusy(false);
    }
  };

  return (
    <>
      <div className="adm__row-head">
        <h1 className="adm__title">Orders</h1>
        <button className="a-btn" type="button" disabled={!trackableOrders.length || orders.length < 2} onClick={openTrackingSwap}>
          Swap or move tracking
        </button>
      </div>
      {error && <p className="notice notice--error">{error}</p>}
      {swapNotice && <p className="notice" role="status">{swapNotice}</p>}
      <div className="adm__card">
        {orders.length === 0 ? (
          <p className="adm__muted">No orders yet.</p>
        ) : (
          <div className="adm__scroll">
            <table className="adm__table">
              <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {orders.map((o) => {
                  const edit = cancellationEdits[o._id] || { status: o.status, reason: o.cancellationReason || "" };
                  const trackingMode = trackingModes[o._id] || "";
                  return (
                  <Fragment key={o._id}>
                    <tr>
                      <td>#{o._id.slice(-6)}</td>
                      <td>{new Date(o.createdAt).toLocaleDateString("en-IN")}</td>
                      <td>{o.customer.name}</td>
                      <td>{rupees(o.total)}</td>
                      <td>
                        <div className="adm__order-status">
                          <select className="field adm__select" value={edit.status} disabled={savingOrder === o._id}
                            onChange={(event) => {
                              const status = event.target.value;
                              if (status === "cancelled") {
                                setCancellationEdits((current) => ({
                                  ...current,
                                  [o._id]: { status, reason: current[o._id]?.reason ?? o.cancellationReason ?? "" },
                                }));
                                return;
                              }
                              if (status === o.status) {
                                setCancellationEdits((current) => {
                                  const next = { ...current };
                                  delete next[o._id];
                                  return next;
                                });
                              } else {
                                void changeStatus(o._id, status);
                              }
                            }}>
                            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          {edit.status === "cancelled" && (
                            <>
                              <label className="adm__reason-label" htmlFor={`cancellation-reason-${o._id}`}>Cancellation reason</label>
                              <textarea
                                id={`cancellation-reason-${o._id}`}
                                className="field adm__reason-input"
                                rows="2"
                                maxLength="500"
                                required
                                value={edit.reason}
                                onChange={(event) => setCancellationEdits((current) => ({
                                  ...current,
                                  [o._id]: { ...edit, reason: event.target.value },
                                }))}
                              />
                              <button
                                className="a-btn a-btn--primary adm__reason-save"
                                type="button"
                                disabled={!edit.reason.trim() || savingOrder === o._id || (o.status === "cancelled" && edit.reason.trim() === (o.cancellationReason || "").trim())}
                                onClick={() => changeStatus(o._id, "cancelled", edit.reason)}
                              >
                                {o.status === "cancelled" ? "Update reason" : "Save cancellation"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="adm__actions">
                        <button className="link-btn" onClick={() => setOpen(open === o._id ? null : o._id)}>{open === o._id ? "Hide" : "Details"}</button>
                        <button className="link-btn danger" onClick={() => window.confirm("Delete this order record?") && run(() => adminApi.deleteOrder(o._id))}>Delete</button>
                      </td>
                    </tr>
                    {open === o._id && (
                      <tr className="adm__detail">
                        <td colSpan="6">
                          <div className="adm__order-detail">
                            <section className="adm__order-detail-section">
                              <h3>Order details</h3>
                              <dl className="adm__order-detail-grid">
                                <div><dt>Full order ID</dt><dd>{o._id}</dd></div>
                                <div><dt>Account ID</dt><dd>{showValue(o.user?._id || o.user)}</dd></div>
                                <div><dt>Status</dt><dd>{showValue(o.status)}</dd></div>
                                <div><dt>Order total</dt><dd>{rupees(o.total)}</dd></div>
                                <div><dt>Created</dt><dd>{formatDateTime(o.createdAt)}</dd></div>
                                <div><dt>Last updated</dt><dd>{formatDateTime(o.updatedAt)}</dd></div>
                                <div><dt>Cancellation reason</dt><dd>{showValue(o.cancellationReason)}</dd></div>
                              </dl>
                            </section>

                            <section className="adm__order-detail-section">
                              <h3>Customer and delivery</h3>
                              <dl className="adm__order-detail-grid">
                                <div><dt>Name</dt><dd>{showValue(o.customer.name)}</dd></div>
                                <div><dt>Email</dt><dd>{showValue(o.customer.email)}</dd></div>
                                <div><dt>Phone</dt><dd>{showValue(o.customer.phone)}</dd></div>
                                <div><dt>Street address</dt><dd>{showValue(o.customer.address)}</dd></div>
                                <div><dt>City</dt><dd>{showValue(o.customer.city)}</dd></div>
                                <div><dt>Pincode</dt><dd>{showValue(o.customer.pincode)}</dd></div>
                              </dl>
                            </section>

                            <section className="adm__order-detail-section">
                              <h3>Shipment tracking</h3>
                              <label className="adm__tracking-visibility">
                                <input
                                  type="checkbox"
                                  checked={o.trackingVisibleToCustomer !== false}
                                  disabled={trackingVisibilityBusy === o._id}
                                  onChange={(event) => void setTrackingVisibility(o, event.target.checked)}
                                />
                                <span>Show tracking to customer</span>
                                {trackingVisibilityBusy === o._id && <span className="adm__muted">Saving...</span>}
                              </label>
                              {!trackingMode ? (
                                <div className="adm__tracking-choices" role="group" aria-label={`Choose tracking method for order ${o._id.slice(-6)}`}>
                                  <button
                                    className="adm__tracking-choice"
                                    type="button"
                                    onClick={() => setTrackingModes((current) => ({ ...current, [o._id]: "create" }))}
                                  >
                                    <strong>Create new tracker</strong>
                                    <span>Register a new tracking record with the tracking provider.</span>
                                  </button>
                                  <button
                                    className="adm__tracking-choice"
                                    type="button"
                                    onClick={() => setTrackingModes((current) => ({ ...current, [o._id]: "existing" }))}
                                  >
                                    <strong>Fetch existing tracker</strong>
                                    <span>Connect a tracking record that already exists with the provider.</span>
                                  </button>
                                  <button
                                    className="adm__tracking-choice"
                                    type="button"
                                    onClick={() => setTrackingModes((current) => ({ ...current, [o._id]: "manual" }))}
                                  >
                                    <strong>Provide tracking link</strong>
                                    <span>Save a carrier link for the customer without provider updates.</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="adm__tracking-method">
                                  <button
                                    className="link-btn"
                                    type="button"
                                    disabled={trackingBusy === o._id}
                                    onClick={() => setTrackingModes((current) => ({ ...current, [o._id]: "" }))}
                                  >
                                    Back to tracking options
                                  </button>
                                  <p>{trackingMode === "create"
                                    ? "Create a new tracking record for this tracking number."
                                    : trackingMode === "existing"
                                    ? "Fetch data for a tracking record that already exists with the provider."
                                    : "Add the carrier's tracking page and ID. The tracking provider will not be contacted."}</p>
                                  <div className="adm__tracking-form">
                                    <label className="label" htmlFor={`tracking-id-${o._id}`}>Tracking ID
                                      <input
                                        id={`tracking-id-${o._id}`}
                                        className="field"
                                        type="text"
                                        maxLength="50"
                                        value={trackingEdits[o._id] ?? o.tracking?.trackingNumber ?? ""}
                                        onChange={(event) => setTrackingEdits((current) => ({ ...current, [o._id]: event.target.value }))}
                                      />
                                    </label>
                                    {trackingMode === "create" ? (
                                      <button
                                        className="a-btn a-btn--primary"
                                        type="button"
                                        disabled={trackingBusy === o._id}
                                        onClick={() => void confirmTracking(o)}
                                      >
                                        {trackingBusy === o._id ? "Saving..." : "Create and track"}
                                      </button>
                                    ) : null}
                                  </div>
                                  {trackingMode === "existing" && (
                                    <div className="adm__tracking-form">
                                      <label className="label" htmlFor={`provider-tracker-id-${o._id}`}>Existing provider tracker ID
                                        <input
                                          id={`provider-tracker-id-${o._id}`}
                                          className="field"
                                          type="text"
                                          maxLength="120"
                                          placeholder="Paste the existing tracker ID"
                                          value={existingTrackerEdits[o._id] ?? ""}
                                          onChange={(event) => setExistingTrackerEdits((current) => ({ ...current, [o._id]: event.target.value }))}
                                        />
                                      </label>
                                      <button
                                        className="a-btn a-btn--primary"
                                        type="button"
                                        disabled={trackingBusy === o._id}
                                        onClick={() => void useExistingTracker(o)}
                                      >
                                        {trackingBusy === o._id ? "Fetching..." : "Fetch and save"}
                                      </button>
                                    </div>
                                  )}
                                  {trackingMode === "manual" && (
                                    <div className="adm__tracking-manual-form">
                                      <label className="label" htmlFor={`carrier-name-${o._id}`}>Carrier
                                        <input
                                          id={`carrier-name-${o._id}`}
                                          className="field"
                                          type="text"
                                          maxLength="100"
                                          placeholder="Carrier name"
                                          value={trackingCarrierEdits[o._id] ?? o.tracking?.carrierName ?? ""}
                                          onChange={(event) => setTrackingCarrierEdits((current) => ({ ...current, [o._id]: event.target.value }))}
                                        />
                                      </label>
                                      <label className="label" htmlFor={`tracking-url-${o._id}`}>Carrier tracking link
                                        <input
                                          id={`tracking-url-${o._id}`}
                                          className="field"
                                          type="url"
                                          maxLength="2048"
                                          placeholder="https://carrier.example/track/..."
                                          value={trackingUrlEdits[o._id] ?? o.tracking?.trackingUrl ?? ""}
                                          onChange={(event) => setTrackingUrlEdits((current) => ({ ...current, [o._id]: event.target.value }))}
                                        />
                                      </label>
                                      <button
                                        className="a-btn a-btn--primary"
                                        type="button"
                                        disabled={trackingBusy === o._id}
                                        onClick={() => void saveManualTracking(o)}
                                      >
                                        {trackingBusy === o._id ? "Saving..." : "Save tracking link"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                              {trackingMessages[o._id] && <p className={trackingMessages[o._id].includes("saved") ? "notice" : "notice notice--error"} role="status">{trackingMessages[o._id]}</p>}
                              <TrackingDetails
                                tracking={o.tracking}
                                loading={trackingLoading === o._id}
                                refreshError={o.tracking?.lastRefreshError || (trackingMessages[o._id]?.startsWith("Tracking refresh failed") ? trackingMessages[o._id] : "")}
                              />
                            </section>

                            <section className="adm__order-detail-section">
                              <h3>Items ({o.items.length})</h3>
                              <ol className="adm__order-items">
                                {o.items.map((item, index) => (
                                  <li key={`${item.product}-${index}`}>
                                    <strong>{showValue(item.name)}</strong>
                                    <dl className="adm__order-detail-grid">
                                      <div><dt>Product ID</dt><dd>{showValue(item.product)}</dd></div>
                                      <div><dt>Size</dt><dd>{showValue(item.size)}</dd></div>
                                      <div><dt>Quantity</dt><dd>{showValue(item.qty)}</dd></div>
                                      <div><dt>Unit price</dt><dd>{rupees(item.price)}</dd></div>
                                      <div><dt>Line total</dt><dd>{rupees(item.price * item.qty)}</dd></div>
                                    </dl>
                                  </li>
                                ))}
                              </ol>
                            </section>

                            <section className="adm__order-detail-section">
                              <h3>Payment</h3>
                              <dl className="adm__order-detail-grid">
                                <div><dt>Payment method</dt><dd>{o.paymentMethod === "razorpay" ? "Razorpay" : "Pay on delivery"}</dd></div>
                                <div><dt>Payment status</dt><dd>{paymentStatusLabel(o)}</dd></div>
                                {o.refundedAmount > 0 && <div><dt>Refunded amount</dt><dd>{`${showValue(o.paymentCurrency)} ${paiseToText(o.refundedAmount)}`}</dd></div>}
                                <div><dt>Paid amount</dt><dd>{o.paymentAmount != null ? `${showValue(o.paymentCurrency)} ${(Number(o.paymentAmount) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Not available"}</dd></div>
                                <div><dt>Razorpay order ID</dt><dd>{showValue(o.razorpayOrderId)}</dd></div>
                                <div><dt>Razorpay payment ID</dt><dd>{showValue(o.razorpayPaymentId)}</dd></div>
                                <div><dt>Razorpay payment method</dt><dd>{showValue(o.razorpayMethod)}</dd></div>
                                <div className="adm__order-detail-wide"><dt>Verification signature</dt><dd>{showValue(o.razorpaySignature)}</dd></div>
                              </dl>
                            </section>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {trackingConfirmation && (
        <div className="modal">
          <section className="modal__panel" role="dialog" aria-modal="true" aria-labelledby="tracking-confirm-title">
            <h2 id="tracking-confirm-title">Save and track this shipment?</h2>
            <p>Tracking ID: <strong>{trackingConfirmation.trackingNumber}</strong></p>
            <div className="modal__actions">
              <button className="a-btn" type="button" onClick={() => setTrackingConfirmation(null)}>Cancel</button>
              <button className="a-btn a-btn--primary" type="button" onClick={() => void saveConfirmedTracking()}>Confirm</button>
            </div>
          </section>
        </div>
      )}
      {swapTrackingModal && (
        <div className="modal">
          <section className="modal__panel" role="dialog" aria-modal="true" aria-labelledby="tracking-swap-title">
            <h2 id="tracking-swap-title">Swap or move tracking</h2>
            <p>{swapWillExchange
              ? "This exchanges both orders' tracking IDs, provider tracker IDs, saved status, and events."
              : "This moves the complete tracking record to the selected order and leaves the source order untracked."} This does not register a new tracker.</p>
            <div className="form-grid">
              <label className="label" htmlFor="tracking-swap-first">Order with tracking
                <select
                  id="tracking-swap-first"
                  className="field"
                  value={swapSelection.firstOrderId}
                  onChange={(event) => {
                    const firstOrderId = event.target.value;
                    setSwapSelection((current) => ({
                      firstOrderId,
                      secondOrderId: current.secondOrderId === firstOrderId
                        ? orders.find((order) => order._id !== firstOrderId)?._id || ""
                        : current.secondOrderId,
                    }));
                  }}
                >
                  {trackableOrders.map((order) => (
                    <option key={order._id} value={order._id}>
                      #{order._id.slice(-6)} - {order.customer.name} - {order.tracking.trackingNumber}
                    </option>
                  ))}
                </select>
              </label>
              <label className="label" htmlFor="tracking-swap-second">Order to receive tracking
                <select
                  id="tracking-swap-second"
                  className="field"
                  value={swapSelection.secondOrderId}
                  onChange={(event) => setSwapSelection((current) => ({ ...current, secondOrderId: event.target.value }))}
                >
                  {orders.filter((order) => order._id !== swapSelection.firstOrderId).map((order) => (
                    <option key={order._id} value={order._id}>
                      #{order._id.slice(-6)} - {order.customer.name} - {order.tracking?.trackerId ? order.tracking.trackingNumber : "No tracker"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {swapError && <p className="notice notice--error" role="alert">{swapError}</p>}
            <div className="modal__actions">
              <button className="a-btn" type="button" disabled={swapBusy} onClick={() => setSwapTrackingModal(false)}>Cancel</button>
              <button
                className="a-btn a-btn--primary"
                type="button"
                disabled={swapBusy || !swapSelection.firstOrderId || !swapSelection.secondOrderId || swapSelection.firstOrderId === swapSelection.secondOrderId}
                onClick={() => void swapTrackingRecords()}
              >
                {swapBusy ? "Saving..." : swapWillExchange ? "Swap tracking" : "Move tracking"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
