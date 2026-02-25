import React, { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { PaymentBadge, DeliveryBadge } from "./order-badges"
import { BookSentToggle } from "./book-sent-toggle"
import { CountryFlag } from "./country-flag"
import { OrderTag } from "./order-tag"
import { useUpdateMetadata } from "../../hooks/use-update-metadata"
import { toast } from "@medusajs/ui"

interface OrdersTableProps {
  orders: any[]
  isLoading?: boolean
  selectedOrders: Set<string>
  onSelectionChange: (selected: Set<string>) => void
  sortField: string
  sortDir: string
  onSort: (field: string) => void
}

// ═══════════════════════════════════════════
// DATE FORMATTING
// ═══════════════════════════════════════════
function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  if (isToday) return `Today at ${time}`
  if (isYesterday) return `Yesterday at ${time}`
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ` at ${time}`
  )
}

// ═══════════════════════════════════════════
// CURRENCY FORMATTING
// ═══════════════════════════════════════════
function formatCurrency(amount: number, currency?: string) {
  const c = (currency || "EUR").toUpperCase()
  if (c === "EUR") return `\u20AC${amount.toFixed(2)}`
  return `${amount.toFixed(2)} ${c}`
}

// ═══════════════════════════════════════════
// HELPER: determine payment status from order
// ═══════════════════════════════════════════
function getPaymentStatus(order: any): string {
  if (order.payment_collections?.length) {
    const pc = order.payment_collections[0]
    if (pc.status === "captured" || pc.status === "completed") return "paid"
    if (pc.status === "refunded") return "refunded"
    if (pc.status === "partially_refunded") return "partially_refunded"
    if (pc.status === "authorized") return "authorized"
    return pc.status || "pending"
  }
  return "pending"
}

// ═══════════════════════════════════════════
// HELPER: get customer name
// ═══════════════════════════════════════════
function getCustomerName(order: any): string {
  const addr = order.shipping_address
  if (addr?.first_name || addr?.last_name) {
    return [addr.first_name, addr.last_name].filter(Boolean).join(" ")
  }
  return order.email || "Unknown"
}

// ═══════════════════════════════════════════
// HELPER: get tag (from metadata or first item product title)
// ═══════════════════════════════════════════
function getTag(order: any): string {
  if (order.metadata?.tags) return order.metadata.tags
  if (order.items?.length > 0) {
    const product = order.items[0]?.variant?.product
    if (product?.title) return product.title
    if (order.items[0]?.title) return order.items[0].title
  }
  return ""
}

// ═══════════════════════════════════════════
// TABLE STYLES
// ═══════════════════════════════════════════
const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: "12px",
  fontWeight: 600,
  color: "#6D7175",
  borderBottom: "1px solid #E1E3E5",
  whiteSpace: "nowrap",
  userSelect: "none",
  cursor: "pointer",
  transition: "color 0.15s",
  background: "#FFFFFF",
  position: "sticky",
  top: 0,
  zIndex: 2,
}

const tdStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "13px",
  borderBottom: "1px solid #F1F1F1",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
}

// ═══════════════════════════════════════════
// SKELETON LOADING
// ═══════════════════════════════════════════
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i}>
          <td style={{ ...tdStyle, width: "40px", textAlign: "center" }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "4px", background: "#EBEBEB", margin: "0 auto" }} />
          </td>
          <td style={tdStyle}><div style={{ width: "60px", height: "14px", borderRadius: "4px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}><div style={{ width: "130px", height: "14px", borderRadius: "4px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}><div style={{ width: "140px", height: "14px", borderRadius: "4px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}><div style={{ width: "60px", height: "14px", borderRadius: "4px", background: "#EBEBEB" }} /></td>
          <td style={{ ...tdStyle, textAlign: "center" }}><div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "#EBEBEB", margin: "0 auto" }} /></td>
          <td style={tdStyle}><div style={{ width: "70px", height: "22px", borderRadius: "12px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}><div style={{ width: "70px", height: "22px", borderRadius: "12px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}><div style={{ width: "50px", height: "14px", borderRadius: "4px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}><div style={{ width: "120px", height: "22px", borderRadius: "6px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}><div style={{ width: "50px", height: "14px", borderRadius: "4px", background: "#EBEBEB" }} /></td>
        </tr>
      ))}
    </>
  )
}

