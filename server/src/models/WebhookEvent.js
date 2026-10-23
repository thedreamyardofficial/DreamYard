import mongoose from "mongoose";

// Remembers every Razorpay webhook delivery so a repeated delivery is not processed twice.
// The event record also stores the order and user references for fast audit searches.
const webhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    event: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String, index: true },
    status: { type: String, enum: ["processing", "processed", "failed"], default: "processing" },
    attempts: { type: Number, default: 1 },
    result: { type: String, maxlength: 200 },
    lastError: { type: String, maxlength: 300 },
  },
  { timestamps: true }
);

webhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
webhookEventSchema.index({ user: 1, event: 1, createdAt: -1 });
webhookEventSchema.index({ order: 1, event: 1, createdAt: -1 });
webhookEventSchema.index({ razorpayOrderId: 1, event: 1, createdAt: -1 });

export default mongoose.model("WebhookEvent", webhookEventSchema);
