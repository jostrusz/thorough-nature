import React from "react"
import { useParams } from "react-router-dom"
// Simple loading spinner
function LoadingSpinner() {
  return (
    <div style={{
      width: "24px",
      height: "24px",
      border: "3px solid #E1E3E5",
      borderTopColor: "#008060",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
import { useOrderDetail } from "../../../hooks/use-order-detail"
import { OrderDetailHeader } from "../../../components/orders/order-detail-header"
import { OrderDetailItems } from "../../../components/orders/order-detail-items"
import { OrderDetailCustomer } from "../../../components/orders/order-detail-customer"
import { OrderDetailPayment } from "../../../components/orders/order-detail-payment"
import { OrderDetailTimeline } from "../../../components/orders/order-detail-timeline"
import { OrderDetailMetadata } from "../../../components/orders/order-detail-metadata"

const pageStyle: React.CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "24px 32px",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
}

const OrderDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useOrderDetail(id)

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 20px",
        }}
      >
        <LoadingSpinner />
      </div>
    )
  }

  if (error || !data?.order) {
    return (
      <div style={pageStyle}>
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "#8C9196",
          }}
        >
          <p style={{ fontSize: "14px" }}>
            {error ? `Error: ${(error as Error).message}` : "Order not found"}
          </p>
        </div>
      </div>
    )
  }

  const order = data.order

  return (
    <div style={pageStyle}>
      {/* Header */}
      <OrderDetailHeader order={order} />

      {/* Two-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 380px",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* Left column - Main content */}
        <div>
          <OrderDetailItems order={order} />
          <OrderDetailPayment order={order} />
          <OrderDetailTimeline order={order} />
          <OrderDetailMetadata order={order} />
        </div>

        {/* Right column - Sidebar */}
        <div>
          <OrderDetailCustomer order={order} />
        </div>
      </div>
    </div>
  )
}

export default OrderDetailPage
