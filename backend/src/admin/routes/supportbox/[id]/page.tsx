// @ts-nocheck
import { useState, useRef, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
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
      const parent = n.parentElement
      let isLayoutBoundary = false
      if (parent && parent !== document.documentElement) {
        const parentDisplay = getComputedStyle(parent).display
        if ((parentDisplay === "flex" || parentDisplay === "grid") && parent.children.length > 1) {
          isLayoutBoundary = true
        }
      }

      saved.push({
        el: n,
        s: {
          bg: n.style.background, mw: n.style.maxWidth, w: n.style.width,
          pl: n.style.paddingLeft, pr: n.style.paddingRight, m: n.style.margin,
          overflow: n.style.overflow, flex: n.style.flex, minWidth: n.style.minWidth,
        },
      })

      n.style.setProperty("background", PAGE_BG, "important")
      n.style.setProperty("max-width", "none", "important")
      n.style.setProperty("width", "100%", "important")
      n.style.setProperty("padding-left", "0", "important")
      n.style.setProperty("padding-right", "0", "important")
      n.style.setProperty("margin", "0", "important")
      n.style.setProperty("overflow-x", "hidden", "important")
      n.style.setProperty("overflow-y", "visible", "important")
      n.style.setProperty("min-width", "0", "important")

      if (isLayoutBoundary) {
        // Expand content column to fill remaining space, keep sidebar visible
        n.style.setProperty("flex", "1 1 0%", "important")
        break
      }

      n = n.parentElement
    }
    return () => {
      saved.forEach(({ el: x, s }) => {
        x.style.background = s.bg; x.style.maxWidth = s.mw; x.style.width = s.w
        x.style.paddingLeft = s.pl; x.style.paddingRight = s.pr; x.style.margin = s.m
        x.style.overflow = s.overflow; x.style.flex = s.flex; x.style.minWidth = s.minWidth
      })
    }
  }, [ref])
}

/* ═══════════════════════════════════════════════════════════════
   AI LABEL HELPERS
   ═══════════════════════════════════════════════════════════════ */
function getCatColor(category: string): { color: string; bg: string } {
  const map: Record<string, { color: string; bg: string }> = {
    payment_issue: { color: "#DC2626", bg: "#FEF2F2" },
    shipping: { color: "#2563EB", bg: "#EFF6FF" },
    order_issue: { color: "#D97706", bg: "#FFFBEB" },
    product_feedback: { color: "#059669", bg: "#ECFDF5" },
    returns: { color: "#7C3AED", bg: "#F5F3FF" },
    account: { color: "#6B7280", bg: "#F3F4F6" },
    spam: { color: "#EF4444", bg: "#FEF2F2" },
    other: { color: "#6B7280", bg: "#F3F4F6" },
  }
  return map[category] || map.other
}

