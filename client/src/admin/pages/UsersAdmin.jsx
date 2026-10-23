import { Fragment, useEffect, useState } from "react";
import { adminApi } from "../adminApi.js";
import { rupees } from "../../api/client.js";

const formatDateTime = (value) => value ? new Date(value).toLocaleString("en-IN") : "Not recorded";
const showValue = (value) => value == null || value === "" ? "Not available" : value;
const PAYMENT_STATUS_LABELS = { captured: "Captured", partially_refunded: "Partially refunded", refunded: "Refunded" };

export default function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [detailsById, setDetailsById] = useState({});
  const [loadingDetailsId, setLoadingDetailsId] = useState("");
  const [detailsErrors, setDetailsErrors] = useState({});

  const load = () => adminApi.users().then(setUsers).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  const remove = async (user) => {
    if (!window.confirm(`Permanently delete ${user.name}'s account? Their order history will be retained.`)) return;
    setError("");
    setDeletingId(user._id);
    try {
      await adminApi.deleteUser(user._id);
      setUsers((current) => current.filter((item) => item._id !== user._id));
      setExpandedId((current) => current === user._id ? "" : current);
      setDetailsById((current) => {
        const next = { ...current };
        delete next[user._id];
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId("");
    }
  };

  const toggleDetails = async (user) => {
    if (expandedId === user._id) {
      setExpandedId("");
      return;
    }
    setExpandedId(user._id);
    setDetailsErrors((current) => ({ ...current, [user._id]: "" }));
    if (detailsById[user._id]) return;

    setLoadingDetailsId(user._id);
    try {
      const result = await adminApi.userDetails(user._id);
      setDetailsById((current) => ({ ...current, [user._id]: result }));
    } catch (detailsError) {
      setDetailsErrors((current) => ({ ...current, [user._id]: detailsError.message }));
    } finally {
      setLoadingDetailsId("");
    }
  };

  const query = search.trim().toLowerCase();
  const shown = users.filter((user) =>
    user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)
  );

  return (
    <>
      <h1 className="adm__title">Users</h1>
      {error && <p className="notice notice--error">{error}</p>}
      <div className="adm__card">
        <input
          className="field adm__search"
          type="search"
          placeholder="Search users by name or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {shown.length === 0 ? (
          <p className="adm__muted">{users.length ? "No users match your search." : "No customer accounts yet."}</p>
        ) : (
          <div className="adm__scroll">
            <table className="adm__table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Sign-in method</th><th>Joined</th><th>Orders</th><th></th></tr>
              </thead>
              <tbody>
                {shown.map((user) => {
                  const details = detailsById[user._id];
                  const detailUser = details?.user;
                  return (
                    <Fragment key={user._id}>
                      <tr>
                        <td><strong>{user.name}</strong></td>
                        <td>{user.email}</td>
                        <td>{user.signInMethod}</td>
                        <td>{new Date(user.createdAt).toLocaleDateString("en-IN")}</td>
                        <td>{user.orderCount}</td>
                        <td className="adm__actions">
                          <button className="link-btn" type="button" aria-expanded={expandedId === user._id} onClick={() => void toggleDetails(user)}>
                            {expandedId === user._id ? "Hide details" : "Details"}
                          </button>
                          <button
                            className="link-btn danger"
                            type="button"
                            disabled={deletingId === user._id}
                            onClick={() => remove(user)}
                          >
                            {deletingId === user._id ? "Deleting…" : "Delete"}
                          </button>
                        </td>
                      </tr>
                      {expandedId === user._id && (
                        <tr className="adm__detail">
                          <td colSpan="6">
                            <div className="adm__user-detail">
                              {loadingDetailsId === user._id && <p className="adm__muted">Loading user details...</p>}
                              {detailsErrors[user._id] && <p className="notice notice--error" role="alert">{detailsErrors[user._id]}</p>}
                              {detailUser && (
                                <>
                                  <section className="adm__order-detail-section">
                                    <h3>Account</h3>
                                    <dl className="adm__order-detail-grid">
                                      <div><dt>User ID</dt><dd>{detailUser._id}</dd></div>
                                      <div><dt>Full name</dt><dd>{showValue(detailUser.name)}</dd></div>
                                      <div><dt>Email</dt><dd>{showValue(detailUser.email)}</dd></div>
                                      <div><dt>Sign-in method</dt><dd>{detailUser.signInMethod}</dd></div>
                                      <div><dt>Google profile photo</dt><dd>{detailUser.googleAvatarUrl
                                        ? <a href={detailUser.googleAvatarUrl} target="_blank" rel="noreferrer">View profile photo</a>
                                        : "Not available"}</dd></div>
                                      <div><dt>Account created</dt><dd>{formatDateTime(detailUser.createdAt)}</dd></div>
                                      <div><dt>Last account update</dt><dd>{formatDateTime(detailUser.updatedAt)}</dd></div>
                                      <div><dt>Age confirmation</dt><dd>{formatDateTime(detailUser.ageConfirmedAt)}</dd></div>
                                      <div><dt>Terms and Privacy accepted</dt><dd>{formatDateTime(detailUser.policiesAcceptedAt)}</dd></div>
                                    </dl>
                                  </section>

                                  <section className="adm__order-detail-section">
                                    <h3>Saved addresses ({detailUser.addresses.length})</h3>
                                    {detailUser.addresses.length ? detailUser.addresses.map((address, index) => (
                                      <dl className="adm__order-detail-grid adm__user-address" key={address._id || `${address.email}-${index}`}>
                                        <div><dt>Recipient</dt><dd>{showValue(address.name)}</dd></div>
                                        <div><dt>Email</dt><dd>{showValue(address.email)}</dd></div>
                                        <div><dt>Phone</dt><dd>{showValue(address.phone)}</dd></div>
                                        <div><dt>Address</dt><dd>{showValue(address.address)}</dd></div>
                                        <div><dt>City</dt><dd>{showValue(address.city)}</dd></div>
                                        <div><dt>Pincode</dt><dd>{showValue(address.pincode)}</dd></div>
                                      </dl>
                                    )) : <p className="adm__muted">No saved addresses.</p>}
                                  </section>

                                  <section className="adm__order-detail-section">
                                    <h3>Shopping bag ({detailUser.cart.length} items)</h3>
                                    {detailUser.cart.length ? (
                                      <ul className="adm__user-cart">
                                        {detailUser.cart.map((item) => <li key={`${item.productId}-${item.size}`}>
                                          <span>{item.productName} · {item.size}</span><strong>Qty {item.quantity}</strong>
                                        </li>)}
                                      </ul>
                                    ) : <p className="adm__muted">Shopping bag is empty.</p>}
                                  </section>

                                  <section className="adm__order-detail-section">
                                    <h3>Orders ({details.orders.length})</h3>
                                    {details.orders.length ? details.orders.map((order) => (
                                      <article className="adm__user-order" key={order._id}>
                                        <h4>Order #{order._id.slice(-6)} · {showValue(order.status)}</h4>
                                        <dl className="adm__order-detail-grid">
                                          <div><dt>Order ID</dt><dd>{order._id}</dd></div>
                                          <div><dt>Placed</dt><dd>{formatDateTime(order.createdAt)}</dd></div>
                                          <div><dt>Total</dt><dd>{rupees(order.total)}</dd></div>
                                          <div><dt>Payment method</dt><dd>{showValue(order.paymentMethod)}</dd></div>
                                          <div><dt>Payment status</dt><dd>{order.paymentMethod === "razorpay" ? PAYMENT_STATUS_LABELS[order.paymentStatus] || "Captured" : "Due on delivery"}</dd></div>
                                          <div><dt>Paid amount</dt><dd>{order.paymentAmount != null ? `${showValue(order.paymentCurrency)} ${(Number(order.paymentAmount) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Not available"}</dd></div>
                                          <div><dt>Payment reference</dt><dd>{showValue(order.razorpayPaymentId || order.razorpayOrderId)}</dd></div>
                                          <div><dt>Recipient</dt><dd>{showValue(order.customer?.name)}</dd></div>
                                          <div><dt>Delivery email</dt><dd>{showValue(order.customer?.email)}</dd></div>
                                          <div><dt>Delivery phone</dt><dd>{showValue(order.customer?.phone)}</dd></div>
                                          <div className="adm__order-detail-wide"><dt>Delivery address</dt><dd>{[order.customer?.address, order.customer?.city, order.customer?.pincode].filter(Boolean).join(", ") || "Not available"}</dd></div>
                                          {order.tracking?.trackingNumber && <>
                                            <div><dt>Tracking ID</dt><dd>{order.tracking.trackingNumber}</dd></div>
                                            <div><dt>Carrier</dt><dd>{showValue(order.tracking.carrierName)}</dd></div>
                                            <div><dt>Tracking status</dt><dd>{showValue(order.tracking.status)}</dd></div>
                                            <div><dt>Provider tracker ID</dt><dd>{showValue(order.tracking.trackerId)}</dd></div>
                                            <div className="adm__order-detail-wide"><dt>Tracking link</dt><dd>{showValue(order.tracking.trackingUrl)}</dd></div>
                                          </>}
                                          {order.cancellationReason && <div className="adm__order-detail-wide"><dt>Cancellation reason</dt><dd>{order.cancellationReason}</dd></div>}
                                        </dl>
                                        <h5>Items</h5>
                                        <ul className="adm__user-cart">
                                          {order.items.map((item, index) => <li key={`${item.product}-${index}`}>
                                            <span>{item.name} · {item.size} · {rupees(item.price)} each</span><strong>Qty {item.qty}</strong>
                                          </li>)}
                                        </ul>
                                      </article>
                                    )) : <p className="adm__muted">No orders are linked to this account.</p>}
                                  </section>
                                </>
                              )}
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