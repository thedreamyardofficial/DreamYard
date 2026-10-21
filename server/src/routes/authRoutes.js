import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler as h } from "../middleware/error.js";
import { requireUser } from "../middleware/userAuth.js";
import * as auth from "../controllers/authController.js";
import * as tracking from "../controllers/trackingController.js";

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many account attempts. Try again in 15 minutes." },
});

router.post("/register", authLimiter, h(auth.register));
router.post("/login", authLimiter, h(auth.login));
router.post("/google", authLimiter, h(auth.googleLogin));
router.use(requireUser);
router.get("/me", h(auth.me));
router.post("/addresses", h(auth.addAddress));
router.put("/addresses/:addressId", h(auth.updateAddress));
router.delete("/addresses/:addressId", h(auth.removeAddress));
router.get("/cart", h(auth.getCart));
router.put("/cart", h(auth.saveCart));
router.get("/orders", h(auth.orderHistory));
router.get("/orders/:orderId/tracking", h(tracking.refreshCustomerTracking));

export default router;