import React from "react"
import { PaymentBadge } from "./order-badges"
import { formatCurrency } from "../../lib/format-currency"
import {
  colors,
  shadows,
  radii,
  cardStyle,
  cardHeaderStyle,
  fontStack,
  getPaymentIconUrl,
  getPaymentFallback,
  getPaymentMethodName,
  getOrderDisplayNumber,
} from "./design-tokens"

interface OrderDetailPaymentProps {
  order: any
  onCapture?: () => void
  isCapturing?: boolean
}

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
    return activePC.status || "pending"
  }
  if (order.metadata?.copied_payment_status) return order.metadata.copied_payment_status
  return "pending"
}

/** Detect the primary payment provider from payment data */
function detectProvider(payments: any[]): {
  name: string
  isPayPal: boolean
  isKlarna: boolean
  isMollie: boolean
  needsCapture: boolean
  color: string
  label: string
} {
  const payment = payments[0]
  if (!payment) return { name: "unknown", isPayPal: false, isKlarna: false, isMollie: false, needsCapture: false, color: "#6D7175", label: "Payment" }

  const pid = payment.provider_id || ""
  const data = payment.data || {}

  if (pid.includes("paypal")) {
    return {
      name: "paypal",
      isPayPal: true,
      isKlarna: false,
      isMollie: false,
      needsCapture: !!(data.paypalOrderId || data.authorizationId),
      color: "#0070BA",
      label: "PayPal",
    }
  }
  if (pid.includes("klarna")) {
    return {
      name: "klarna",
      isPayPal: false,
      isKlarna: true,
      isMollie: false,
      needsCapture: !!data.klarnaOrderId,
      color: "#FFB3C7",
      label: "Klarna",
    }
  }
  return {
    name: "mollie",
    isPayPal: false,
    isKlarna: false,
    isMollie: true,
    needsCapture: false,
    color: "#6D7175",
    label: "Mollie",
  }
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "7px 4px",
  fontSize: "14px",
  borderRadius: "4px",
  margin: "0 -4px",
  transition: "background 0.12s ease",
}

const TRACKING_URLS: Record<string, (n: string) => string> = {
  dhl: (n) => `https://tracking.dhl.com/?shipmentid=${n}`,
  "dhl-parcel": (n) => `https://www.dhlparcel.nl/nl/volg-je-pakket?tc=${n}`,
  dpd: (n) => `https://tracking.dpd.de/parcelstatus?query=${n}`,
  gls: (n) => `https://gls-group.eu/GROUP/en/parcel-tracking?match=${n}`,
  postnl: (n) => `https://postnl.nl/tracktrace/?B=${n}`,
  fedex: (n) => `https://tracking.fedex.com/tracking?tracknumbers=${n}`,
  ups: (n) => `https://www.ups.com/track?tracknum=${n}`,
}

