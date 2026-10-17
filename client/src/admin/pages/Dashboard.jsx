import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ADMIN_BASE } from "../../config.js";
import { rupees } from "../../api/client.js";
import { adminApi } from "../adminApi.js";

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi.stats().then(setS).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="notice notice--error">{error}</p>;
  if (!s) return <p className="adm__muted">Loading…</p>;

  const cards = [
    ["Revenue", rupees(s.revenue), "excluding cancelled orders"],
    ["Orders", s.orders, `${s.newOrders} waiting to ship`],
    ["Products", s.products, `${s.hidden} hidden`],
    ["Low stock", s.lowStock, "5 or fewer left"],
    ["Sections", s.sections, "in the shop menu"],
  ];

  return (
    <>
      <h1 className="adm__title">Dashboard</h1>
      <div className="adm__stats">
        {cards.map(([label, value, note]) => (
          <div key={label} className="adm__card adm__stat">
            <p className="adm__muted">{label}</p>
            <p className="adm__stat-value">{value}</p>
            <p className="adm__muted">{note}</p>
          </div>
        ))}
      </div>

      <div className="adm__card">
        <div className="adm__row-head">
          <h2>Latest orders</h2>
          <Link to={`${ADMIN_BASE}/orders`} className="link-btn">All orders</Link>
        </div>
        {s.recent.length === 0 ? (
          <p className="adm__muted">No orders yet.</p>
        ) : (
          <table className="adm__table">
            <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {s.recent.map((o) => (
                <tr key={o._id}>
                  <td>#{o._id.slice(-6)}</td>
                  <td>{o.customer.name}</td>
                  <td>{rupees(o.total)}</td>
                  <td><span className={`badge badge--${o.status}`}>{o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