// ═══════════════════════════════════════════
// CHECKBOX
// ═══════════════════════════════════════════
function Checkbox({
  checked,
  indeterminate,
  onClick,
}: {
  checked: boolean
  indeterminate?: boolean
  onClick: () => void
}) {
  let bg = "#fff"
  let border = "#C9CCCF"
  if (checked || indeterminate) {
    bg = "#008060"
    border = "#008060"
  }

  return (
    <div
      onClick={onClick}
      style={{
        width: "18px",
        height: "18px",
        border: `2px solid ${border}`,
        borderRadius: "4px",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        transition: "all 0.15s ease",
        position: "relative",
      }}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 16 16" fill="white">
          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
        </svg>
      )}
      {indeterminate && !checked && (
        <div
          style={{
            width: "8px",
            height: "2px",
            background: "#fff",
            borderRadius: "1px",
          }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export function OrdersTable({
  orders,
  isLoading,
  selectedOrders,
  onSelectionChange,
  sortField,
  sortDir,
  onSort,
}: OrdersTableProps) {
  const navigate = useNavigate()
  const updateMetadata = useUpdateMetadata()

  const allSelected = orders.length > 0 && orders.every((o) => selectedOrders.has(o.id))
  const someSelected = orders.some((o) => selectedOrders.has(o.id))

  function toggleSelectAll() {
    if (allSelected) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(orders.map((o) => o.id)))
    }
  }

  function toggleOrder(orderId: string) {
    const next = new Set(selectedOrders)
    if (next.has(orderId)) {
      next.delete(orderId)
    } else {
      next.add(orderId)
    }
    onSelectionChange(next)
  }

  function handleBookSentToggle(order: any) {
    const currentValue = order.metadata?.book_sent === true || order.metadata?.book_sent === "true"
    updateMetadata.mutate(
      { orderId: order.id, metadata: { book_sent: !currentValue } },
      {
        onSuccess: () => {
          toast.success(`Book sent ${!currentValue ? "marked" : "unmarked"} for #${order.display_id}`)
        },
        onError: () => {
          toast.error("Failed to update book sent status")
        },
      }
    )
  }

  function renderSortIcon(field: string) {
    if (sortField !== field) return <span style={{ opacity: 0, marginLeft: "4px", fontSize: "10px" }}>{"\u25BC"}</span>
    return (
      <span style={{ marginLeft: "4px", fontSize: "10px" }}>
        {sortDir === "DESC" ? "\u25BC" : "\u25B2"}
      </span>
    )
  }

  if (isLoading) {
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: "40px", textAlign: "center", cursor: "default" }}></th>
              <th style={thStyle}>Order</th>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Customer</th>
              <th style={thStyle}>Total</th>
              <th style={{ ...thStyle, textAlign: "center", cursor: "default" }}>Book sent</th>
              <th style={thStyle}>Payment</th>
              <th style={thStyle}>Delivery</th>
              <th style={thStyle}>Items</th>
              <th style={thStyle}>Tags</th>
              <th style={thStyle}>Country</th>
            </tr>
          </thead>
          <tbody>
            <SkeletonRows />
          </tbody>
        </table>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "60px 20px",
          color: "#8C9196",
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ marginBottom: "12px", opacity: 0.4 }}
        >
          <rect x="6" y="10" width="36" height="28" rx="3" />
          <path d="M6 18h36M18 10v8" />
        </svg>
        <p style={{ fontSize: "14px" }}>No orders match your filters</p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: "40px", textAlign: "center", cursor: "default" }}>
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                onClick={toggleSelectAll}
              />
            </th>
            <th style={thStyle} onClick={() => onSort("display_id")}>
              Order {renderSortIcon("display_id")}
            </th>
            <th style={thStyle} onClick={() => onSort("created_at")}>
              Date {renderSortIcon("created_at")}
            </th>
            <th style={thStyle} onClick={() => onSort("customer")}>
              Customer {renderSortIcon("customer")}
            </th>
            <th style={thStyle} onClick={() => onSort("total")}>
              Total {renderSortIcon("total")}
            </th>
            <th style={{ ...thStyle, textAlign: "center", cursor: "default" }}>
              Book sent
            </th>
            <th style={thStyle}>Payment</th>
            <th style={thStyle}>Delivery</th>
            <th style={thStyle}>Items</th>
            <th style={thStyle}>Tags</th>
            <th style={thStyle}>Country</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const isSelected = selectedOrders.has(order.id)
            const paymentStatus = getPaymentStatus(order)
            const customerName = getCustomerName(order)
            const tag = getTag(order)
            const countryCode = order.shipping_address?.country_code
            const deliveryStatus = order.metadata?.dextrum_status || ""
            const bookSent = order.metadata?.book_sent === true || order.metadata?.book_sent === "true"
            const itemCount = order.items?.length || 0
            const total = Number(order.total) || 0

            return (
              <tr
                key={order.id}
                style={{
                  background: isSelected ? "#F2F7FE" : "transparent",
                  transition: "background 0.12s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "#F9FAFB"
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent"
                }}
              >
                <td
                  style={{ ...tdStyle, width: "40px", textAlign: "center" }}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleOrder(order.id)
                  }}
                >
                  <Checkbox checked={isSelected} onClick={() => toggleOrder(order.id)} />
                </td>
                <td
                  style={tdStyle}
                  onClick={() => navigate(`/custom-orders/${order.id}`)}
                >
                  <span
                    style={{
                      color: "#2C6ECB",
                      fontWeight: 600,
                      cursor: "pointer",
                      textDecoration: "none",
                    }}
                  >
                    #{order.display_id}
                  </span>
                </td>
                <td
                  style={tdStyle}
                  onClick={() => navigate(`/custom-orders/${order.id}`)}
                >
                  <span style={{ color: "#1A1A1A" }}>{formatDate(order.created_at)}</span>
                </td>
                <td
                  style={tdStyle}
                  onClick={() => navigate(`/custom-orders/${order.id}`)}
                >
                  {customerName}
                </td>
                <td
                  style={tdStyle}
                  onClick={() => navigate(`/custom-orders/${order.id}`)}
                >
                  <strong>{formatCurrency(total, order.currency_code)}</strong>
                </td>
                <td
                  style={{ ...tdStyle, textAlign: "center" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <BookSentToggle
                    sent={bookSent}
                    onClick={() => handleBookSentToggle(order)}
                  />
                </td>
                <td
                  style={tdStyle}
                  onClick={() => navigate(`/custom-orders/${order.id}`)}
                >
                  <PaymentBadge status={paymentStatus} />
                </td>
                <td
                  style={tdStyle}
                  onClick={() => navigate(`/custom-orders/${order.id}`)}
                >
                  <DeliveryBadge status={deliveryStatus} />
                </td>
                <td
                  style={tdStyle}
                  onClick={() => navigate(`/custom-orders/${order.id}`)}
                >
                  <span style={{ color: "#6D7175" }}>
                    {itemCount} item{itemCount !== 1 ? "s" : ""}
                  </span>
                </td>
                <td
                  style={tdStyle}
                  onClick={() => navigate(`/custom-orders/${order.id}`)}
                >
                  <OrderTag tag={tag} countryCode={countryCode} />
                </td>
                <td
                  style={tdStyle}
                  onClick={() => navigate(`/custom-orders/${order.id}`)}
                >
                  <CountryFlag code={countryCode} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
