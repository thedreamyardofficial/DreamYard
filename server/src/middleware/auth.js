import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401);
    return next(new Error("Sign in to continue."));
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.role !== "admin") throw new Error("not admin");
    req.admin = payload;
    next();
  } catch {
    res.status(401);
    next(new Error("Your session expired. Sign in again."));
  }
}
