import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { razorpayWebhook } from "../controllers/webhookController.js";
import { asyncHandler } from "../middleware/error.js";

const router = Router();

// Unauthenticated by design: the HMAC signature is the authentication.
// The raw body is required for signature checking, so this router must be mounted before express.json().
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many webhook requests." },
});

router.post("/razorpay", webhookLimiter, express.raw({ type: () => true, limit: "256kb" }), asyncHandler(razorpayWebhook));
export default router;
