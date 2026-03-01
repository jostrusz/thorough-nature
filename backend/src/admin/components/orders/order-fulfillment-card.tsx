import React from "react"
import { FulfillmentBadge } from "./order-badges"
import { formatCurrency } from "../../lib/format-currency"
import {
  colors,
  shadows,
  radii,
  cardStyle,
  cardHeaderStyle,
  btnPrimary,
  fontStack,
} from "./design-tokens"

interface OrderFulfillmentCardProps {
  order: any
  onMarkAsFulfilled: () => void
  onSendToDextrum: () => void
  onFakturoidCreate: () => void
  onQBCreate: () => void
  isLoading?: boolean
  isDextrumLoading?: boolean
  isFakturoidLoading?: boolean
  isQBLoading?: boolean
}

export function OrderFulfillmentCard({
  order,
  onMarkAsFulfilled,
  onSendToDextrum,
  onFakturoidCreate,
  onQBCreate,
  isLoading,
  isDextrumLoading,
  isFakturoidLoading,
  isQBLoading,
}: OrderFulfillmentCardProps) {
  const items = order.items || []
  const currency = order.currency_code
  const hasFulfillments = order.fulfillments && order.fulfillments.length > 0
  const shippingMethod =
    order.shipping_methods?.[0]?.name ||
    order.shipping_methods?.[0]?.shipping_option_id ||
    ""
  const hasDextrum = !!order.metadata?.dextrum_order_code
  const hasFakturoid = !!order.metadata?.fakturoid_invoice_id
  const hasQB = !!order.metadata?.quickbooks_invoice_id

  return (
    <div
      style={{
        ...cardStyle,
        fontFamily: fontStack,
        transition: "box-shadow 0.25s ease, transform 0.25s ease",
      }}
    >
      {/* Header */}
      <div style={cardHeaderStyle}>
        <FulfillmentBadge fulfilled={hasFulfillments} />
      </div>

      {/* Shipping method */}
      {shippingMethod && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 20px",
            fontSize: "13px",
            color: colors.textSec,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="1" y="6" width="12" height="9" rx="1" />
            <path d="M13 9h4l2 3v3h-6V9zM4 18a2 2 0 104 0M14 18a2 2 0 104 0" />
          </svg>
          {shippingMethod}
        </div>
      )}

      {/* Items list */}
      <div style={{ padding: "12px 20px" }}>
        {items.map((item: any) => {
          const productTitle =
            item.variant?.product?.title || item.title || "Unknown product"
          const variantTitle = item.variant?.title || ""
          const sku = item.variant?.sku || ""
          const thumbnail = item.variant?.product?.thumbnail || item.thumbnail
          const quantity = item.quantity || 1
          const unitPrice = Number(item.unit_price) || 0
          const total = unitPrice * quantity

          return (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 4px",
                borderBottom: `1px solid ${colors.border}`,
                borderRadius: radii.xs,
                margin: "0 -4px",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.bgHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent"
              }}
            >
              {/* Thumbnail */}
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt={productTitle}
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: radii.xs,
                    objectFit: "cover",
                    border: `1px solid ${colors.border}`,
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: radii.xs,
                    background: colors.bgHover,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    color: colors.textMuted,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  {"\uD83D\uDCD6"}
                </div>
              )}

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: colors.accent,
                    textDecoration: "none",
                    cursor: "pointer",
                    transition: "color 0.15s ease",
                  }}
                >
                  {productTitle}
                </div>
                {variantTitle && variantTitle !== "default" && (
                  <div style={{ fontSize: "12px", color: colors.textSec, marginTop: "2px" }}>
                    {variantTitle}
                  </div>
                )}
                {sku && (
                  <div style={{ fontSize: "12px", color: colors.textMuted, marginTop: "1px" }}>
                    SKU: {sku}
                  </div>
                )}
              </div>

              {/* Quantity x Price = Total */}
              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <div style={{ fontSize: "13px", color: colors.text }}>
                  {formatCurrency(unitPrice, currency)} &times; {quantity}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: colors.text,
                    marginTop: "2px",
                  }}
                >
                  {formatCurrency(total, currency)}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Action buttons */}
      {!hasFulfillments && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            flexWrap: "wrap",
            padding: "12px 20px",
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          {/* Send to Dextrum WMS */}
          {!hasDextrum && (
            <button
              onClick={onSendToDextrum}
              disabled={isDextrumLoading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: radii.xs,
                fontSize: "12px",
                fontWeight: 500,
                cursor: isDextrumLoading ? "default" : "pointer",
                opacity: isDextrumLoading ? 0.6 : 1,
                border: `1px solid ${colors.border}`,
                background: "#FFFFFF",
                color: colors.text,
                transition: "all 0.15s ease",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="4" width="16" height="12" rx="2" />
                <path d="M2 8h16M7 4v4M13 4v4" />
              </svg>
              {isDextrumLoading ? "Sending..." : "Send to Dextrum"}
            </button>
          )}

          {/* Mark as fulfilled */}
          <button
            onClick={onMarkAsFulfilled}
            disabled={isLoading}
            style={{
              ...btnPrimary,
              cursor: isLoading ? "default" : "pointer",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="4 10 8 14 16 6" />
            </svg>
            {isLoading ? "Fulfilling..." : "Mark as fulfilled"}
          </button>
        </div>
      )}

      {/* Invoice action buttons */}
      {(!hasFakturoid || !hasQB) && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            flexWrap: "wrap",
            padding: "10px 20px",
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          {!hasFakturoid && (
            <button
              onClick={onFakturoidCreate}
              disabled={isFakturoidLoading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: radii.xs,
                fontSize: "12px",
                fontWeight: 600,
                cursor: isFakturoidLoading ? "default" : "pointer",
                opacity: isFakturoidLoading ? 0.6 : 1,
                border: `1px solid ${colors.border}`,
                background: "#FFFFFF",
                color: "#008060",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "11px", fontWeight: 700 }}>fa</span>
              {isFakturoidLoading ? "Creating..." : "Send to Fakturoid"}
            </button>
          )}
          {!hasQB && (
            <button
              onClick={onQBCreate}
              disabled={isQBLoading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: radii.xs,
                fontSize: "12px",
                fontWeight: 600,
                cursor: isQBLoading ? "default" : "pointer",
                opacity: isQBLoading ? 0.6 : 1,
                border: `1px solid ${colors.border}`,
                background: "#FFFFFF",
                color: "#2CA01C",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "11px", fontWeight: 700 }}>qb</span>
              {isQBLoading ? "Creating..." : "Send to QuickBooks"}
            </button>
          )}
        </div>
      )}

      {/* Fulfilled info */}
      {hasFulfillments && (
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${colors.border}` }}>
          {order.fulfillments.map((ful: any) => (
            <div
              key={ful.id}
              style={{
                fontSize: "13px",
                color: colors.textSec,
                padding: "4px 0",
              }}
            >
              <span style={{ fontWeight: 500, color: colors.text }}>Fulfilled</span>
              {" on "}
              {new Date(ful.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {ful.tracking_numbers?.length > 0 && (
                <span>
                  {" \u2022 Tracking: "}
                  {ful.tracking_numbers.join(", ")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
