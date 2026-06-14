import React, { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { PaymentBadge, DeliveryBadge } from "./order-badges"
import { BookSentToggle } from "./book-sent-toggle"
import { CountryFlag } from "./country-flag"
import { OrderTag } from "./order-tag"
import { useUpdateMetadata } from "../../hooks/use-update-metadata"
import { toast } from "@medusajs/ui"
import { colors, radii, shadows, getPaymentIconUrl, getPaymentFallback, getPaymentMethodName, getOrderDisplayNumber, getProjectChip } from "./design-tokens"
import { formatCurrency } from "../../lib/format-currency"

interface OrdersTableProps {
  orders: any[]
  isLoading?: boolean
  selectedOrders: Set<string>
  onSelectionChange: (selected: Set<string>) => void
  sortField: string
  sortDir: string
  onSort: (field: string) => void
  onBeforeNavigate?: () => void
  onOpenOrder?: (order: any) => void
}

// ═══════════════════════════════════════════
// DATE FORMATTING
// ═══════════════════════════════════════════
function formatDate(iso: string): { label: string; time: string; isRecent: boolean } {
  const d = new Date(iso)
  // Compare dates in CET
  const cetOptions = { timeZone: "Europe/Prague" } as const
  const cetDateStr = d.toLocaleDateString("en-US", cetOptions)
  const nowCetStr = new Date().toLocaleDateString("en-US", cetOptions)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayCetStr = yesterday.toLocaleDateString("en-US", cetOptions)

  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Prague",
  })

  if (cetDateStr === nowCetStr) return { label: "Today", time, isRecent: true }
  if (cetDateStr === yesterdayCetStr) return { label: "Yesterday", time, isRecent: true }
  return {
    label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Europe/Prague" }),
    time,
    isRecent: false,
  }
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
  return "—"
}

// Initials for the customer avatar (fallback to email first char)
function getInitials(name: string, email?: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts.length === 1 && parts[0] !== "—") return parts[0].slice(0, 2).toUpperCase()
  if (email) return email.slice(0, 2).toUpperCase()
  return "?"
}

// Deterministic soft avatar color from a string
const AVATAR_COLORS = [
  { bg: "#EEF2FF", fg: "#4338CA" },
  { bg: "#FFF1F2", fg: "#BE123C" },
  { bg: "#ECFDF5", fg: "#047857" },
  { bg: "#FFF7ED", fg: "#C2410C" },
  { bg: "#F0F9FF", fg: "#0369A1" },
  { bg: "#FAF5FF", fg: "#7E22CE" },
]
function avatarColor(key: string): { bg: string; fg: string } {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

// ═══════════════════════════════════════════
// HELPER: get tag (from metadata or first item product title)
// ═══════════════════════════════════════════
const PROJECT_TAG_NAMES: Record<string, string> = {
  dehondenbijbel: "De Hondenbijbel",
  odpusc: "Odpuść",
  "odpusc-ksiazka": "Odpuść",
  slapp: "Släpp taget",
  "slapp-taget": "Släpp taget",
  "psi-superzivot": "Psí superživot",
  "lass-los": "Lass los",
  loslatenboek: "Laat Los Wat Je Kapotmaakt",
  "het-leven": "Het Leven Dat Je Verdient",
  "kocici-bible": "Kočičí bible",
  "odpust-knizka": "Pusť to, co tě ničí",
  "zycie-zaslugy": "Życie na które zasługujesz",
}

function getTag(order: any): string {
  if (order.metadata?.tags) return order.metadata.tags
  // Fallback: map project_id to display name
  const projectId = order.metadata?.project_id
  if (projectId && PROJECT_TAG_NAMES[projectId]) return PROJECT_TAG_NAMES[projectId]
  return ""
}

// ═══════════════════════════════════════════
// TABLE STYLES
// ═══════════════════════════════════════════
const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "7px 14px",
  fontSize: "10.5px",
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
  padding: "6px 14px",
  fontSize: "12.5px",
  borderBottom: "1px solid rgba(0,0,0,0.03)",
  verticalAlign: "middle",
}

