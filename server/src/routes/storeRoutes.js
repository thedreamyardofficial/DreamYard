import { Router } from "express";
import { listCategories, getPublicSettings } from "../controllers/storeController.js";
import { asyncHandler } from "../middleware/error.js";

const router = Router();
router.get("/categories", asyncHandler(listCategories));
router.get("/settings", asyncHandler(getPublicSettings));
export default router;
