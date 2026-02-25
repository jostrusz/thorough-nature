import React, { useState } from "react"

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
  type?: "event" | "comment"
}

export function OrderDetailTimeline({
  order,
  onAddComment,
  isAddingComment,
}: OrderDetailTimelineProps) {
  const [commentText, setCommentText] = useState("")

  // Build timeline events from order data
  const events: TimelineEvent[] = []

  // Created
  if (order.created_at) {
    events.push({
      date: order.created_at,
      label: "Order created",
      color: "#008060",
      type: "event",
    })
  }

  // Payment
  const payments =
    order.payment_collections?.flatMap((pc: any) => pc.payments || []) || []
  for (const payment of payments) {
    if (payment.captured_at || payment.created_at) {
      events.push({
        date: payment.captured_at || payment.created_at,
        label: "Payment captured",
        detail: payment.provider_id
          ? `via ${payment.provider_id.replace("pp_", "").replace(/_/g, " ")}`
          : undefined,
        color: "#0D5740",
        type: "event",
      })
    }
  }

  // Fulfillments
  const fulfillments = order.fulfillments || []
  for (const fulfillment of fulfillments) {
    if (fulfillment.created_at) {
      events.push({
        date: fulfillment.created_at,
        label: "Fulfilled",
        detail: fulfillment.tracking_numbers?.length
          ? `Tracking: ${fulfillment.tracking_numbers.join(", ")}`
          : undefined,
        color: "#1E40AF",
        type: "event",
      })
    }
  }

  // BaseLinker status changes (from metadata)
  if (order.metadata?.baselinker_status) {
    const statusLabels: Record<string, string> = {
      imported: "Imported to BaseLinker",
      processing: "Processing in warehouse",
      sent: "Order sent",
      transit: "In transit",
      delivered: "Delivered",
      returned: "Returned",
    }
    events.push({
      date: order.metadata?.baselinker_import_date || order.updated_at || order.created_at,
      label:
        statusLabels[order.metadata.baselinker_status] ||
        order.metadata.baselinker_status,
      detail: "BaseLinker",
      color:
        order.metadata.baselinker_status === "delivered"
          ? "#0D5740"
          : order.metadata.baselinker_status === "returned"
          ? "#9E2B25"
          : "#3730A3",
      type: "event",
    })
  }

  // Fakturoid invoice created
  if (order.metadata?.fakturoid_invoice_id) {
    events.push({
      date: order.metadata?.fakturoid_created_at || order.updated_at || order.created_at,
      label: "Fakturoid invoice created",
      detail: order.metadata.fakturoid_invoice_id,
      color: "#008060",
      type: "event",
    })
  }

  // Comments from metadata
  const comments: any[] = order.metadata?.timeline_comments || []
  for (const comment of comments) {
    events.push({
      date: comment.created_at,
      label: comment.text,
      detail: comment.author || "Staff",
      color: "#6D7175",
      type: "comment",
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
    if (isToday) {
      return `Today at ${d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })}`
    }
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const handlePostComment = () => {
    if (!commentText.trim() || !onAddComment) return
    onAddComment(commentText.trim())
    setCommentText("")
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E1E3E5",
        borderRadius: "10px",
        marginBottom: "16px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "#1A1A1A",
          padding: "16px 20px",
          borderBottom: "1px solid #E1E3E5",
        }}
      >
        Timeline
      </div>

      {/* Comment box */}
      {onAddComment && (
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E1E3E5",
          }}
        >
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            {/* User avatar */}
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "#008060",
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
                  border: "1px solid #E1E3E5",
                  borderRadius: "8px",
                  fontSize: "13px",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#008060")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#E1E3E5")}
              />
              {commentText.trim() && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "8px",
                  }}
                >
                  <button
                    onClick={handlePostComment}
                    disabled={isAddingComment}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      background: "#1A1A1A",
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
          <div
            style={{
              fontSize: "12px",
              color: "#8C9196",
              marginTop: "8px",
              textAlign: "center",
            }}
          >
            Only you and other staff can see comments
          </div>
        </div>
      )}

      {/* Timeline events */}
      <div style={{ padding: "16px 20px" }}>
        {events.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#8C9196" }}>
            No timeline events
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {events.map((event, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "12px",
                  paddingBottom: i < events.length - 1 ? "16px" : "0",
                  position: "relative",
                }}
              >
                {/* Dot and line */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    position: "relative",
                  }}
                >
                  {event.type === "comment" ? (
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        border: "2px solid #E1E3E5",
                        background: "#FFFFFF",
                        flexShrink: 0,
                        marginTop: "3px",
                        boxSizing: "border-box",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        background: event.color,
                        flexShrink: 0,
                        marginTop: "3px",
                      }}
                    />
                  )}
                  {i < events.length - 1 && (
                    <div
                      style={{
                        width: "2px",
                        flex: 1,
                        background: "#E1E3E5",
                        marginTop: "4px",
                      }}
                    />
                  )}
                </div>

                {/* Content */}
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: event.type === "comment" ? 400 : 500,
                      color: "#1A1A1A",
                      fontStyle: event.type === "comment" ? "normal" : "normal",
                    }}
                  >
                    {event.label}
                  </div>
                  {event.detail && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6D7175",
                        marginTop: "2px",
                      }}
                    >
                      {event.detail}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#8C9196",
                      marginTop: "2px",
                    }}
                  >
                    {formatDate(event.date)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
