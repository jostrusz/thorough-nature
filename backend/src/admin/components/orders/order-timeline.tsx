import React, { useState, useRef, useEffect } from "react"
import { colors, radii, cardStyle, cardHeaderStyle, fontStack } from "./design-tokens"

// ═══════════════════════════════════════════
// UNIFIED ORDER TIMELINE
// Merges all event sources into one chronological timeline.
// ═══════════════════════════════════════════

interface OrderTimelineProps {
  order: any
}

type EventIcon =
  | "order" | "payment" | "fulfillment" | "dextrum"
  | "fakturoid" | "quickbooks" | "cancel" | "refund"
  | "edit" | "email" | "archive" | "tracking" | "upsell"
  | "download"

type EventStatus = "success" | "info" | "warning" | "error" | "neutral"

interface TimelineEvent {
  date: string
  label: string
  detail?: string
  icon: EventIcon
  status: EventStatus
  // Rich data (from payment_activity_log)
  gateway?: string
  paymentMethod?: string
  amount?: number
  currency?: string
  transactionId?: string
  refundId?: string
  errorMessage?: string
  errorCode?: string
  trackingNumber?: string
  trackingCarrier?: string
  trackingUrl?: string
  // Email data
  emailTo?: string
  emailSubject?: string
  htmlBody?: string
  // Download data
  downloadCount?: number
  downloadFiles?: string[]
}

// ═══ CONSTANTS ═══

const GATEWAY_NAMES: Record<string, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  mollie: "Mollie",
  klarna: "Klarna",
  comgate: "Comgate",
  przelewy24: "Przelewy24",
  airwallex: "Airwallex",
  p24: "Przelewy24",
  upsell: "Upsell",
}

const METHOD_LABELS: Record<string, string> = {
  ideal: "iDEAL",
  creditcard: "Credit Card",
  bancontact: "Bancontact",
  klarnapaylater: "Klarna",
  klarna: "Klarna",
  paypal: "PayPal",
  applepay: "Apple Pay",
  googlepay: "Google Pay",
  eps: "EPS",
  przelewy24: "Przelewy24",
  p24: "Przelewy24",
  sepa_debit: "SEPA Direct Debit",
  revolut_pay: "Revolut Pay",
  card: "Card",
}

const EMAIL_TEMPLATES: Record<string, string> = {
  order_confirmation: "Order Confirmation",
  shipment_notification: "Shipment Notification",
  ebook_delivery: "E-book Delivery",
  ebook_delivery_resend: "E-book Delivery (Resent)",
  abandoned_checkout: "Abandoned Checkout Reminder",
  invite_user: "User Invitation",
}

const PAYMENT_EVENT_LABELS: Record<string, string> = {
  received: "Payment Received",
  cod_pending: "Awaiting COD Payment",
  initiate: "Payment Initiated",
  authorization: "Payment Authorized",
  capture: "Payment Captured",
  refund: "Payment Refunded",
  cancellation: "Payment Cancelled",
  status_update: "Payment Status Updated",
  tracking_sent: "Tracking Sent to Gateway",
  upsell_accepted: "Upsell Accepted",
  upsell_payment_captured: "Upsell Payment Captured",
}

const DEXTRUM_STATUS_LABELS: Record<string, string> = {
  WAITING: "WMS: Order queued",
  IMPORTED: "WMS: Sent to warehouse",
  PROCESSED: "WMS: Order processed",
  PACKED: "WMS: Package packed",
  DISPATCHED: "WMS: Dispatched",
  IN_TRANSIT: "WMS: In transit",
  DELIVERED: "WMS: Delivered",
  ALLOCATION_ISSUE: "WMS: Stock allocation issue",
  PARTIALLY_PICKED: "WMS: Partially picked",
  CANCELLED: "WMS: Cancelled",
  FAILED: "WMS: Failed",
}

// ═══ ICON COMPONENT ═══

