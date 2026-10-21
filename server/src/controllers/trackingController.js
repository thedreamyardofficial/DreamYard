import mongoose from "mongoose";
import Order from "../models/Order.js";
import { createTrackingRecord, getTrackingResults } from "../utils/trackingProvider.js";

const refreshCooldownMs = 2 * 60 * 1000;
const refreshes = new Map();
const confirmations = new Map();
const trackingNumberPattern = /^[A-Za-z0-9_./-]{5,50}$/;
const providerTrackerIdPattern = /^[A-Za-z0-9_-]{8,120}$/;

function mapTrackingResult(result) {
  const shipment = result.shipment;
  const delivery = shipment.delivery || {};
  const tracker = result.tracker;
  const courierCode = Array.isArray(tracker.courierCode)
    ? tracker.courierCode.join(", ")
    : tracker.courierCode;

  return {
    carrierName: tracker.courierName || shipment.courierName || courierCode || "",
    status: shipment.statusMilestone || "",
    estimatedDeliveryDate: delivery.estimatedDeliveryDate || "",
    courierEstimatedDeliveryDate: {
      from: delivery.courierEstimatedDeliveryDate?.from || "",
      to: delivery.courierEstimatedDeliveryDate?.to || "",
    },
    events: (result.events || []).map((event) => ({
      eventId: event.eventId,
      status: event.status || "",
      occurrenceDatetime: event.occurrenceDatetime || "",
      location: event.location || "",
      statusMilestone: event.statusMilestone || "",
      order: event.order,
    })),
  };
}

async function fetchTrackingProviderData(orderId, trackingNumber, trackerId) {
  const requestedAt = new Date();
  // console.log("[Tracking provider request]", {
  //   requestedAt: requestedAt.toISOString(),
  //   orderId: String(orderId),
  //   trackingNumber,
  //   trackerId,
  // });

  try {
    const result = await getTrackingResults(trackerId);
    // console.log("[Tracking provider response]", {
    //   receivedAt: new Date().toISOString(),
    //   orderId: String(orderId),
    //   trackingNumber,
    //   trackerId,
    //   data: result,
    // });
    if (result.tracker.trackerId !== trackerId) {
      throw new Error("The tracking provider returned results for a different tracker ID.");
    }
    if (result.tracker.trackingNumber.toUpperCase() !== trackingNumber.toUpperCase()) {
      throw new Error("The tracking provider returned results for a different tracking number.");
    }
    return { result, requestedAt };
  } catch (error) {
    // console.error("[Tracking provider error]", {
    //   failedAt: new Date().toISOString(),
    //   orderId: String(orderId),
    //   trackingNumber,
    //   trackerId,
    //   message: error.message,
    // });
    throw error;
  }
}

async function refreshOrder(orderId, force) {
  const order = await Order.findById(orderId);
  if (!order?.tracking?.trackingNumber || !order.tracking.trackerId) {
    return { tracking: order?.tracking || null, refreshError: "" };
  }

  const tracking = order.tracking;
  const now = new Date();
  if (!force && tracking.lastRefreshAttemptAt && now - tracking.lastRefreshAttemptAt < refreshCooldownMs) {
    return { tracking, refreshError: tracking.lastRefreshError || "" };
  }

  tracking.lastRefreshAttemptAt = now;
  await order.save();

  try {
    const { result } = await fetchTrackingProviderData(order._id, tracking.trackingNumber, tracking.trackerId);
    Object.assign(tracking, mapTrackingResult(result), {
      lastSuccessfulAt: new Date(),
      lastRefreshError: "",
    });
    await order.save();
    return { tracking, refreshError: "" };
  } catch (error) {
    tracking.lastRefreshError = error.message || "Tracking information could not be refreshed.";
    await order.save();
    return { tracking, refreshError: tracking.lastRefreshError };
  }
}

export function refreshOrderTracking(orderId, { force = false } = {}) {
  const key = String(orderId);
  if (refreshes.has(key)) return refreshes.get(key);

  const pending = refreshOrder(orderId, force).finally(() => refreshes.delete(key));
  refreshes.set(key, pending);
  return pending;
}

async function refreshAfterTrackingOperation(orderId) {
  const key = String(orderId);
  while (confirmations.has(key)) {
    await confirmations.get(key)?.catch(() => {});
  }
  return refreshOrderTracking(orderId);
}

function validateOrderId(req, res) {
  if (!mongoose.isValidObjectId(req.params.id || req.params.orderId)) {
    res.status(400);
    throw new Error("That order ID isn't valid.");
  }
}

