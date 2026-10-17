import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
});

export const uploadToCloudinary = (buffer, filename) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "dreamyard",
        resource_type: "image",
        public_id: filename.replace(/\.[^/.]+$/, ""),
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url) return reject(new Error("Cloudinary upload did not return a URL."));
        resolve(result.secure_url);
      }
    );

    stream.end(buffer);
  });

export const deleteFromCloudinary = async (url) => {
  if (!url || !url.includes("cloudinary.com")) return false;

  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/").filter(Boolean);
    const uploadIndex = segments.indexOf("upload");
    if (uploadIndex === -1) return false;

    const publicIdParts = segments.slice(uploadIndex + 1);
    const withoutVersion = publicIdParts[0]?.startsWith("v") ? publicIdParts.slice(1) : publicIdParts;
    const publicId = withoutVersion.join("/").replace(/\.[^/.]+$/, "");
    if (!publicId) return false;

    const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    return result?.result === "ok" || result?.result === "not found";
  } catch {
    return false;
  }
};

export default cloudinary;
