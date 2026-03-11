// @ts-nocheck
import { useState, useRef, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../../lib/sdk"

/* ═══════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Premium SaaS look
   ═══════════════════════════════════════════════════════════════ */
const PAGE_BG = "#F9FAFB"

const D = {
  // surfaces
  bg: PAGE_BG,
  card: "#FFFFFF",
  raised: "#FFFFFF",
  inset: "#F3F4F6",
  // borders
  border: "#E5E7EB",
  borderSubtle: "#F3F4F6",
  // text
  text: "#111827",
  textSec: "#6B7280",
  textMuted: "#9CA3AF",
  textFaint: "#D1D5DB",
  // accents
  brand: "#4F46E5",
  brandLight: "#EEF2FF",
  green: "#059669",
  greenLight: "#ECFDF5",
  greenBorder: "#D1FAE5",
  blue: "#2563EB",
  blueLight: "#EFF6FF",
  blueBorder: "#DBEAFE",
  purple: "#7C3AED",
  purpleLight: "#F5F3FF",
  orange: "#D97706",
  orangeLight: "#FFFBEB",
  red: "#DC2626",
  redLight: "#FEF2F2",
  // shadows
  xs: "0 1px 2px rgba(0,0,0,0.04)",
  sm: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  md: "0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -2px rgba(0,0,0,0.04)",
  lg: "0 10px 15px -3px rgba(0,0,0,0.06), 0 4px 6px -4px rgba(0,0,0,0.04)",
  // radii
  r8: "8px",
  r12: "12px",
  r16: "16px",
  r20: "20px",
  rFull: "9999px",
}

/* ═══════════════════════════════════════════════════════════════
   FULL WIDTH HOOK
   ═══════════════════════════════════════════════════════════════ */
function useFullWidth(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const saved: { el: HTMLElement; s: Record<string, string> }[] = []
    let n: HTMLElement | null = el.parentElement
    while (n && n !== document.documentElement) {
      saved.push({
        el: n,
        s: {
          bg: n.style.background, mw: n.style.maxWidth, w: n.style.width,
          pl: n.style.paddingLeft, pr: n.style.paddingRight, m: n.style.margin,
          overflow: n.style.overflow,
        },
      })
      n.style.setProperty("background", PAGE_BG, "important")
      n.style.setProperty("max-width", "none", "important")
      n.style.setProperty("width", "100%", "important")
      n.style.setProperty("padding-left", "0", "important")
      n.style.setProperty("padding-right", "0", "important")
      n.style.setProperty("margin", "0", "important")
      n.style.setProperty("overflow-x", "hidden", "important")
      n = n.parentElement
    }
    return () => {
      saved.forEach(({ el: x, s }) => {
        x.style.background = s.bg; x.style.maxWidth = s.mw; x.style.width = s.w
        x.style.paddingLeft = s.pl; x.style.paddingRight = s.pr; x.style.margin = s.m
        x.style.overflow = s.overflow
      })
    }
  }, [ref])
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
const f = {
  date: (d: string) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "",
  time: (d: string) => d ? new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "",
  dt: (d: string) => d ? `${f.date(d)} at ${f.time(d)}` : "",
  money: (n: number, c: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: c || "EUR", minimumFractionDigits: 2 }).format(n || 0),
  strip: (h: string) => h?.replace(/<[^>]*>/g, "").trim() || "",
}

/* ═══════════════════════════════════════════════════════════════
   PILL BADGE
   ═══════════════════════════════════════════════════════════════ */
function Pill({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: D.rFull,
      fontSize: "11px", fontWeight: 600, lineHeight: "20px", backgroundColor: bg, color,
      letterSpacing: "0.01em",
    }}>
      {children}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════
   COLLAPSIBLE SECTION
   ═══════════════════════════════════════════════════════════════ */
function Section({ label, children, open: defaultOpen = true }: { label: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: `1px solid ${D.borderSubtle}` }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 0", border: "none", background: "none", cursor: "pointer",
        }}
      >
        <span style={{ fontSize: "11px", fontWeight: 700, color: D.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", color: D.textFaint }}>
          <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open && <div style={{ paddingBottom: "16px" }}>{children}</div>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   DETAIL ROW — key/value
   ═══════════════════════════════════════════════════════════════ */
function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  if (!v) return null
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "4px 0", gap: "16px" }}>
      <span style={{ fontSize: "12px", color: D.textMuted, whiteSpace: "nowrap" }}>{k}</span>
      <span style={{ fontSize: "12px", color: D.text, fontWeight: 500, textAlign: "right", fontFamily: mono ? "'SF Mono',Menlo,monospace" : "inherit", wordBreak: "break-all" }}>{v}</span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ORDER TIMELINE
   ═══════════════════════════════════════════════════════════════ */
