import { Fragment, useEffect, useState } from "react";
import { adminApi } from "../adminApi.js";
import { rupees } from "../../api/client.js";

const STATUSES = ["placed", "shipped", "delivered", "cancelled"];

const formatDateTime = (value) => value ? new Date(value).toLocaleString("en-IN") : "Not available";
const showValue = (value) => value == null || value === "" ? "Not available" : value;

export default function OrdersAdmin() {
  const [orders, setOrders] = useState([]);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");
  const [cancellationEdits, setCancellationEdits] = useState({});
  const [savingOrder, setSavingOrder] = useState(null);

  const load = () => adminApi.orders().then(setOrders).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

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

  return (
    <>
      <h1 className="adm__title">Orders</h1>
      {error && <p className="notice notice--error">{error}</p>}
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
                                <div><dt>Payment status</dt><dd>{o.paymentMethod === "razorpay" ? "Captured" : "Due on delivery"}</dd></div>
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
    </>
  );
}
