import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: String,
    size: String,
    qty: { type: Number, min: 1, required: true },
    price: Number, // unit price at time of purchase
  },
  { _id: false }
);

const trackingEventSchema = new mongoose.Schema(
  {
    eventId: String,
    status: String,
    occurrenceDatetime: String,
    location: String,
    statusMilestone: String,
    order: Number,
  },
  { _id: false }
);

const orderTrackingSchema = new mongoose.Schema(
  {
    trackingNumber: { type: String, trim: true },
    trackerId: { type: String, default: "" },
    trackingUrl: { type: String, trim: true, default: "" },
    carrierName: { type: String, default: "" },
    status: { type: String, default: "" },
    estimatedDeliveryDate: { type: String, default: "" },
    courierEstimatedDeliveryDate: {
      from: { type: String, default: "" },
      to: { type: String, default: "" },
    },
    events: { type: [trackingEventSchema], default: [] },
    lastSuccessfulAt: { type: Date, default: null },
    lastRefreshAttemptAt: { type: Date, default: null },
    lastRefreshError: { type: String, default: "" },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      pincode: { type: String, required: true },
    },
    items: { type: [orderItemSchema], validate: (v) => v.length > 0 },
    total: { type: Number, required: true },
    tracking: { type: orderTrackingSchema, default: null },
    trackingVisibleToCustomer: { type: Boolean, default: true },
    status: { type: String, enum: ["placed", "shipped", "delivered", "cancelled"], default: "placed" },
    cancellationReason: { type: String, trim: true, maxlength: 500, default: "" },
    paymentMethod: { type: String, enum: ["pay_on_delivery", "razorpay"], default: "pay_on_delivery" },
    razorpayOrderId: String,
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    razorpaySignature: String,
    razorpayMethod: String,
    paymentAmount: Number,
    paymentCurrency: String,
    // Only set for Razorpay orders. Kept in sync by the refund webhooks.
    paymentStatus: { type: String, enum: ["captured", "partially_refunded", "refunded"] },
    refundedAmount: { type: Number, min: 0, default: 0 }, // in paise
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
