import Razorpay from "razorpay";
import { env } from "./env.js";

export const razorpay = env.razorpayEnabled
  ? new Razorpay({ key_id: env.razorpayKeyId, key_secret: env.razorpayKeySecret })
  : null;