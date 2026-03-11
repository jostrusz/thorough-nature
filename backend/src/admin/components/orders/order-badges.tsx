import React from "react"
import { colors } from "./design-tokens"

// ═══════════════════════════════════════════
// SHARED BADGE STYLES
// ═══════════════════════════════════════════
const badgeBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 10px",
  borderRadius: "5px",
  fontSize: "11px",
  fontWeight: 600,
  whiteSpace: "nowrap",
}

// ═══════════════════════════════════════════
// PAYMENT BADGE
// ═══════════════════════════════════════════
const PAYMENT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  paid:                { bg: "rgba(0,179,122,0.08)",  text: "#00B37A", label: "Paid" },
  pending:             { bg: "rgba(212,160,23,0.08)", text: "#D4A017", label: "Pending" },
  authorized:          { bg: "rgba(59,130,246,0.07)", text: "#3B82F6", label: "Authorized" },
  requires_action:     { bg: "rgba(212,160,23,0.08)", text: "#D4A017", label: "Requires action" },
  refunded:            { bg: "rgba(0,0,0,0.04)",      text: "#6B7185", label: "Refunded" },
  partially_refunded:  { bg: "rgba(0,0,0,0.04)",      text: "#6B7185", label: "Part. Refunded" },
  canceled:            { bg: "rgba(231,76,60,0.07)",  text: "#E74C3C", label: "Canceled" },
  failed:              { bg: "rgba(231,76,60,0.07)",  text: "#E74C3C", label: "Failed" },
  captured:            { bg: "rgba(0,179,122,0.08)",  text: "#00B37A", label: "Captured" },
}

export function PaymentBadge({ status }: { status: string }) {
  const style = PAYMENT_STYLES[status] || PAYMENT_STYLES.pending
  return (
    <span
      className="od-badge"
      style={{
        ...badgeBase,
        background: style.bg,
        color: style.text,
      }}
    >
      {style.label}
    </span>
  )
}

// ═══════════════════════════════════════════
// DELIVERY BADGE — Updated for Dextrum statuses
// ═══════════════════════════════════════════
const DELIVERY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  // Medusa fulfillment statuses (fallback when no Dextrum status)
  unfulfilled:       { bg: "rgba(212,160,23,0.08)",  text: "#D4A017", label: "Unfulfilled" },
  fulfilled:         { bg: "rgba(0,179,122,0.08)",   text: "#00B37A", label: "Fulfilled" },
  partially_fulfilled: { bg: "rgba(59,130,246,0.07)", text: "#3B82F6", label: "Partial" },

  // Dextrum delivery statuses (uppercase keys from metadata.dextrum_status)
  NEW:               { bg: "rgba(212,160,23,0.08)",  text: "#D4A017", label: "New" },
  WAITING:           { bg: "rgba(212,160,23,0.08)",  text: "#D4A017", label: "Waiting" },
  IMPORTED:          { bg: "rgba(59,130,246,0.07)",  text: "#3B82F6", label: "Imported" },
  PROCESSED:         { bg: "rgba(59,130,246,0.07)",  text: "#3B82F6", label: "Processed" },
  PACKED:            { bg: "rgba(108,92,231,0.08)",  text: "#6C5CE7", label: "Packed" },
  DISPATCHED:        { bg: "rgba(59,130,246,0.07)",  text: "#3B82F6", label: "Dispatched" },
  IN_TRANSIT:        { bg: "rgba(59,130,246,0.07)",  text: "#3B82F6", label: "In Transit" },
  DELIVERED:         { bg: "rgba(0,179,122,0.08)",   text: "#00B37A", label: "Delivered" },
  ALLOCATION_ISSUE:  { bg: "rgba(231,76,60,0.07)",   text: "#E74C3C", label: "Stock Issue" },
  PARTIALLY_PICKED:  { bg: "rgba(212,160,23,0.08)",  text: "#D4A017", label: "Partial Pick" },
  CANCELLED:         { bg: "rgba(0,0,0,0.04)",       text: "#6B7185", label: "Cancelled" },
  FAILED:            { bg: "rgba(231,76,60,0.07)",   text: "#E74C3C", label: "Failed" },
}

export function DeliveryBadge({ status }: { status?: string }) {
  if (!status) {
    return <span style={{ color: colors.textMuted, fontSize: "12px" }}>&mdash;</span>
  }
  const style = DELIVERY_STYLES[status] || { bg: "rgba(0,0,0,0.04)", text: "#6B7185", label: status }
  return (
    <span
      className="od-badge"
      style={{
        ...badgeBase,
        background: style.bg,
        color: style.text,
      }}
    >
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
          ...badgeBase,
          background: colors.greenBg,
          color: colors.green,
        }}
      >
        Fulfilled
      </span>
    )
  }
  return (
    <span
      className="od-badge"
      style={{
        ...badgeBase,
        background: colors.orangeBg,
        color: colors.orange,
      }}
    >
      Unfulfilled
    </span>
  )
}
