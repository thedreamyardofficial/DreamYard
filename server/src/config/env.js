import "dotenv/config";

const required = [
  "MONGO_URI",
  "JWT_SECRET",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  ...(process.env.RAZORPAY_ENABLED === "true" ? ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"] : []),
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}. Copy .env.example to .env and fill them in.`);
  process.exit(1);
}

if (process.env.RAZORPAY_ENABLED === "true") {
  const { RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: keySecret, RAZORPAY_WEBHOOK_SECRET: webhookSecret } = process.env;
  const problems = [];
  if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) problems.push("RAZORPAY_KEY_ID must look like rzp_test_xxxx or rzp_live_xxxx");
  if (webhookSecret.length < 16) problems.push("RAZORPAY_WEBHOOK_SECRET must be at least 16 characters");
  if (webhookSecret === keySecret) problems.push("RAZORPAY_WEBHOOK_SECRET must be different from RAZORPAY_KEY_SECRET");
  if (problems.length) {
    console.error(`Invalid Razorpay configuration: ${problems.join("; ")}.`);
    process.exit(1);
  }
  if (process.env.NODE_ENV === "production" && keyId.startsWith("rzp_test_")) {
    console.warn("Razorpay is running with TEST keys in production. Customers will not be charged real money.");
  }
  if (process.env.NODE_ENV !== "production" && keyId.startsWith("rzp_live_")) {
    console.warn("Razorpay LIVE keys are loaded in a non-production environment. Real money will be charged.");
  }
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  isProd: process.env.NODE_ENV === "production",
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
  razorpayEnabled: process.env.RAZORPAY_ENABLED === "true",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  trackingProviderApiKey: process.env.SHIP24_API_KEY || "",
  clientOrigins: (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean),
};
