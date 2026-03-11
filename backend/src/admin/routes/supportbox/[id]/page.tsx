// @ts-nocheck
import { useState, useRef, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { Badge } from "@medusajs/ui"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../../lib/sdk"

// ═══════════════════════════════════════════
// FULL-WIDTH OVERRIDE
// ═══════════════════════════════════════════
const BG = "#F7F8FA"

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
// DESIGN TOKENS
// ═══════════════════════════════════════════
const T = {
  bg: "#F7F8FA",
  card: "#FFFFFF",
  border: "#E5E7EB",
  borderLight: "#F3F4F6",
  text: "#111827",
  textSec: "#6B7280",
  textMuted: "#9CA3AF",
  textFaint: "#D1D5DB",
  green: "#059669",
  greenBg: "#ECFDF5",
  greenBorder: "#A7F3D0",
  blue: "#2563EB",
  blueBg: "#EFF6FF",
  blueBorder: "#BFDBFE",
  purple: "#7C3AED",
  purpleBg: "#F5F3FF",
  orange: "#D97706",
  orangeBg: "#FFFBEB",
  red: "#DC2626",
  redBg: "#FEF2F2",
  accent: "#4F46E5",
  accentBg: "#EEF2FF",
  shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04)",
  radius: "12px",
  radiusSm: "8px",
  radiusLg: "16px",
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════
const fmt = {
  date: (d: string) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "",
  time: (d: string) => d ? new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "",
  dateTime: (d: string) => d ? `${fmt.time(d)}, ${fmt.date(d)}` : "",
  money: (n: number, c: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: c || "EUR" }).format(n || 0),
  strip: (html: string) => html?.replace(/<[^>]*>/g, "").trim() || "",
}

// ═══════════════════════════════════════════
// SECTION CARD wrapper
// ═══════════════════════════════════════════
function SidebarCard({ title, icon, children, defaultOpen = true }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{
      backgroundColor: T.card, border: `1px solid ${T.border}`,
      borderRadius: T.radius, overflow: "hidden", boxShadow: T.shadow,
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", border: "none", backgroundColor: "transparent", cursor: "pointer",
          borderBottom: open ? `1px solid ${T.borderLight}` : "none",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
          {icon} {title}
        </span>
        <span style={{ fontSize: "11px", color: T.textMuted, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
      </button>
      {open && <div style={{ padding: "16px 18px" }}>{children}</div>}
    </div>
  )
}

// ═══════════════════════════════════════════
// INFO ROW — label: value pair
// ═══════════════════════════════════════════
function InfoRow({ label, value, mono, color }: { label: string; value: React.ReactNode; mono?: boolean; color?: string }) {
  if (!value) return null
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "5px 0", gap: "12px" }}>
      <span style={{ fontSize: "12px", color: T.textMuted, flexShrink: 0, minWidth: "80px" }}>{label}</span>
      <span style={{
        fontSize: "12px", color: color || T.text, fontWeight: 500, textAlign: "right",
        fontFamily: mono ? "SF Mono, Menlo, monospace" : "inherit", wordBreak: "break-all",
      }}>{value}</span>
    </div>
  )
}

