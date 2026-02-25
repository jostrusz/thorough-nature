import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { PaymentBadge, FulfillmentBadge } from "./order-badges"
import { OrderActionsDropdown } from "./order-actions-dropdown"

interface OrderDetailHeaderProps {
  order: any
  onRefund: () => void
  onEdit: () => void
  onCancel: () => void
  onDuplicate: () => void
  onArchive: () => void
  onSendToBaseLinker: () => void
  onFakturoidCreate: () => void
  onFakturoidOpen: () => void
}

const btnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "7px 14px",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid #E1E3E5",
  background: "#FFFFFF",
  color: "#1A1A1A",
  transition: "all 0.15s ease",
  whiteSpace: "nowrap" as const,
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

export function OrderDetailHeader({
  order,
  onRefund,
  onEdit,
  onCancel,
  onDuplicate,
  onArchive,
  onSendToBaseLinker,
  onFakturoidCreate,
  onFakturoidOpen,
}: OrderDetailHeaderProps) {
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const paymentStatus = getPaymentStatus(order)
  const hasFulfillments = order.fulfillments && order.fulfillments.length > 0
  const createdAt = new Date(order.created_at)
  const fakturoidInvoiceId = order.metadata?.fakturoid_invoice_id
  const fakturoidInvoiceUrl = order.metadata?.fakturoid_invoice_url
  const baselinkerOrderId = order.metadata?.baselinker_order_id

  // Set the order ID for the status page link in dropdown
  if (typeof window !== "undefined") {
    ;(window as any).__orderIdForStatusPage = order.id
  }

  return (
    <div style={{ marginBottom: "24px" }}>
      {/* Breadcrumb */}
      <button
        onClick={() => navigate("/custom-orders")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
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
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 4l-6 6 6 6" />
        </svg>
        Orders
      </button>

      {/* Title row with actions */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "8px",
        }}
      >
        {/* Left: Order number + badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "#1A1A1A",
              margin: 0,
            }}
          >
            #{order.display_id}
          </h1>
          <PaymentBadge status={paymentStatus} />
          <FulfillmentBadge fulfilled={hasFulfillments} />
        </div>

        {/* Right: Action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={onRefund}
            style={btnStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
          >
            Refund
          </button>
          <button
            onClick={onEdit}
            style={btnStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
          >
            Edit
          </button>

          {/* More actions dropdown */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                ...btnStyle,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
            >
              More actions
              <svg
                width="12"
                height="12"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 8l5 5 5-5" />
              </svg>
            </button>
            <OrderActionsDropdown
              open={dropdownOpen}
              onClose={() => setDropdownOpen(false)}
              onDuplicate={onDuplicate}
              onCancel={onCancel}
              onArchive={onArchive}
              onSendToBaseLinker={onSendToBaseLinker}
              onFakturoidCreate={onFakturoidCreate}
              onFakturoidOpen={onFakturoidOpen}
              fakturoidInvoiceId={fakturoidInvoiceId}
              fakturoidInvoiceUrl={fakturoidInvoiceUrl}
              baselinkerOrderId={baselinkerOrderId}
            />
          </div>
        </div>
      </div>

      {/* Date subtitle */}
      <p
        style={{
          fontSize: "13px",
          color: "#6D7175",
          margin: 0,
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
        {order.metadata?.source && (
          <span style={{ color: "#8C9196" }}> from {order.metadata.source}</span>
        )}
      </p>
    </div>
  )
}
