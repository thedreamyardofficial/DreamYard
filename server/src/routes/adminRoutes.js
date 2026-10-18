import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAdmin } from "../middleware/auth.js";
import { asyncHandler as h } from "../middleware/error.js";
import { upload } from "../middleware/upload.js";
import * as auth from "../controllers/admin/authController.js";
import * as products from "../controllers/admin/productAdmin.js";
import * as categories from "../controllers/admin/categoryAdmin.js";
import * as orders from "../controllers/admin/orderAdmin.js";
import * as settings from "../controllers/admin/settingsAdmin.js";
import * as dashboard from "../controllers/admin/dashboardAdmin.js";
import * as users from "../controllers/admin/userAdmin.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many sign-in attempts. Try again in 15 minutes." },
});
router.post("/login", loginLimiter, h(auth.login));

// Everything below needs a valid admin token
router.use(requireAdmin);
router.get("/me", auth.me);
router.get("/stats", h(dashboard.stats));
router.post("/upload", upload.single("image"), h(dashboard.upload));

router.get("/products", h(products.listAll));
router.post("/products", h(products.create));
router.put("/products/:id", h(products.update));
router.delete("/products/:id", h(products.remove));

router.get("/categories", h(categories.list));
router.post("/categories", h(categories.create));
router.put("/categories/:id", h(categories.update));
router.delete("/categories/:id", h(categories.remove));

router.get("/orders", h(orders.list));
router.patch("/orders/:id/status", h(orders.setStatus));
router.delete("/orders/:id", h(orders.remove));

router.get("/users", h(users.list));
router.delete("/users/:id", h(users.remove));

router.put("/settings", h(settings.update));

export default router;
