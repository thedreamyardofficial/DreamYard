import Settings from "../models/Settings.js";

export const getSettings = () =>
  Settings.findOneAndUpdate({ key: "site" }, { $setOnInsert: { key: "site" } }, { upsert: true, new: true });