function formatCat(category: string): string {
  const map: Record<string, string> = {
    payment_issue: "Payment",
    shipping: "Shipping",
    order_issue: "Order issue",
    product_feedback: "Feedback",
    returns: "Returns",
    account: "Account",
    spam: "Spam",
    other: "Other",
  }
  return map[category] || category
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
  const { data: customer, isLoading: custLoading } = useQuery({
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

  // Determine if this is an unknown customer — no customer record AND no orders
  const isUnknown = !custLoading && !customer && allOrders.length === 0

  return (
    <div style={{
      backgroundColor: D.card, borderRadius: D.r16, border: `1px solid ${D.border}`,
      boxShadow: D.sm, overflow: "hidden",
    }}>
      {/* Profile header */}
      <div style={{ padding: "24px 24px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: isUnknown ? "0" : "20px" }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "50%",
            background: isUnknown
              ? `linear-gradient(135deg, ${D.textMuted}, ${D.textFaint})`
              : `linear-gradient(135deg, ${D.brand}, ${D.purple})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px", fontWeight: 700, color: "#fff", flexShrink: 0,
            boxShadow: isUnknown ? "none" : `0 2px 8px ${D.brand}33`,
          }}>
            {isUnknown ? "?" : initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: D.text, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name || email || "Unknown"}
            </div>
            <div style={{ fontSize: "12px", color: D.textSec, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {email}
            </div>
          </div>
        </div>

        {/* Unknown customer banner */}
        {isUnknown && (
          <div style={{
            marginTop: "16px", padding: "14px 16px", borderRadius: D.r12,
            backgroundColor: D.orangeLight, border: `1px solid ${D.orange}25`,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: "1px" }}>
                <path d="M9 1.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM9 5.25v3.75M9 12h.008" stroke={D.orange} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: D.orange, lineHeight: 1.3, marginBottom: "4px" }}>
                  Customer not found
                </div>
                <div style={{ fontSize: "12px", color: D.textSec, lineHeight: 1.5 }}>
                  No customer account or orders match <strong style={{ color: D.text }}>{email}</strong>. This may be a new inquiry from someone who hasn't purchased yet.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats strip — only show when we have data */}
        {!isUnknown && (
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
        )}
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
              <Link to={`/custom-orders/${order.order_id}`} style={{ fontSize: "13px", fontWeight: 600, color: D.blue, textDecoration: "none" }}>
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

        {allOrders.length === 0 && !isUnknown && (
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
   SANDBOXED EMAIL BODY — renders HTML emails in an iframe to
   prevent CSS/style leaking into the parent page
   ═══════════════════════════════════════════════════════════════ */
function SandboxedEmailBody({ html, textColor }: { html: string; textColor: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(120)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const resizeObserver = new ResizeObserver(() => {
      const doc = iframe.contentDocument
      if (doc?.body) {
        const h = doc.body.scrollHeight
        if (h > 0) setHeight(h + 16)
      }
    })

    const onLoad = () => {
      const doc = iframe.contentDocument
      if (!doc) return
      // Inject base styles into the iframe
      doc.open()
      doc.write(`<!DOCTYPE html><html><head><style>
        body { margin: 0; padding: 0; font-family: 'Inter', -apple-system, sans-serif;
               font-size: 14px; line-height: 1.7; color: ${textColor};
               word-break: break-word; overflow-wrap: break-word; }
        img { max-width: 100%; height: auto; }
        a { color: #2563EB; }
        table { max-width: 100% !important; }
        * { max-width: 100% !important; box-sizing: border-box; }
      </style></head><body>${html}</body></html>`)
      doc.close()

      // Observe body for size changes
      if (doc.body) {
        resizeObserver.observe(doc.body)
        // Initial height
        setTimeout(() => {
          const h = doc.body.scrollHeight
          if (h > 0) setHeight(h + 16)
        }, 100)
      }
    }

    iframe.addEventListener("load", onLoad)
    // Trigger if already loaded
    if (iframe.contentDocument?.readyState === "complete") onLoad()

    return () => {
      iframe.removeEventListener("load", onLoad)
      resizeObserver.disconnect()
    }
  }, [html, textColor])

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin"
      style={{
        width: "100%",
        height: `${height}px`,
        border: "none",
        overflow: "hidden",
        display: "block",
      }}
      title="Email content"
    />
  )
}

/* ═══════════════════════════════════════════════════════════════
   MESSAGE BUBBLE
   ═══════════════════════════════════════════════════════════════ */
function MessageBubble({ msg }: { msg: any }) {
  const inb = msg.direction === "inbound"
  const body = msg.body_html || msg.body_text || ""
  const has = f.strip(body).length > 0
  const [hovered, setHovered] = useState(false)
  const senderLabel = inb
    ? (msg.from_name || msg.from_email || "Customer")
    : `You (${msg.from_email || "Support"})`
  const msgAttachments = msg.metadata?.attachments || []

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", flexDirection: "column", alignItems: inb ? "flex-start" : "flex-end",
        animation: `msgSlide${inb ? "Left" : "Right"} 0.35s cubic-bezier(0.4, 0, 0.2, 1)`,
      }}
    >
      {/* Sender + Timestamp header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        marginBottom: "6px", paddingLeft: inb ? "2px" : 0, paddingRight: inb ? 0 : "2px",
      }}>
        {/* Direction indicator */}
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: "20px", height: "20px", borderRadius: "50%",
          backgroundColor: inb ? D.blueLight : D.greenLight,
          fontSize: "10px", flexShrink: 0,
        }}>
          {inb ? "📩" : "📤"}
        </span>
        <span style={{ fontSize: "12px", fontWeight: 700, color: inb ? D.blue : D.green }}>
          {senderLabel}
        </span>
        <span style={{ fontSize: "11px", color: D.textMuted }}>•</span>
        <span style={{ fontSize: "11px", color: D.textMuted }}>
          {f.dt(msg.created_at)}
        </span>
        {!inb && msg.delivery_status && (
          <DeliveryBadge status={msg.delivery_status} />
        )}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: inb ? "100%" : "88%",
        overflow: "hidden",
        padding: "14px 18px",
        borderRadius: inb ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
        backgroundColor: inb ? D.card : D.greenLight,
        border: `1px solid ${inb ? D.border : D.greenBorder}`,
        borderLeft: inb ? `3px solid ${D.blue}` : undefined,
        borderRight: !inb ? `3px solid ${D.green}` : undefined,
        boxShadow: hovered
          ? `0 4px 16px ${inb ? "rgba(0,0,0,0.08)" : D.green + "20"}`
          : D.xs,
        transform: hovered ? "scale(1.01)" : "scale(1)",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
      }}>
        {has ? (
          <SandboxedEmailBody html={body} textColor={D.text} />
        ) : (
          <div style={{ fontSize: "13px", color: D.textMuted, fontStyle: "italic" }}>(empty)</div>
        )}

        {/* Attachments */}
        {msgAttachments.length > 0 && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: "6px",
            marginTop: "10px", paddingTop: "10px",
            borderTop: `1px solid ${inb ? D.borderSubtle : D.greenBorder}`,
          }}>
            {msgAttachments.map((att: any, idx: number) => (
              <AttachmentChip
                key={idx}
                file={{ name: att.filename, size: att.size || 0, type: att.content_type || "" }}
                content={att.content}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   DELIVERY STATUS BADGE
   ═══════════════════════════════════════════════════════════════ */
function DeliveryBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    sent:              { label: "Sent",      color: D.blue,   bg: D.blueLight,   icon: "↗" },
    delivered:         { label: "Delivered",  color: D.green,  bg: D.greenLight,  icon: "✓" },
    opened:            { label: "Opened",    color: "#7C3AED", bg: D.purpleLight, icon: "👁" },
    clicked:           { label: "Clicked",   color: "#7C3AED", bg: D.purpleLight, icon: "🔗" },
    delivery_delayed:  { label: "Delayed",   color: D.orange, bg: D.orangeLight, icon: "⏳" },
    bounced:           { label: "Bounced",   color: D.red,    bg: D.redLight,    icon: "✕" },
    complained:        { label: "Spam",      color: D.red,    bg: D.redLight,    icon: "⚠" },
  }
  const c = cfg[status] || { label: status, color: D.textMuted, bg: D.inset, icon: "·" }

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "3px",
      padding: "1px 8px", borderRadius: "9999px",
      fontSize: "10px", fontWeight: 600,
      color: c.color, backgroundColor: c.bg,
      letterSpacing: "0.01em",
    }}>
      <span style={{ fontSize: "9px" }}>{c.icon}</span>
      {c.label}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════
   REPLY COMPOSER
   ═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   ATTACHMENT CHIP — shows a single attached file
   ═══════════════════════════════════════════════════════════════ */
function AttachmentChip({ file, onRemove, content }: { file: { name: string; size: number; type: string }; onRemove?: () => void; content?: string }) {
  const sizeStr = file.size < 1024 ? `${file.size} B`
    : file.size < 1048576 ? `${(file.size / 1024).toFixed(1)} KB`
    : `${(file.size / 1048576).toFixed(1)} MB`

  const icon = file.type.startsWith("image/") ? "🖼"
    : file.type === "application/pdf" ? "📄"
    : file.type.includes("spreadsheet") || file.type.includes("excel") ? "📊"
    : file.type.includes("document") || file.type.includes("word") ? "📝"
    : "📎"

  const handleDownload = () => {
    if (!content) return
    const byteChars = atob(content)
    const byteArr = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i)
    const blob = new Blob([byteArr], { type: file.type || "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = file.name
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      onClick={content ? handleDownload : undefined}
      style={{
        display: "inline-flex", alignItems: "center", gap: "8px",
        padding: "6px 12px", borderRadius: "10px",
        backgroundColor: D.blueLight, border: `1px solid ${D.blueBorder}`,
        fontSize: "12px", color: D.text, maxWidth: "260px",
        cursor: content ? "pointer" : "default",
      }}>
      <span style={{ fontSize: "14px", flexShrink: 0 }}>{icon}</span>
      <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {file.name}
      </span>
      <span style={{ color: D.textMuted, fontSize: "11px", flexShrink: 0 }}>
        {sizeStr}
      </span>
      {onRemove && (
        <button
          onClick={onRemove}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "18px", height: "18px", borderRadius: "50%",
            border: "none", backgroundColor: D.red + "18", color: D.red,
            cursor: "pointer", fontSize: "11px", fontWeight: 700, flexShrink: 0,
            transition: "background-color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = D.red + "30")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = D.red + "18")}
        >
          ✕
        </button>
      )}
    </div>
  )
}

function Composer({ text, setText, onSend, sending, keepOpen, setKeepOpen, editorRef, attachments, setAttachments }: {
  text: string; setText: (v: string) => void; onSend: () => void; sending: boolean
  keepOpen: boolean; setKeepOpen: (v: boolean) => void; editorRef?: React.RefObject<HTMLDivElement>
  attachments: { file: File; base64: string }[]; setAttachments: (v: { file: File; base64: string }[]) => void
}) {
  const ref = editorRef || useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [, forceUpdate] = useState(0)

  const getHtml = () => ref.current?.innerHTML || ""
  const getPlainText = () => ref.current?.innerText?.trim() || ""

  const handleInput = () => {
    setText(ref.current?.innerText?.trim() || "")
    forceUpdate(n => n + 1)
  }

  const execCmd = (cmd: string) => {
    document.execCommand(cmd, false)
    ref.current?.focus()
    forceUpdate(n => n + 1)
  }

  const isActive = (cmd: string) => document.queryCommandState(cmd)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "b" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); execCmd("bold") }
    if (e.key === "i" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); execCmd("italic") }
    if (e.key === "u" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); execCmd("underline") }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newAttachments: { file: File; base64: string }[] = []
    for (const file of files) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // Remove data:...;base64, prefix — Resend expects raw base64
          resolve(result.split(",")[1] || result)
        }
        reader.readAsDataURL(file)
      })
      newAttachments.push({ file, base64 })
    }
    setAttachments([...attachments, ...newAttachments])
    // Reset input so same file can be re-added
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const removeAttachment = (idx: number) => {
    setAttachments(attachments.filter((_, i) => i !== idx))
  }

  const hasContent = text.length > 0

  return (
    <div style={{
      backgroundColor: D.card, borderRadius: D.r16,
      border: `1px solid ${focused ? D.brand + "60" : D.border}`,
      boxShadow: focused ? `0 0 0 3px ${D.brand}12, ${D.sm}` : D.sm,
      overflow: "hidden",
      transition: "border-color 0.3s ease, box-shadow 0.3s ease",
    }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: "4px",
        padding: "8px 24px", borderBottom: `1px solid ${D.borderSubtle}`,
        backgroundColor: D.inset,
      }}>
        <button type="button" className={`sb-toolbar-btn ${isActive("bold") ? "active" : ""}`} onMouseDown={e => { e.preventDefault(); execCmd("bold") }} title="Bold (Ctrl+B)"><b>B</b></button>
        <button type="button" className={`sb-toolbar-btn ${isActive("italic") ? "active" : ""}`} onMouseDown={e => { e.preventDefault(); execCmd("italic") }} title="Italic (Ctrl+I)"><i>I</i></button>
        <button type="button" className={`sb-toolbar-btn ${isActive("underline") ? "active" : ""}`} onMouseDown={e => { e.preventDefault(); execCmd("underline") }} title="Underline (Ctrl+U)"><u>U</u></button>
        <div style={{ width: "1px", height: "18px", backgroundColor: D.border, margin: "0 6px" }} />
        <button
          type="button"
          className="sb-toolbar-btn"
          onMouseDown={e => { e.preventDefault(); fileInputRef.current?.click() }}
          title="Attach file"
          style={{ display: "flex", alignItems: "center", gap: "4px" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M12.07 6.53L7.12 11.48a3.18 3.18 0 01-4.5-4.5l4.95-4.95a2.12 2.12 0 013 3L5.62 9.98a1.06 1.06 0 01-1.5-1.5l4.25-4.24" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: "12px" }}>Attach</span>
        </button>
      </div>

      {/* Editor area */}
      <div style={{ padding: "20px 24px 12px" }}>
        <div
          ref={ref}
          className="sb-editor"
          contentEditable
          data-placeholder="Write your reply..."
          onInput={handleInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          style={{
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            color: D.text,
          }}
        />

        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: "8px",
            marginTop: "14px", paddingTop: "14px",
            borderTop: `1px solid ${D.borderSubtle}`,
          }}>
            {attachments.map((att, idx) => (
              <AttachmentChip
                key={idx}
                file={{ name: att.file.name, size: att.file.size, type: att.file.type }}
                onRemove={() => removeAttachment(idx)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 24px", borderTop: `1px solid ${D.borderSubtle}`,
        backgroundColor: D.inset,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "11px", color: D.textMuted }}>
            {hasContent ? `${text.length} chars` : ""}
            {attachments.length > 0 ? ` · ${attachments.length} file${attachments.length > 1 ? "s" : ""}` : ""}
          </span>
          <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: D.textSec, cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={keepOpen}
              onChange={(e) => setKeepOpen(e.target.checked)}
              style={{ width: "14px", height: "14px", accentColor: D.brand, cursor: "pointer" }}
            />
            Keep in inbox
          </label>
        </div>
        <button
          className={hasContent ? "sb-action-btn" : ""}
          onClick={onSend}
          disabled={!hasContent || sending}
          style={{
            padding: "8px 20px", fontSize: "13px", fontWeight: 600, color: "#fff",
            background: hasContent ? D.brand : D.textFaint,
            border: "none", borderRadius: "10px",
            cursor: hasContent ? "pointer" : "not-allowed",
            boxShadow: hasContent ? `0 2px 8px ${D.brand}35` : "none",
            transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {sending ? "Sending..." : attachments.length > 0 ? `Send reply + ${attachments.length} file${attachments.length > 1 ? "s" : ""}` : "Send reply"}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ORDER CONTEXT CARD — shown above messages in conversation
   ═══════════════════════════════════════════════════════════════ */
function OrderContextCard({ orders }: { orders: any[] }) {
  const [expanded, setExpanded] = useState<string | null>(orders[0]?.order_id || null)
  if (orders.length === 0) return null

  return (
    <div style={{
      backgroundColor: D.card, borderRadius: D.r16,
      border: `1px solid ${D.border}`, boxShadow: D.sm,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 20px",
        borderBottom: `1px solid ${D.borderSubtle}`,
        display: "flex", alignItems: "center", gap: "10px",
        backgroundColor: D.inset,
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 3h12l-1.5 7H3.5L2 3z" stroke={D.brand} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="5.5" cy="13" r="1" fill={D.brand}/>
          <circle cx="10.5" cy="13" r="1" fill={D.brand}/>
        </svg>
        <span style={{ fontSize: "12px", fontWeight: 700, color: D.textSec, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Order context
        </span>
        <span style={{ fontSize: "11px", color: D.textMuted }}>
          {orders.length} order{orders.length > 1 ? "s" : ""} found
        </span>
      </div>

      {/* Orders */}
      {orders.map((order: any) => {
        const isOpen = expanded === order.order_id
        const trackingNo = order.tracking_number || order.fulfillments?.[0]?.labels?.[0]?.tracking_number
        const trackingUrl = order.tracking_link || order.fulfillments?.[0]?.labels?.[0]?.tracking_url
        const paymentProvider = order.payments?.[0]?.provider_id || ""
        const providerLabel = paymentProvider.includes("stripe") ? "Stripe"
          : paymentProvider.includes("paypal") ? "PayPal"
          : paymentProvider.includes("mollie") ? "Mollie"
          : paymentProvider.includes("comgate") ? "Comgate"
          : paymentProvider.includes("cod") ? "COD"
          : paymentProvider || "—"
        const refunds = (order.payments || []).flatMap((p: any) => p.refunds || [])
        const totalRefunded = refunds.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0)

        // Build comprehensive timeline events
        const timelineEvents: { label: string; date?: string; color: string; detail?: string }[] = []
        // 1. Order placed
        timelineEvents.push({ label: "Order placed", date: order.created_at, color: D.green, detail: `#${order.display_id}` })
        // 2. Payment captured
        const capturedAt = order.payments?.[0]?.captured_at || (order.payment_status === "paid" ? order.created_at : undefined)
        timelineEvents.push({ label: `Payment captured (${providerLabel})`, date: capturedAt, color: D.blue })
        // 3. Fulfillment created
        const fulfillment = order.fulfillments?.[0]
        if (fulfillment) {
          timelineEvents.push({ label: "Fulfillment created", date: fulfillment.created_at, color: D.purple })
        } else {
          timelineEvents.push({ label: "Fulfillment created", date: undefined, color: D.purple })
        }
        // 4. Shipped
        const shippedAt = fulfillment?.shipped_at || (trackingNo ? fulfillment?.created_at : undefined)
        timelineEvents.push({
          label: trackingNo ? `Shipped — ${trackingNo}` : "Shipped",
          date: shippedAt,
          color: D.blue,
          detail: order.carrier || undefined,
        })
        // 5. Delivery status (from metadata / Dextrum)
        if (order.delivery_status) {
          const delDate = order.delivery_status === "delivered"
            ? (fulfillment?.delivered_at || order.created_at)
            : undefined
          timelineEvents.push({
            label: `Delivery: ${order.delivery_status}`,
            date: order.delivery_status === "delivered" ? delDate : undefined,
            color: order.delivery_status === "delivered" ? D.green : D.orange,
          })
        } else {
          timelineEvents.push({ label: "Delivered", date: fulfillment?.delivered_at, color: D.green })
        }
        // 6. Refunds
        refunds.forEach((r: any) => {
          timelineEvents.push({
            label: `Refund: ${f.money(r.amount, order.currency_code)}`,
            date: r.created_at,
            color: D.red,
            detail: r.note || undefined,
          })
        })
        // 7. Canceled
        if (order.canceled_at || order.status === "canceled") {
          timelineEvents.push({ label: "Order canceled", date: order.canceled_at || order.created_at, color: D.red })
        }

        return (
          <div key={order.order_id} style={{ borderBottom: `1px solid ${D.borderSubtle}` }}>
            {/* Order toggle header */}
            <button
              onClick={() => setExpanded(isOpen ? null : order.order_id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 20px", border: "none", background: "none", cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: D.text }}>
                  Order #{order.display_id}
                </span>
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
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: D.text }}>
                  {f.money(order.total, order.currency_code)}
                </span>
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s", color: D.textFaint }}>
                  <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                </svg>
              </div>
            </button>

            {/* Expanded content */}
            {isOpen && (
              <div style={{ padding: "0 20px 20px" }}>
                <div style={{ display: "flex", gap: "20px" }}>
                  {/* Left: Products + Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Products */}
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: D.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
                        Products
                      </div>
                      {order.items?.map((item: any, i: number) => (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px",
                          backgroundColor: D.inset, borderRadius: D.r8,
                          marginBottom: i < order.items.length - 1 ? "6px" : 0,
                        }}>
                          {item.thumbnail && (
                            <img src={item.thumbnail} alt="" style={{
                              width: "40px", height: "40px", borderRadius: D.r8, objectFit: "cover",
                              border: `1px solid ${D.borderSubtle}`,
                            }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "13px", color: D.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.title}
                            </div>
                            <div style={{ fontSize: "11px", color: D.textMuted, marginTop: "2px" }}>
                              Qty: {item.quantity}
                              {item.unit_price > 0 && <> · {f.money(item.unit_price, order.currency_code)}</>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Quick info grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                      <div style={{ padding: "8px 12px", backgroundColor: D.inset, borderRadius: D.r8 }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: D.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Payment</div>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: D.text, marginTop: "2px" }}>{providerLabel}</div>
                      </div>
                      <div style={{ padding: "8px 12px", backgroundColor: D.inset, borderRadius: D.r8 }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: D.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total</div>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: D.text, marginTop: "2px" }}>{f.money(order.total, order.currency_code)}</div>
                      </div>
                      {totalRefunded > 0 && (
                        <div style={{ padding: "8px 12px", backgroundColor: D.redLight, borderRadius: D.r8 }}>
                          <div style={{ fontSize: "10px", fontWeight: 700, color: D.red, textTransform: "uppercase", letterSpacing: "0.05em" }}>Refunded</div>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: D.red, marginTop: "2px" }}>{f.money(totalRefunded, order.currency_code)}</div>
                        </div>
                      )}
                      {order.shipping_address && (
                        <div style={{ padding: "8px 12px", backgroundColor: D.inset, borderRadius: D.r8, gridColumn: totalRefunded > 0 ? undefined : "span 1" }}>
                          <div style={{ fontSize: "10px", fontWeight: 700, color: D.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ship to</div>
                          <div style={{ fontSize: "12px", fontWeight: 500, color: D.text, marginTop: "2px" }}>
                            {[order.shipping_address.city, order.shipping_address.country_code?.toUpperCase()].filter(Boolean).join(", ")}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tracking bar */}
                    {trackingNo && (
                      <div style={{ marginTop: "10px", padding: "10px 12px", backgroundColor: D.blueLight, borderRadius: D.r8, border: `1px solid ${D.blueBorder}` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <span style={{ fontSize: "10px", fontWeight: 700, color: D.blue, textTransform: "uppercase", letterSpacing: "0.05em" }}>Tracking: </span>
                            <span style={{ fontSize: "12px", color: D.text, fontFamily: "'SF Mono',Menlo,monospace", fontWeight: 500 }}>{trackingNo}</span>
                            {order.carrier && <span style={{ fontSize: "11px", color: D.textSec }}> via {order.carrier}</span>}
                          </div>
                          {trackingUrl && (
                            <a href={trackingUrl} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: "11px", color: D.blue, textDecoration: "none", fontWeight: 600 }}>
                              Track →
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* View in admin */}
                    <div style={{ marginTop: "10px" }}>
                      <Link to={`/custom-orders/${order.order_id}`} style={{ fontSize: "12px", fontWeight: 600, color: D.blue, textDecoration: "none" }}>
                        View full order in admin →
                      </Link>
                    </div>
                  </div>

                  {/* Right: Timeline */}
                  <div style={{ width: "240px", flexShrink: 0 }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: D.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
                      Timeline
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {timelineEvents.map((ev, i) => (
                        <div key={i} style={{ display: "flex", gap: "10px" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "14px", flexShrink: 0 }}>
                            <div style={{
                              width: "8px", height: "8px", borderRadius: "50%", marginTop: "4px",
                              backgroundColor: ev.date ? ev.color : D.borderSubtle,
                              boxShadow: ev.date ? `0 0 0 3px ${ev.color}18` : "none",
                            }} />
                            {i < timelineEvents.length - 1 && (
                              <div style={{ width: "1.5px", flex: 1, minHeight: "14px", backgroundColor: D.borderSubtle }} />
                            )}
                          </div>
                          <div style={{ paddingBottom: i < timelineEvents.length - 1 ? "8px" : 0, minWidth: 0 }}>
                            <div style={{
                              fontSize: "11px", fontWeight: ev.date ? 600 : 400,
                              color: ev.date ? D.text : D.textFaint, lineHeight: "16px",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {ev.label}
                            </div>
                            {ev.date && (
                              <div style={{ fontSize: "10px", color: D.textMuted, marginTop: "1px" }}>
                                {f.dt(ev.date)}
                              </div>
                            )}
                            {ev.detail && (
                              <div style={{ fontSize: "10px", color: D.textMuted, fontStyle: "italic" }}>{ev.detail}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
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
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [reply, setReply] = useState("")
  const [keepOpen, setKeepOpen] = useState(false)
  const [attachments, setAttachments] = useState<{ file: File; base64: string }[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0)
    // Also scroll any parent containers to top
    let n: HTMLElement | null = pageRef.current?.parentElement || null
    while (n && n !== document.documentElement) {
      n.scrollTop = 0
      n = n.parentElement
    }
  }, [ticketId])

  const { data, isLoading } = useQuery({
    queryKey: ["supportbox-ticket-detail", ticketId],
    queryFn: async () => await sdk.client.fetch(`/admin/supportbox/tickets/${ticketId}`, { method: "GET" }) as any,
    enabled: !!ticketId,
  })

  const ticket = data?.ticket
  const orders = data?.allOrders || []

  // Auto-mark ticket as read when opened
  useEffect(() => {
    if (ticket?.status === "new" && ticketId) {
      sdk.client.fetch(`/admin/supportbox/tickets/${ticketId}/read`, { method: "POST" })
        .then(() => {
          qc.invalidateQueries({ queryKey: ["supportbox-tickets"] })
          qc.invalidateQueries({ queryKey: ["supportbox-ticket-detail", ticketId] })
        })
        .catch(() => {})
    }
  }, [ticket?.status, ticketId])

  const replyMut = useMutation({
    mutationFn: async ({ html, plainText, atts }: { html: string; plainText: string; atts: { file: File; base64: string }[] }) => {
      const attPayload = atts.map(a => ({
        filename: a.file.name,
        content: a.base64,
        content_type: a.file.type || "application/octet-stream",
        size: a.file.size,
      }))
      return sdk.client.fetch(`/admin/supportbox/tickets/${ticketId}/reply`, {
        method: "POST",
        body: {
          body_html: html,
          body_text: plainText,
          keep_open: keepOpen,
          ...(attPayload.length > 0 ? { attachments: attPayload } : {}),
        },
      })
    },
    onSuccess: () => {
      setReply("")
      setAttachments([])
      if (editorRef.current) editorRef.current.innerHTML = ""
      qc.invalidateQueries({ queryKey: ["supportbox-ticket-detail", ticketId] })
      qc.invalidateQueries({ queryKey: ["supportbox-tickets"] })
      if (!keepOpen) {
        navigate("/supportbox")
      }
    },
  })

  const solveMut = useMutation({
    mutationFn: async () => sdk.client.fetch(`/admin/supportbox/tickets/${ticketId}/solve`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supportbox-ticket-detail", ticketId] })
      qc.invalidateQueries({ queryKey: ["supportbox-tickets"] })
      navigate("/supportbox")
    },
  })

  const reopenMut = useMutation({
    mutationFn: async () => sdk.client.fetch(`/admin/supportbox/tickets/${ticketId}/reopen`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["supportbox-ticket-detail", ticketId] }); qc.invalidateQueries({ queryKey: ["supportbox-tickets"] }) },
  })

  const spamMut = useMutation({
    mutationFn: async () => sdk.client.fetch(`/admin/supportbox/tickets/${ticketId}/spam`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supportbox-ticket-detail", ticketId] })
      qc.invalidateQueries({ queryKey: ["supportbox-tickets"] })
      navigate("/supportbox")
    },
  })

  // Sort messages newest first — most recent message at top
  const msgs = [...(ticket?.messages || [])].sort((a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at))

  // No auto-scroll — user controls scroll position

  const send = () => {
    if (!reply.trim()) return
    const html = editorRef.current?.innerHTML || ""
    const plainText = editorRef.current?.innerText?.trim() || ""
    replyMut.mutateAsync({ html, plainText, atts: attachments })
  }

  // Loading / 404
  if (isLoading) return <div style={{ padding: "100px", textAlign: "center", color: D.textSec }}>Loading...</div>
  if (!ticket) return <div style={{ padding: "100px", textAlign: "center", color: D.textSec }}>Ticket not found</div>

  const st = ticket.status === "solved" ? { label: "Solved", bg: D.greenLight, color: D.green }
    : ticket.status === "old" ? { label: "Old", bg: D.orangeLight, color: D.orange }
    : ticket.status === "spam" ? { label: "Spam", bg: D.redLight, color: D.red }
    : ticket.status === "read" ? { label: "", bg: "transparent", color: "transparent" }
    : { label: "New", bg: D.greenLight, color: D.green }

  return (
    <div ref={pageRef} style={{ width: "100%", maxWidth: "1200px", margin: "0 auto", padding: "24px 32px", background: PAGE_BG, boxSizing: "border-box", minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @keyframes msgSlideLeft { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes msgSlideRight { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .sb-action-btn { transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) !important; }
        .sb-action-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 4px 12px rgba(0,0,0,0.12) !important; }
        .sb-back-btn { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important; }
        .sb-back-btn:hover { background-color: #F3F4F6 !important; transform: scale(1.08) !important; border-color: #D1D5DB !important; }
        .sb-msg-body { white-space: pre-wrap; overflow: hidden; max-width: 100%; }
        .sb-msg-body p { margin: 0 0 10px 0; white-space: normal; }
        .sb-msg-body p:last-child { margin-bottom: 0; }
        .sb-msg-body br + br { content: ''; display: block; margin-top: 10px; }
        .sb-msg-body div { margin-bottom: 6px; white-space: normal; }
        .sb-msg-body div:last-child { margin-bottom: 0; }
        .sb-msg-body ul, .sb-msg-body ol { margin: 8px 0; padding-left: 24px; white-space: normal; }
        .sb-msg-body li { margin-bottom: 4px; }
        .sb-msg-body blockquote { border-left: 3px solid #E5E7EB; padding-left: 12px; margin: 8px 0; color: #6B7280; }
        .sb-msg-body table { white-space: normal; max-width: 100%; table-layout: fixed; }
        .sb-msg-body img { max-width: 100%; height: auto; }
        .sb-msg-body * { max-width: 100%; box-sizing: border-box; }
        .sb-editor { min-height: 80px; max-height: 300px; overflow-y: auto; outline: none; font-size: 14px; line-height: 1.7; word-break: break-word; white-space: pre-wrap; }
        .sb-editor:empty:before { content: attr(data-placeholder); color: ${D.textMuted}; pointer-events: none; }
        .sb-toolbar-btn { padding: 4px 10px; font-size: 13px; background: transparent; border: 1px solid ${D.border}; border-radius: 6px; cursor: pointer; color: ${D.textSec}; transition: all 0.15s ease; line-height: 1; }
        .sb-toolbar-btn:hover { background: ${D.inset}; color: ${D.text}; border-color: ${D.textMuted}; }
        .sb-toolbar-btn.active { background: ${D.brand}15; color: ${D.brand}; border-color: ${D.brand}50; }
      `}</style>

      {/* ══════ HEADER ══════ */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: "200px", flex: "1 1 auto" }}>
          <Link to="/supportbox" style={{ textDecoration: "none", flexShrink: 0 }}>
            <div className="sb-back-btn" style={{
              width: "34px", height: "34px", borderRadius: D.r8, backgroundColor: D.card,
              border: `1px solid ${D.border}`, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", boxShadow: D.xs,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke={D.textSec} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </Link>
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h1 style={{ fontSize: "18px", fontWeight: 700, color: D.text, margin: 0, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                {ticket.subject}
              </h1>
              <Pill bg={st.bg} color={st.color}>{st.label}</Pill>
            </div>
            <div style={{ fontSize: "13px", color: D.textSec, marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ticket.from_name ? `${ticket.from_name}` : ticket.from_email}
              <span style={{ color: D.textFaint, margin: "0 6px" }}>·</span>
              {f.dt(ticket.created_at)}
            </div>
            {/* AI Labels */}
            {ticket.metadata?.ai_labels && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                {ticket.metadata.ai_labels.project && (
                  <span style={{
                    fontSize: "11px", fontWeight: 600, color: "#4F46E5",
                    backgroundColor: "#EEF2FF", padding: "2px 10px",
                    borderRadius: "9999px", letterSpacing: "0.02em",
                  }}>
                    {ticket.metadata.ai_labels.project}
                  </span>
                )}
                {ticket.metadata.ai_labels.category && (
                  <span style={{
                    fontSize: "11px", fontWeight: 600,
                    color: getCatColor(ticket.metadata.ai_labels.category).color,
                    backgroundColor: getCatColor(ticket.metadata.ai_labels.category).bg,
                    padding: "2px 10px", borderRadius: "9999px",
                  }}>
                    {formatCat(ticket.metadata.ai_labels.category)}
                  </span>
                )}
                {ticket.metadata.ai_labels.summary && (
                  <span style={{ fontSize: "12px", color: "#6B7280", fontStyle: "italic" }}>
                    {ticket.metadata.ai_labels.summary}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ flexShrink: 0, display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Spam button */}
          {ticket.status !== "spam" && (
            <button className="sb-action-btn" onClick={() => spamMut.mutate()} disabled={spamMut.isPending}
              style={{
                padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: D.red,
                backgroundColor: D.redLight, border: `1px solid ${D.red}25`,
                borderRadius: D.r8, cursor: "pointer", transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                whiteSpace: "nowrap",
              }}>
              {spamMut.isPending ? "..." : "Spam"}
            </button>
          )}

          {/* Solve / Reopen / Un-spam */}
          {ticket.status === "spam" ? (
            <button className="sb-action-btn" onClick={() => reopenMut.mutate()} disabled={reopenMut.isPending}
              style={{
                padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: D.orange,
                backgroundColor: D.orangeLight, border: `1px solid ${D.orange}40`,
                borderRadius: D.r8, cursor: "pointer", transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                whiteSpace: "nowrap",
              }}>
              {reopenMut.isPending ? "..." : "Not spam"}
            </button>
          ) : ticket.status !== "solved" ? (
            <button className="sb-action-btn" onClick={() => solveMut.mutate()} disabled={solveMut.isPending}
              style={{
                padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff",
                backgroundColor: D.green, border: "none", borderRadius: D.r8,
                cursor: "pointer", boxShadow: `0 2px 8px ${D.green}35`, transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                whiteSpace: "nowrap",
              }}>
              {solveMut.isPending ? "..." : "Mark solved"}
            </button>
          ) : (
            <button className="sb-action-btn" onClick={() => reopenMut.mutate()} disabled={reopenMut.isPending}
              style={{
                padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: D.orange,
                backgroundColor: D.orangeLight, border: `1px solid ${D.orange}40`,
                borderRadius: D.r8, cursor: "pointer", transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                whiteSpace: "nowrap",
              }}>
              {reopenMut.isPending ? "..." : "Reopen"}
            </button>
          )}
        </div>
      </div>

      {/* ══════ LAYOUT: Conversation | Sidebar ══════ */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "flex-start" }}>

        {/* Conversation (flex 7 = ~70%) */}
        <div style={{ flex: "7 1 500px", minWidth: 0, display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Order context */}
          <OrderContextCard orders={orders} />

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
          <Composer text={reply} setText={setReply} onSend={send} sending={replyMut.isPending} keepOpen={keepOpen} setKeepOpen={setKeepOpen} editorRef={editorRef} attachments={attachments} setAttachments={setAttachments} />

          {replyMut.isError && (
            <div style={{ padding: "12px 16px", backgroundColor: D.redLight, border: `1px solid ${D.red}30`, borderRadius: D.r12, fontSize: "13px", color: D.red }}>
              Failed to send: {(replyMut.error as any)?.message || "Unknown error"}
            </div>
          )}
        </div>

        {/* Sidebar (flex 3 = ~30%, wraps below on narrow screens) */}
        <div style={{
          flex: "3 1 240px", maxWidth: "400px",
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