function Timeline({ events }: { events: { label: string; date?: string; color: string }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {events.map((ev, i) => (
        <div key={i} style={{ display: "flex", gap: "10px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "14px", flexShrink: 0 }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%", marginTop: "4px",
              backgroundColor: ev.date ? ev.color : D.borderSubtle,
              boxShadow: ev.date ? `0 0 0 3px ${ev.color}18` : "none",
            }} />
            {i < events.length - 1 && <div style={{ width: "1.5px", flex: 1, minHeight: "16px", backgroundColor: D.borderSubtle }} />}
          </div>
          <div style={{ paddingBottom: i < events.length - 1 ? "10px" : 0, minWidth: 0 }}>
            <div style={{ fontSize: "12px", fontWeight: ev.date ? 600 : 400, color: ev.date ? D.text : D.textFaint, lineHeight: "16px" }}>{ev.label}</div>
            {ev.date && <div style={{ fontSize: "11px", color: D.textMuted, marginTop: "1px" }}>{f.dt(ev.date)}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   CUSTOMER SIDEBAR
   ═══════════════════════════════════════════════════════════════ */
function CustomerSidebar({ ticket, allOrders }: { ticket: any; allOrders: any[] }) {
  const email = ticket.from_email
  const { data: customer } = useQuery({
    queryKey: ["customer-by-email", email],
    queryFn: async () => {
      try { const r = await sdk.client.fetch(`/admin/customers?q=${email}`, { method: "GET" }) as any; return r.customers?.[0] || null } catch { return null }
    },
  })

  const spent = allOrders.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0)
  const curr = allOrders[0]?.currency_code || "EUR"
  const name = customer ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim() : (ticket.from_name || "")
  const initial = (name?.[0] || email?.[0] || "?").toUpperCase()
  const addr = customer?.addresses?.[0] || allOrders[0]?.shipping_address

  return (
    <div style={{
      backgroundColor: D.card, borderRadius: D.r16, border: `1px solid ${D.border}`,
      boxShadow: D.sm, overflow: "hidden",
    }}>
      {/* Profile header */}
      <div style={{ padding: "24px 24px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "50%",
            background: `linear-gradient(135deg, ${D.brand}, ${D.purple})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px", fontWeight: 700, color: "#fff", flexShrink: 0,
            boxShadow: `0 2px 8px ${D.brand}33`,
          }}>
            {initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: D.text, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name || email}
            </div>
            <div style={{ fontSize: "12px", color: D.textSec, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {email}
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <div style={{ textAlign: "center", padding: "12px 8px", borderRadius: D.r12, backgroundColor: D.brandLight }}>
            <div style={{ fontSize: "20px", fontWeight: 800, color: D.brand, lineHeight: 1 }}>{allOrders.length}</div>
            <div style={{ fontSize: "10px", fontWeight: 600, color: D.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "4px" }}>orders</div>
          </div>
          <div style={{ textAlign: "center", padding: "12px 8px", borderRadius: D.r12, backgroundColor: D.greenLight }}>
            <div style={{ fontSize: "20px", fontWeight: 800, color: D.green, lineHeight: 1 }}>{f.money(spent, curr)}</div>
            <div style={{ fontSize: "10px", fontWeight: 600, color: D.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "4px" }}>total spent</div>
          </div>
        </div>
      </div>

      {/* Detail sections */}
      <div style={{ padding: "0 24px 8px" }}>
        {/* Contact */}
        <Section label="Contact details">
          <Row k="Email" v={email} />
          {customer?.phone && <Row k="Phone" v={customer.phone} />}
          {customer?.created_at && <Row k="Customer since" v={f.date(customer.created_at)} />}
        </Section>

        {/* Address */}
        {addr && (
          <Section label="Shipping address">
            <div style={{ fontSize: "13px", color: D.text, lineHeight: 1.6 }}>
              {[addr.first_name, addr.last_name].filter(Boolean).join(" ") && (
                <div style={{ fontWeight: 600 }}>{[addr.first_name, addr.last_name].filter(Boolean).join(" ")}</div>
              )}
              {addr.company && <div>{addr.company}</div>}
              {addr.address_1 && <div>{addr.address_1}</div>}
              {addr.address_2 && <div>{addr.address_2}</div>}
              <div>{[addr.postal_code, addr.city].filter(Boolean).join(" ")}</div>
              {addr.province && <div>{addr.province}</div>}
              {addr.country_code && <div>{addr.country_code.toUpperCase()}</div>}
              {addr.phone && <div style={{ color: D.textSec, marginTop: "4px", fontSize: "12px" }}>Tel: {addr.phone}</div>}
            </div>
          </Section>
        )}

        {/* Orders */}
        {allOrders.map((order: any, idx: number) => (
          <Section key={order.order_id} label={`Order #${order.display_id}`} open={idx === 0}>
            {/* Header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <Link to={`/orders/${order.order_id}`} style={{ fontSize: "13px", fontWeight: 600, color: D.blue, textDecoration: "none" }}>
                View order →
              </Link>
              <span style={{ fontSize: "14px", fontWeight: 700, color: D.text }}>{f.money(order.total, order.currency_code)}</span>
            </div>

            {/* Badges */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
              <Pill
                bg={order.status === "completed" ? D.greenLight : order.status === "canceled" ? D.redLight : D.orangeLight}
                color={order.status === "completed" ? D.green : order.status === "canceled" ? D.red : D.orange}
              >
                {order.status}
              </Pill>
              <Pill
                bg={order.payment_status === "paid" ? D.greenLight : D.orangeLight}
                color={order.payment_status === "paid" ? D.green : D.orange}
              >
                {order.payment_status === "paid" ? "Paid" : "Awaiting"}
              </Pill>
              {order.delivery_status && (
                <Pill
                  bg={order.delivery_status === "delivered" ? D.greenLight : D.blueLight}
                  color={order.delivery_status === "delivered" ? D.green : D.blue}
                >
                  {order.delivery_status}
                </Pill>
              )}
            </div>

            {/* Items */}
            <div style={{ marginBottom: "14px" }}>
              {order.items?.map((item: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 0" }}>
                  {item.thumbnail && (
                    <img src={item.thumbnail} alt="" style={{ width: "32px", height: "32px", borderRadius: D.r8, objectFit: "cover", border: `1px solid ${D.borderSubtle}` }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "12px", color: D.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                    <div style={{ fontSize: "11px", color: D.textMuted }}>Qty: {item.quantity}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Ship to */}
            {order.shipping_address && (
              <div style={{ padding: "10px 12px", backgroundColor: D.inset, borderRadius: D.r8, marginBottom: "14px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: D.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Ship to</div>
                <div style={{ fontSize: "12px", color: D.text, lineHeight: 1.5 }}>
                  {[order.shipping_address.first_name, order.shipping_address.last_name].filter(Boolean).join(" ")}
                  {order.shipping_address.address_1 && <>, {order.shipping_address.address_1}</>}
                  {order.shipping_address.city && <>, {order.shipping_address.postal_code} {order.shipping_address.city}</>}
                  {order.shipping_address.country_code && <>, {order.shipping_address.country_code.toUpperCase()}</>}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div style={{ marginBottom: "14px" }}>
              <Timeline events={[
                { label: "Ordered", date: order.created_at, color: D.green },
                { label: "Paid", date: order.payments?.[0]?.captured_at || (order.payment_status === "paid" ? order.created_at : undefined), color: D.blue },
                { label: "Shipped", date: order.fulfillments?.[0]?.shipped_at || order.fulfillments?.[0]?.created_at, color: D.purple },
                { label: "Delivered", date: order.delivery_status === "delivered" ? (order.fulfillments?.[0]?.delivered_at || order.created_at) : undefined, color: D.green },
              ]} />
            </div>

            {/* Tracking */}
            {(order.tracking_number || order.fulfillments?.[0]?.labels?.[0]?.tracking_number) && (
              <div style={{ padding: "10px 12px", backgroundColor: D.blueLight, borderRadius: D.r8, border: `1px solid ${D.blueBorder}` }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: D.blue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Tracking</div>
                <div style={{ fontSize: "12px", color: D.text, fontFamily: "'SF Mono',Menlo,monospace", fontWeight: 500 }}>
                  {order.tracking_number || order.fulfillments?.[0]?.labels?.[0]?.tracking_number}
                </div>
                {order.carrier && <div style={{ fontSize: "11px", color: D.textSec, marginTop: "2px" }}>via {order.carrier}</div>}
                {(order.tracking_link || order.fulfillments?.[0]?.labels?.[0]?.tracking_url) && (
                  <a href={order.tracking_link || order.fulfillments?.[0]?.labels?.[0]?.tracking_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: "11px", color: D.blue, textDecoration: "none", fontWeight: 600, display: "inline-block", marginTop: "4px" }}>
                    Track shipment →
                  </a>
                )}
              </div>
            )}
          </Section>
        ))}

        {allOrders.length === 0 && (
          <Section label="Orders">
            <div style={{ fontSize: "13px", color: D.textMuted, textAlign: "center", padding: "8px 0" }}>
              No orders found
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MESSAGE BUBBLE
   ═══════════════════════════════════════════════════════════════ */
function MessageBubble({ msg }: { msg: any }) {
  const inb = msg.direction === "inbound"
  const body = msg.body_html || msg.body_text || ""
  const has = f.strip(body).length > 0

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: inb ? "flex-start" : "flex-end" }}>
      {/* Sender */}
      <div style={{
        fontSize: "11px", fontWeight: 600, color: inb ? D.textSec : D.green,
        marginBottom: "6px", paddingLeft: inb ? "2px" : 0, paddingRight: inb ? 0 : "2px",
      }}>
        {msg.from_name || msg.from_email || (inb ? "Customer" : "You")}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: "88%",
        padding: "14px 18px",
        borderRadius: inb ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
        backgroundColor: inb ? D.card : D.greenLight,
        border: `1px solid ${inb ? D.border : D.greenBorder}`,
        boxShadow: D.xs,
      }}>
        {has ? (
          <div style={{ fontSize: "14px", lineHeight: 1.7, color: D.text, wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: body }} />
        ) : (
          <div style={{ fontSize: "13px", color: D.textMuted, fontStyle: "italic" }}>(empty)</div>
        )}
      </div>

      {/* Timestamp */}
      <div style={{
        fontSize: "11px", color: D.textMuted, marginTop: "6px",
        paddingLeft: inb ? "2px" : 0, paddingRight: inb ? 0 : "2px",
      }}>
        {f.dt(msg.created_at)}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   REPLY COMPOSER
   ═══════════════════════════════════════════════════════════════ */
function Composer({ text, setText, onSend, sending }: {
  text: string; setText: (v: string) => void; onSend: () => void; sending: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.max(80, el.scrollHeight) + "px"
  }, [text])

  return (
    <div style={{
      backgroundColor: D.card, borderRadius: D.r16,
      border: `1px solid ${D.border}`, boxShadow: D.sm, overflow: "hidden",
    }}>
      {/* Input area */}
      <div style={{ padding: "20px 24px 12px" }}>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && text.trim()) { e.preventDefault(); onSend() } }}
          placeholder="Write your reply..."
          style={{
            width: "100%", minHeight: "80px", maxHeight: "300px",
            padding: 0, fontSize: "14px", lineHeight: 1.7, color: D.text,
            backgroundColor: "transparent", border: "none", resize: "none", outline: "none",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Action bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 24px", borderTop: `1px solid ${D.borderSubtle}`,
        backgroundColor: D.inset,
      }}>
        <span style={{ fontSize: "11px", color: D.textMuted }}>
          {text.trim() ? `${text.trim().length} chars · ⌘+Enter` : "⌘+Enter to send"}
        </span>
        <button
          onClick={onSend}
          disabled={!text.trim() || sending}
          style={{
            padding: "8px 20px", fontSize: "13px", fontWeight: 600, color: "#fff",
            background: text.trim() ? D.brand : D.textFaint,
            border: "none", borderRadius: D.r8,
            cursor: text.trim() ? "pointer" : "not-allowed",
            boxShadow: text.trim() ? `0 1px 3px ${D.brand}44` : "none",
            transition: "all 0.15s ease",
          }}
        >
          {sending ? "Sending..." : "Send reply"}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
const TicketDetailPage = () => {
  const pageRef = useRef<HTMLDivElement>(null)
  useFullWidth(pageRef)

  const { id: ticketId } = useParams()
  const qc = useQueryClient()
  const [reply, setReply] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["supportbox-ticket-detail", ticketId],
    queryFn: async () => await sdk.client.fetch(`/admin/supportbox/tickets/${ticketId}`, { method: "GET" }) as any,
    enabled: !!ticketId,
  })

  const ticket = data?.ticket
  const orders = data?.allOrders || []

  const replyMut = useMutation({
    mutationFn: async (html: string) => sdk.client.fetch(`/admin/supportbox/tickets/${ticketId}/reply`, { method: "POST", body: { body_html: html, body_text: reply } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["supportbox-ticket-detail", ticketId] }); setReply("") },
  })

  const solveMut = useMutation({
    mutationFn: async () => sdk.client.fetch(`/admin/supportbox/tickets/${ticketId}/solve`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["supportbox-ticket-detail", ticketId] }); qc.invalidateQueries({ queryKey: ["supportbox-tickets"] }) },
  })

  const reopenMut = useMutation({
    mutationFn: async () => sdk.client.fetch(`/admin/supportbox/tickets/${ticketId}/reopen`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["supportbox-ticket-detail", ticketId] }); qc.invalidateQueries({ queryKey: ["supportbox-tickets"] }) },
  })

  const msgs = [...(ticket?.messages || [])].sort((a: any, b: any) => +new Date(a.created_at) - +new Date(b.created_at))

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs.length])

  const send = () => {
    if (!reply.trim()) return
    replyMut.mutateAsync(reply.split("\n").map(l => `<p>${l}</p>`).join(""))
  }

  // Loading / 404
  if (isLoading) return <div style={{ padding: "100px", textAlign: "center", color: D.textSec }}>Loading...</div>
  if (!ticket) return <div style={{ padding: "100px", textAlign: "center", color: D.textSec }}>Ticket not found</div>

  const st = ticket.status === "solved" ? { label: "Solved", bg: D.greenLight, color: D.green }
    : ticket.status === "old" ? { label: "Old", bg: D.orangeLight, color: D.orange }
    : { label: "New", bg: D.greenLight, color: D.green }

  return (
    <div ref={pageRef} style={{ width: "100%", padding: "24px 32px", background: PAGE_BG, boxSizing: "border-box", minHeight: "100vh", overflowX: "hidden" }}>

      {/* ══════ HEADER ══════ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "20px" }}>
          <Link to="/supportbox" style={{ textDecoration: "none" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: D.r8, backgroundColor: D.card,
              border: `1px solid ${D.border}`, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", boxShadow: D.xs, marginTop: "2px",
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke={D.textSec} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </Link>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: D.text, margin: 0, lineHeight: 1.25, letterSpacing: "-0.01em" }}>
              {ticket.subject}
            </h1>
            <div style={{ fontSize: "13px", color: D.textSec, marginTop: "6px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span>{ticket.from_name ? `${ticket.from_name}` : ticket.from_email}</span>
              <span style={{ color: D.textFaint }}>·</span>
              <span>{f.dt(ticket.created_at)}</span>
              <span style={{ color: D.textFaint }}>·</span>
              <Pill bg={st.bg} color={st.color}>{st.label}</Pill>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
          {ticket.status !== "solved" ? (
            <button onClick={() => solveMut.mutate()} disabled={solveMut.isPending}
              style={{
                padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff",
                backgroundColor: D.green, border: "none", borderRadius: D.r8,
                cursor: "pointer", boxShadow: D.xs, transition: "all 0.15s",
              }}>
              {solveMut.isPending ? "..." : "Mark solved"}
            </button>
          ) : (
            <button onClick={() => reopenMut.mutate()} disabled={reopenMut.isPending}
              style={{
                padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: D.orange,
                backgroundColor: D.orangeLight, border: `1px solid ${D.orange}40`,
                borderRadius: D.r8, cursor: "pointer", transition: "all 0.15s",
              }}>
              {reopenMut.isPending ? "..." : "Reopen"}
            </button>
          )}
        </div>
      </div>

      {/* ══════ LAYOUT: Conversation | Sidebar ══════ */}
      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>

        {/* Conversation (flex 7 = ~70%) */}
        <div style={{ flex: 7, minWidth: 0, display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Messages card */}
          <div style={{
            backgroundColor: D.card, borderRadius: D.r16,
            border: `1px solid ${D.border}`, boxShadow: D.sm,
            padding: "24px 28px",
          }}>
            {msgs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: D.textMuted, fontSize: "14px" }}>
                No messages yet
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                {msgs.map((m: any) => <MessageBubble key={m.id} msg={m} />)}
                <div ref={endRef} />
              </div>
            )}
          </div>

          {/* Composer */}
          <Composer text={reply} setText={setReply} onSend={send} sending={replyMut.isPending} />

          {replyMut.isError && (
            <div style={{ padding: "12px 16px", backgroundColor: D.redLight, border: `1px solid ${D.red}30`, borderRadius: D.r12, fontSize: "13px", color: D.red }}>
              Failed to send: {(replyMut.error as any)?.message || "Unknown error"}
            </div>
          )}
        </div>

        {/* Sidebar (flex 3 = ~30%, responsive min) */}
        <div style={{
          flex: 3, minWidth: "260px", maxWidth: "400px",
          position: "sticky", top: "24px",
          maxHeight: "calc(100vh - 80px)", overflowY: "auto",
        }}>
          <CustomerSidebar ticket={ticket} allOrders={orders} />
        </div>
      </div>
    </div>
  )
}

export default TicketDetailPage
