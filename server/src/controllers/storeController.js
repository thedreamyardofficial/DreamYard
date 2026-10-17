import Category from "../models/Category.js";
import { getSettings } from "../utils/settings.js";

export const listCategories = async (_req, res) => res.json(await Category.find().sort({ order: 1, name: 1 }));
export const getPublicSettings = async (_req, res) => res.json(await getSettings());
