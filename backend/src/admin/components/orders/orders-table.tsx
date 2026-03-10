import React, { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { PaymentBadge, DeliveryBadge } from "./order-badges"
import { BookSentToggle } from "./book-sent-toggle"
import { CountryFlag } from "./country-flag"
import { OrderTag } from "./order-tag"
import { useUpdateMetadata } from "../../hooks/use-update-metadata"
import { toast } from "@medusajs/ui"
import { colors, radii, shadows, getPaymentIconUrl, getPaymentFallback, getOrderDisplayNumber } from "./design-tokens"
import { formatCurrency } from "../../lib/format-currency"

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

// Currency formatting — uses shared multi-currency utility from lib/format-currency

// ═══════════════════════════════════════════
// HELPER: determine payment status from order
// ═══════════════════════════════════════════
function getPaymentStatus(order: any): string {
  // If metadata says captured, trust it (auto-capture or manual)
  if (order.metadata?.payment_captured) return "paid"

  // COD orders: stay "pending" until explicitly marked as captured
  // Check payment_collections AND metadata (metadata survives order edits that cancel PCs)
  const isCOD = (order.payment_collections || []).some((pc: any) =>
    (pc.payments || []).some((p: any) => (p.provider_id || "").includes("cod"))
  ) || order.metadata?.payment_provider === "cod" || order.metadata?.payment_method === "cod"
  if (isCOD) return "pending"

  if (order.payment_collections?.length) {
    // After order edits, old PCs may be canceled. Find the most relevant one.
    const pcs = order.payment_collections as any[]
    const activePC = pcs.find((pc: any) =>
      pc.status === "captured" || pc.status === "completed"
    ) || pcs.find((pc: any) =>
      pc.status !== "canceled"
    ) || pcs[pcs.length - 1]

    if (activePC.status === "captured" || activePC.status === "completed") return "paid"
    if (activePC.status === "refunded") return "refunded"
    if (activePC.status === "partially_refunded") return "partially_refunded"
    if (activePC.status === "authorized") return "authorized"
    return activePC.status || "pending"
  }
  if (order.metadata?.copied_payment_status) return order.metadata.copied_payment_status
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
  padding: "11px 20px",
  fontSize: "11px",
  fontWeight: 600,
  color: "#9CA3B8",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  borderBottom: "1px solid rgba(0,0,0,0.07)",
  background: "#F5F6FA",
  userSelect: "none",
  cursor: "pointer",
  whiteSpace: "nowrap",
}

const tdStyle: React.CSSProperties = {
  padding: "14px 20px",
  fontSize: "13px",
  borderBottom: "1px solid rgba(0,0,0,0.04)",
  verticalAlign: "middle",
}

// ═══════════════════════════════════════════
// SKELETON LOADING
// ═══════════════════════════════════════════
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i}>
          <td style={{ ...tdStyle, width: "36px", textAlign: "center" }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "4px", background: "#EBEBEB", margin: "0 auto" }} />
          </td>
          <td style={tdStyle}><div style={{ width: "60px", height: "14px", borderRadius: "4px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}><div style={{ width: "160px", height: "32px", borderRadius: "6px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}><div style={{ width: "70px", height: "22px", borderRadius: "12px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}><div style={{ width: "70px", height: "22px", borderRadius: "12px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}><div style={{ width: "40px", height: "14px", borderRadius: "4px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}><div style={{ width: "70px", height: "14px", borderRadius: "4px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}><div style={{ width: "40px", height: "14px", borderRadius: "4px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}><div style={{ width: "100px", height: "14px", borderRadius: "4px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}><div style={{ width: "20px", height: "20px", borderRadius: "4px", background: "#EBEBEB" }} /></td>
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
    bg = colors.accent
    border = colors.accent
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
// INLINE STYLES FOR ROW HOVER (actions visibility)
// ═══════════════════════════════════════════
const rowHoverStyles = `
  .orders-table-row .row-actions { opacity: 0; transition: opacity 0.15s ease; }
  .orders-table-row:hover .row-actions { opacity: 1; }
`

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
          toast.success(`Book sent ${!currentValue ? "marked" : "unmarked"} for ${getOrderDisplayNumber(order)}`)
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
      <span style={{ marginLeft: "4px", fontSize: "10px", color: colors.accent }}>
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
              <th style={{ ...thStyle, width: "36px", textAlign: "center", cursor: "default" }}></th>
              <th style={thStyle}>Order</th>
              <th style={thStyle}>Customer</th>
              <th style={thStyle}>Payment</th>
              <th style={thStyle}>Fulfillment</th>
              <th style={thStyle}>Items</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}>Country</th>
              <th style={thStyle}>Date</th>
              <th style={{ ...thStyle, width: "48px", cursor: "default" }}></th>
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
          padding: "80px 20px",
          color: colors.textMuted,
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ marginBottom: "16px", opacity: 0.35 }}
        >
          <rect x="6" y="10" width="36" height="28" rx="3" />
          <path d="M6 18h36M18 10v8" />
        </svg>
        <p style={{ fontSize: "14px", fontWeight: 500, color: colors.textMuted }}>No orders found</p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <style>{rowHoverStyles}</style>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: "36px", textAlign: "center", cursor: "default" }}>
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                onClick={toggleSelectAll}
              />
            </th>
            <th style={{ ...thStyle, minWidth: "120px", whiteSpace: "nowrap" }} onClick={() => onSort("display_id")}>
              Order {renderSortIcon("display_id")}
            </th>
            <th style={thStyle} onClick={() => onSort("customer")}>
              Customer {renderSortIcon("customer")}
            </th>
            <th style={{ ...thStyle, cursor: "default" }}>Payment</th>
            <th style={{ ...thStyle, cursor: "default" }}>Fulfillment</th>
            <th style={{ ...thStyle, cursor: "default" }}>Items</th>
            <th style={thStyle} onClick={() => onSort("total")}>
              Total {renderSortIcon("total")}
            </th>
            <th style={{ ...thStyle, cursor: "default" }}>Country</th>
            <th style={thStyle} onClick={() => onSort("created_at")}>
              Date {renderSortIcon("created_at")}
            </th>
            <th style={{ ...thStyle, width: "48px", cursor: "default" }}></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const isSelected = selectedOrders.has(order.id)
            const paymentStatus = getPaymentStatus(order)
            const customerName = getCustomerName(order)
            const tag = getTag(order)
            const countryCode = order.shipping_address?.country_code
              || order.billing_address?.country_code
              || (() => {
                // Fallback: extract from custom_order_number "NL2026-75" → "nl"
                const num = order.metadata?.custom_order_number
                if (num && typeof num === "string") {
                  const m = num.match(/^([A-Za-z]{2})\d/)
                  if (m) return m[1].toLowerCase()
                }
                return "nl" // Default to NL (primary market)
              })()
            const deliveryStatus = order.metadata?.dextrum_status || (() => {
              const fulfillments = order.fulfillments || []
              const itemCount2 = order.items?.length || 0
              if (fulfillments.length === 0) return "unfulfilled"
              // Check if all items are fulfilled
              const fulfilledItemIds = new Set<string>()
              fulfillments.forEach((f: any) => {
                (f.items || []).forEach((fi: any) => {
                  fulfilledItemIds.add(fi.line_item_id)
                })
              })
              if (itemCount2 > 0 && fulfilledItemIds.size < itemCount2) return "partially_fulfilled"
              return "fulfilled"
            })()
            const bookSent = order.metadata?.book_sent === true || order.metadata?.book_sent === "true"
            const itemCount = order.items?.length || 0
            const total = (Number(order.total) || 0)
              + (Number(order.metadata?.cod_fee) || 0)
              + (Number(order.metadata?.shipping_fee) || 0)

            return (
              <tr
                key={order.id}
                className="orders-table-row"
                style={{
                  background: isSelected ? "rgba(108,92,231,0.04)" : "transparent",
                  transition: "background 0.12s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "#F8F9FC"
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent"
                }}
                onClick={() => navigate(`/custom-orders/${order.id}`)}
              >
                {/* 1. Checkbox */}
                <td
                  style={{ ...tdStyle, width: "36px", textAlign: "center" }}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleOrder(order.id)
                  }}
                >
                  <Checkbox checked={isSelected} onClick={() => toggleOrder(order.id)} />
                </td>

                {/* 2. Order */}
                <td style={tdStyle}>
                  <span
                    style={{
                      color: colors.accent,
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {getOrderDisplayNumber(order)}
                  </span>
                </td>

                {/* 3. Customer (with payment method icon) */}
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {(() => {
                      const iconUrl = getPaymentIconUrl(order)
                      if (iconUrl) {
                        return (
                          <div style={{
                            width: "32px", height: "32px", borderRadius: "8px",
                            background: "#f0f1f5", padding: "4px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, overflow: "hidden",
                          }}>
                            <img src={iconUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                          </div>
                        )
                      }
                      const fb = getPaymentFallback(order)
                      return (
                        <div style={{
                          width: "32px", height: "32px", borderRadius: "8px",
                          background: fb.bg, color: fb.color,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, fontSize: "10px", fontWeight: 700,
                        }}>
                          {fb.letter}
                        </div>
                      )
                    })()}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: "13px", color: colors.text }}>
                        {customerName}
                      </div>
                      <div style={{ fontSize: "11px", color: colors.textMuted, marginTop: "1px" }}>
                        {order.email}
                      </div>
                    </div>
                  </div>
                </td>

                {/* 4. Payment */}
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {(() => {
                      const iconUrl = getPaymentIconUrl(order)
                      if (iconUrl) {
                        return (
                          <div style={{
                            width: "22px", height: "22px", borderRadius: "4px",
                            background: "#f0f1f5", padding: "3px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, overflow: "hidden",
                          }}>
                            <img src={iconUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                          </div>
                        )
                      }
                      const fb = getPaymentFallback(order)
                      return (
                        <div style={{
                          width: "22px", height: "22px", borderRadius: "4px",
                          background: fb.bg, color: fb.color,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, fontSize: "8px", fontWeight: 700,
                        }}>
                          {fb.letter}
                        </div>
                      )
                    })()}
                    <PaymentBadge status={paymentStatus} />
                  </div>
                </td>

                {/* 5. Fulfillment */}
                <td style={tdStyle}>
                  <DeliveryBadge status={deliveryStatus} />
                </td>

                {/* 6. Items */}
                <td style={tdStyle}>
                  <span style={{ color: colors.textMuted }}>
                    {itemCount} item{itemCount !== 1 ? "s" : ""}
                  </span>
                </td>

                {/* 7. Total */}
                <td style={tdStyle}>
                  <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: colors.text }}>
                    {formatCurrency(total, order.currency_code)}
                  </span>
                </td>

                {/* 8. Country */}
                <td style={tdStyle}>
                  <CountryFlag code={countryCode} />
                </td>

                {/* 9. Date */}
                <td style={tdStyle}>
                  <span style={{ color: colors.textMuted, whiteSpace: "nowrap" }}>
                    {formatDate(order.created_at)}
                  </span>
                </td>

                {/* 10. Actions (three dots) */}
                <td
                  style={{ ...tdStyle, width: "48px", textAlign: "center" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="row-actions"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "28px",
                      height: "28px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.05)" }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
                    onClick={() => navigate(`/custom-orders/${order.id}`)}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill={colors.textSec}>
                      <circle cx="8" cy="3" r="1.5" />
                      <circle cx="8" cy="8" r="1.5" />
                      <circle cx="8" cy="13" r="1.5" />
                    </svg>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
