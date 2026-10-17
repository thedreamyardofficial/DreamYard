import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../uploads");

const ALLOWED = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    ALLOWED[file.mimetype] ? cb(null, true) : cb(new Error("Upload a JPG, PNG, WebP or GIF image.")),
});
