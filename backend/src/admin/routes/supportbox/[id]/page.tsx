// @ts-nocheck
import { useState, useRef, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { Button, Badge, Textarea } from "@medusajs/ui"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../../lib/sdk"

// ═══════════════════════════════════════════
// COLORS
// ═══════════════════════════════════════════
const C = {
  bg: "#F9FAFB",
  white: "#FFFFFF",
  border: "#E5E7EB",
  borderLight: "#F3F4F6",
  text: "#111827",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  green: "#10B981",
  greenBg: "#ECFDF5",
  greenLight: "#F0FDF4",
  blue: "#3B82F6",
  blueBg: "#EFF6FF",
  orange: "#F59E0B",
  red: "#EF4444",
  inboundBg: "#F3F4F6",
  outboundBg: "#ECFDF5",
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════
function formatDate(date: string): string {
  const d = new Date(date)
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function formatTime(date: string): string {
  const d = new Date(date)
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
}

function formatDateTime(date: string): string {
  return `${formatTime(date)}, ${formatDate(date)}`
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "EUR" }).format(amount || 0)
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return formatDate(date)
}

// ═══════════════════════════════════════════
// ORDER CARD
// ═══════════════════════════════════════════
function OrderCard({ order }: { order: any }) {
  const [hovered, setHovered] = useState(false)

  const statusColor = order.status === "completed" || order.status === "fulfilled"
    ? "green" : order.status === "canceled" ? "red" : "orange"

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "14px 16px",
        border: `1px solid ${C.border}`,
        borderRadius: "12px",
        marginBottom: "10px",
        backgroundColor: hovered ? C.bg : C.white,
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        boxShadow: hovered ? "0 4px 12px rgba(0,0,0,0.06)" : "0 1px 3px rgba(0,0,0,0.03)",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <Link to={`/orders/${order.order_id}`} style={{ fontSize: "13px", fontWeight: 600, color: C.text, textDecoration: "none" }}>
          #{order.display_id}
        </Link>
        <span style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>
          {formatCurrency(order.total, order.currency_code)}
        </span>
      </div>

      {/* Status */}
      <Badge color={statusColor}>{order.status || "pending"}</Badge>

      {/* Delivery status */}
      {order.delivery_status && (
        <div style={{ marginTop: "8px", fontSize: "12px", color: C.textSecondary }}>
          {order.carrier ? `${order.carrier}: ` : ""}{order.tracking_number || order.delivery_status}
        </div>
      )}

      {/* Tracking link */}
      {order.tracking_link && (
        <a
          href={order.tracking_link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: "12px", color: C.blue, textDecoration: "none", display: "block", marginTop: "4px" }}
        >
          Track shipment &rarr;
        </a>
      )}

      {/* Items */}
      {order.items?.length > 0 && (
        <div style={{ marginTop: "8px", borderTop: `1px solid ${C.borderLight}`, paddingTop: "8px" }}>
          {order.items.map((item: any, i: number) => (
            <div key={i} style={{ fontSize: "12px", color: C.textSecondary, marginBottom: "2px" }}>
              {item.title} &times; {item.quantity}
            </div>
          ))}
        </div>
      )}

      {/* Date */}
      <div style={{ fontSize: "11px", color: C.textMuted, marginTop: "8px" }}>
        Ordered {formatDate(order.created_at)}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// ORDER TIMELINE
// ═══════════════════════════════════════════
function OrderTimeline({ orders }: { orders: any[] }) {
  // Build timeline events from all orders
  const events: { label: string; date: string; dateRaw: string; color: string }[] = []

  for (const order of orders) {
    events.push({
      label: `Order #${order.display_id} placed`,
      date: formatDate(order.created_at),
      dateRaw: order.created_at,
      color: C.blue,
    })

    if (order.fulfillments) {
      for (const f of order.fulfillments) {
        if (f.created_at) {
          events.push({
            label: `#${order.display_id} shipped${order.carrier ? ` via ${order.carrier}` : ""}`,
            date: formatDate(f.created_at),
            dateRaw: f.created_at,
            color: C.orange,
          })
        }
        if (f.delivered_at) {
          events.push({
            label: `#${order.display_id} delivered`,
            date: formatDate(f.delivered_at),
            dateRaw: f.delivered_at,
            color: C.green,
          })
        }
      }
    }

    if (order.delivery_status && order.delivery_status !== "pending") {
      events.push({
        label: `#${order.display_id}: ${order.delivery_status}`,
        date: order.tracking_number ? `Tracking: ${order.tracking_number}` : "",
        dateRaw: order.created_at,
        color: C.green,
      })
    }
  }

  // Sort newest first
  events.sort((a, b) => new Date(b.dateRaw).getTime() - new Date(a.dateRaw).getTime())

  if (events.length === 0) return null

  return (
    <div style={{ position: "relative", paddingLeft: "20px" }}>
      {/* Vertical line */}
      <div style={{
        position: "absolute", left: "7px", top: "4px", bottom: "4px",
        width: "2px", backgroundColor: C.border,
      }} />

      {events.map((event, i) => (
        <div key={i} style={{ position: "relative", marginBottom: "14px" }}>
          <div style={{
            position: "absolute", left: "-17px", top: "4px",
            width: "10px", height: "10px", borderRadius: "50%",
            backgroundColor: i === 0 ? event.color : "#D1D5DB",
            border: "2px solid white",
          }} />
          <div style={{ fontSize: "12px", fontWeight: 500, color: C.text }}>{event.label}</div>
          <div style={{ fontSize: "11px", color: C.textMuted }}>{event.date}</div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════
// CUSTOMER SIDEBAR
// ═══════════════════════════════════════════
function CustomerSidebar({ fromEmail, allOrders }: { fromEmail: string; allOrders: any[] }) {
  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer-by-email", fromEmail],
    queryFn: async () => {
      try {
        const response = await sdk.client.fetch(
          `/admin/customers?q=${fromEmail}`,
          { method: "GET" }
        ) as any
        return response.customers?.[0] || null
      } catch {
        return null
      }
    },
  })

  const totalSpent = allOrders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0)
  const mainCurrency = allOrders[0]?.currency_code || "EUR"

  return (
    <div>
      {/* Customer Card */}
      <div style={{
        backgroundColor: C.white, border: `1px solid ${C.border}`,
        borderRadius: "12px", padding: "20px", marginBottom: "16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "14px" }}>
          Customer
        </div>

        {isLoading ? (
          <div style={{ color: C.textSecondary, fontSize: "13px" }}>Loading...</div>
        ) : !customer ? (
          <div>
            <div style={{ fontSize: "13px", fontWeight: 500, color: C.text, marginBottom: "4px" }}>{fromEmail}</div>
            <div style={{ fontSize: "12px", color: C.textMuted }}>No customer record found</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%",
                backgroundColor: C.greenBg, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "14px", fontWeight: 600, color: C.green, flexShrink: 0,
              }}>
                {(customer.first_name?.[0] || "?").toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: C.text }}>
                  {customer.first_name} {customer.last_name}
                </div>
                <a href={`mailto:${customer.email}`} style={{ fontSize: "12px", color: C.blue, textDecoration: "none" }}>
                  {customer.email}
                </a>
              </div>
            </div>

            {customer.phone && (
              <div style={{ fontSize: "12px", color: C.textSecondary, marginBottom: "6px" }}>
                {customer.phone}
              </div>
            )}

            {customer.addresses?.[0] && (
              <div style={{ fontSize: "12px", color: C.textSecondary, marginBottom: "6px" }}>
                {[customer.addresses[0].city, customer.addresses[0].country_code?.toUpperCase()].filter(Boolean).join(", ")}
              </div>
            )}

            {customer.created_at && (
              <div style={{ fontSize: "11px", color: C.textMuted, marginBottom: "10px" }}>
                Customer since {formatDate(customer.created_at)}
              </div>
            )}

            {/* Stats row */}
            <div style={{
              display: "flex", gap: "16px", paddingTop: "10px",
              borderTop: `1px solid ${C.borderLight}`,
            }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: C.text }}>{allOrders.length}</div>
                <div style={{ fontSize: "11px", color: C.textMuted }}>orders</div>
              </div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: C.text }}>
                  {formatCurrency(totalSpent, mainCurrency)}
                </div>
                <div style={{ fontSize: "11px", color: C.textMuted }}>total spent</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* All Orders */}
      {allOrders.length > 0 && (
        <div style={{
          backgroundColor: C.white, border: `1px solid ${C.border}`,
          borderRadius: "12px", padding: "20px", marginBottom: "16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "14px" }}>
            All Orders ({allOrders.length})
          </div>
          {allOrders.map((order: any) => (
            <OrderCard key={order.order_id} order={order} />
          ))}
        </div>
      )}

      {/* Order Timeline */}
      {allOrders.length > 0 && (
        <div style={{
          backgroundColor: C.white, border: `1px solid ${C.border}`,
          borderRadius: "12px", padding: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "14px" }}>
            Order Timeline
          </div>
          <OrderTimeline orders={allOrders} />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
const TicketDetailPage = () => {
  const { id: ticketId } = useParams()
  const queryClient = useQueryClient()
  const [replyText, setReplyText] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["supportbox-ticket-detail", ticketId],
    queryFn: async () => {
      const response = await sdk.client.fetch(
        `/admin/supportbox/tickets/${ticketId}`,
        { method: "GET" }
      )
      return response as any
    },
    enabled: !!ticketId,
  })

  const ticket = data?.ticket
  const allOrders = data?.allOrders || []

  const replyMutation = useMutation({
    mutationFn: async (bodyHtml: string) => {
      return await sdk.client.fetch(
        `/admin/supportbox/tickets/${ticketId}/reply`,
        { method: "POST", body: { body_html: bodyHtml } }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supportbox-ticket-detail", ticketId] })
      setReplyText("")
    },
  })

  const solveMutation = useMutation({
    mutationFn: async () => {
      return await sdk.client.fetch(
        `/admin/supportbox/tickets/${ticketId}/solve`,
        { method: "POST" }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supportbox-ticket-detail", ticketId] })
      queryClient.invalidateQueries({ queryKey: ["supportbox-tickets"] })
    },
  })

  const reopenMutation = useMutation({
    mutationFn: async () => {
      return await sdk.client.fetch(
        `/admin/supportbox/tickets/${ticketId}/reopen`,
        { method: "POST" }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supportbox-ticket-detail", ticketId] })
      queryClient.invalidateQueries({ queryKey: ["supportbox-tickets"] })
    },
  })

  // Auto-scroll to bottom when messages change
  const messages = ticket?.messages || []
  const sortedMessages = [...messages].sort(
    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [sortedMessages.length])

  const handleSendReply = async () => {
    if (!replyText.trim()) return
    const bodyHtml = replyText.split("\n").map((line) => `<p>${line}</p>`).join("")
    await replyMutation.mutateAsync(bodyHtml)
  }

  if (isLoading) {
    return <div style={{ padding: "32px", color: C.textSecondary, fontSize: "13px" }}>Loading...</div>
  }

  if (!ticket) {
    return <div style={{ padding: "32px", color: C.textSecondary, fontSize: "13px" }}>Ticket not found</div>
  }

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px 32px" }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: "24px", paddingBottom: "16px", borderBottom: `1px solid ${C.border}`,
      }}>
        <div>
          <Link to="/supportbox" style={{ textDecoration: "none" }}>
            <Button variant="secondary" size="small" style={{ marginBottom: "12px" }}>
              &larr; Back
            </Button>
          </Link>
          <h1 style={{ fontSize: "18px", fontWeight: 600, color: C.text, margin: "0 0 4px" }}>
            {ticket.subject}
          </h1>
          <div style={{ fontSize: "13px", color: C.textSecondary }}>
            From: {ticket.from_name ? `${ticket.from_name} <${ticket.from_email}>` : ticket.from_email}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Badge color={ticket.status === "new" ? "green" : "grey"}>
            {ticket.status === "new" ? "New" : ticket.status === "solved" ? "Solved" : "Old"}
          </Badge>
          {ticket.status === "new" || ticket.status !== "solved" ? (
            <Button onClick={() => solveMutation.mutate()} isLoading={solveMutation.isPending} size="small">
              Mark as Solved
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => reopenMutation.mutate()} isLoading={reopenMutation.isPending} size="small">
              Reopen
            </Button>
          )}
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ display: "flex", gap: "24px" }}>
        {/* ═══ Left — Conversation ═══ */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Messages */}
          <div style={{
            backgroundColor: C.white, border: `1px solid ${C.border}`,
            borderRadius: "12px", padding: "24px", marginBottom: "16px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {sortedMessages.map((message: any) => {
                const isInbound = message.direction === "inbound"
                return (
                  <div
                    key={message.id}
                    style={{
                      display: "flex",
                      justifyContent: isInbound ? "flex-start" : "flex-end",
                    }}
                  >
                    <div style={{
                      maxWidth: "80%",
                      padding: "14px 16px",
                      borderRadius: isInbound ? "12px 12px 12px 4px" : "12px 12px 4px 12px",
                      backgroundColor: isInbound ? C.inboundBg : C.outboundBg,
                    }}>
                      <div style={{
                        fontSize: "12px", fontWeight: 600,
                        color: isInbound ? C.textSecondary : C.green,
                        marginBottom: "6px",
                      }}>
                        {message.from_name || message.from_email || (isInbound ? "Customer" : "Support")}
                      </div>
                      <div
                        style={{ fontSize: "13px", lineHeight: 1.6, color: C.text }}
                        dangerouslySetInnerHTML={{ __html: message.body_html }}
                      />
                      <div style={{
                        fontSize: "11px", color: C.textMuted, marginTop: "8px", textAlign: "right",
                      }}>
                        {formatDateTime(message.created_at)}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Reply Box */}
          <div style={{
            backgroundColor: C.white, border: `1px solid ${C.border}`,
            borderRadius: "12px", padding: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: C.text, marginBottom: "10px" }}>
              Reply to Customer
            </div>
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your reply here..."
              style={{ minHeight: "100px", marginBottom: "12px", borderRadius: "8px" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setReplyText("")}
                disabled={replyMutation.isPending || !replyText.trim()}
              >
                Clear
              </Button>
              <Button
                size="small"
                onClick={handleSendReply}
                isLoading={replyMutation.isPending}
                disabled={!replyText.trim()}
              >
                Send Reply
              </Button>
            </div>
          </div>
        </div>

        {/* ═══ Right — Sidebar ═══ */}
        <div style={{ width: "360px", flexShrink: 0 }}>
          <CustomerSidebar fromEmail={ticket.from_email} allOrders={allOrders} />
        </div>
      </div>
    </div>
  )
}

export default TicketDetailPage
