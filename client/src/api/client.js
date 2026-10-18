const RAW_API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const API_BASE = `${RAW_API_URL.replace(/\/$/, "")}/api`;

async function request(path, options = {}, token) {
  let res;
  try {
    const { headers = {}, ...fetchOptions } = options;
    res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new Error("Can't reach the store server. Check that it is running.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong. Try again.");
  return data;
}

export const api = {
  products: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/products${qs ? `?${qs}` : ""}`);
  },
  product: (slug) => request(`/products/${slug}`),
  categories: () => request("/categories"),
  settings: () => request("/settings"),
  register: (body) => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  googleLogin: (credential) => request("/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),
  me: (token) => request("/auth/me", {}, token),
  addAddress: (token, body) => request("/auth/addresses", { method: "POST", body: JSON.stringify(body) }, token),
  removeAddress: (token, addressId) => request(`/auth/addresses/${addressId}`, { method: "DELETE" }, token),
  getCart: (token) => request("/auth/cart", {}, token),
  saveCart: (token, items) => request("/auth/cart", { method: "PUT", body: JSON.stringify({ items }) }, token),
  orders: (token) => request("/auth/orders", {}, token),
  createOrder: (body, token) => request("/orders", { method: "POST", body: JSON.stringify(body) }, token),
};

export const rupees = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
export const imgSrc = (url) => url || "";