function EventIconCircle({ icon }: { icon: EventIcon }) {
  const base: React.CSSProperties = {
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  }

  switch (icon) {
    case "payment":
      return (
        <div style={{ ...base, background: colors.greenBg }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.green} strokeWidth="2">
            <rect x="2" y="4" width="16" height="12" rx="2" /><path d="M2 9h16" />
          </svg>
        </div>
      )
    case "fulfillment":
      return (
        <div style={{ ...base, background: colors.blueBg }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.blue} strokeWidth="2">
            <polyline points="4 10 8 14 16 6" />
          </svg>
        </div>
      )
    case "dextrum":
      return (
        <div style={{ ...base, background: colors.accentBg }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.accent} strokeWidth="1.5">
            <rect x="2" y="4" width="16" height="12" rx="2" /><path d="M2 8h16M7 4v4M13 4v4" />
          </svg>
        </div>
      )
    case "fakturoid":
      return (
        <div style={{ ...base, background: colors.greenBg }}>
          <span style={{ fontSize: "10px", fontWeight: 700, color: colors.green }}>fa</span>
        </div>
      )
    case "quickbooks":
      return (
        <div style={{ ...base, background: colors.blueBg }}>
          <span style={{ fontSize: "10px", fontWeight: 700, color: colors.blue }}>QB</span>
        </div>
      )
    case "cancel":
      return (
        <div style={{ ...base, background: colors.redBg }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.red} strokeWidth="2">
            <line x1="5" y1="5" x2="15" y2="15" /><line x1="15" y1="5" x2="5" y2="15" />
          </svg>
        </div>
      )
    case "refund":
      return (
        <div style={{ ...base, background: colors.yellowBg }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.yellow} strokeWidth="2">
            <path d="M4 10l4-4M4 10l4 4M4 10h12" />
          </svg>
        </div>
      )
    case "edit":
      return (
        <div style={{ ...base, background: colors.bgHover }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.textSec} strokeWidth="1.5">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-10 10L3 17.5l1.086-3.414 10-10z" />
          </svg>
        </div>
      )
    case "email":
      return (
        <div style={{ ...base, background: colors.accentBg }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.accent} strokeWidth="1.5">
            <rect x="2" y="4" width="16" height="12" rx="2" /><path d="M2 4l8 6 8-6" />
          </svg>
        </div>
      )
    case "archive":
      return (
        <div style={{ ...base, background: colors.bgHover }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.textSec} strokeWidth="1.5">
            <rect x="2" y="3" width="16" height="4" rx="1" /><path d="M4 7v8a2 2 0 002 2h8a2 2 0 002-2V7M8 11h4" />
          </svg>
        </div>
      )
    case "tracking":
      return (
        <div style={{ ...base, background: colors.blueBg }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.blue} strokeWidth="1.5">
            <path d="M4 10h8m0 0l-3-3m3 3l-3 3M16 10a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
        </div>
      )
    case "upsell":
      return (
        <div style={{ ...base, background: colors.greenBg }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.green} strokeWidth="2">
            <path d="M10 4v12M6 8l4-4 4 4" />
          </svg>
        </div>
      )
    case "download":
      return (
        <div style={{ ...base, background: colors.accentBg }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.accent} strokeWidth="2">
            <path d="M10 3v10M6 9l4 4 4-4M4 15h12" />
          </svg>
        </div>
      )
    default: // "order"
      return (
        <div style={{ ...base, background: colors.greenBg }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="4" fill={colors.green} />
          </svg>
        </div>
      )
  }
}

// ═══ HELPERS ═══

function extractGatewayName(providerId: string): string {
  return (providerId || "").replace(/^pp_/, "").split("_")[0].toLowerCase()
}

function extractPaymentMethod(payment: any): string {
  const data = payment?.data || {}
  const raw = data.method || data.payment_method || data.resource?.method || ""
  return METHOD_LABELS[raw] || raw || ""
}

function extractGatewayPaymentId(payment: any): string {
  const data = payment?.data || {}
  return (
    data.molliePaymentId || data.mollieOrderId ||
    data.stripePaymentIntentId || data.stripeCheckoutSessionId ||
    data.paypalOrderId || data.klarnaOrderId ||
    data.comgateTransId || data.airwallexPaymentIntentId ||
    data.payment_intent || data.id ||
    data.payment_id || data.transaction_id || ""
  )
}

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount)
}

