// @ts-nocheck
import { useState, useRef, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { Button, Badge } from "@medusajs/ui"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../../lib/sdk"

// ═══════════════════════════════════════════
// FULL-WIDTH OVERRIDE
// ═══════════════════════════════════════════
const BG = "#F8FAFC"

function useFullWidth(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const originals: { el: HTMLElement; styles: Record<string, string> }[] = []
    let node: HTMLElement | null = el.parentElement
    while (node && node !== document.documentElement) {
      originals.push({
        el: node,
        styles: {
          background: node.style.background,
          maxWidth: node.style.maxWidth,
          width: node.style.width,
          padding: node.style.padding,
          paddingLeft: node.style.paddingLeft,
          paddingRight: node.style.paddingRight,
          margin: node.style.margin,
          boxSizing: node.style.boxSizing,
        },
      })
      node.style.setProperty("background", BG, "important")
      node.style.setProperty("max-width", "none", "important")
      node.style.setProperty("width", "100%", "important")
      node.style.setProperty("padding-left", "0", "important")
      node.style.setProperty("padding-right", "0", "important")
      node.style.setProperty("margin", "0", "important")
      node.style.setProperty("box-sizing", "border-box", "important")
      node = node.parentElement
    }
    return () => {
      originals.forEach(({ el: n, styles }) => {
        n.style.background = styles.background
        n.style.maxWidth = styles.maxWidth
        n.style.width = styles.width
        n.style.padding = styles.padding
        n.style.paddingLeft = styles.paddingLeft
        n.style.paddingRight = styles.paddingRight
        n.style.margin = styles.margin
        n.style.boxSizing = styles.boxSizing
      })
    }
  }, [ref])
}

// ═══════════════════════════════════════════
// COLORS & THEME
// ═══════════════════════════════════════════
const C = {
  bg: "#F8FAFC",
  white: "#FFFFFF",
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  text: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  green: "#10B981",
  greenBg: "#ECFDF5",
  greenLight: "#D1FAE5",
  blue: "#3B82F6",
  blueBg: "#EFF6FF",
  blueLight: "#DBEAFE",
  purple: "#8B5CF6",
  purpleBg: "#F5F3FF",
  orange: "#F59E0B",
  orangeBg: "#FFFBEB",
  red: "#EF4444",
  inboundBg: "#F1F5F9",
  inboundBorder: "#E2E8F0",
  outboundBg: "#ECFDF5",
  outboundBorder: "#A7F3D0",
  accent: "#6366F1",
  accentBg: "#EEF2FF",
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════
function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
}

function formatDateTime(date: string): string {
  return `${formatTime(date)}, ${formatDate(date)}`
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "EUR" }).format(amount || 0)
}

function stripHtml(html: string): string {
  return html?.replace(/<[^>]*>/g, "").trim() || ""
}

