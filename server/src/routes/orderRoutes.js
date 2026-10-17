import { Router } from "express";
import rateLimit from "express-rate-limit";
import { createOrder } from "../controllers/orderController.js";
import { asyncHandler } from "../middleware/error.js";

const router = Router();
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many orders from this network. Try again in a few minutes." },
});

router.post("/", orderLimiter, asyncHandler(createOrder));
export default router;
