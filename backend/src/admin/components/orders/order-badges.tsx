import React from "react"

// ═══════════════════════════════════════════
// PAYMENT BADGE
// ═══════════════════════════════════════════
const PAYMENT_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  paid: { bg: "#AEE9D1", text: "#0D5740", dot: "#0D5740", label: "Paid" },
  captured: { bg: "#AEE9D1", text: "#0D5740", dot: "#0D5740", label: "Paid" },
  pending: { bg: "#FFD79D", text: "#7A4F01", dot: "#7A4F01", label: "Payment pending" },
  authorized: { bg: "#FFD79D", text: "#7A4F01", dot: "#7A4F01", label: "Authorized" },
  requires_action: { bg: "#FFD79D", text: "#7A4F01", dot: "#7A4F01", label: "Requires action" },
  refunded: { bg: "#E4E5E7", text: "#44474A", dot: "#44474A", label: "Refunded" },
  partially_refunded: { bg: "#F0E0FF", text: "#6B21A8", dot: "#6B21A8", label: "Partially refunded" },
  canceled: { bg: "#E4E5E7", text: "#44474A", dot: "#44474A", label: "Canceled" },
}

export function PaymentBadge({ status }: { status: string }) {
  const style = PAYMENT_STYLES[status] || PAYMENT_STYLES.pending
  return (
    <span
      className="od-badge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 10px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: 600,
        whiteSpace: "nowrap",
        background: style.bg,
        color: style.text,
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        cursor: "default",
      }}
    >
      <span
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: style.dot,
          flexShrink: 0,
        }}
      />
      {style.label}
    </span>
  )
}

// ═══════════════════════════════════════════
// DELIVERY BADGE — Updated for Dextrum statuses
// ═══════════════════════════════════════════
const DELIVERY_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  // Dextrum delivery statuses (uppercase keys from metadata.dextrum_status)
  NEW: { bg: "#DBEAFE", text: "#1E40AF", dot: "#1E40AF", label: "New" },
  WAITING: { bg: "#FFD79D", text: "#7A4F01", dot: "#7A4F01", label: "Waiting" },
  IMPORTED: { bg: "#E0E7FF", text: "#3730A3", dot: "#3730A3", label: "Imported" },
  PROCESSED: { bg: "#FEF3C7", text: "#92400E", dot: "#92400E", label: "Processed" },
  PACKED: { bg: "#A4E8F2", text: "#0E4F5C", dot: "#0E4F5C", label: "Packed" },
  DISPATCHED: { bg: "#D1FAE5", text: "#047857", dot: "#047857", label: "Dispatched" },
  IN_TRANSIT: { bg: "#A4E8F2", text: "#0E4F5C", dot: "#0E4F5C", label: "In Transit" },
  DELIVERED: { bg: "#AEE9D1", text: "#0D5740", dot: "#0D5740", label: "Delivered" },
  ALLOCATION_ISSUE: { bg: "#FED3D1", text: "#9E2B25", dot: "#9E2B25", label: "Stock Issue" },
  PARTIALLY_PICKED: { bg: "#FFD79D", text: "#7A4F01", dot: "#7A4F01", label: "Partial Pick" },
  CANCELLED: { bg: "#E4E5E7", text: "#44474A", dot: "#44474A", label: "Cancelled" },
  FAILED: { bg: "#FED3D1", text: "#9E2B25", dot: "#9E2B25", label: "Failed" },
}

export function DeliveryBadge({ status }: { status?: string }) {
  if (!status) {
    return <span style={{ color: "#8C9196", fontSize: "12px" }}>&mdash;</span>
  }
  const style = DELIVERY_STYLES[status] || { bg: "#E4E5E7", text: "#44474A", dot: "#44474A", label: status }
  return (
    <span
      className="od-badge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 10px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: 600,
        whiteSpace: "nowrap",
        background: style.bg,
        color: style.text,
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        cursor: "default",
      }}
    >
      <span
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: style.dot,
          flexShrink: 0,
        }}
      />
      {style.label}
    </span>
  )
}

// ═══════════════════════════════════════════
// FULFILLMENT BADGE
// ═══════════════════════════════════════════
export function FulfillmentBadge({ fulfilled }: { fulfilled: boolean }) {
  if (fulfilled) {
    return (
      <span
        className="od-badge"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          padding: "3px 10px",
          borderRadius: "12px",
          fontSize: "12px",
          fontWeight: 600,
          whiteSpace: "nowrap",
          background: "#E4E5E7",
          color: "#44474A",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
          cursor: "default",
        }}
      >
        <span
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: "#44474A",
            flexShrink: 0,
          }}
        />
        Fulfilled
      </span>
    )
  }
  return (
    <span
      className="od-badge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 10px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: 600,
        whiteSpace: "nowrap",
        background: "#FED3D1",
        color: "#9E2B25",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        cursor: "default",
      }}
    >
      <span
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: "#9E2B25",
          flexShrink: 0,
        }}
      />
      Unfulfilled
    </span>
  )
}