export function OrderDetailPayment({ order, onCapture, isCapturing }: OrderDetailPaymentProps) {
  const currency = order.currency_code
  const paymentStatus = getPaymentStatus(order)
  const items = order.items || []
  const itemCount = items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0)

  const subtotal = Number(order.subtotal) || 0
  const discountTotal = Number(order.discount_total) || 0
  const shippingTotal = Number(order.shipping_total) || 0
  const taxTotal = Number(order.tax_total) || 0
  const total = (Number(order.total) || 0)
    + (Number(order.metadata?.cod_fee) || 0)
    + (Number(order.metadata?.shipping_fee) || 0)

  const discountCode =
    order.discounts?.[0]?.code ||
    order.metadata?.discount_code ||
    (discountTotal > 0 ? "Discount" : "")

  const shippingMethodName =
    order.shipping_methods?.[0]?.name ||
    order.shipping_methods?.[0]?.shipping_option_id ||
    "Shipping"

  const payments = (order.payment_collections || []).flatMap(
    (pc: any) => pc.payments || []
  )
  const totalPaid = payments.reduce(
    (sum: number, p: any) => sum + (Number(p.amount) || 0),
    0
  )

  const provider = detectProvider(payments)
  const isCaptured = order.metadata?.payment_captured === true
  const showCaptureButton =
    !isCaptured &&
    (provider.isPayPal || provider.isKlarna) &&
    provider.needsCapture

  // Tracking info from Dextrum
  const trackingNumber = order.metadata?.dextrum_tracking_number
  const trackingCarrier = order.metadata?.dextrum_carrier || ""
  const trackingUrlFn = TRACKING_URLS[trackingCarrier.toLowerCase()]
  const trackingUrl = trackingNumber && trackingUrlFn
    ? trackingUrlFn(trackingNumber)
    : order.metadata?.dextrum_tracking_url || null

  // Payment method icon
  const paymentIconUrl = getPaymentIconUrl(order)
  const paymentFallback = getPaymentFallback(order)
  const paymentMethodName = getPaymentMethodName(order)

  return (
    <div
      className="od-card"
      style={cardStyle}
    >
      {/* Header with payment badge and payment method icon */}
      <div style={cardHeaderStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <PaymentBadge status={paymentStatus} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {paymentIconUrl ? (
            <img
              src={paymentIconUrl}
              alt={paymentMethodName}
              style={{ width: "24px", height: "24px", objectFit: "contain" }}
            />
          ) : (
            <span
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: paymentFallback.bg,
                color: paymentFallback.color,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                fontWeight: 700,
                fontFamily: fontStack,
                lineHeight: 1,
              }}
            >
              {paymentFallback.letter}
            </span>
          )}
          <span style={{ fontSize: "13px", fontWeight: 500, color: colors.textSec }}>
            {paymentMethodName}
          </span>
        </div>
      </div>

      {/* Payment breakdown */}
      <div style={{ padding: "16px 20px" }}>
        {/* Subtotal */}
        <div className="od-row-hover" style={rowStyle}>
          <span style={{ color: colors.textSec }}>
            Subtotal
            <span style={{ marginLeft: "8px", color: colors.textMuted }}>
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
          </span>
          <span style={{ color: colors.text }}>{formatCurrency(subtotal, currency)}</span>
        </div>

        {/* Discount */}
        {discountTotal > 0 && (
          <div className="od-row-hover" style={rowStyle}>
            <span style={{ color: colors.textSec }}>
              Discount
              {discountCode && (
                <span
                  style={{
                    marginLeft: "8px",
                    fontSize: "12px",
                    background: colors.accentBg,
                    padding: "1px 6px",
                    borderRadius: "4px",
                    color: colors.accent,
                    textTransform: "uppercase",
                  }}
                >
                  {discountCode}
                </span>
              )}
            </span>
            <span style={{ color: colors.text }}>
              -{formatCurrency(discountTotal, currency)}
            </span>
          </div>
        )}

        {/* Shipping */}
        <div className="od-row-hover" style={rowStyle}>
          <span style={{ color: colors.textSec }}>
            Shipping
            <span style={{ marginLeft: "8px", color: colors.textMuted, fontSize: "12px" }}>
              {shippingMethodName}
            </span>
          </span>
          <span style={{ color: colors.text }}>
            {shippingTotal === 0
              ? formatCurrency(0, currency)
              : formatCurrency(shippingTotal, currency)}
          </span>
        </div>

        {/* Delivery Fee (Doprava domů) */}
        {Number(order.metadata?.shipping_fee) > 0 && (
          <div className="od-row-hover" style={rowStyle}>
            <span style={{ color: colors.textSec }}>
              Doprava domů
            </span>
            <span style={{ color: colors.text }}>
              +{formatCurrency(Number(order.metadata.shipping_fee), currency)}
            </span>
          </div>
        )}

        {/* COD Fee (Dobírka) */}
        {order.metadata?.cod_fee && (
          <div className="od-row-hover" style={rowStyle}>
            <span style={{ color: colors.textSec }}>
              Dobírka (COD)
            </span>
            <span style={{ color: colors.text }}>
              +{formatCurrency(Number(order.metadata.cod_fee), currency)}
            </span>
          </div>
        )}

        {/* Taxes */}
        {taxTotal > 0 && (
          <div className="od-row-hover" style={rowStyle}>
            <span style={{ color: colors.textSec }}>
              Taxes
              <span style={{ marginLeft: "8px", color: colors.textMuted, fontSize: "12px" }}>
                {order.metadata?.tax_rate || "VAT"} (Included)
              </span>
            </span>
            <span style={{ color: colors.text }}>
              {formatCurrency(taxTotal, currency)}
            </span>
          </div>
        )}

        {/* Divider + Total */}
        <div style={{ borderTop: `1px solid ${colors.border}`, marginTop: "8px", paddingTop: "8px" }}>
          <div style={{ ...rowStyle, fontSize: "15px", fontWeight: 700 }}>
            <span style={{ color: colors.text }}>Total</span>
            <span style={{ color: colors.text }}>{formatCurrency(total, currency)}</span>
          </div>
        </div>

        {/* Paid amount — kept as summary line */}
        <div style={{ borderTop: `1px solid ${colors.border}`, marginTop: "8px", paddingTop: "8px" }}>
          <div className="od-row-hover" style={rowStyle}>
            <span style={{ color: colors.text, fontWeight: 500 }}>
              {paymentStatus === "paid" || paymentStatus === "captured"
                ? "Paid"
                : paymentStatus === "refunded"
                ? "Refunded"
                : "Pending"}
            </span>
            <span style={{ color: colors.text, fontWeight: 500 }}>
              {paymentStatus === "pending" ? formatCurrency(total, currency) : formatCurrency(totalPaid || total, currency)}
            </span>
          </div>
        </div>

        {/* ─── Order & Tracking Info ─── */}
        <div style={{ borderTop: `1px solid ${colors.border}`, marginTop: "8px", paddingTop: "8px" }}>
          {/* Medusa Order ID */}
          {order.display_id && (
            <div className="od-row-hover" style={{ ...rowStyle, fontSize: "12px" }}>
              <span style={{ color: colors.textMuted }}>Order ID</span>
              <code
                style={{
                  fontSize: "12px",
                  background: colors.bgHover,
                  padding: "1px 8px",
                  borderRadius: "4px",
                  color: colors.text,
                  fontFamily: "monospace",
                }}
              >
                {getOrderDisplayNumber(order)}
              </code>
            </div>
          )}

          {/* Tracking Number */}
          {trackingNumber && (
            <div className="od-row-hover" style={{ ...rowStyle, fontSize: "12px" }}>
              <span style={{ color: colors.textMuted }}>Tracking Number</span>
              <code
                style={{
                  fontSize: "12px",
                  background: colors.bgHover,
                  padding: "1px 8px",
                  borderRadius: "4px",
                  color: colors.text,
                  fontFamily: "monospace",
                }}
              >
                {trackingNumber}
              </code>
            </div>
          )}

          {/* Tracking Link */}
          {trackingUrl && (
            <div className="od-row-hover" style={{ ...rowStyle, fontSize: "12px" }}>
              <span style={{ color: colors.textMuted }}>Tracking Link</span>
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "12px",
                  color: colors.accent,
                  textDecoration: "none",
                }}
              >
                {trackingCarrier.toUpperCase() || "Track"} &rarr;
              </a>
            </div>
          )}
        </div>

        {/* Payment provider info moved to Payment Activity section */}

        {/* ─── Universal Capture Button (PayPal / Klarna) ─── */}
        {showCaptureButton && (
          <div
            style={{
              borderTop: `1px solid ${colors.border}`,
              marginTop: "12px",
              paddingTop: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  background: colors.yellowBg,
                  color: colors.yellow,
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "10px",
                }}
              >
                {provider.isPayPal
                  ? "PayPal — Authorized (not yet captured)"
                  : "Klarna — Authorized (not yet captured)"}
              </span>
            </div>
            <div style={{ fontSize: "12px", color: colors.textMuted, marginBottom: "8px" }}>
              {provider.isPayPal
                ? "PayPal authorizations must be captured within 29 days. Capture after shipping the order."
                : "Klarna payments must be captured within 28 days of authorization. Capture after shipping the order."}
            </div>
            {onCapture && (
              <button
                onClick={onCapture}
                disabled={isCapturing}
                className="od-btn-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  background: colors.accent,
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: isCapturing ? "not-allowed" : "pointer",
                  opacity: isCapturing ? 0.7 : 1,
                  boxShadow: shadows.btn,
                }}
              >
                {isCapturing ? (
                  <>
                    <span
                      style={{
                        width: "14px",
                        height: "14px",
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                        display: "inline-block",
                      }}
                    />
                    Capturing...
                  </>
                ) : (
                  `Capture ${provider.label} Payment`
                )}
              </button>
            )}
          </div>
        )}

        {/* Captured confirmation */}
        {isCaptured && (provider.isPayPal || provider.isKlarna) && (
          <div
            style={{
              borderTop: `1px solid ${colors.border}`,
              marginTop: "12px",
              paddingTop: "12px",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                background: colors.greenBg,
                color: colors.green,
                fontSize: "11px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "10px",
              }}
            >
              {provider.label} — Captured
              {order.metadata?.payment_captured_at && (
                <span style={{ fontWeight: 400, marginLeft: "4px" }}>
                  {(() => {
                    const d = new Date(order.metadata.payment_captured_at)
                    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`
                  })()}
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
