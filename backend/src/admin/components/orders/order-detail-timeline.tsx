import React from "react"

interface OrderDetailTimelineProps {
  order: any
}

interface TimelineEvent {
  date: string
  label: string
  detail?: string
  color: string
}

export function OrderDetailTimeline({ order }: OrderDetailTimelineProps) {
  // Build timeline events from order data
  const events: TimelineEvent[] = []

  // Created
  if (order.created_at) {
    events.push({
      date: order.created_at,
      label: "Order created",
      color: "#008060",
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
      date: order.updated_at || order.created_at,
      label: statusLabels[order.metadata.baselinker_status] || order.metadata.baselinker_status,
      detail: "BaseLinker",
      color:
        order.metadata.baselinker_status === "delivered"
          ? "#0D5740"
          : order.metadata.baselinker_status === "returned"
          ? "#9E2B25"
          : "#3730A3",
    })
  }

  // Sort by date (newest first)
  events.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E1E3E5",
        borderRadius: "10px",
        padding: "20px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "#1A1A1A",
          marginBottom: "16px",
        }}
      >
        Timeline
      </div>

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
                    fontWeight: 500,
                    color: "#1A1A1A",
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
  )
}
