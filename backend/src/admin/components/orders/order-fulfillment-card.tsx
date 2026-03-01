import React, { useState } from "react"
import { FulfillmentBadge } from "./order-badges"
import { formatCurrency } from "../../lib/format-currency"
import {
  colors,
  shadows,
  radii,
  cardStyle,
  cardHeaderStyle,
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

// ═══════════════════════════════════════════
// PREMIUM BUTTON COMPONENT
// ═══════════════════════════════════════════

type BtnVariant = "primary" | "secondary" | "fakturoid" | "quickbooks"

interface PremiumBtnProps {
  variant: BtnVariant
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  label: string
  loadingLabel: string
  icon: React.ReactNode
}

const variantStyles: Record<
  BtnVariant,
  {
    bg: string
    bgHover: string
    color: string
    border: string
    borderHover: string
    shadow: string
    shadowHover: string
    shadowActive: string
    glow: string
  }
> = {
  primary: {
    bg: "linear-gradient(135deg, #7C6CF0 0%, #6C5CE7 50%, #5A4BD1 100%)",
    bgHover: "linear-gradient(135deg, #8B7DF5 0%, #7C6CF0 50%, #6C5CE7 100%)",
    color: "#FFFFFF",
    border: "transparent",
    borderHover: "transparent",
    shadow: "0 2px 8px rgba(108,92,231,0.3), 0 1px 3px rgba(108,92,231,0.2)",
    shadowHover: "0 6px 20px rgba(108,92,231,0.4), 0 2px 8px rgba(108,92,231,0.25)",
    shadowActive: "0 1px 4px rgba(108,92,231,0.3)",
    glow: "0 0 0 3px rgba(108,92,231,0.15)",
  },
  secondary: {
    bg: "linear-gradient(135deg, #FFFFFF 0%, #FAFAFA 100%)",
    bgHover: "linear-gradient(135deg, #FAFAFA 0%, #F3F4F6 100%)",
    color: colors.text,
    border: "rgba(0,0,0,0.10)",
    borderHover: "rgba(0,0,0,0.20)",
    shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
    shadowHover: "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
    shadowActive: "0 1px 2px rgba(0,0,0,0.08)",
    glow: "0 0 0 3px rgba(0,0,0,0.04)",
  },
  fakturoid: {
    bg: "linear-gradient(135deg, #FFFFFF 0%, #F0FFF8 100%)",
    bgHover: "linear-gradient(135deg, #F0FFF8 0%, #E0F7EC 100%)",
    color: "#008060",
    border: "rgba(0,128,96,0.15)",
    borderHover: "rgba(0,128,96,0.35)",
    shadow: "0 1px 3px rgba(0,128,96,0.08), 0 1px 2px rgba(0,0,0,0.04)",
    shadowHover: "0 4px 12px rgba(0,128,96,0.15), 0 2px 4px rgba(0,128,96,0.08)",
    shadowActive: "0 1px 2px rgba(0,128,96,0.12)",
    glow: "0 0 0 3px rgba(0,128,96,0.1)",
  },
  quickbooks: {
    bg: "linear-gradient(135deg, #FFFFFF 0%, #F0FFF0 100%)",
    bgHover: "linear-gradient(135deg, #F0FFF0 0%, #E0F7E0 100%)",
    color: "#2CA01C",
    border: "rgba(44,160,28,0.15)",
    borderHover: "rgba(44,160,28,0.35)",
    shadow: "0 1px 3px rgba(44,160,28,0.08), 0 1px 2px rgba(0,0,0,0.04)",
    shadowHover: "0 4px 12px rgba(44,160,28,0.15), 0 2px 4px rgba(44,160,28,0.08)",
    shadowActive: "0 1px 2px rgba(44,160,28,0.12)",
    glow: "0 0 0 3px rgba(44,160,28,0.1)",
  },
}

function PremiumBtn({
  variant,
  onClick,
  disabled,
  loading,
  label,
  loadingLabel,
  icon,
}: PremiumBtnProps) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const s = variantStyles[variant]
  const isDisabled = disabled || loading
  const isPrimary = variant === "primary"

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        padding: isPrimary ? "9px 18px" : "8px 14px",
        borderRadius: isPrimary ? "10px" : "8px",
        fontSize: isPrimary ? "13px" : "12px",
        fontWeight: 600,
        fontFamily: fontStack,
        letterSpacing: isPrimary ? "0.01em" : "0",
        cursor: isDisabled ? "default" : "pointer",
        opacity: isDisabled ? 0.55 : 1,
        border: `1px solid ${hovered && !isDisabled ? s.borderHover : s.border}`,
        background: hovered && !isDisabled ? s.bgHover : s.bg,
        color: s.color,
        boxShadow: pressed && !isDisabled
          ? s.shadowActive
          : hovered && !isDisabled
            ? `${s.shadowHover}, ${s.glow}`
            : s.shadow,
        transform: pressed && !isDisabled
          ? "translateY(1px) scale(0.97)"
          : hovered && !isDisabled
            ? "translateY(-1px)"
            : "translateY(0)",
        transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Shimmer overlay on hover (primary only) */}
      {isPrimary && hovered && !isDisabled && (
        <span
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)",
            animation: "shimmer 1.5s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      )}
      <span style={{ display: "inline-flex", position: "relative", zIndex: 1 }}>{icon}</span>
      <span style={{ position: "relative", zIndex: 1 }}>{loading ? loadingLabel : label}</span>
    </button>
  )
}

