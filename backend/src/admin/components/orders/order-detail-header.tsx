import React from "react"
import { useNavigate } from "react-router-dom"
import { PaymentBadge, DeliveryBadge, FulfillmentBadge } from "./order-badges"

interface OrderDetailHeaderProps {
  order: any
}

function getPaymentStatus(order: any): string {
  if (order.payment_collections?.length) {
    const pc = order.payment_collections[0]
    if (pc.status === "captured" || pc.status === "completed") return "paid"
    if (pc.status === "refunded") return "refunded"
    return pc.status || "pending"
  }
  return "pending"
}

export function OrderDetailHeader({ order }: OrderDetailHeaderProps) {
  const navigate = useNavigate()
  const paymentStatus = getPaymentStatus(order)
  const deliveryStatus = order.metadata?.baselinker_status || ""
  const hasFulfillments = order.fulfillments && order.fulfillments.length > 0
  const createdAt = new Date(order.created_at)

  return (
    <div style={{ marginBottom: "24px" }}>
      {/* Back button */}
      <button
        onClick={() => navigate("/custom-orders")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 0",
          border: "none",
          background: "none",
          cursor: "pointer",
          fontSize: "13px",
          color: "#6D7175",
          marginBottom: "16px",
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#1A1A1A")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#6D7175")}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 4l-6 6 6 6" />
        </svg>
        Back to orders
      </button>

      {/* Title row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "#1A1A1A",
              margin: 0,
            }}
          >
            Order #{order.display_id}
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "#6D7175",
              marginTop: "4px",
            }}
          >
            {createdAt.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            at{" "}
            {createdAt.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </p>
        </div>
      </div>

      {/* Status badges */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <PaymentBadge status={paymentStatus} />
        {deliveryStatus && <DeliveryBadge status={deliveryStatus} />}
        <FulfillmentBadge fulfilled={hasFulfillments} />
      </div>
    </div>
  )
}
