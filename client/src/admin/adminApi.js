import { API_BASE } from "../api/client.js";
import { ADMIN_BASE } from "../config.js";

const KEY = "dream-yard-admin-token";
export const tokenStore = {
  get: () => localStorage.getItem(KEY) || sessionStorage.getItem(KEY),
  set: (token, remember = true) => {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    (remember ? localStorage : sessionStorage).setItem(KEY, token);
  },
  clear: () => {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  },
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
  login: (email, password, remember) => request("/login", { method: "POST", body: { email, password, remember } }),
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
  setOrderStatus: (id, status, cancellationReason = "") => request(`/orders/${id}/status`, { method: "PATCH", body: { status, cancellationReason } }),
  deleteOrder: (id) => request(`/orders/${id}`, { method: "DELETE" }),
  users: () => request("/users"),
  deleteUser: (id) => request(`/users/${id}`, { method: "DELETE" }),
  saveSettings: (body) => request("/settings", { method: "PUT", body }),
};
