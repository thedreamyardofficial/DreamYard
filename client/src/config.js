export const ADMIN_PATH = (import.meta.env.VITE_ADMIN_PATH || "admin").replace(/^\/+|\/+$/g, "");
export const ADMIN_BASE = `/${ADMIN_PATH}`;
export const SHOW_INTRO = import.meta.env.VITE_SHOW_INTRO === "true";
