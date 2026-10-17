import { API_BASE } from "../api/client.js";
import { ADMIN_BASE } from "../config.js";

const KEY = "dream-yard-admin-token";
export const tokenStore = {
  get: () => localStorage.getItem(KEY),
  set: (t) => localStorage.setItem(KEY, t),
  clear: () => localStorage.removeItem(KEY),
};

async function request(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(`${API_BASE}/admin${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  } catch {
    throw new Error("Can't reach the server. Check that it is running.");
  }
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && path !== "/login") {
    tokenStore.clear();
    window.location.assign(`${ADMIN_BASE}/login`);
  }
  if (!res.ok) throw new Error(data.message || "Something went wrong. Try again.");
  return data;
}

export const adminApi = {
  login: (email, password) => request("/login", { method: "POST", body: { email, password } }),
  stats: () => request("/stats"),
  upload: (file) => {
    const form = new FormData();
    form.append("image", file);
    return request("/upload", { method: "POST", form });
  },
  products: () => request("/products"),
  saveProduct: (id, body) => request(id ? `/products/${id}` : "/products", { method: id ? "PUT" : "POST", body }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),
  categories: () => request("/categories"),
  saveCategory: (id, body) => request(id ? `/categories/${id}` : "/categories", { method: id ? "PUT" : "POST", body }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: "DELETE" }),
  orders: () => request("/orders"),
  setOrderStatus: (id, status) => request(`/orders/${id}/status`, { method: "PATCH", body: { status } }),
  deleteOrder: (id) => request(`/orders/${id}`, { method: "DELETE" }),
  saveSettings: (body) => request("/settings", { method: "PUT", body }),
};