async function saveConfirmedTracking(orderId, trackingNumber) {
  const existingRefresh = refreshes.get(String(orderId));
  if (existingRefresh) await existingRefresh;

  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error("Order not found.");
  }

  if (order.tracking?.trackingNumber?.toUpperCase() === trackingNumber.toUpperCase() && order.tracking.trackerId) {
    return refreshOrderTracking(order._id, { force: true });
  }

  let tracker;
  try {
    tracker = await createTrackingRecord(order, trackingNumber);
  } catch (error) {
    throw error;
  }

  order.tracking = {
    trackingNumber,
    trackerId: tracker.trackerId,
    carrierName: "",
    status: "",
    estimatedDeliveryDate: "",
    courierEstimatedDeliveryDate: { from: "", to: "" },
    events: [],
    lastSuccessfulAt: null,
    lastRefreshAttemptAt: null,
    lastRefreshError: "",
  };
  await order.save();

  return refreshOrderTracking(order._id, { force: true });
}

async function saveExistingTrackingRecord(orderId, trackingNumber, trackerId) {
  const key = String(orderId);
  const existingRefresh = refreshes.get(key);
  if (existingRefresh) await existingRefresh;

  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error("Order not found.");
  }

  const { result, requestedAt } = await fetchTrackingProviderData(order._id, trackingNumber, trackerId);
  order.tracking = {
    trackingNumber,
    trackerId,
    ...mapTrackingResult(result),
    lastSuccessfulAt: new Date(),
    lastRefreshAttemptAt: requestedAt,
    lastRefreshError: "",
  };
  await order.save();
  return { tracking: order.tracking, refreshError: "" };
}

async function saveManualTracking(orderId, trackingNumber, carrierName, trackingUrl) {
  const key = String(orderId);
  const existingRefresh = refreshes.get(key);
  if (existingRefresh) await existingRefresh;

  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error("Order not found.");
  }

  order.tracking = {
    trackingNumber,
    trackerId: "",
    trackingUrl,
    carrierName,
    status: "",
    estimatedDeliveryDate: "",
    courierEstimatedDeliveryDate: { from: "", to: "" },
    events: [],
    lastSuccessfulAt: null,
    lastRefreshAttemptAt: null,
    lastRefreshError: "",
  };
  await order.save();
  return { tracking: order.tracking, refreshError: "" };
}

export async function confirmTracking(req, res) {
  validateOrderId(req, res);
  const trackingNumber = typeof req.body?.trackingNumber === "string" ? req.body.trackingNumber.trim() : "";
  if (!trackingNumberPattern.test(trackingNumber)) {
    res.status(400);
    throw new Error("Enter a tracking ID between 5 and 50 characters using letters, numbers, hyphens, underscores, slashes, or periods.");
  }

  const key = String(req.params.id);
  if (confirmations.has(key)) {
    res.status(409);
    throw new Error("A tracking update is already in progress for this order.");
  }

  const pending = saveConfirmedTracking(req.params.id, trackingNumber).finally(() => confirmations.delete(key));
  confirmations.set(key, pending);
  try {
    res.json(await pending);
  } catch (error) {
    res.status(error.status || (error.message === "Order not found." ? 404 : 502));
    throw error;
  }
}

export async function useExistingTrackingRecord(req, res) {
  validateOrderId(req, res);
  const trackingNumber = typeof req.body?.trackingNumber === "string" ? req.body.trackingNumber.trim() : "";
  const trackerId = typeof req.body?.trackerId === "string" ? req.body.trackerId.trim() : "";
  if (!trackingNumberPattern.test(trackingNumber)) {
    res.status(400);
    throw new Error("Enter a valid Tracking ID (5 to 50 letters, numbers, or - _ / .).");
  }
  if (!providerTrackerIdPattern.test(trackerId)) {
    res.status(400);
    throw new Error("Enter a valid tracking provider ID.");
  }

  const key = String(req.params.id);
  if (confirmations.has(key)) {
    res.status(409);
    throw new Error("A tracking update is already in progress for this order.");
  }

  const pending = saveExistingTrackingRecord(req.params.id, trackingNumber, trackerId)
    .finally(() => confirmations.delete(key));
  confirmations.set(key, pending);
  try {
    res.json(await pending);
  } catch (error) {
    res.status(error.status || (error.message === "Order not found." ? 404 : 502));
    throw error;
  }
}