// ═══════════════════════════════════════════
// SKELETON LOADING
// ═══════════════════════════════════════════
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 12 }).map((_, i) => (
        <tr key={i}>
          <td style={{ ...tdStyle, width: "36px", textAlign: "center" }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "4px", background: "#EBEBEB", margin: "0 auto" }} />
          </td>
          <td style={tdStyle}><div style={{ width: "70px", height: "14px", borderRadius: "4px", background: "#EBEBEB" }} /></td>
          <td className="col-date" style={tdStyle}><div style={{ width: "80px", height: "14px", borderRadius: "4px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#EBEBEB", flexShrink: 0 }} />
              <div>
                <div style={{ width: "110px", height: "12px", borderRadius: "4px", background: "#EBEBEB", marginBottom: "5px" }} />
                <div style={{ width: "140px", height: "10px", borderRadius: "4px", background: "#F0F0F0" }} />
              </div>
            </div>
          </td>
          <td style={tdStyle}><div style={{ width: "60px", height: "14px", borderRadius: "4px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}><div style={{ width: "70px", height: "14px", borderRadius: "4px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}><div style={{ width: "70px", height: "22px", borderRadius: "12px", background: "#EBEBEB" }} /></td>
          <td style={tdStyle}><div style={{ width: "70px", height: "22px", borderRadius: "12px", background: "#EBEBEB" }} /></td>
          <td className="col-items" style={tdStyle}><div style={{ width: "40px", height: "14px", borderRadius: "4px", background: "#EBEBEB" }} /></td>
          <td className="col-country" style={tdStyle}><div style={{ width: "30px", height: "14px", borderRadius: "4px", background: "#EBEBEB" }} /></td>
          <td className="col-project" style={tdStyle}><div style={{ width: "90px", height: "18px", borderRadius: "6px", background: "#EBEBEB" }} /></td>
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
  .orders-table-row {
    transition: background 0.15s ease, box-shadow 0.15s ease;
    border-left: 3px solid transparent;
  }
  .orders-table-row:hover {
    background: #F4F5FA !important;
    border-left-color: ${colors.accent};
    box-shadow: 0 1px 4px rgba(108,92,231,0.06);
  }
  .orders-table-row:active {
    background: #ECEDF5 !important;
  }
  .orders-table-row .row-actions { opacity: 0; transition: opacity 0.15s ease; }
  .orders-table-row:hover .row-actions { opacity: 1; }
  .orders-table-row td:first-child { padding-left: 11px; }
  .orders-table-row .otr-avatar { transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1); }
  .orders-table-row:hover .otr-avatar { transform: scale(1.08); }
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
  onBeforeNavigate,
  onOpenOrder,
}: OrdersTableProps) {
  const navigate = useNavigate()
  const updateMetadata = useUpdateMetadata()

  const handleOrderClick = (e: React.MouseEvent, order: any) => {
    // Cmd/Ctrl-click → open the full detail page in a new tab.
    if (e.metaKey || e.ctrlKey) {
      window.open(`/app/custom-orders/${order.id}`, "_blank")
      return
    }
    // Plain click → open the side-drawer peek (falls back to full page nav).
    if (onOpenOrder) {
      onOpenOrder(order)
    } else {
      onBeforeNavigate?.()
      navigate(`/custom-orders/${order.id}`)
    }
  }

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
      <div className="orders-desktop-table" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: "36px", textAlign: "center", cursor: "default" }}></th>
              <th style={thStyle}>Order</th>
              <th className="col-date" style={thStyle}>Date</th>
              <th style={thStyle}>Customer</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}>Payment</th>
              <th style={thStyle}>Payment status</th>
              <th style={thStyle}>Fulfillment</th>
              <th className="col-items" style={thStyle}>Items</th>
              <th className="col-country" style={thStyle}>Country</th>
              <th className="col-project" style={thStyle}>Project</th>
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

  // ═══ Mobile Card Layout ═══
  const mobileCards = (
    <div className="orders-mobile-cards" style={{ display: "none" }}>
      {orders.map((order) => {
        const paymentStatus = getPaymentStatus(order)
        const customerName = getCustomerName(order)
        const countryCode = order.shipping_address?.country_code
          || order.billing_address?.country_code
          || (() => {
            const num = order.metadata?.custom_order_number
            if (num && typeof num === "string") {
              const m = num.match(/^([A-Za-z]{2})\d/)
              if (m) return m[1].toLowerCase()
            }
            return "nl"
          })()
        const deliveryStatus = order.metadata?.dextrum_status || (() => {
          const fulfillments = order.fulfillments || []
          const itemCount2 = order.items?.length || 0
          if (fulfillments.length === 0) return "unfulfilled"
          const fulfilledItemIds = new Set<string>()
          fulfillments.forEach((f: any) => {
            (f.items || []).forEach((fi: any) => {
              fulfilledItemIds.add(fi.line_item_id)
            })
          })
          if (itemCount2 > 0 && fulfilledItemIds.size < itemCount2) return "partially_fulfilled"
          return "fulfilled"
        })()
        const itemCount = order.items?.length || 0
        const total = (Number(order.total) || 0)
          + (Number(order.metadata?.cod_fee) || 0)
          + (Number(order.metadata?.shipping_fee) || 0)
        const dt = formatDate(order.created_at)

        return (
          <div
            key={order.id}
            onClick={(e: React.MouseEvent) => handleOrderClick(e, order)}
            style={{
              padding: "14px 16px",
              borderBottom: `1px solid ${colors.border}`,
              cursor: "pointer",
              background: selectedOrders.has(order.id) ? "rgba(108,92,231,0.05)" : "transparent",
            }}
          >
            {/* Top row: order number + total */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ color: colors.accent, fontWeight: 700, fontSize: "14px" }}>
                {getOrderDisplayNumber(order)}
              </span>
              <span style={{ fontWeight: 700, fontSize: "14px", color: colors.text, fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(total, order.currency_code)}
              </span>
            </div>
            {/* Second row: customer + items + time */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontSize: "13px", color: colors.textSec }}>
              <span style={{ fontWeight: 500 }}>{customerName}</span>
              <span style={{ color: colors.textMuted }}>&middot;</span>
              <span style={{ color: colors.textMuted }}>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
              <span style={{ color: colors.textMuted }}>&middot;</span>
              <span style={{ color: colors.textMuted, fontSize: "12px" }}>{dt.label} {dt.time}</span>
            </div>
            {/* Third row: badges + country + project chip */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <PaymentBadge status={paymentStatus} />
              <DeliveryBadge status={deliveryStatus} />
              <CountryFlag code={countryCode} />
              {(() => {
                const chip = getProjectChip(order.metadata?.project_id)
                if (!chip) return null
                return (
                  <span style={{
                    fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px",
                    background: chip.bg, color: chip.color, whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis", maxWidth: "180px",
                  }}>
                    {chip.label}
                  </span>
                )
              })()}
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div>
      {mobileCards}
      <div className="orders-desktop-table" style={{ overflowX: "auto" }}>
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
            <th style={{ ...thStyle, minWidth: "90px", whiteSpace: "nowrap" }} onClick={() => onSort("display_id")}>
              Order {renderSortIcon("display_id")}
            </th>
            <th className="col-date" style={thStyle} onClick={() => onSort("created_at")}>
              Date {renderSortIcon("created_at")}
            </th>
            <th style={thStyle} onClick={() => onSort("customer")}>
              Customer {renderSortIcon("customer")}
            </th>
            <th style={thStyle} onClick={() => onSort("total")}>
              Total {renderSortIcon("total")}
            </th>
            <th style={{ ...thStyle, cursor: "default" }}>Payment</th>
            <th style={{ ...thStyle, cursor: "default" }}>Payment status</th>
            <th style={{ ...thStyle, cursor: "default" }}>Fulfillment</th>
            <th className="col-items" style={{ ...thStyle, cursor: "default" }}>Items</th>
            <th className="col-country" style={{ ...thStyle, cursor: "default" }}>Country</th>
            <th className="col-project" style={{ ...thStyle, cursor: "default" }}>Project</th>
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
                  background: isSelected ? "rgba(108,92,231,0.05)" : "transparent",
                  cursor: "pointer",
                }}
                onClick={(e: React.MouseEvent) => handleOrderClick(e, order)}
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
                  <span style={{ color: colors.accent, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {getOrderDisplayNumber(order)}
                  </span>
                </td>

                {/* 3. Date (highlighted) */}
                <td className="col-date" style={tdStyle}>
                  {(() => {
                    const dt = formatDate(order.created_at)
                    return (
                      <div style={{ whiteSpace: "nowrap" }}>
                        <span style={{
                          fontWeight: dt.isRecent ? 600 : 500,
                          fontSize: "12px",
                          color: dt.isRecent ? colors.text : colors.textSec,
                        }}>
                          {dt.label}
                        </span>
                        <span style={{ fontSize: "11px", color: colors.textMuted, marginLeft: "4px" }}>
                          {dt.time}
                        </span>
                      </div>
                    )
                  })()}
                </td>

                {/* 4. Customer — avatar + name (nowrap) + email subline (nowrap) */}
                <td style={{ ...tdStyle, maxWidth: "230px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0 }}>
                    {(() => {
                      const av = avatarColor(order.email || customerName)
                      return (
                        <div className="otr-avatar" style={{
                          width: "26px", height: "26px", borderRadius: "50%",
                          background: av.bg, color: av.fg,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, fontSize: "10px", fontWeight: 700, letterSpacing: "0.3px",
                        }}>
                          {getInitials(customerName, order.email)}
                        </div>
                      )
                    })()}
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, fontSize: "12.5px", color: colors.text,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        maxWidth: "190px", lineHeight: 1.3,
                      }}>
                        {customerName}
                      </div>
                      <div style={{
                        fontSize: "11px", color: colors.textMuted,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        maxWidth: "190px", lineHeight: 1.3,
                      }}>
                        {order.email}
                      </div>
                    </div>
                  </div>
                </td>

                {/* 5. Total */}
                <td style={tdStyle}>
                  <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: colors.text }}>
                    {formatCurrency(total, order.currency_code)}
                  </span>
                </td>

                {/* 7. Payment — method icon + name */}
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {(() => {
                      const iconUrl = getPaymentIconUrl(order)
                      if (iconUrl) {
                        return (
                          <div style={{
                            width: "18px", height: "18px", borderRadius: "3px",
                            background: "#f0f1f5", padding: "2px",
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
                          width: "18px", height: "18px", borderRadius: "3px",
                          background: fb.bg, color: fb.color,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, fontSize: "6px", fontWeight: 700,
                        }}>
                          {fb.letter}
                        </div>
                      )
                    })()}
                    <span style={{ fontSize: "12px", color: colors.textSec, whiteSpace: "nowrap" }}>
                      {getPaymentMethodName(order)}
                    </span>
                  </div>
                </td>

                {/* 8. Payment status */}
                <td style={tdStyle}>
                  <PaymentBadge status={paymentStatus} />
                </td>

                {/* 9. Fulfillment */}
                <td style={tdStyle}>
                  <DeliveryBadge status={deliveryStatus} />
                </td>

                {/* Items */}
                <td className="col-items" style={tdStyle}>
                  <span style={{ color: colors.textMuted }}>
                    {itemCount} item{itemCount !== 1 ? "s" : ""}
                  </span>
                </td>

                {/* Country */}
                <td className="col-country" style={tdStyle}>
                  <CountryFlag code={countryCode} />
                </td>

                {/* Project — colored chip from metadata.project_id, fallback to tag */}
                <td className="col-project" style={tdStyle}>
                  {(() => {
                    const chip = getProjectChip(order.metadata?.project_id)
                    if (chip) {
                      return (
                        <span style={{
                          display: "inline-block",
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "6px",
                          background: chip.bg,
                          color: chip.color,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "150px",
                        }}>
                          {chip.label}
                        </span>
                      )
                    }
                    if (!tag) return <span style={{ color: colors.textMuted }}>—</span>
                    return (
                      <span style={{
                        fontSize: "11px",
                        color: colors.textMuted,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "inline-block",
                        maxWidth: "150px",
                      }}>
                        {tag}
                      </span>
                    )
                  })()}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}
