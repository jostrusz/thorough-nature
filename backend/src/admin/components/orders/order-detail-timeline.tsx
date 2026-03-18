import React, { useState } from "react"
import { formatCurrency } from "../../lib/format-currency"
import { colors, shadows, radii, cardStyle, cardHeaderStyle, fontStack } from "./design-tokens"

interface OrderDetailTimelineProps {
  order: any
  onAddComment?: (comment: string) => void
  isAddingComment?: boolean
}

interface TimelineEvent {
  date: string
  label: string
  detail?: string
  color: string
  type?: "event" | "comment" | "integration" | "status_change"
  icon?: "order" | "payment" | "fulfillment" | "dextrum" | "fakturoid" | "quickbooks" | "edit" | "cancel" | "refund" | "comment" | "email" | "archive"
}

// ═══════════════════════════════════════════
// ICON COMPONENTS
// ═══════════════════════════════════════════

function EventIcon({ icon, color }: { icon?: string; color: string }) {
  const style: React.CSSProperties = {
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
        <div style={{ ...style, background: colors.greenBg }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.green} strokeWidth="2">
            <rect x="2" y="4" width="16" height="12" rx="2" />
            <path d="M2 9h16" />
          </svg>
        </div>
      )
    case "fulfillment":
      return (
        <div style={{ ...style, background: colors.blueBg }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.blue} strokeWidth="2">
            <polyline points="4 10 8 14 16 6" />
          </svg>
        </div>
      )
    case "dextrum":
      return (
        <div style={{ ...style, background: colors.accentBg }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.accent} strokeWidth="1.5">
            <rect x="2" y="4" width="16" height="12" rx="2" />
            <path d="M2 8h16M7 4v4M13 4v4" />
          </svg>
        </div>
      )
    case "fakturoid":
      return (
        <div style={{ ...style, background: colors.greenBg }}>
          <span style={{ fontSize: "10px", fontWeight: 700, color: colors.green }}>fa</span>
        </div>
      )
    case "quickbooks":
      return (
        <div style={{ ...style, background: colors.blueBg }}>
          <span style={{ fontSize: "10px", fontWeight: 700, color: colors.blue }}>QB</span>
        </div>
      )
    case "cancel":
      return (
        <div style={{ ...style, background: colors.redBg }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.red} strokeWidth="2">
            <line x1="5" y1="5" x2="15" y2="15" /><line x1="15" y1="5" x2="5" y2="15" />
          </svg>
        </div>
      )
    case "refund":
      return (
        <div style={{ ...style, background: colors.yellowBg }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.yellow} strokeWidth="2">
            <path d="M4 10l4-4M4 10l4 4M4 10h12" />
          </svg>
        </div>
      )
    case "edit":
      return (
        <div style={{ ...style, background: colors.bgHover }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.textSec} strokeWidth="1.5">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-10 10L3 17.5l1.086-3.414 10-10z" />
          </svg>
        </div>
      )
    case "email":
      return (
        <div style={{ ...style, background: colors.accentBg }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.accent} strokeWidth="1.5">
            <rect x="2" y="4" width="16" height="12" rx="2" /><path d="M2 4l8 6 8-6" />
          </svg>
        </div>
      )
    case "archive":
      return (
        <div style={{ ...style, background: colors.bgHover }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.textSec} strokeWidth="1.5">
            <rect x="2" y="3" width="16" height="4" rx="1" /><path d="M4 7v8a2 2 0 002 2h8a2 2 0 002-2V7M8 11h4" />
          </svg>
        </div>
      )
    case "comment":
      return (
        <div style={{ ...style, border: `2px solid ${colors.border}`, background: colors.bgCard, boxSizing: "border-box" }}>
          <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke={colors.textMuted} strokeWidth="2">
            <path d="M4 12l-2 4 4-2 10-10-2-2z" />
          </svg>
        </div>
      )
    default: // "order"
      return (
        <div style={{ ...style, background: colors.greenBg }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={colors.green} strokeWidth="2">
            <circle cx="10" cy="10" r="3" fill="currentColor" />
          </svg>
        </div>
      )
  }
}

