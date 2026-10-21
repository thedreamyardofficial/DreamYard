import Settings from "../../models/Settings.js";
import { getSettings } from "../../utils/settings.js";

const FIELDS = [
  "storeName", "announcement", "heroTitle", "heroSubtitle", "footerNote", "contactEmail", "contactPhone",
  "termsContent", "privacyContent", "shippingReturnsContent", "contactGrievanceContent",
];

export async function update(req, res) {
  const patch = {};
  for (const f of FIELDS) if (typeof req.body?.[f] === "string") patch[f] = req.body[f].trim();
  for (const f of ["termsContent", "privacyContent", "shippingReturnsContent", "contactGrievanceContent"]) {
    if (patch[f]?.length > 20000) { res.status(400); throw new Error("Policy text must be 20,000 characters or fewer."); }
  }
  if (patch.storeName === "") { res.status(400); throw new Error("The store needs a name."); }
  await getSettings();
  res.json(await Settings.findOneAndUpdate({ key: "site" }, patch, { new: true }));
}
