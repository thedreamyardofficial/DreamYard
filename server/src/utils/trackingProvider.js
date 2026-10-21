import { env } from "../config/env.js";

const API_BASE = "https://api.ship24.com/public/v1";

class TrackingProviderError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  if (!env.trackingProviderApiKey) throw new TrackingProviderError("Tracking is not configured on the server.", 503);

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${env.trackingProviderApiKey}`,
        ...(options.body ? { "Content-Type": "application/json; charset=utf-8" } : {}),
      },
      signal: AbortSignal.timeout(65000),
    });
  } catch {
    throw new TrackingProviderError("The tracking provider could not be reached. Saved tracking information was kept.", 502);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(data.errors)
      ? data.errors.map((item) => item.message).filter(Boolean).join(" ")
      : data.message;
    const message = response.status === 429
      ? "The tracking provider rate limit was reached. Please retry later."
      : detail || `The tracking provider returned HTTP ${response.status}.`;
    throw new TrackingProviderError(message, response.status === 429 ? 429 : 502);
  }
  return data;
}

export async function createTrackingRecord(order, trackingNumber) {
  const body = {
    trackingNumber,
    shipmentReference: `dreamyard-order-${order._id}`,
    destinationCountryCode: "IN",
    destinationPostCode: order.customer.pincode,
  };
  const data = await request("/trackers", { method: "POST", body: JSON.stringify(body) });
  const tracker = data.data?.tracker;
  if (!tracker?.trackerId) throw new TrackingProviderError("The tracking provider did not return a tracker ID.", 502);
  return tracker;
}

export async function getTrackingResults(trackerId) {
  const data = await request(`/trackers/${encodeURIComponent(trackerId)}/results`);
  const tracking = data.data?.trackings?.[0];
  if (!tracking?.tracker || !tracking?.shipment) {
    throw new TrackingProviderError("The tracking provider has not returned tracking information yet.", 502);
  }
  return tracking;
}