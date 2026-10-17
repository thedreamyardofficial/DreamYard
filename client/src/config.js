export const ADMIN_PATH = (import.meta.env.VITE_ADMIN_PATH || "admin").replace(/^\/+|\/+$/g, "");
export const ADMIN_BASE = `/${ADMIN_PATH}`;
