import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

const scrypt = promisify(scryptCallback);
const emailPattern = /^\S+@\S+\.\S+$/;
const googleClient = env.googleClientId ? new OAuth2Client(env.googleClientId) : null;

function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    googleAvatarUrl: user.googleAvatarUrl || "",
    addresses: user.addresses,
  };
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const [salt, storedHash] = String(stored || "").split(":");
  if (!salt || !storedHash) return false;
  const hash = await scrypt(password, salt, 64);
  const expected = Buffer.from(storedHash, "hex");
  return expected.length === hash.length && timingSafeEqual(expected, hash);
}

function createToken(user) {
  return jwt.sign({ role: "customer" }, env.jwtSecret, { subject: String(user._id), expiresIn: "30d" });
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export async function register(req, res) {
  const { name, password } = req.body || {};
  const email = normalizeEmail(req.body?.email);
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100 || !emailPattern.test(email) || email.length > 254) {
    res.status(400);
    throw new Error("Enter your name and a valid email address.");
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    res.status(400);
    throw new Error("Your password must be between 8 and 128 characters.");
  }

  const user = await User.create({ name: name.trim(), email, passwordHash: await hashPassword(password) });
  res.status(201).json({ token: createToken(user), user: publicUser(user) });
}

export async function login(req, res) {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const user = await User.findOne({ email }).select("+passwordHash");
  if (typeof password !== "string" || !user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401);
    throw new Error("Wrong email or password.");
  }
  res.json({ token: createToken(user), user: publicUser(user) });
}

export async function googleLogin(req, res) {
  if (!googleClient) {
    res.status(503);
    throw new Error("Google sign-in is not configured on the server.");
  }
  const credential = req.body?.credential;
  if (typeof credential !== "string" || credential.length > 8192) {
    res.status(400);
    throw new Error("Google did not return a valid sign-in credential.");
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: env.googleClientId });
    payload = ticket.getPayload();
  } catch {
    res.status(401);
    throw new Error("Google sign-in could not be verified. Please try again.");
  }

  const email = normalizeEmail(payload?.email);
  if (!payload?.sub || !emailPattern.test(email) || payload.email_verified !== true) {
    res.status(401);
    throw new Error("Google must verify your email address before you can sign in.");
  }

  let user = await User.findOne({ googleId: payload.sub });
  if (!user) {
    user = await User.findOne({ email });
    if (user) {
      if (user.googleId && user.googleId !== payload.sub) {
        res.status(409);
        throw new Error("This email is already connected to a different Google account.");
      }
      user.googleId = payload.sub;
      user.googleAvatarUrl = typeof payload.picture === "string" ? payload.picture : user.googleAvatarUrl;
      await user.save();
    } else {
      user = await User.create({
        name: typeof payload.name === "string" && payload.name.trim()
          ? payload.name.trim().slice(0, 100)
          : email.split("@")[0],
        email,
        googleId: payload.sub,
        googleAvatarUrl: typeof payload.picture === "string" ? payload.picture : "",
      });
    }
  }

  res.json({ token: createToken(user), user: publicUser(user) });
}

export async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) {
    res.status(401);
    throw new Error("Your account could not be found. Sign in again.");
  }
  res.json({ user: publicUser(user) });
}

function validateAddress(address) {
  return address &&
    typeof address.name === "string" && address.name.trim().length <= 100 && !!address.name.trim() &&
    typeof address.email === "string" && emailPattern.test(address.email.trim()) &&
    typeof address.phone === "string" && /^[0-9+\-\s()]{8,20}$/.test(address.phone.trim()) &&
    typeof address.address === "string" && !!address.address.trim() && address.address.trim().length <= 300 &&
    typeof address.city === "string" && !!address.city.trim() && address.city.trim().length <= 100 &&
    typeof address.pincode === "string" && /^[0-9]{6}$/.test(address.pincode.trim());
}

export async function addAddress(req, res) {
  const input = req.body || {};
  if (!validateAddress(input)) {
    res.status(400);
    throw new Error("Check the address, email, phone number, and 6-digit pincode.");
  }
  const user = await User.findById(req.user.id);
  if (!user) {
    res.status(404);
    throw new Error("Account not found.");
  }
  if (user.addresses.length >= 20) {
    res.status(400);
    throw new Error("You can save up to 20 addresses. Remove one before adding another.");
  }
  user.addresses.push({
    ...input,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    pincode: input.pincode.trim(),
  });
  await user.save();
  res.status(201).json({ user: publicUser(user) });
}

export async function updateAddress(req, res) {
  if (!mongoose.isValidObjectId(req.params.addressId)) {
    res.status(400);
    throw new Error("That address isn't valid.");
  }
  const input = req.body || {};
  if (!validateAddress(input)) {
    res.status(400);
    throw new Error("Check the address, email, phone number, and 6-digit pincode.");
  }
  const user = await User.findById(req.user.id);
  const address = user?.addresses.id(req.params.addressId);
  if (!user || !address) {
    res.status(404);
    throw new Error("Address not found.");
  }
  Object.assign(address, {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    pincode: input.pincode.trim(),
  });
  await user.save();
  res.json({ user: publicUser(user) });
}

export async function removeAddress(req, res) {
  if (!mongoose.isValidObjectId(req.params.addressId)) {
    res.status(400);
    throw new Error("That address isn't valid.");
  }
  const user = await User.findById(req.user.id);
  const address = user?.addresses.id(req.params.addressId);
  if (!user || !address) {
    res.status(404);
    throw new Error("Address not found.");
  }
  user.addresses.pull({ _id: address._id });
  await user.save();
  res.json({ user: publicUser(user) });
}

export async function getCart(req, res) {
  const user = await User.findById(req.user.id).populate("cart.product", "name price image published");
  if (!user) {
    res.status(404);
    throw new Error("Account not found.");
  }
  const cart = user.cart
    .filter((line) => line.product?.published)
    .map((line) => ({
      productId: String(line.product._id),
      size: line.size,
      qty: line.qty,
      name: line.product.name,
      price: line.product.price,
      image: line.product.image,
    }));
  res.json({ cart });
}

export async function saveCart(req, res) {
  const lines = req.body?.items;
  if (!Array.isArray(lines) || lines.length > 100) {
    res.status(400);
    throw new Error("Your bag could not be saved.");
  }
  const normalized = [];
  const seen = new Set();
  for (const line of lines) {
    const productId = String(line?.productId || "");
    const size = typeof line?.size === "string" ? line.size.trim() : "";
    const qty = Number(line?.qty);
    const key = `${productId}:${size}`;
    if (!mongoose.isValidObjectId(productId) || !size || size.length > 20 || !Number.isInteger(qty) || qty < 1 || qty > 10) {
      res.status(400);
      throw new Error("One of the bag items is invalid.");
    }
    if (!seen.has(key)) normalized.push({ product: productId, size, qty });
    seen.add(key);
  }
  const productIds = [...new Set(normalized.map((line) => String(line.product)))];
  const products = await Product.find({ _id: { $in: productIds }, published: true }).select("_id");
  if (products.length !== productIds.length) {
    res.status(400);
    throw new Error("One of the bag items is no longer available.");
  }
  const user = await User.findById(req.user.id);
  if (!user) {
    res.status(404);
    throw new Error("Account not found.");
  }
  user.cart = normalized;
  await user.save();
  res.json({ ok: true });
}

export async function orderHistory(req, res) {
  const orders = await Order.find({ user: req.user.id })
    .select("customer items total status cancellationReason tracking createdAt paymentMethod paymentStatus refundedAmount paymentCurrency")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({ orders });
}