// ═══════════════════════════════════════════
// TIMELINE DOT — for order events
// ═══════════════════════════════════════════
function TimelineEvent({ label, date, color, isLast }: { label: string; date?: string; color: string; isLast?: boolean }) {
  return (
    <div style={{ display: "flex", gap: "10px", position: "relative" }}>
      {/* Dot + line */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{
          width: "10px", height: "10px", borderRadius: "50%",
          backgroundColor: date ? color : T.textFaint,
          border: `2px solid ${date ? color : T.textFaint}`,
          boxShadow: date ? `0 0 0 3px ${color}22` : "none",
        }} />
        {!isLast && (
          <div style={{ width: "2px", height: "20px", backgroundColor: T.borderLight }} />
        )}
      </div>
      {/* Text */}
      <div style={{ paddingBottom: isLast ? 0 : "8px", marginTop: "-2px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: date ? T.text : T.textMuted }}>{label}</div>
        {date && <div style={{ fontSize: "11px", color: T.textMuted }}>{fmt.dateTime(date)}</div>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// CUSTOMER SIDEBAR — rich context panel
// ═══════════════════════════════════════════
function CustomerSidebar({ ticket, allOrders }: { ticket: any; allOrders: any[] }) {
  const fromEmail = ticket.from_email
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
  const name = customer ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim() : (ticket.from_name || "")
  const initial = (name?.[0] || fromEmail?.[0] || "?").toUpperCase()

  // Get shipping address from most recent order
  const latestAddr = allOrders[0]?.shipping_address

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

      {/* ── CUSTOMER PROFILE ── */}
      <SidebarCard title="Customer" icon="👤">
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
          <div style={{
            width: "42px", height: "42px", borderRadius: "50%",
            background: `linear-gradient(135deg, ${T.accent}, ${T.purple})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px", fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>
            {initial}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name || fromEmail}
            </div>
            <div style={{ fontSize: "12px", color: T.blue, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {fromEmail}
            </div>
          </div>
        </div>

        {customer?.phone && <InfoRow label="Phone" value={customer.phone} />}
        {customer?.created_at && <InfoRow label="Since" value={fmt.date(customer.created_at)} />}

        {/* Address from customer or latest order */}
        {(customer?.addresses?.[0] || latestAddr) && (() => {
          const addr = customer?.addresses?.[0] || latestAddr
          const lines = [
            addr.address_1,
            addr.address_2,
            [addr.city, addr.postal_code].filter(Boolean).join(" "),
            addr.province,
            addr.country_code?.toUpperCase(),
          ].filter(Boolean)
          return (
            <div style={{ marginTop: "8px", padding: "10px 12px", backgroundColor: T.bg, borderRadius: T.radiusSm }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: T.textMuted, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.3px" }}>Address</div>
              {lines.map((line, i) => (
                <div key={i} style={{ fontSize: "12px", color: T.text, lineHeight: 1.5 }}>{line}</div>
              ))}
            </div>
          )
        })()}

        {/* Quick stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "12px" }}>
          <div style={{ textAlign: "center", padding: "10px 8px", borderRadius: T.radiusSm, backgroundColor: T.purpleBg }}>
            <div style={{ fontSize: "18px", fontWeight: 800, color: T.purple }}>{allOrders.length}</div>
            <div style={{ fontSize: "10px", fontWeight: 600, color: T.textMuted, textTransform: "uppercase" }}>orders</div>
          </div>
          <div style={{ textAlign: "center", padding: "10px 8px", borderRadius: T.radiusSm, backgroundColor: T.greenBg }}>
            <div style={{ fontSize: "18px", fontWeight: 800, color: T.green }}>{fmt.money(totalSpent, mainCurrency)}</div>
            <div style={{ fontSize: "10px", fontWeight: 600, color: T.textMuted, textTransform: "uppercase" }}>spent</div>
          </div>
        </div>
      </SidebarCard>

      {/* ── ORDERS ── */}
      {allOrders.map((order: any) => (
        <SidebarCard
          key={order.order_id}
          title={`Order #${order.display_id}`}
          icon="📦"
          defaultOpen={allOrders.length <= 2}
        >
          {/* Order header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <Link to={`/orders/${order.order_id}`} style={{ fontSize: "13px", fontWeight: 700, color: T.blue, textDecoration: "none" }}>
              #{order.display_id} →
            </Link>
            <span style={{ fontSize: "14px", fontWeight: 700, color: T.text }}>
              {fmt.money(order.total, order.currency_code)}
            </span>
          </div>

          {/* Status badges */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
            <span style={{
              fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "6px",
              backgroundColor: order.status === "completed" ? T.greenBg : order.status === "canceled" ? T.redBg : T.orangeBg,
              color: order.status === "completed" ? T.green : order.status === "canceled" ? T.red : T.orange,
            }}>
              {order.status}
            </span>
            <span style={{
              fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "6px",
              backgroundColor: order.payment_status === "paid" ? T.greenBg : order.payment_status === "canceled" ? T.redBg : T.orangeBg,
              color: order.payment_status === "paid" ? T.green : order.payment_status === "canceled" ? T.red : T.orange,
            }}>
              {order.payment_status === "paid" ? "Paid" : order.payment_status === "canceled" ? "Payment canceled" : "Awaiting payment"}
            </span>
          </div>

          {/* Items */}
          <div style={{ marginBottom: "12px" }}>
            {order.items?.map((item: any, i: number) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 0", borderBottom: i < order.items.length - 1 ? `1px solid ${T.borderLight}` : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  {item.thumbnail && (
                    <img src={item.thumbnail} alt="" style={{ width: "28px", height: "28px", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: "12px", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.title}
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: T.textMuted, flexShrink: 0, marginLeft: "8px" }}>
                  x{item.quantity}
                </span>
              </div>
            ))}
          </div>

          {/* Delivery address */}
          {order.shipping_address && (
            <div style={{ padding: "10px 12px", backgroundColor: T.bg, borderRadius: T.radiusSm, marginBottom: "12px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: T.textMuted, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.3px" }}>Ship to</div>
              <div style={{ fontSize: "12px", color: T.text, lineHeight: 1.5 }}>
                {[order.shipping_address.first_name, order.shipping_address.last_name].filter(Boolean).join(" ")}
              </div>
              <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.5 }}>
                {[
                  order.shipping_address.address_1,
                  order.shipping_address.address_2,
                  [order.shipping_address.city, order.shipping_address.postal_code].filter(Boolean).join(" "),
                  order.shipping_address.country_code?.toUpperCase(),
                ].filter(Boolean).join(", ")}
              </div>
              {order.shipping_address.phone && (
                <div style={{ fontSize: "11px", color: T.textMuted, marginTop: "2px" }}>Tel: {order.shipping_address.phone}</div>
              )}
            </div>
          )}

          {/* Order timeline */}
          <div style={{ padding: "10px 12px", backgroundColor: T.bg, borderRadius: T.radiusSm, marginBottom: "8px" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: T.textMuted, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.3px" }}>Timeline</div>
            <TimelineEvent label="Order placed" date={order.created_at} color={T.green} />
            <TimelineEvent
              label="Payment"
              date={order.payments?.[0]?.captured_at || (order.payment_status === "paid" ? order.created_at : undefined)}
              color={T.blue}
            />
            <TimelineEvent
              label="Shipped"
              date={order.fulfillments?.[0]?.shipped_at || order.fulfillments?.[0]?.created_at}
              color={T.purple}
            />
            <TimelineEvent
              label="Delivered"
              date={order.delivery_status === "delivered" ? (order.fulfillments?.[0]?.delivered_at || undefined) : undefined}
              color={T.green}
              isLast
            />
          </div>

          {/* Tracking */}
          {(order.tracking_number || order.fulfillments?.[0]?.labels?.[0]?.tracking_number) && (
            <div style={{ padding: "10px 12px", backgroundColor: T.blueBg, borderRadius: T.radiusSm, border: `1px solid ${T.blueBorder}` }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: T.blue, marginBottom: "4px" }}>Tracking</div>
              <div style={{ fontSize: "12px", color: T.text, fontFamily: "SF Mono, Menlo, monospace" }}>
                {order.tracking_number || order.fulfillments?.[0]?.labels?.[0]?.tracking_number}
              </div>
              {order.carrier && (
                <div style={{ fontSize: "11px", color: T.textSec, marginTop: "2px" }}>via {order.carrier}</div>
              )}
              {(order.tracking_link || order.fulfillments?.[0]?.labels?.[0]?.tracking_url) && (
                <a
                  href={order.tracking_link || order.fulfillments?.[0]?.labels?.[0]?.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "11px", color: T.blue, textDecoration: "none", display: "inline-block", marginTop: "4px", fontWeight: 600 }}
                >
                  Track shipment →
                </a>
              )}
            </div>
          )}

          {/* Delivery status from Dextrum */}
          {order.delivery_status && (
            <div style={{ marginTop: "8px" }}>
              <InfoRow label="Delivery" value={
                <span style={{
                  fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px",
                  backgroundColor: order.delivery_status === "delivered" ? T.greenBg : T.orangeBg,
                  color: order.delivery_status === "delivered" ? T.green : T.orange,
                }}>
                  {order.delivery_status}
                </span>
              } />
            </div>
          )}

          <div style={{ fontSize: "11px", color: T.textMuted, marginTop: "8px", textAlign: "right" }}>
            Ordered {fmt.date(order.created_at)}
          </div>
        </SidebarCard>
      ))}

      {allOrders.length === 0 && (
        <SidebarCard title="Orders" icon="📦">
          <div style={{ textAlign: "center", padding: "12px 0", color: T.textMuted, fontSize: "13px" }}>
            No orders found for this email
          </div>
        </SidebarCard>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════════
function MessageBubble({ message }: { message: any }) {
  const isInbound = message.direction === "inbound"
  const body = message.body_html || message.body_text || ""
  const hasContent = fmt.strip(body).length > 0

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isInbound ? "flex-start" : "flex-end" }}>
      {/* Sender */}
      <div style={{
        fontSize: "11px", fontWeight: 600, marginBottom: "6px",
        color: isInbound ? T.textSec : T.green,
        paddingLeft: isInbound ? "16px" : 0,
        paddingRight: isInbound ? 0 : "16px",
      }}>
        {isInbound ? "👤 " : "💬 "}
        {message.from_name || message.from_email || (isInbound ? "Customer" : "Support")}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: "85%",
        padding: "16px 20px",
        borderRadius: isInbound ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
        backgroundColor: isInbound ? T.card : T.greenBg,
        border: `1px solid ${isInbound ? T.border : T.greenBorder}`,
        boxShadow: T.shadow,
      }}>
        {hasContent ? (
          <div
            style={{ fontSize: "14px", lineHeight: 1.75, color: T.text, wordBreak: "break-word" }}
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : (
          <div style={{ fontSize: "13px", color: T.textMuted, fontStyle: "italic" }}>(no email body)</div>
        )}
      </div>

      {/* Time */}
      <div style={{
        fontSize: "11px", color: T.textMuted, marginTop: "6px",
        paddingLeft: isInbound ? "16px" : 0,
        paddingRight: isInbound ? 0 : "16px",
      }}>
        {fmt.dateTime(message.created_at)}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// REPLY COMPOSER
// ═══════════════════════════════════════════
function ReplyComposer({ replyText, setReplyText, onSend, isSending }: {
  replyText: string; setReplyText: (v: string) => void; onSend: () => void; isSending: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.max(100, el.scrollHeight) + "px"
  }, [replyText])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && replyText.trim()) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div style={{
      backgroundColor: T.card, border: `1px solid ${T.accent}`,
      borderRadius: T.radiusLg, padding: "20px 24px", boxShadow: T.shadowMd,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>✉️</span>
          <span style={{ fontSize: "13px", fontWeight: 700, color: T.text }}>Reply to Customer</span>
        </div>
        <span style={{ fontSize: "11px", color: T.textMuted }}>⌘+Enter to send</span>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write your reply here..."
        style={{
          width: "100%", minHeight: "100px", maxHeight: "350px",
          padding: "14px 16px", fontSize: "14px", lineHeight: 1.7, color: T.text,
          backgroundColor: T.bg, border: `1px solid ${T.borderLight}`,
          borderRadius: T.radius, resize: "none", outline: "none",
          fontFamily: "inherit", transition: "border-color 0.2s ease", boxSizing: "border-box",
        }}
        onFocus={(e) => { e.target.style.borderColor = T.accent }}
        onBlur={(e) => { e.target.style.borderColor = T.borderLight }}
      />

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
        <div style={{ fontSize: "11px", color: T.textMuted }}>
          {replyText.trim().length > 0 && `${replyText.trim().length} chars`}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {replyText.trim() && (
            <button
              onClick={() => setReplyText("")}
              disabled={isSending}
              style={{
                padding: "8px 14px", fontSize: "12px", fontWeight: 500,
                color: T.textSec, backgroundColor: "transparent",
                border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
          <button
            onClick={onSend}
            disabled={!replyText.trim() || isSending}
            style={{
              padding: "10px 22px", fontSize: "13px", fontWeight: 700, color: "#fff",
              background: replyText.trim() ? `linear-gradient(135deg, ${T.accent}, ${T.purple})` : T.borderLight,
              border: "none", borderRadius: T.radiusSm,
              cursor: replyText.trim() ? "pointer" : "not-allowed",
              boxShadow: replyText.trim() ? "0 4px 14px rgba(79,70,229,0.25)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            {isSending ? "Sending..." : "Send Reply"}
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
      <div style={{ padding: "80px", textAlign: "center" }}>
        <div style={{ fontSize: "28px", marginBottom: "12px" }}>⏳</div>
        <div style={{ color: T.textSec, fontSize: "14px" }}>Loading ticket...</div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div style={{ padding: "80px", textAlign: "center" }}>
        <div style={{ fontSize: "28px", marginBottom: "12px" }}>🔍</div>
        <div style={{ color: T.textSec, fontSize: "14px" }}>Ticket not found</div>
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
    <div ref={pageRef} style={{ width: "100%", padding: "28px 40px", background: BG, boxSizing: "border-box", minHeight: "100vh" }}>
      {/* Global CSS override */}
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

      {/* ═══ TOP BAR ═══ */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "28px", paddingBottom: "20px", borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link to="/supportbox" style={{ textDecoration: "none" }}>
            <button style={{
              padding: "8px 14px", fontSize: "13px", fontWeight: 500,
              color: T.textSec, backgroundColor: T.card,
              border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
              cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
              boxShadow: T.shadow, transition: "all 0.15s",
            }}>
              ← Back
            </button>
          </Link>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 700, color: T.text, margin: 0, lineHeight: 1.3 }}>
              {ticket.subject}
            </h1>
            <div style={{ fontSize: "13px", color: T.textSec, marginTop: "4px" }}>
              From: {ticket.from_name ? `${ticket.from_name} <${ticket.from_email}>` : ticket.from_email}
              <span style={{ color: T.textMuted, margin: "0 8px" }}>·</span>
              {fmt.dateTime(ticket.created_at)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Badge color={status.color}>{status.emoji} {status.label}</Badge>
          {ticket.status !== "solved" ? (
            <button
              onClick={() => solveMutation.mutate()}
              disabled={solveMutation.isPending}
              style={{
                padding: "8px 18px", fontSize: "13px", fontWeight: 600,
                color: "#fff", background: `linear-gradient(135deg, ${T.green}, #047857)`,
                border: "none", borderRadius: T.radiusSm, cursor: "pointer",
                boxShadow: "0 2px 8px rgba(5,150,105,0.3)", transition: "all 0.15s",
              }}
            >
              {solveMutation.isPending ? "..." : "✓ Mark Solved"}
            </button>
          ) : (
            <button
              onClick={() => reopenMutation.mutate()}
              disabled={reopenMutation.isPending}
              style={{
                padding: "8px 18px", fontSize: "13px", fontWeight: 600,
                color: T.orange, backgroundColor: T.orangeBg,
                border: `1px solid ${T.orange}`, borderRadius: T.radiusSm,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {reopenMutation.isPending ? "..." : "↩ Reopen"}
            </button>
          )}
        </div>
      </div>

      {/* ═══ MAIN LAYOUT ═══ */}
      <div style={{ display: "flex", gap: "28px", alignItems: "flex-start" }}>

        {/* LEFT: Conversation + Reply (flex 3) */}
        <div style={{ flex: 3, minWidth: 0, display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Messages */}
          <div style={{
            backgroundColor: T.card, border: `1px solid ${T.border}`,
            borderRadius: T.radiusLg, padding: "28px 32px", boxShadow: T.shadow,
          }}>
            {sortedMessages.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: T.textMuted }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>💬</div>
                <div style={{ fontSize: "14px" }}>No messages yet</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {sortedMessages.map((message: any) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Reply */}
          <ReplyComposer
            replyText={replyText}
            setReplyText={setReplyText}
            onSend={handleSendReply}
            isSending={replyMutation.isPending}
          />

          {replyMutation.isError && (
            <div style={{
              padding: "12px 16px", backgroundColor: T.redBg,
              border: "1px solid #FECACA", borderRadius: T.radius,
              fontSize: "13px", color: T.red,
            }}>
              Failed to send: {(replyMutation.error as any)?.message || "Unknown error"}
            </div>
          )}
        </div>

        {/* RIGHT: Sidebar (flex 1, sticky) */}
        <div style={{
          flex: 1, minWidth: "300px", maxWidth: "400px",
          position: "sticky", top: "20px", maxHeight: "calc(100vh - 60px)",
          overflowY: "auto", paddingRight: "4px",
        }}>
          <CustomerSidebar ticket={ticket} allOrders={allOrders} />
        </div>
      </div>
    </div>
  )
}

export default TicketDetailPage
