import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    pincode: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const cartLineSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    size: { type: String, required: true, trim: true, maxlength: 20 },
    qty: { type: Number, required: true, min: 1, max: 10 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true },
    googleAvatarUrl: { type: String, default: "", maxlength: 2048 },
    ageConfirmedAt: { type: Date, default: null },
    policiesAcceptedAt: { type: Date, default: null },
    addresses: {
      type: [addressSchema],
      default: [],
      validate: { validator: (addresses) => addresses.length <= 20, message: "You can save up to 20 addresses." },
    },
    cart: { type: [cartLineSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);