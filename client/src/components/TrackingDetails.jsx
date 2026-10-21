const formatDateTime = (value) => value ? new Date(value).toLocaleString() : "Not available";
const formatDate = (value) => value ? new Date(value).toLocaleDateString() : "Not available";

export default function TrackingDetails({ tracking, refreshError = "", loading = false, emptyMessage = "Tracking has not been assigned yet." }) {
  if (!tracking?.trackingNumber) return <p className="tracking__empty">{emptyMessage}</p>;
  if (tracking.trackingUrl) {
    return (
      <div className="tracking">
        <dl className="tracking__summary">
          <div><dt>Tracking ID</dt><dd>{tracking.trackingNumber}</dd></div>
          <div><dt>Carrier</dt><dd>{tracking.carrierName || "Not available"}</dd></div>
        </dl>
        
        <a href={tracking.trackingUrl} target="_blank" rel="noreferrer">
          Track your order at: {tracking.trackingUrl}
        </a>
      </div>
    );
  }

  const events = tracking.events || [];
  const hasResults = Boolean(tracking.lastSuccessfulAt || tracking.status || events.length);
  const estimate = tracking.estimatedDeliveryDate
    ? formatDate(tracking.estimatedDeliveryDate)
    : tracking.courierEstimatedDeliveryDate?.from || tracking.courierEstimatedDeliveryDate?.to
    ? `${tracking.courierEstimatedDeliveryDate.from ? formatDate(tracking.courierEstimatedDeliveryDate.from) : ""}${tracking.courierEstimatedDeliveryDate.from && tracking.courierEstimatedDeliveryDate.to ? " - " : ""}${tracking.courierEstimatedDeliveryDate.to ? formatDate(tracking.courierEstimatedDeliveryDate.to) : ""}`
      : "Not available";

  return (
    <div className="tracking">
      <dl className="tracking__summary">
        <div><dt>Tracking ID</dt><dd>{tracking.trackingNumber}</dd></div>
        <div><dt>Carrier</dt><dd>{tracking.carrierName || "Not available"}</dd></div>
        <div><dt>Shipment status</dt><dd>{tracking.status || "Not available"}</dd></div>
        <div><dt>Estimated delivery</dt><dd>{estimate}</dd></div>
        <div><dt>Last successful update</dt><dd>{formatDateTime(tracking.lastSuccessfulAt)}</dd></div>
      </dl>
      {loading && <p className="tracking__meta" role="status">Updating tracking...</p>}
      {refreshError && (
        <p className="notice notice--error" role="status">
          {hasResults ? "Showing the last saved tracking information. " : "Tracking refresh failed. "}{refreshError}
        </p>
      )}
      {!hasResults && !refreshError && <p className="tracking__empty">Tracking information is not available yet.</p>}
      {events.length > 0 && (
        <ol className="tracking__events">
          {events.map((event, index) => (
            <li key={event.eventId || `${event.occurrenceDatetime}-${index}`}>
              <strong>{event.status || event.statusMilestone || "Shipment update"}</strong>
              <time>{formatDateTime(event.occurrenceDatetime)}</time>
              {event.location && <span>{event.location}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}