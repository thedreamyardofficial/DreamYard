import { Router } from "express";
import rateLimit from "express-rate-limit";
import { createOrder, createRazorpayOrder, paymentConfig, razorpayPaymentStatus, verifyRazorpayPayment } from "../controllers/orderController.js";
import { asyncHandler } from "../middleware/error.js";
import { requireUser } from "../middleware/userAuth.js";

const router = Router();
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many orders from this network. Try again in a few minutes." },
});
// Confirming or checking a payment that has already been made must never be blocked by a shared IP,
// so these are counted per signed-in customer instead.
const confirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user.id}`,
  message: { message: "Too many payment checks. Try again in a few minutes." },
});
const noStore = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};

router.post("/", requireUser, orderLimiter, asyncHandler(createOrder));
router.get("/payment-config", asyncHandler(paymentConfig));
router.post("/razorpay/order", requireUser, noStore, orderLimiter, asyncHandler(createRazorpayOrder));
router.post("/razorpay/verify", requireUser, noStore, confirmLimiter, asyncHandler(verifyRazorpayPayment));
router.get("/razorpay/status/:razorpayOrderId", requireUser, noStore, confirmLimiter, asyncHandler(razorpayPaymentStatus));
export default router;
