export const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";

// Returns a slug that isn't used yet in the given model
export async function uniqueSlug(Model, text) {
  const base = slugify(text);
  let slug = base;
  let n = 2;
  while (await Model.exists({ slug })) slug = `${base}-${n++}`;
  return slug;
}
