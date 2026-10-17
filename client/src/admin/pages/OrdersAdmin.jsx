import { Fragment, useEffect, useState } from "react";
import { adminApi } from "../adminApi.js";
import { rupees } from "../../api/client.js";

const STATUSES = ["placed", "shipped", "delivered", "cancelled"];

export default function OrdersAdmin() {
  const [orders, setOrders] = useState([]);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");

  const load = () => adminApi.orders().then(setOrders).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const run = async (fn) => {
    setError("");
    try { await fn(); await load(); } catch (e) { setError(e.message); }
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
                {orders.map((o) => (
                  <Fragment key={o._id}>
                    <tr>
                      <td>#{o._id.slice(-6)}</td>
                      <td>{new Date(o.createdAt).toLocaleDateString("en-IN")}</td>
                      <td>{o.customer.name}</td>
                      <td>{rupees(o.total)}</td>
                      <td>
                        <select className="field adm__select" value={o.status} disabled={o.status === "cancelled"}
                          onChange={(e) => run(() => adminApi.setOrderStatus(o._id, e.target.value))}>
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="adm__actions">
                        <button className="link-btn" onClick={() => setOpen(open === o._id ? null : o._id)}>{open === o._id ? "Hide" : "Details"}</button>
                        <button className="link-btn danger" onClick={() => window.confirm("Delete this order record?") && run(() => adminApi.deleteOrder(o._id))}>Delete</button>
                      </td>
                    </tr>
                    {open === o._id && (
                      <tr className="adm__detail">
                        <td colSpan="6">
                          <p><strong>{o.customer.name}</strong> · {o.customer.email} · {o.customer.phone}</p>
                          <p>{o.customer.address}, {o.customer.city} {o.customer.pincode}</p>
                          <ul>
                            {o.items.map((i, idx) => (
                              <li key={idx}>{i.name} ({i.size}) × {i.qty} — {rupees(i.price * i.qty)}</li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
