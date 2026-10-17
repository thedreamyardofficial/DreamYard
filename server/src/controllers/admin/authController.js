import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

const hash = (v) => crypto.createHash("sha256").update(String(v)).digest();
const same = (a, b) => crypto.timingSafeEqual(hash(a), hash(b));

export async function login(req, res) {
  const { email, password } = req.body || {};
  const okEmail = same(email, env.adminEmail);
  const okPass = same(password, env.adminPassword);
  if (!(okEmail && okPass)) {
    res.status(401);
    throw new Error("Wrong email or password.");
  }
  const token = jwt.sign({ role: "admin", email: env.adminEmail }, env.jwtSecret, { expiresIn: "12h" });
  res.json({ token, email: env.adminEmail });
}

export const me = (req, res) => res.json({ email: req.admin.email });