function getDateHeader(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return "Today"
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Europe/Prague",
  })

  if (isToday) return `Today at ${time}`
  if (isYesterday) return `Yesterday at ${time}`
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }) + ` at ${time}`
}

// ═══ EVENT BUILDER ═══

function buildTimelineEvents(order: any): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const meta = order.metadata || {}

  // Check if we have rich payment_activity_log
  const paymentActivityLog: any[] = meta.payment_activity_log || []
  const hasRichPaymentLog = paymentActivityLog.length > 0

  // ─── 1. Order created ───
  if (order.created_at) {
    events.push({
      date: order.created_at,
      label: "Order created",
      detail: meta.source ? `Source: ${meta.source}` : undefined,
      icon: "order",
      status: "success",
    })
  }

  // ─── 2. Payment events ───
  // If we have payment_activity_log, use those (richer data with gateway, method, txn ID)
  // Otherwise, fall back to raw payment_collections data
  if (hasRichPaymentLog) {
    for (const entry of paymentActivityLog) {
      const eventLabel = PAYMENT_EVENT_LABELS[entry.event] || entry.event || "Payment Event"
      const gatewayName = GATEWAY_NAMES[entry.gateway] || entry.gateway || ""
      const methodLabel = entry.payment_method ? (METHOD_LABELS[entry.payment_method] || entry.payment_method) : ""

      let icon: EventIcon = "payment"
      let status: EventStatus = "success"

      if (entry.event === "refund" || entry.event === "cancellation") {
        icon = entry.event === "refund" ? "refund" : "cancel"
        status = entry.event === "refund" ? "warning" : "error"
      } else if (entry.event === "tracking_sent") {
        icon = "tracking"
        status = "info"
      } else if (entry.status === "error") {
        icon = "cancel"
        status = "error"
      } else if (entry.status === "pending") {
        status = "warning"
      }

      events.push({
        date: entry.timestamp,
        label: eventLabel,
        icon,
        status,
        gateway: gatewayName,
        paymentMethod: methodLabel,
        amount: entry.amount ? Number(entry.amount) : undefined,
        currency: entry.currency,
        transactionId: entry.transaction_id,
        refundId: entry.refund_id,
        errorMessage: entry.error_message,
        errorCode: entry.error_code,
        trackingNumber: entry.tracking_number,
        trackingCarrier: entry.tracking_carrier,
        detail: entry.detail,
      })
    }

    // Synthetic "Payment Received" if no received/capture/authorization in log
    const hasReceived = paymentActivityLog.some(
      (e: any) => e.event === "received" || e.event === "capture" || e.event === "authorization"
    )
    if (!hasReceived) {
      const payments = (order.payment_collections || []).flatMap((pc: any) => pc.payments || [])
      if (payments.length > 0) {
        const p = payments[0]
        const gateway = extractGatewayName(p.provider_id || "")
        const isCOD = (p.provider_id || "").includes("cod")
        const isCODCaptured = isCOD && meta.payment_captured === true
        const amount = Number(p.amount) || Number(order.total) || 0

        events.push({
          date: p.created_at || p.captured_at || order.created_at,
          label: isCOD ? (isCODCaptured ? "Payment Received" : "Awaiting COD Payment") : "Payment Received",
          icon: "payment",
          status: isCOD && !isCODCaptured ? "warning" : "success",
          gateway: GATEWAY_NAMES[gateway] || gateway,
          paymentMethod: isCOD ? "COD" : extractPaymentMethod(p),
          amount,
          currency: order.currency_code,
          transactionId: extractGatewayPaymentId(p),
          detail: isCOD && !isCODCaptured ? "Awaiting cash on delivery" : undefined,
        })
      }
    }
  } else {
    // Fallback: raw payment_collections data
    const payments = (order.payment_collections || []).flatMap((pc: any) => pc.payments || [])
    for (const payment of payments) {
      const gateway = extractGatewayName(payment.provider_id || "")
      const gatewayLabel = GATEWAY_NAMES[gateway] || gateway
      const method = extractPaymentMethod(payment)
      const txnId = extractGatewayPaymentId(payment)
      const amount = Number(payment.amount) || 0

      if (payment.captured_at) {
        events.push({
          date: payment.captured_at,
          label: "Payment Captured",
          icon: "payment",
          status: "success",
          gateway: gatewayLabel,
          paymentMethod: method,
          amount,
          currency: order.currency_code,
          transactionId: txnId,
        })
      } else if (payment.created_at) {
        events.push({
          date: payment.created_at,
          label: "Payment Authorized",
          icon: "payment",
          status: "success",
          gateway: gatewayLabel,
          paymentMethod: method,
          amount,
          currency: order.currency_code,
          transactionId: txnId,
        })
      }

      // Refunds
      for (const refund of payment.refunds || []) {
        events.push({
          date: refund.created_at || payment.updated_at,
          label: "Payment Refunded",
          icon: "refund",
          status: "warning",
          gateway: gatewayLabel,
          amount: Number(refund.amount) || 0,
          currency: order.currency_code,
        })
      }
    }

    // Payment collection-level refund (if no individual refunds)
    for (const pc of order.payment_collections || []) {
      if (pc.status === "refunded") {
        const payments = pc.payments || []
        if (!payments.some((p: any) => p.refunds?.length)) {
          events.push({
            date: pc.updated_at || pc.created_at,
            label: "Payment Refunded",
            icon: "refund",
            status: "warning",
          })
        }
      }
    }
  }

  // ─── 3. Upsell events ───
  const upsellLog: any[] = meta.upsell_log || []
  for (const entry of upsellLog) {
    events.push({
      date: entry.timestamp,
      label: PAYMENT_EVENT_LABELS[entry.event] || entry.event || "Upsell Event",
      icon: "upsell",
      status: "success",
      transactionId: entry.payment_id,
      detail: entry.message,
    })
  }

  // ─── 4. Fulfillments ───
  // Tracking URL from order metadata
  const orderTrackingUrl = meta.dextrum_tracking_url || meta.tracking_url || ""
  const orderTrackingNumber = meta.dextrum_tracking_number || ""
  const orderTrackingCarrier = meta.dextrum_carrier || meta.carrier_name || ""

  for (const f of order.fulfillments || []) {
    if (f.created_at) {
      events.push({
        date: f.created_at,
        label: "Items fulfilled",
        icon: "fulfillment",
        status: "info",
        trackingNumber: f.tracking_numbers?.length ? f.tracking_numbers[0] : orderTrackingNumber || undefined,
        trackingCarrier: orderTrackingCarrier || undefined,
        trackingUrl: orderTrackingUrl || undefined,
      })
    }
    if (f.shipped_at) {
      events.push({
        date: f.shipped_at,
        label: "Shipment created",
        icon: "fulfillment",
        status: "info",
        trackingNumber: f.tracking_numbers?.length ? f.tracking_numbers[0] : orderTrackingNumber || undefined,
        trackingCarrier: orderTrackingCarrier || undefined,
        trackingUrl: orderTrackingUrl || undefined,
      })
    }
    if (f.delivered_at) {
      events.push({
        date: f.delivered_at,
        label: "Marked as delivered",
        icon: "fulfillment",
        status: "success",
      })
    }
    if (f.canceled_at) {
      events.push({
        date: f.canceled_at,
        label: "Fulfillment canceled",
        icon: "cancel",
        status: "error",
      })
    }
  }

  // ─── 5. Dextrum WMS timeline ───
  const dextrumTimeline: any[] = meta.dextrum_timeline || []
  for (const entry of dextrumTimeline) {
    const isError = ["ALLOCATION_ISSUE", "CANCELLED", "FAILED"].includes(entry.status)
    const isDelivered = entry.status === "DELIVERED"
    const isDispatched = entry.status === "DISPATCHED"
    events.push({
      date: entry.date || entry.timestamp || order.created_at,
      label: DEXTRUM_STATUS_LABELS[entry.status] || `WMS: ${entry.status}`,
      detail: entry.detail || undefined,
      icon: "dextrum",
      status: isError ? "error" : isDelivered ? "success" : "info",
      trackingNumber: entry.tracking_number || (isDispatched || isDelivered ? orderTrackingNumber : undefined) || undefined,
      trackingCarrier: (isDispatched || isDelivered ? orderTrackingCarrier : undefined) || undefined,
      trackingUrl: (isDispatched || isDelivered ? orderTrackingUrl : undefined) || undefined,
    })
  }

  // Dextrum fallback (if status but no timeline array)
  if (meta.dextrum_status && !dextrumTimeline.length) {
    const isDexDispatched = ["DISPATCHED", "IN_TRANSIT", "DELIVERED"].includes(meta.dextrum_status)
    events.push({
      date: meta.dextrum_sent_at || meta.dextrum_status_updated_at || order.created_at,
      label: DEXTRUM_STATUS_LABELS[meta.dextrum_status] || `WMS: ${meta.dextrum_status}`,
      detail: meta.dextrum_order_code ? `WMS Order: ${meta.dextrum_order_code}` : undefined,
      icon: "dextrum",
      status: "info",
      trackingNumber: isDexDispatched ? orderTrackingNumber || undefined : undefined,
      trackingCarrier: isDexDispatched ? orderTrackingCarrier || undefined : undefined,
      trackingUrl: isDexDispatched ? orderTrackingUrl || undefined : undefined,
    })
  }

  // ─── 6. Order status changes ───
  if (order.status === "canceled" && order.canceled_at) {
    events.push({
      date: order.canceled_at,
      label: "Order canceled",
      icon: "cancel",
      status: "error",
    })
  }
  if (order.status === "archived") {
    events.push({
      date: order.created_at,
      label: "Order archived",
      icon: "archive",
      status: "neutral",
    })
  }

  // ─── 7. Email notifications ───
  // Prefer email_activity_log (new format) over email_log (legacy)
  const emailActivityLog: any[] = meta.email_activity_log || []
  const emailLogLegacy: any[] = meta.email_log || []

  if (emailActivityLog.length > 0) {
    for (const entry of emailActivityLog) {
      const templateLabel = EMAIL_TEMPLATES[entry.template] || entry.template || "Email"
      const isFailed = entry.status === "failed"
      events.push({
        date: entry.timestamp,
        label: isFailed ? `Email failed: ${templateLabel}` : `Email sent: ${templateLabel}`,
        icon: isFailed ? "cancel" : "email",
        status: isFailed ? "error" : "info",
        emailTo: entry.to || order.email,
        emailSubject: entry.subject,
        errorMessage: isFailed ? (entry.error_message || "Sending failed") : undefined,
        htmlBody: entry.html_body || undefined,
      })
    }
  } else if (emailLogLegacy.length > 0) {
    for (const email of emailLogLegacy) {
      events.push({
        date: email.sent_at || email.created_at,
        label: `Email sent: ${email.subject || email.type || "Notification"}`,
        icon: "email",
        status: "info",
        emailTo: email.to || order.email,
      })
    }
  }

  // ─── 8. Integrations (Fakturoid, QuickBooks) ───
  if (meta.fakturoid_invoice_id) {
    events.push({
      date: meta.fakturoid_created_at || order.created_at,
      label: "Fakturoid: Invoice created",
      detail: `Invoice #${meta.fakturoid_invoice_id}`,
      icon: "fakturoid",
      status: "success",
    })
  }
  if (meta.fakturoid_credit_note_id) {
    events.push({
      date: meta.fakturoid_credit_note_created_at || order.created_at,
      label: "Fakturoid: Credit note created",
      detail: `Credit note #${meta.fakturoid_credit_note_id}`,
      icon: "fakturoid",
      status: "warning",
    })
  }
  if (meta.quickbooks_invoice_id) {
    events.push({
      date: meta.quickbooks_created_at || order.created_at,
      label: "QuickBooks: Invoice created",
      detail: `Invoice #${meta.quickbooks_invoice_id}`,
      icon: "quickbooks",
      status: "success",
    })
  }
  if (meta.quickbooks_credit_memo_id) {
    events.push({
      date: meta.quickbooks_credit_memo_created_at || order.created_at,
      label: "QuickBooks: Credit memo created",
      detail: `Credit memo #${meta.quickbooks_credit_memo_id}`,
      icon: "quickbooks",
      status: "warning",
    })
  }

  // ─── 9. Book sent ───
  if (meta.book_sent === true || meta.book_sent === "true") {
    events.push({
      date: meta.book_sent_at || order.created_at,
      label: "Book marked as sent",
      icon: "fulfillment",
      status: "success",
    })
  }

  // ─── 9b. E-book downloads ───
  const downloadLog: any[] = meta.download_activity_log || []
  for (const entry of downloadLog) {
    events.push({
      date: entry.timestamp,
      label: `E-book downloaded (${entry.download_count || ""}x)`,
      icon: "download",
      status: "info",
      emailTo: entry.email,
      downloadCount: entry.download_count,
      downloadFiles: entry.files,
      detail: entry.ip && entry.ip !== "unknown" ? `IP: ${entry.ip}` : undefined,
    })
  }

  // ─── 10. Audit log (field changes) ───
  const auditLog: any[] = meta.audit_log || []
  for (const entry of auditLog) {
    events.push({
      date: entry.changed_at || entry.created_at,
      label: entry.label || `Field updated: ${entry.field}`,
      detail: entry.detail || (entry.old_value !== undefined
        ? `${entry.old_value} → ${entry.new_value}`
        : entry.new_value ? `Set to: ${entry.new_value}` : undefined),
      icon: "edit",
      status: "neutral",
    })
  }

  // ─── 11. Manual payment capture ───
  if (meta.payment_captured === true && meta.payment_captured_at) {
    // Only add if not already covered by payment_activity_log
    const alreadyCovered = paymentActivityLog.some((e: any) => e.event === "capture")
    if (!alreadyCovered) {
      events.push({
        date: meta.payment_captured_at,
        label: "Payment manually marked as captured",
        icon: "payment",
        status: "success",
      })
    }
  }

  // Sort newest first
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return events
}