export function OrderDetailTimeline({
  order,
  onAddComment,
  isAddingComment,
}: OrderDetailTimelineProps) {
  const [commentText, setCommentText] = useState("")

  // ═══════════════════════════════════════════
  // BUILD TIMELINE EVENTS
  // ═══════════════════════════════════════════
  const events: TimelineEvent[] = []

  // 1. Order created
  if (order.created_at) {
    events.push({
      date: order.created_at,
      label: "Order created",
      detail: order.metadata?.source ? `from ${order.metadata.source}` : undefined,
      color: "#AEE9D1",
      type: "event",
      icon: "order",
    })
  }

  // 2. Payment captured / authorized
  const payments =
    order.payment_collections?.flatMap((pc: any) => pc.payments || []) || []
  for (const payment of payments) {
    const provider = payment.provider_id
      ? payment.provider_id.replace("pp_", "").replace(/_/g, " ")
      : "Payment provider"
    const paymentGatewayId =
      payment.data?.molliePaymentId ||
      payment.data?.mollieOrderId ||
      payment.data?.paypalOrderId ||
      payment.data?.klarnaOrderId ||
      payment.data?.comgateTransId ||
      payment.data?.payment_intent ||
      payment.data?.id ||
      null

    if (payment.captured_at) {
      events.push({
        date: payment.captured_at,
        label: "Payment captured",
        detail: `${provider}${paymentGatewayId ? ` · Payment ID: ${paymentGatewayId}` : ""}`,
        color: "#0D5740",
        type: "event",
        icon: "payment",
      })
    } else if (payment.created_at) {
      events.push({
        date: payment.created_at,
        label: "Payment authorized",
        detail: `${provider}${paymentGatewayId ? ` · Payment ID: ${paymentGatewayId}` : ""}`,
        color: "#0D5740",
        type: "event",
        icon: "payment",
      })
    }

    // Refund events
    if (payment.refunds?.length) {
      for (const refund of payment.refunds) {
        events.push({
          date: refund.created_at || payment.updated_at,
          label: `Refund processed`,
          detail: `${formatCurrency(Number(refund.amount) || 0, order.currency_code)} via ${provider}`,
          color: "#9E2B25",
          type: "status_change",
          icon: "refund",
        })
      }
    }
  }

  // 3. Payment collection status changes
  for (const pc of order.payment_collections || []) {
    if (pc.status === "refunded") {
      // Only add if we didn't already add a refund from payment refunds
      if (!payments.some((p: any) => p.refunds?.length)) {
        events.push({
          date: pc.updated_at || pc.created_at,
          label: "Payment refunded",
          color: "#9E2B25",
          type: "status_change",
          icon: "refund",
        })
      }
    }
  }

  // 4. Fulfillments
  const fulfillments = order.fulfillments || []
  for (const fulfillment of fulfillments) {
    if (fulfillment.created_at) {
      events.push({
        date: fulfillment.created_at,
        label: "Items fulfilled",
        detail: fulfillment.tracking_numbers?.length
          ? `Tracking: ${fulfillment.tracking_numbers.join(", ")}`
          : undefined,
        color: "#1E40AF",
        type: "event",
        icon: "fulfillment",
      })
    }
    if (fulfillment.shipped_at) {
      events.push({
        date: fulfillment.shipped_at,
        label: "Shipment created",
        detail: fulfillment.tracking_numbers?.length
          ? `Tracking: ${fulfillment.tracking_numbers.join(", ")}`
          : undefined,
        color: "#1E40AF",
        type: "event",
        icon: "fulfillment",
      })
    }
    if (fulfillment.delivered_at) {
      events.push({
        date: fulfillment.delivered_at,
        label: "Marked as delivered",
        color: "#0D5740",
        type: "event",
        icon: "fulfillment",
      })
    }
    if (fulfillment.canceled_at) {
      events.push({
        date: fulfillment.canceled_at,
        label: "Fulfillment canceled",
        color: "#9E2B25",
        type: "status_change",
        icon: "cancel",
      })
    }
  }

  // 5. Order status changes
  if (order.status === "canceled" && order.canceled_at) {
    events.push({
      date: order.canceled_at,
      label: "Order canceled",
      color: "#9E2B25",
      type: "status_change",
      icon: "cancel",
    })
  }
  if (order.status === "archived") {
    events.push({
      date: order.updated_at || order.created_at,
      label: "Order archived",
      color: "#6B7280",
      type: "status_change",
      icon: "archive",
    })
  }

  // 6b. Dextrum / WMS events
  const dextrumTimeline: any[] = order.metadata?.dextrum_timeline || []
  for (const entry of dextrumTimeline) {
    const statusLabels: Record<string, string> = {
      WAITING: "Dextrum: Order queued",
      IMPORTED: "Dextrum: Sent to warehouse",
      PROCESSED: "Dextrum: Order processed",
      PACKED: "Dextrum: Package packed",
      DISPATCHED: "Dextrum: Dispatched",
      IN_TRANSIT: "Dextrum: In transit",
      DELIVERED: "Dextrum: Delivered",
      ALLOCATION_ISSUE: "Dextrum: Stock allocation issue",
      PARTIALLY_PICKED: "Dextrum: Partially picked",
      CANCELLED: "Dextrum: Cancelled",
      RESENT: "Dextrum: Resent to warehouse",
      FAILED: "Dextrum: Failed",
    }
    events.push({
      date: entry.date || order.updated_at || order.created_at,
      label: statusLabels[entry.status] || `Dextrum: ${entry.status}`,
      detail: entry.detail || (entry.tracking_number ? `Tracking: ${entry.tracking_number}` : undefined),
      color: "#3730A3",
      type: "integration",
      icon: "dextrum",
    })
  }

  // 6c. Dextrum initial status (if no timeline but has dextrum_status)
  if (order.metadata?.dextrum_status && !dextrumTimeline.length) {
    events.push({
      date: order.metadata?.dextrum_sent_at || order.metadata?.dextrum_status_updated_at || order.updated_at || order.created_at,
      label: `Dextrum: ${order.metadata.dextrum_status}`,
      detail: order.metadata.dextrum_order_code
        ? `WMS Order: ${order.metadata.dextrum_order_code}`
        : undefined,
      color: "#3730A3",
      type: "integration",
      icon: "dextrum",
    })
  }

  // 7. Fakturoid events
  if (order.metadata?.fakturoid_invoice_id) {
    events.push({
      date: order.metadata?.fakturoid_created_at || order.updated_at || order.created_at,
      label: "Fakturoid: Invoice created",
      detail: `Invoice #${order.metadata.fakturoid_invoice_id}`,
      color: "#047857",
      type: "integration",
      icon: "fakturoid",
    })
  }

  // 8. QuickBooks events
  if (order.metadata?.quickbooks_invoice_id) {
    events.push({
      date: order.metadata?.quickbooks_created_at || order.updated_at || order.created_at,
      label: "QuickBooks: Invoice created",
      detail: `Invoice #${order.metadata.quickbooks_invoice_id}`,
      color: "#1D4ED8",
      type: "integration",
      icon: "quickbooks",
    })
  }

  // 9. Book sent change
  if (order.metadata?.book_sent === true || order.metadata?.book_sent === "true") {
    events.push({
      date: order.metadata?.book_sent_at || order.updated_at || order.created_at,
      label: "Book marked as sent",
      color: "#6B7280",
      type: "status_change",
      icon: "fulfillment",
    })
  }

  // 10. Email notifications (from metadata log — both old and new format)
  const emailLog: any[] = order.metadata?.email_log || []
  for (const email of emailLog) {
    events.push({
      date: email.sent_at || email.created_at,
      label: `Email sent: ${email.subject || email.type || "Notification"}`,
      detail: `to ${email.to || order.email}`,
      color: "#4338CA",
      type: "event",
      icon: "email",
    })
  }

  // 10b. Email activity log (new format from email-logger utility)
  const emailActivityLog: any[] = order.metadata?.email_activity_log || []
  const EMAIL_TEMPLATE_LABELS: Record<string, string> = {
    order_confirmation: "Order Confirmation",
    shipment_notification: "Shipment Notification",
    ebook_delivery: "E-book Delivery",
    ebook_delivery_resend: "E-book Delivery (Resent)",
    abandoned_checkout: "Abandoned Checkout Reminder",
  }
  for (const entry of emailActivityLog) {
    const templateLabel = EMAIL_TEMPLATE_LABELS[entry.template] || entry.template || "Email"
    const isFailed = entry.status === "failed"
    events.push({
      date: entry.timestamp,
      label: isFailed ? `Email failed: ${templateLabel}` : `Email sent: ${templateLabel}`,
      detail: isFailed
        ? entry.error_message || "Sending failed"
        : `to ${entry.to || order.email}${entry.subject ? ` · "${entry.subject}"` : ""}`,
      color: isFailed ? "#9E2B25" : "#4338CA",
      type: "event",
      icon: isFailed ? "cancel" : "email",
    })
  }

  // 11. Field change audit log (from metadata)
  const auditLog: any[] = order.metadata?.audit_log || []
  for (const entry of auditLog) {
    events.push({
      date: entry.changed_at || entry.created_at,
      label: entry.label || `Field updated: ${entry.field}`,
      detail: entry.detail || (entry.old_value !== undefined
        ? `${entry.old_value} \u2192 ${entry.new_value}`
        : `Set to: ${entry.new_value}`),
      color: "#6B7280",
      type: "status_change",
      icon: "edit",
    })
  }

  // 12. Staff comments
  const comments: any[] = order.metadata?.timeline_comments || []
  for (const comment of comments) {
    events.push({
      date: comment.created_at,
      label: comment.text,
      detail: comment.author || "Staff",
      color: "#6D7175",
      type: "comment",
      icon: "comment",
    })
  }

  // Sort by date (newest first)
  events.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

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
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    }) + ` at ${time}`
  }

  const handlePostComment = () => {
    if (!commentText.trim() || !onAddComment) return
    onAddComment(commentText.trim())
    setCommentText("")
  }

  // Group events by date header
  function getDateHeader(iso: string): string {
    const d = new Date(iso)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return "Today"
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  }

  // Build grouped events
  const grouped: { header: string; events: (TimelineEvent & { index: number })[] }[] = []
  let currentHeader = ""
  for (let i = 0; i < events.length; i++) {
    const header = getDateHeader(events[i].date)
    if (header !== currentHeader) {
      grouped.push({ header, events: [] })
      currentHeader = header
    }
    grouped[grouped.length - 1].events.push({ ...events[i], index: i })
  }

  return (
    <div
      className="od-card"
      style={cardStyle}
    >
      <div style={cardHeaderStyle}>
        Timeline
      </div>

      {/* Comment box */}
      {onAddComment && (
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: colors.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              JO
            </div>
            <div style={{ flex: 1 }}>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Leave a comment..."
                rows={2}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: `1px solid ${colors.border}`,
                  borderRadius: "8px",
                  fontSize: "13px",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                  fontFamily: fontStack,
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = colors.accent)}
                onBlur={(e) => (e.currentTarget.style.borderColor = colors.border)}
              />
              {commentText.trim() && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button
                    onClick={handlePostComment}
                    disabled={isAddingComment}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      background: colors.accent,
                      color: "#FFFFFF",
                      border: "none",
                      opacity: isAddingComment ? 0.6 : 1,
                    }}
                  >
                    {isAddingComment ? "Posting..." : "Post"}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div style={{ fontSize: "12px", color: colors.textMuted, marginTop: "8px", textAlign: "center" }}>
            Only you and other staff can see comments
          </div>
        </div>
      )}

      {/* Timeline events grouped by date */}
      <div style={{ padding: "16px 20px" }}>
        {events.length === 0 ? (
          <p style={{ fontSize: "13px", color: colors.textMuted }}>No timeline events</p>
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

              {/* Events in this group */}
              {group.events.map((event, i) => (
                <div
                  key={event.index}
                  style={{
                    display: "flex",
                    gap: "12px",
                    paddingBottom: i < group.events.length - 1 ? "12px" : "0",
                    position: "relative",
                  }}
                >
                  {/* Icon + connector line */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      position: "relative",
                    }}
                  >
                    <EventIcon icon={event.icon} color={event.color} />
                    {i < group.events.length - 1 && (
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
                  <div style={{ flex: 1, paddingTop: "2px" }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: event.type === "comment" ? 400 : 500,
                        color: colors.text,
                      }}
                    >
                      {event.label}
                    </div>
                    {event.detail && (
                      <div style={{ fontSize: "12px", color: colors.textSec, marginTop: "2px" }}>
                        {event.detail}
                      </div>
                    )}
                    <div style={{ fontSize: "12px", color: colors.textMuted, marginTop: "2px" }}>
                      {formatDate(event.date)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// formatCurrency imported from ../../lib/format-currency