// ═══════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════

const CheckIcon = (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 10 8 14 16 6" />
  </svg>
)

const WarehouseIcon = (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="16" height="12" rx="2" />
    <path d="M2 8h16M7 4v4M13 4v4" />
  </svg>
)

// ═══════════════════════════════════════════
// FULFILLMENT CARD
// ═══════════════════════════════════════════

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
      {/* Scoped keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>

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
            fontSize: "14px",
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
                    fontSize: "14px",
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
                <div style={{ fontSize: "14px", color: colors.text }}>
                  {formatCurrency(unitPrice, currency)} &times; {quantity}
                </div>
                <div
                  style={{
                    fontSize: "14px",
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

      {/* Action buttons — premium row */}
      {!hasFulfillments && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            padding: "14px 20px",
            borderTop: `1px solid ${colors.border}`,
            background: "linear-gradient(180deg, rgba(248,249,252,0) 0%, rgba(248,249,252,0.5) 100%)",
          }}
        >
          {/* Send to Dextrum WMS */}
          {!hasDextrum && (
            <PremiumBtn
              variant="secondary"
              onClick={onSendToDextrum}
              disabled={isDextrumLoading}
              loading={isDextrumLoading}
              label="Send to Dextrum"
              loadingLabel="Sending..."
              icon={WarehouseIcon}
            />
          )}

          {/* Mark as fulfilled */}
          <PremiumBtn
            variant="primary"
            onClick={onMarkAsFulfilled}
            disabled={isLoading}
            loading={isLoading}
            label="Mark as fulfilled"
            loadingLabel="Fulfilling..."
            icon={CheckIcon}
          />
        </div>
      )}

      {/* Invoice action buttons — premium row */}
      {(!hasFakturoid || !hasQB) && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            padding: "12px 20px",
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          {!hasFakturoid && (
            <PremiumBtn
              variant="fakturoid"
              onClick={onFakturoidCreate}
              disabled={isFakturoidLoading}
              loading={isFakturoidLoading}
              label="Send to Fakturoid"
              loadingLabel="Creating..."
              icon={<span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "-0.02em" }}>fa</span>}
            />
          )}
          {!hasQB && (
            <PremiumBtn
              variant="quickbooks"
              onClick={onQBCreate}
              disabled={isQBLoading}
              loading={isQBLoading}
              label="Send to QuickBooks"
              loadingLabel="Creating..."
              icon={<span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "-0.02em" }}>qb</span>}
            />
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
                fontSize: "14px",
                color: colors.textSec,
                padding: "4px 0",
              }}
            >
              <span style={{ fontWeight: 600, color: colors.text }}>Fulfilled</span>
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
