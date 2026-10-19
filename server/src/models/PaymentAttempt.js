import mongoose from "mongoose";

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
    status: { type: String, enum: ["pending", "processing", "completed"], default: "pending" },
    completedOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  },
  { timestamps: true }
);

export default mongoose.model("PaymentAttempt", paymentAttemptSchema);