import mongoose from "mongoose";

// One document per Razorpay checkout. It is the server's own record of what the
// customer is paying for, so the amount and items never come from the browser.
const paymentAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customer: {
      name: String,
      email: String,
      phone: String,
      address: String,
      city: String,
      pincode: String,
    },
    items: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
      name: String,
      size: String,
      qty: { type: Number, min: 1, required: true },
      price: Number,
    }],
    total: { type: Number, required: true },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String },
    // pending    : waiting for the customer to pay
    // processing : a payment arrived and one worker has claimed it
    // completed  : the order exists
    // refunded   : paid but could not be fulfilled (e.g. out of stock), money refunded
    // released   : authorized but never captured because it could not be fulfilled
    status: { type: String, enum: ["pending", "processing", "completed", "refunded", "released"], default: "pending" },
    completedOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    processingStartedAt: { type: Date },
    stockReserved: { type: Boolean, default: false },
    failureReason: { type: String, maxlength: 300 },
    lastPaymentError: { type: String, maxlength: 300 },
    refundId: { type: String },
    reconcileCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Abandoned checkouts (never paid) are removed after 30 days. Anything that
// received a payment is kept for the audit trail.
paymentAttemptSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { status: "pending" } }
);
paymentAttemptSchema.index({ status: 1, reconcileCount: 1, createdAt: 1 });

export default mongoose.model("PaymentAttempt", paymentAttemptSchema);
