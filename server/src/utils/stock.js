import Product from "../models/Product.js";

export async function releaseStock(items) {
  await Promise.all(items.map((item) => Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty } })));
}

// Atomically takes stock for every line. If any line is short, everything taken so far is put back.
export async function tryReserveStock(items) {
  const reserved = [];
  for (const item of items) {
    const { modifiedCount } = await Product.updateOne(
      { _id: item.product, stock: { $gte: item.qty } },
      { $inc: { stock: -item.qty } }
    );
    if (!modifiedCount) {
      await releaseStock(reserved);
      return { ok: false, item };
    }
    reserved.push(item);
  }
  return { ok: true, reserved };
}
