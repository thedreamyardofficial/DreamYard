import { useEffect, useState } from "react";
import { adminApi } from "../adminApi.js";

export default function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const load = () => adminApi.users().then(setUsers).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  const remove = async (user) => {
    if (!window.confirm(`Permanently delete ${user.name}'s account? Their order history will be retained.`)) return;
    setError("");
    setDeletingId(user._id);
    try {
      await adminApi.deleteUser(user._id);
      setUsers((current) => current.filter((item) => item._id !== user._id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId("");
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
                {shown.map((user) => (
                  <tr key={user._id}>
                    <td><strong>{user.name}</strong></td>
                    <td>{user.email}</td>
                    <td>{user.signInMethod}</td>
                    <td>{new Date(user.createdAt).toLocaleDateString("en-IN")}</td>
                    <td>{user.orderCount}</td>
                    <td className="adm__actions">
                      <button
                        className="link-btn danger"
                        disabled={deletingId === user._id}
                        onClick={() => remove(user)}
                      >
                        {deletingId === user._id ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}