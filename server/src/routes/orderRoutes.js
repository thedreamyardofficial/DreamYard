import { Router } from "express";
import rateLimit from "express-rate-limit";
import { createOrder, createRazorpayOrder, paymentConfig, verifyRazorpayPayment } from "../controllers/orderController.js";
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

router.post("/", requireUser, orderLimiter, asyncHandler(createOrder));
router.get("/payment-config", asyncHandler(paymentConfig));
router.post("/razorpay/order", requireUser, orderLimiter, asyncHandler(createRazorpayOrder));
router.post("/razorpay/verify", requireUser, orderLimiter, asyncHandler(verifyRazorpayPayment));
export default router;
