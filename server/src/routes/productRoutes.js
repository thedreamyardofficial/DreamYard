import { Router } from "express";
import { listProducts, getProduct } from "../controllers/productController.js";
import { asyncHandler } from "../middleware/error.js";

const router = Router();
router.get("/", asyncHandler(listProducts));
router.get("/:slug", asyncHandler(getProduct));
export default router;
