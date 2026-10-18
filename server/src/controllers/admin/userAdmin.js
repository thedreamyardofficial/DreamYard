import mongoose from "mongoose";
import Order from "../../models/Order.js";
import User from "../../models/User.js";

export async function list(_req, res) {
  const users = await User.find()
    .select("name email googleId createdAt")
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  const userIds = users.map((user) => user._id);
  const orderCounts = userIds.length
    ? await Order.aggregate([
        { $match: { user: { $in: userIds } } },
        { $group: { _id: "$user", count: { $sum: 1 } } },
      ])
    : [];
  const countsByUser = new Map(orderCounts.map(({ _id, count }) => [String(_id), count]));

  res.json(users.map((user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    signInMethod: user.googleId ? "Google" : "Email and password",
    createdAt: user.createdAt,
    orderCount: countsByUser.get(String(user._id)) || 0,
  })));
}

export async function remove(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("That user ID isn't valid.");
  }

  const user = await User.findById(req.params.id).select("_id");
  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }

  await Order.updateMany({ user: user._id }, { $set: { user: null } });
  await User.deleteOne({ _id: user._id });
  res.json({ ok: true });
}