export async function saveManualTrackingDetails(req, res) {
  validateOrderId(req, res);
  const trackingNumber = typeof req.body?.trackingNumber === "string" ? req.body.trackingNumber.trim() : "";
  const carrierName = typeof req.body?.carrierName === "string" ? req.body.carrierName.trim() : "";
  const trackingUrl = typeof req.body?.trackingUrl === "string" ? req.body.trackingUrl.trim() : "";
  if (!trackingNumberPattern.test(trackingNumber)) {
    res.status(400);
    throw new Error("Enter a valid Tracking ID (5 to 50 letters, numbers, or - _ / .).");
  }
  if (!carrierName || carrierName.length > 100) {
    res.status(400);
    throw new Error("Enter a carrier name between 1 and 100 characters.");
  }
  if (trackingUrl.length > 2048) {
    res.status(400);
    throw new Error("The tracking link must be 2048 characters or fewer.");
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(trackingUrl);
  } catch {
    res.status(400);
    throw new Error("Enter a valid tracking link starting with https:// or http://.");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    res.status(400);
    throw new Error("Tracking links must use https:// or http://.");
  }

  const key = String(req.params.id);
  if (confirmations.has(key)) {
    res.status(409);
    throw new Error("A tracking update is already in progress for this order.");
  }

  const pending = saveManualTracking(req.params.id, trackingNumber, carrierName, parsedUrl.toString())
    .finally(() => confirmations.delete(key));
  confirmations.set(key, pending);
  try {
    res.json(await pending);
  } catch (error) {
    res.status(error.status || (error.message === "Order not found." ? 404 : 500));
    throw error;
  }
}

export async function setCustomerTrackingVisibility(req, res) {
  validateOrderId(req, res);
  if (typeof req.body?.visible !== "boolean") {
    res.status(400);
    throw new Error("Choose whether tracking should be visible to the customer.");
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found.");
  }

  order.trackingVisibleToCustomer = req.body.visible;
  await order.save();
  res.json({ trackingVisibleToCustomer: order.trackingVisibleToCustomer });
}

export async function refreshAdminTracking(req, res) {
  validateOrderId(req, res);
  const order = await Order.findById(req.params.id).select("_id");
  if (!order) {
    res.status(404);
    throw new Error("Order not found.");
  }
  res.json(await refreshAfterTrackingOperation(order._id));
}

export async function refreshCustomerTracking(req, res) {
  validateOrderId(req, res);
  const order = await Order.findOne({ _id: req.params.orderId, user: req.user.id })
    .select("_id trackingVisibleToCustomer");
  if (!order) {
    res.status(404);
    throw new Error("Order not found.");
  }
  if (order.trackingVisibleToCustomer === false) {
    return res.json({ tracking: null, visible: false });
  }
  res.json({ ...(await refreshAfterTrackingOperation(order._id)), visible: true });
}

export async function swapOrderTracking(req, res) {
  const { firstOrderId, secondOrderId } = req.body || {};
  if (!mongoose.isValidObjectId(firstOrderId) || !mongoose.isValidObjectId(secondOrderId)) {
    res.status(400);
    throw new Error("Select two valid orders.");
  }
  if (String(firstOrderId) === String(secondOrderId)) {
    res.status(400);
    throw new Error("Choose two different orders.");
  }

  const firstKey = String(firstOrderId);
  const secondKey = String(secondOrderId);
  if (confirmations.has(firstKey) || confirmations.has(secondKey)) {
    res.status(409);
    throw new Error("A tracking update is already in progress for one of these orders. Try again shortly.");
  }

  const pendingRefreshes = [refreshes.get(firstKey), refreshes.get(secondKey)].filter(Boolean);
  const pending = (async () => {
    await Promise.all(pendingRefreshes);

    const session = await mongoose.startSession();
    let swappedOrders;
    try {
      await session.withTransaction(async () => {
        const orders = await Order.find({ _id: { $in: [firstOrderId, secondOrderId] } }).session(session);
        const firstOrder = orders.find((order) => String(order._id) === firstKey);
        const secondOrder = orders.find((order) => String(order._id) === secondKey);
        if (!firstOrder || !secondOrder) {
          const error = new Error("One of the selected orders was not found.");
          error.status = 404;
          throw error;
        }
        if (!firstOrder.tracking?.trackingNumber) {
          const error = new Error("The source order needs a confirmed Tracking ID before its tracking can be moved.");
          error.status = 400;
          throw error;
        }

        const firstTracking = firstOrder.tracking.toObject();
        const secondTracking = secondOrder.tracking?.trackingNumber ? secondOrder.tracking.toObject() : null;
        firstOrder.tracking = secondTracking;
        secondOrder.tracking = firstTracking;
        await firstOrder.save({ session });
        await secondOrder.save({ session });
        swappedOrders = [firstOrder, secondOrder].map((order) => ({
          _id: order._id,
          tracking: order.tracking?.toObject() || null,
        }));
      });
    } finally {
      await session.endSession();
    }

    return { orders: swappedOrders };
  })();

  confirmations.set(firstKey, pending);
  confirmations.set(secondKey, pending);
  try {
    res.json(await pending);
  } catch (error) {
    res.status(error.status || 500);
    throw error;
  } finally {
    if (confirmations.get(firstKey) === pending) confirmations.delete(firstKey);
    if (confirmations.get(secondKey) === pending) confirmations.delete(secondKey);
  }
}