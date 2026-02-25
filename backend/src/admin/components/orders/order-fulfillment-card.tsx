import React from "react"
import { FulfillmentBadge } from "./order-badges"

interface OrderFulfillmentCardProps {
  order: any
  onMarkAsFulfilled: () => void
  isLoading?: boolean
}

const sectionStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E1E3E5",
  borderRadius: "10px",
  marginBottom: "16px",
  overflow: "hidden",
}

function formatCurrency(amount: number, currency?: string) {
  const c = (currency || "EUR").toUpperCase()
  if (c === "EUR") return `\u20AC${amount.toFixed(2)}`
  return `${amount.toFixed(2)} ${c}`
}

export function OrderFulfillmentCard({
  order,
  onMarkAsFulfilled,
  isLoading,
}: OrderFulfillmentCardProps) {
  const items = order.items || []
  const currency = order.currency_code
  const hasFulfillments = order.fulfillments && order.fulfillments.length > 0
  const shippingMethod =
    order.shipping_methods?.[0]?.name ||
    order.shipping_methods?.[0]?.shipping_option_id ||
    ""

  return (
    <div style={sectionStyle}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid #E1E3E5",
        }}
      >
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
            color: "#6D7175",
            borderBottom: "1px solid #F1F1F1",
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
                padding: "10px 0",
                borderBottom: "1px solid #F1F1F1",
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
                    borderRadius: "6px",
                    objectFit: "cover",
                    border: "1px solid #E1E3E5",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "6px",
                    background: "#F6F6F7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    color: "#8C9196",
                    border: "1px solid #E1E3E5",
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
                    color: "#2C6ECB",
                    textDecoration: "none",
                  }}
                >
                  {productTitle}
                </div>
                {variantTitle && variantTitle !== "default" && (
                  <div style={{ fontSize: "12px", color: "#6D7175", marginTop: "2px" }}>
                    {variantTitle}
                  </div>
                )}
                {sku && (
                  <div style={{ fontSize: "12px", color: "#8C9196", marginTop: "1px" }}>
                    SKU: {sku}
                  </div>
                )}
              </div>

              {/* Quantity x Price = Total */}
              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <div style={{ fontSize: "13px", color: "#1A1A1A" }}>
                  {formatCurrency(unitPrice, currency)} &times; {quantity}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#1A1A1A",
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

      {/* Mark as fulfilled button */}
      {!hasFulfillments && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "12px 20px",
            borderTop: "1px solid #E1E3E5",
          }}
        >
          <button
            onClick={onMarkAsFulfilled}
            disabled={isLoading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: isLoading ? "default" : "pointer",
              background: "#008060",
              color: "#FFFFFF",
              border: "1px solid #008060",
              transition: "all 0.15s ease",
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

      {/* Fulfilled info */}
      {hasFulfillments && (
        <div style={{ padding: "12px 20px", borderTop: "1px solid #E1E3E5" }}>
          {order.fulfillments.map((ful: any) => (
            <div
              key={ful.id}
              style={{
                fontSize: "13px",
                color: "#6D7175",
                padding: "4px 0",
              }}
            >
              <span style={{ fontWeight: 500, color: "#1A1A1A" }}>Fulfilled</span>
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