// ═══ MAIN COMPONENT ═══

export function OrderTimeline({ order }: OrderTimelineProps) {
  const events = buildTimelineEvents(order)

  // Group by date header
  const grouped: { header: string; events: TimelineEvent[] }[] = []
  let currentHeader = ""
  for (const event of events) {
    const header = getDateHeader(event.date)
    if (header !== currentHeader) {
      grouped.push({ header, events: [] })
      currentHeader = header
    }
    grouped[grouped.length - 1].events.push(event)
  }

  return (
    <div className="od-card" style={cardStyle}>
      <div style={cardHeaderStyle}>Order Timeline</div>

      <div style={{ padding: "16px 20px" }}>
        {events.length === 0 ? (
          <p style={{ fontSize: "13px", color: colors.textMuted, fontFamily: fontStack }}>
            No timeline events yet
          </p>
        ) : (
          grouped.map((group, gi) => (
            <div key={gi}>
              {/* Date header */}
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: colors.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  padding: gi > 0 ? "16px 0 8px" : "0 0 8px",
                }}
              >
                {group.header}
              </div>

              {/* Events */}
              {group.events.map((event, i) => (
                <TimelineEventRow
                  key={`${gi}-${i}`}
                  event={event}
                  isLast={i === group.events.length - 1}
                  currencyCode={order.currency_code || "eur"}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ═══ EMAIL PREVIEW (Expandable iframe) ═══

function EmailPreview({ htmlBody }: { htmlBody: string }) {
  const [expanded, setExpanded] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeHeight, setIframeHeight] = useState(400)

  useEffect(() => {
    if (!expanded || !iframeRef.current) return

    const iframe = iframeRef.current
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return

    doc.open()
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { margin: 0; padding: 8px; font-family: sans-serif; }
            img { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>${htmlBody}</body>
      </html>
    `)
    doc.close()

    // Auto-resize iframe to content height
    const resizeObserver = new ResizeObserver(() => {
      const bodyHeight = doc.body?.scrollHeight || 400
      setIframeHeight(Math.min(bodyHeight + 20, 800))
    })

    if (doc.body) {
      resizeObserver.observe(doc.body)
    }

    // Fallback: set height after a short delay
    setTimeout(() => {
      const bodyHeight = doc.body?.scrollHeight || 400
      setIframeHeight(Math.min(bodyHeight + 20, 800))
    }, 200)

    return () => resizeObserver.disconnect()
  }, [expanded, htmlBody])

  return (
    <div style={{ marginTop: "6px" }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "none",
          border: `1px solid ${colors.border}`,
          borderRadius: radii.xs,
          padding: "3px 10px",
          fontSize: "11px",
          color: colors.accent,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontFamily: fontStack,
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 20 20"
          fill="none"
          stroke={colors.accent}
          strokeWidth="2"
          style={{
            transform: expanded ? "rotate(90deg)" : "rotate(0)",
            transition: "transform 0.15s ease",
          }}
        >
          <polyline points="6 4 14 10 6 16" />
        </svg>
        {expanded ? "Hide email" : "View email"}
      </button>

      {expanded && (
        <div
          style={{
            marginTop: "8px",
            border: `1px solid ${colors.border}`,
            borderRadius: radii.sm,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <iframe
            ref={iframeRef}
            title="Email preview"
            sandbox="allow-same-origin"
            style={{
              width: "100%",
              height: `${iframeHeight}px`,
              border: "none",
              display: "block",
            }}
          />
        </div>
      )}
    </div>
  )
}

// ═══ EVENT ROW ═══

function TimelineEventRow({
  event,
  isLast,
  currencyCode,
}: {
  event: TimelineEvent
  isLast: boolean
  currencyCode: string
}) {
  const hasRichData = !!(event.gateway || event.amount || event.transactionId || event.emailTo || event.errorMessage || event.trackingUrl || event.trackingNumber || event.downloadCount !== undefined)

  return (
    <div
      style={{
        display: "flex",
        gap: "12px",
        paddingBottom: isLast ? "0" : "14px",
        position: "relative",
      }}
    >
      {/* Icon + connector line */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
        <EventIconCircle icon={event.icon} />
        {!isLast && (
          <div
            style={{
              width: "2px",
              flex: 1,
              background: colors.border,
              marginTop: "4px",
              minHeight: "8px",
            }}
          />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingTop: "1px", minWidth: 0 }}>
        {/* Header row: label + pills + amount */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "13px", fontWeight: 500, color: colors.text, fontFamily: fontStack }}>
            {event.label}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            {/* Gateway pill */}
            {event.gateway && (
              <span style={{
                display: "inline-block",
                borderRadius: "9999px",
                border: `1px solid ${colors.border}`,
                padding: "1px 8px",
                fontSize: "11px",
                fontWeight: 500,
                color: colors.textSec,
                fontFamily: fontStack,
              }}>
                {event.gateway}
              </span>
            )}

            {/* Email pill */}
            {event.emailTo && !event.gateway && (
              <span style={{
                display: "inline-block",
                borderRadius: "9999px",
                border: `1px solid ${colors.border}`,
                padding: "1px 8px",
                fontSize: "11px",
                fontWeight: 500,
                color: "#3B82F6",
                background: "#EBF5FF",
                fontFamily: fontStack,
              }}>
                Email
              </span>
            )}

            {/* Amount */}
            {event.amount && event.amount > 0 && (
              <span style={{ fontSize: "13px", fontWeight: 600, color: colors.text, fontFamily: fontStack }}>
                {fmtCurrency(event.amount, event.currency || currencyCode)}
              </span>
            )}
          </div>
        </div>

        {/* Rich details */}
        {hasRichData && (
          <div style={{ marginTop: "4px", fontSize: "12px", fontFamily: fontStack, display: "flex", flexDirection: "column", gap: "2px" }}>
            {/* Payment method */}
            {event.paymentMethod && (
              <p style={{ color: colors.textSec, margin: 0 }}>
                <span style={{ fontWeight: 500 }}>Method:</span> {event.paymentMethod}
              </p>
            )}

            {/* Transaction ID */}
            {event.transactionId && (
              <p style={{ color: colors.textSec, wordBreak: "break-all", margin: 0 }}>
                <span style={{ fontWeight: 500 }}>ID:</span>{" "}
                <code style={{ background: colors.bgHover, padding: "1px 4px", borderRadius: "4px", fontFamily: "monospace", fontSize: "11px" }}>
                  {event.transactionId}
                </code>
              </p>
            )}

            {/* Refund ID */}
            {event.refundId && (
              <p style={{ color: colors.textSec, wordBreak: "break-all", margin: 0 }}>
                <span style={{ fontWeight: 500 }}>Refund ID:</span>{" "}
                <code style={{ background: colors.bgHover, padding: "1px 4px", borderRadius: "4px", fontFamily: "monospace", fontSize: "11px" }}>
                  {event.refundId}
                </code>
              </p>
            )}

            {/* Tracking info */}
            {event.trackingNumber && (
              <p style={{ color: colors.textSec, margin: 0 }}>
                <span style={{ fontWeight: 500 }}>Tracking:</span>{" "}
                <code style={{ background: colors.bgHover, padding: "1px 4px", borderRadius: "4px", fontFamily: "monospace", fontSize: "11px" }}>
                  {event.trackingNumber}
                </code>
                {event.trackingCarrier && (
                  <span style={{ marginLeft: "6px", fontSize: "11px", color: colors.textMuted }}>
                    ({event.trackingCarrier})
                  </span>
                )}
              </p>
            )}
            {event.trackingUrl && (
              <p style={{ margin: 0 }}>
                <a
                  href={event.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "12px",
                    color: colors.accent,
                    textDecoration: "none",
                    fontWeight: 500,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke={colors.accent} strokeWidth="2">
                    <path d="M15 11v5a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h5M12 3h5v5M10 10l7-7" />
                  </svg>
                  Track shipment &rarr;
                </a>
              </p>
            )}

            {/* Download info */}
            {event.downloadCount !== undefined && (
              <p style={{ color: colors.textSec, margin: 0 }}>
                <span style={{ fontWeight: 500 }}>Downloads:</span> {event.downloadCount}x
                {event.downloadFiles?.length ? (
                  <span style={{ marginLeft: "4px", color: colors.textMuted }}>
                    ({event.downloadFiles.join(", ")})
                  </span>
                ) : null}
              </p>
            )}

            {/* Email details */}
            {event.emailTo && (
              <p style={{ color: colors.textSec, margin: 0 }}>
                <span style={{ fontWeight: 500 }}>To:</span> {event.emailTo}
              </p>
            )}
            {event.emailSubject && (
              <p style={{ color: colors.textSec, margin: 0 }}>
                <span style={{ fontWeight: 500 }}>Subject:</span> {event.emailSubject}
              </p>
            )}

            {/* Error */}
            {event.errorMessage && (
              <div style={{ marginTop: "4px", borderRadius: radii.xs, background: colors.redBg, padding: "6px 8px" }}>
                <p style={{ color: colors.red, margin: 0, fontSize: "12px" }}>
                  <span style={{ fontWeight: 500 }}>Error:</span> {event.errorMessage}
                </p>
                {event.errorCode && (
                  <p style={{ fontSize: "11px", color: colors.red, marginTop: "2px", margin: 0 }}>
                    Code: {event.errorCode}
                  </p>
                )}
              </div>
            )}

            {/* Email HTML preview (expandable) */}
            {event.htmlBody && <EmailPreview htmlBody={event.htmlBody} />}
          </div>
        )}

        {/* Simple detail (non-rich events) */}
        {!hasRichData && event.detail && (
          <div style={{ fontSize: "12px", color: colors.textSec, marginTop: "2px", fontFamily: fontStack }}>
            {event.detail}
          </div>
        )}

        {/* Timestamp */}
        <div style={{ fontSize: "11px", color: colors.textMuted, marginTop: "3px", fontFamily: fontStack }}>
          {formatTime(event.date)}
        </div>
      </div>
    </div>
  )
}
