const RAW_API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const API_BASE = `${RAW_API_URL.replace(/\/$/, "")}/api`;

async function request(path, options) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { headers: { "Content-Type": "application/json" }, ...options });
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
  createOrder: (body) => request("/orders", { method: "POST", body: JSON.stringify(body) }),
};

export const rupees = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
export const imgSrc = (url) => url || "";