// ═══════════════════════════════════════════
// ORDER CARD — compact, clickable
// ═══════════════════════════════════════════
function OrderCard({ order }: { order: any }) {
  const [hovered, setHovered] = useState(false)
  const statusColor = order.status === "completed" || order.status === "fulfilled"
    ? "green" : order.status === "canceled" ? "red" : "orange"
  const statusEmoji = order.status === "completed" || order.status === "fulfilled"
    ? "✅" : order.status === "canceled" ? "❌" : "⏳"

  return (
    <Link to={`/orders/${order.order_id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: "14px 16px",
          border: `1px solid ${hovered ? C.blue : C.border}`,
          borderRadius: "10px",
          marginBottom: "8px",
          backgroundColor: hovered ? C.blueBg : C.white,
          transform: hovered ? "translateY(-1px)" : "none",
          boxShadow: hovered ? "0 4px 12px rgba(59,130,246,0.1)" : "none",
          transition: "all 0.2s ease",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: C.text }}>
            {statusEmoji} #{order.display_id}
          </span>
          <span style={{ fontSize: "14px", fontWeight: 700, color: C.text }}>
            {formatCurrency(order.total, order.currency_code)}
          </span>
        </div>

        <Badge color={statusColor} style={{ marginBottom: "6px" }}>{order.status || "pending"}</Badge>

        {order.tracking_link && (
          <a
            href={order.tracking_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: "11px", color: C.blue, textDecoration: "none", display: "block", marginTop: "6px" }}
          >
            📦 Track shipment &rarr;
          </a>
        )}

        {order.items?.length > 0 && (
          <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: `1px solid ${C.borderLight}` }}>
            {order.items.map((item: any, i: number) => (
              <div key={i} style={{ fontSize: "12px", color: C.textSecondary, lineHeight: 1.5 }}>
                {item.title} &times; {item.quantity}
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: "11px", color: C.textMuted, marginTop: "6px" }}>
          Ordered {formatDate(order.created_at)}
        </div>
      </div>
    </Link>
  )
}

// ═══════════════════════════════════════════
// CUSTOMER SIDEBAR — compact & info-rich
// ═══════════════════════════════════════════
function CustomerSidebar({ fromEmail, allOrders }: { fromEmail: string; allOrders: any[] }) {
  const { data: customer } = useQuery({
    queryKey: ["customer-by-email", fromEmail],
    queryFn: async () => {
      try {
        const response = await sdk.client.fetch(`/admin/customers?q=${fromEmail}`, { method: "GET" }) as any
        return response.customers?.[0] || null
      } catch { return null }
    },
  })

  const totalSpent = allOrders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0)
  const mainCurrency = allOrders[0]?.currency_code || "EUR"
  const name = customer ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim() : ""
  const initial = (name?.[0] || fromEmail?.[0] || "?").toUpperCase()

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Customer Card */}
      <div style={{
        backgroundColor: C.white, border: `1px solid ${C.border}`,
        borderRadius: "14px", padding: "20px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        {/* Avatar + Name */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "17px", fontWeight: 700, color: "#fff", flexShrink: 0,
            boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
          }}>
            {initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name || fromEmail}
            </div>
            <a href={`mailto:${fromEmail}`} style={{ fontSize: "12px", color: C.blue, textDecoration: "none" }}>
              {fromEmail}
            </a>
          </div>
        </div>

        {customer?.phone && (
          <div style={{ fontSize: "12px", color: C.textSecondary, marginBottom: "4px" }}>📱 {customer.phone}</div>
        )}
        {customer?.addresses?.[0] && (
          <div style={{ fontSize: "12px", color: C.textSecondary, marginBottom: "4px" }}>
            📍 {[customer.addresses[0].city, customer.addresses[0].country_code?.toUpperCase()].filter(Boolean).join(", ")}
          </div>
        )}
        {customer?.created_at && (
          <div style={{ fontSize: "11px", color: C.textMuted, marginBottom: "12px" }}>
            Customer since {formatDate(customer.created_at)}
          </div>
        )}

        {/* Stats */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px",
          borderTop: `1px solid ${C.borderLight}`, paddingTop: "14px",
        }}>
          <div style={{
            textAlign: "center", padding: "10px", borderRadius: "10px",
            backgroundColor: C.purpleBg,
          }}>
            <div style={{ fontSize: "20px", fontWeight: 800, color: C.purple }}>{allOrders.length}</div>
            <div style={{ fontSize: "10px", fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>orders</div>
          </div>
          <div style={{
            textAlign: "center", padding: "10px", borderRadius: "10px",
            backgroundColor: C.greenBg,
          }}>
            <div style={{ fontSize: "20px", fontWeight: 800, color: C.green }}>{formatCurrency(totalSpent, mainCurrency)}</div>
            <div style={{ fontSize: "10px", fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>spent</div>
          </div>
        </div>
      </div>

      {/* Orders */}
      {allOrders.length > 0 && (
        <div style={{
          backgroundColor: C.white, border: `1px solid ${C.border}`,
          borderRadius: "14px", padding: "16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{
            fontSize: "11px", fontWeight: 700, color: C.textMuted,
            textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px",
          }}>
            📦 Orders ({allOrders.length})
          </div>
          {allOrders.map((order: any) => (
            <OrderCard key={order.order_id} order={order} />
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// MESSAGE BUBBLE — modern chat design
// ═══════════════════════════════════════════
function MessageBubble({ message }: { message: any }) {
  const isInbound = message.direction === "inbound"
  const body = message.body_html || message.body_text || ""
  const hasContent = stripHtml(body).length > 0

  return (
    <div style={{
      display: "flex",
      justifyContent: isInbound ? "flex-start" : "flex-end",
      paddingLeft: isInbound ? 0 : "48px",
      paddingRight: isInbound ? "48px" : 0,
    }}>
      <div style={{
        maxWidth: "100%",
        width: "100%",
      }}>
        {/* Sender label */}
        <div style={{
          fontSize: "11px", fontWeight: 600, marginBottom: "4px",
          color: isInbound ? C.textSecondary : C.green,
          textAlign: isInbound ? "left" : "right",
          paddingLeft: isInbound ? "14px" : 0,
          paddingRight: isInbound ? 0 : "14px",
        }}>
          {isInbound ? "👤 " : "💬 "}
          {message.from_name || message.from_email || (isInbound ? "Customer" : "Support")}
        </div>

        {/* Bubble */}
        <div style={{
          padding: "16px 20px",
          borderRadius: isInbound ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
          backgroundColor: isInbound ? C.white : C.outboundBg,
          border: `1px solid ${isInbound ? C.border : C.outboundBorder}`,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          {hasContent ? (
            <div
              style={{ fontSize: "14px", lineHeight: 1.7, color: C.text, wordBreak: "break-word" }}
              dangerouslySetInnerHTML={{ __html: body }}
            />
          ) : (
            <div style={{ fontSize: "13px", color: C.textMuted, fontStyle: "italic" }}>
              (no email body)
            </div>
          )}
        </div>

        {/* Time */}
        <div style={{
          fontSize: "11px", color: C.textMuted, marginTop: "4px",
          textAlign: isInbound ? "left" : "right",
          paddingLeft: isInbound ? "14px" : 0,
          paddingRight: isInbound ? 0 : "14px",
        }}>
          {formatDateTime(message.created_at)}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// REPLY COMPOSER — big, prominent
// ═══════════════════════════════════════════
function ReplyComposer({ replyText, setReplyText, onSend, isSending }: {
  replyText: string; setReplyText: (v: string) => void; onSend: () => void; isSending: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.max(120, el.scrollHeight) + "px"
  }, [replyText])

  // Ctrl+Enter to send
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && replyText.trim()) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div style={{
      backgroundColor: C.white,
      border: `2px solid ${C.accent}`,
      borderRadius: "16px",
      padding: "20px 24px",
      boxShadow: "0 4px 20px rgba(99,102,241,0.08)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "14px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "8px",
            background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "13px",
          }}>
            ✉️
          </div>
          <span style={{ fontSize: "14px", fontWeight: 700, color: C.text }}>
            Reply to Customer
          </span>
        </div>
        <span style={{ fontSize: "11px", color: C.textMuted }}>
          ⌘+Enter to send
        </span>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write your reply here... Be helpful and friendly 😊"
        style={{
          width: "100%",
          minHeight: "120px",
          maxHeight: "400px",
          padding: "16px",
          fontSize: "14px",
          lineHeight: 1.7,
          color: C.text,
          backgroundColor: C.bg,
          border: `1px solid ${C.borderLight}`,
          borderRadius: "12px",
          resize: "none",
          outline: "none",
          fontFamily: "inherit",
          transition: "border-color 0.2s ease",
          boxSizing: "border-box",
        }}
        onFocus={(e) => { e.target.style.borderColor = C.accent }}
        onBlur={(e) => { e.target.style.borderColor = C.borderLight }}
      />

      {/* Actions */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: "14px",
      }}>
        <div style={{ fontSize: "12px", color: C.textMuted }}>
          {replyText.trim().length > 0 && `${replyText.trim().length} characters`}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {replyText.trim() && (
            <button
              onClick={() => setReplyText("")}
              disabled={isSending}
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 500,
                color: C.textSecondary,
                backgroundColor: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: "8px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Clear
            </button>
          )}
          <button
            onClick={onSend}
            disabled={!replyText.trim() || isSending}
            style={{
              padding: "10px 24px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#fff",
              background: replyText.trim()
                ? `linear-gradient(135deg, ${C.accent}, ${C.purple})`
                : C.borderLight,
              border: "none",
              borderRadius: "10px",
              cursor: replyText.trim() ? "pointer" : "not-allowed",
              boxShadow: replyText.trim() ? "0 4px 14px rgba(99,102,241,0.3)" : "none",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {isSending ? "Sending..." : "Send Reply ✨"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════
const TicketDetailPage = () => {
  const pageRef = useRef<HTMLDivElement>(null)
  useFullWidth(pageRef)

  const { id: ticketId } = useParams()
  const queryClient = useQueryClient()
  const [replyText, setReplyText] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["supportbox-ticket-detail", ticketId],
    queryFn: async () => {
      const response = await sdk.client.fetch(`/admin/supportbox/tickets/${ticketId}`, { method: "GET" })
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
        { method: "POST", body: { body_html: bodyHtml, body_text: replyText } }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supportbox-ticket-detail", ticketId] })
      setReplyText("")
    },
  })

  const solveMutation = useMutation({
    mutationFn: async () => sdk.client.fetch(`/admin/supportbox/tickets/${ticketId}/solve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supportbox-ticket-detail", ticketId] })
      queryClient.invalidateQueries({ queryKey: ["supportbox-tickets"] })
    },
  })

  const reopenMutation = useMutation({
    mutationFn: async () => sdk.client.fetch(`/admin/supportbox/tickets/${ticketId}/reopen`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supportbox-ticket-detail", ticketId] })
      queryClient.invalidateQueries({ queryKey: ["supportbox-tickets"] })
    },
  })

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
    return (
      <div style={{ padding: "64px", textAlign: "center" }}>
        <div style={{ fontSize: "24px", marginBottom: "8px" }}>⏳</div>
        <div style={{ color: C.textSecondary, fontSize: "14px" }}>Loading ticket...</div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div style={{ padding: "64px", textAlign: "center" }}>
        <div style={{ fontSize: "24px", marginBottom: "8px" }}>🔍</div>
        <div style={{ color: C.textSecondary, fontSize: "14px" }}>Ticket not found</div>
      </div>
    )
  }

  const statusConfig = {
    new: { label: "New", color: "green" as const, emoji: "🟢" },
    solved: { label: "Solved", color: "grey" as const, emoji: "✅" },
    old: { label: "Old", color: "orange" as const, emoji: "📂" },
  }
  const status = statusConfig[ticket.status as keyof typeof statusConfig] || statusConfig.new

  return (
    <div ref={pageRef} style={{ width: "100%", padding: "24px 32px", background: BG, boxSizing: "border-box" }}>
      {/* Inject global CSS to override Medusa admin container constraints */}
      <style>{`
        main > div, main > div > div, main > div > div > div,
        main > div > div > div > div, main > div > div > div > div > div {
          max-width: none !important;
          width: 100% !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
        }
      `}</style>
      {/* ═══ Top Bar ═══ */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "24px", paddingBottom: "20px", borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link to="/supportbox" style={{ textDecoration: "none" }}>
            <button style={{
              padding: "8px 14px", fontSize: "13px", fontWeight: 500,
              color: C.textSecondary, backgroundColor: C.white,
              border: `1px solid ${C.border}`, borderRadius: "8px",
              cursor: "pointer", transition: "all 0.15s ease",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              ← Back
            </button>
          </Link>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.3 }}>
              {ticket.subject}
            </h1>
            <div style={{ fontSize: "13px", color: C.textSecondary, marginTop: "2px" }}>
              From: {ticket.from_name ? `${ticket.from_name} <${ticket.from_email}>` : ticket.from_email}
              <span style={{ color: C.textMuted, margin: "0 8px" }}>·</span>
              {formatDateTime(ticket.created_at)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Badge color={status.color}>
            {status.emoji} {status.label}
          </Badge>
          {ticket.status !== "solved" ? (
            <button
              onClick={() => solveMutation.mutate()}
              disabled={solveMutation.isPending}
              style={{
                padding: "8px 16px", fontSize: "13px", fontWeight: 600,
                color: "#fff", background: `linear-gradient(135deg, ${C.green}, #059669)`,
                border: "none", borderRadius: "8px", cursor: "pointer",
                boxShadow: "0 2px 8px rgba(16,185,129,0.3)",
                transition: "all 0.15s ease",
              }}
            >
              {solveMutation.isPending ? "..." : "✓ Mark Solved"}
            </button>
          ) : (
            <button
              onClick={() => reopenMutation.mutate()}
              disabled={reopenMutation.isPending}
              style={{
                padding: "8px 16px", fontSize: "13px", fontWeight: 600,
                color: C.orange, backgroundColor: C.orangeBg,
                border: `1px solid ${C.orange}`, borderRadius: "8px",
                cursor: "pointer", transition: "all 0.15s ease",
              }}
            >
              {reopenMutation.isPending ? "..." : "↩ Reopen"}
            </button>
          )}
        </div>
      </div>

      {/* ═══ Main Layout — Conversation + Sidebar ═══ */}
      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>

        {/* ─── LEFT: Conversation + Reply (75%) ─── */}
        <div style={{ flex: 3, minWidth: 0, display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Messages area */}
          <div style={{
            backgroundColor: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            {sortedMessages.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: C.textMuted }}>
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>💬</div>
                <div style={{ fontSize: "14px" }}>No messages yet</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {sortedMessages.map((message: any) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Reply Composer */}
          <ReplyComposer
            replyText={replyText}
            setReplyText={setReplyText}
            onSend={handleSendReply}
            isSending={replyMutation.isPending}
          />

          {/* Error display */}
          {replyMutation.isError && (
            <div style={{
              padding: "12px 16px", backgroundColor: "#FEF2F2",
              border: "1px solid #FECACA", borderRadius: "10px",
              fontSize: "13px", color: C.red,
            }}>
              ❌ Failed to send: {(replyMutation.error as any)?.message || "Unknown error"}
            </div>
          )}
        </div>

        {/* ─── RIGHT: Customer Sidebar (25%) ─── */}
        <div style={{ flex: 1, minWidth: "280px", maxWidth: "380px" }}>
          <CustomerSidebar fromEmail={ticket.from_email} allOrders={allOrders} />
        </div>
      </div>
    </div>
  )
}

export default TicketDetailPage
