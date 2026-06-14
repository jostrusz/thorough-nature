import React, { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "@medusajs/ui"
import { PaymentBadge, DeliveryBadge } from "./order-badges"
import { useUpdateMetadata } from "../../hooks/use-update-metadata"
import { formatCurrency } from "../../lib/format-currency"
import {
  colors,
  radii,
  fontStack,
  getPaymentIconUrl,
  getPaymentFallback,
  getPaymentMethodName,
  getOrderDisplayNumber,
  getProjectChip,
  COUNTRY_OPTIONS,
} from "./design-tokens"

// Fulfillment lifecycle (Dextrum / PostNord mySTOCK statuses)
const PIPELINE = ["NEW", "WAITING", "IMPORTED", "PROCESSED", "PACKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED"]
const STEP_LABEL: Record<string, string> = {
  NEW: "New", WAITING: "Waiting", IMPORTED: "Imported", PROCESSED: "Processed",
  PACKED: "Packed", DISPATCHED: "Dispatched", IN_TRANSIT: "Transit", DELIVERED: "Delivered",
}

// Payment status (same logic as orders-table / route.ts — kept local to avoid a shared import cycle)
function getPaymentStatus(order: any): string {
  if (order.metadata?.payment_captured) return "paid"
  const isCOD = (order.payment_collections || []).some((pc: any) =>
    (pc.payments || []).some((p: any) => (p.provider_id || "").includes("cod"))
  ) || order.metadata?.payment_provider === "cod" || order.metadata?.payment_method === "cod"
  if (isCOD) return "pending"
  if (order.payment_collections?.length) {
    const pcs = order.payment_collections as any[]
    const activePC = pcs.find((pc: any) => pc.status === "captured" || pc.status === "completed")
      || pcs.find((pc: any) => pc.status !== "canceled") || pcs[pcs.length - 1]
    if (activePC.status === "captured" || activePC.status === "completed") return "paid"
    if (activePC.status === "refunded") return "refunded"
    if (activePC.status === "partially_refunded") return "partially_refunded"
    if (activePC.status === "authorized") return "authorized"
    return activePC.status || "pending"
  }
  if (order.metadata?.copied_payment_status) return order.metadata.copied_payment_status
  return "pending"
}

function getDeliveryStatus(order: any): string {
  if (order.metadata?.dextrum_status) return order.metadata.dextrum_status
  const fulfillments = order.fulfillments || []
  if (fulfillments.length === 0) return "NEW"
  const itemCount = order.items?.length || 0
  const fulfilledIds = new Set<string>()
  fulfillments.forEach((f: any) => (f.items || []).forEach((fi: any) => fulfilledIds.add(fi.line_item_id)))
  if (itemCount > 0 && fulfilledIds.size < itemCount) return "WAITING"
  return "PROCESSED"
}

function getTrackingNumber(order: any): string | null {
  const m = order.metadata || {}
  if (m.dextrum_tracking_number) return String(m.dextrum_tracking_number)
  if (m.tracking_number) return String(m.tracking_number)
  for (const f of order.fulfillments || []) {
    for (const l of f.labels || []) {
      if (l.tracking_number) return String(l.tracking_number)
    }
  }
  return null
}

function getTransactionId(order: any): string | null {
  const m = order.metadata || {}
  return (
    m.airwallexPaymentIntentId || m.stripePaymentIntentId || m.paypalOrderId ||
    m.paypalCaptureId || m.paypal_transaction_id || m.klarnaOrderId ||
    m.novalnetTid || m.comgate_transaction_id || null
  ) as string | null
}

function initials(name: string, email?: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts.length === 1 && parts[0] !== "—") return parts[0].slice(0, 2).toUpperCase()
  if (email) return email.slice(0, 2).toUpperCase()
  return "?"
}

const AVATAR_COLORS = [
  { bg: "#EEF2FF", fg: "#4338CA" }, { bg: "#FFF1F2", fg: "#BE123C" },
  { bg: "#ECFDF5", fg: "#047857" }, { bg: "#FFF7ED", fg: "#C2410C" },
  { bg: "#F0F9FF", fg: "#0369A1" }, { bg: "#FAF5FF", fg: "#7E22CE" },
]
function avatarColor(key: string) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

interface OrderDrawerProps {
  order: any | null
  onClose: () => void
  onBeforeNavigate?: () => void
}

export function OrderDrawer({ order, onClose, onBeforeNavigate }: OrderDrawerProps) {
  const navigate = useNavigate()
  const updateMetadata = useUpdateMetadata()
  const open = !!order

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    if (open) document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return (
    <>
      <DrawerStyles />
      <div
        className={`odrawer-scrim ${open ? "open" : ""}`}
        onClick={onClose}
      />
      <div className={`odrawer ${open ? "open" : ""}`}>
        {order && <DrawerBody order={order} onClose={onClose} navigate={navigate} updateMetadata={updateMetadata} onBeforeNavigate={onBeforeNavigate} />}
      </div>
    </>
  )
}

function DrawerBody({ order, onClose, navigate, updateMetadata, onBeforeNavigate }: any) {
  const customerName = [order.shipping_address?.first_name, order.shipping_address?.last_name].filter(Boolean).join(" ") || "—"
  const av = avatarColor(order.email || customerName)
  const cc = (order.shipping_address?.country_code || order.billing_address?.country_code || "nl").toUpperCase()
  const ctry = COUNTRY_OPTIONS.find((c) => c.code === cc)
  const flag = ctry?.flag || ""
  const paymentStatus = getPaymentStatus(order)
  const deliveryStatus = getDeliveryStatus(order)
  const curIdx = PIPELINE.indexOf(deliveryStatus)
  const issue = deliveryStatus === "ALLOCATION_ISSUE"
  const chip = getProjectChip(order.metadata?.project_id)
  const total = (Number(order.total) || 0) + (Number(order.metadata?.cod_fee) || 0) + (Number(order.metadata?.shipping_fee) || 0)
  const subtotal = Number(order.subtotal) || 0
  const shipping = Number(order.shipping_total) || 0
  const tax = Number(order.tax_total) || 0
  const tracking = getTrackingNumber(order)
  const txn = getTransactionId(order)
  const wms = cc === "SE" || cc === "NO" ? "PostNord Linker" : "Dextrum mySTOCK"
  const carrier = cc === "SE" || cc === "NO" ? "PostNord" : cc === "PL" ? "InPost" : cc === "CZ" || cc === "SK" ? "Zásilkovna" : "GLS"
  const orderState = deliveryStatus === "DELIVERED"
    ? { cls: "os-done", label: "Completed" }
    : paymentStatus === "refunded"
      ? { cls: "os-canc", label: "Refunded" }
      : { cls: "os-open", label: "Open" }
  const bookSent = order.metadata?.book_sent === true || order.metadata?.book_sent === "true"
  const phone = order.shipping_address?.phone || order.billing_address?.phone

  function goFull() {
    onBeforeNavigate?.()
    navigate(`/custom-orders/${order.id}`)
  }
  function markBookSent() {
    updateMetadata.mutate(
      { orderId: order.id, metadata: { book_sent: !bookSent } },
      {
        onSuccess: () => toast.success(`Book sent ${!bookSent ? "marked" : "unmarked"} for ${getOrderDisplayNumber(order)}`),
        onError: () => toast.error("Failed to update book sent"),
      }
    )
  }

  const payIcon = (() => {
    const url = getPaymentIconUrl(order)
    if (url) return <div className="od-payicon"><img src={url} alt="" /></div>
    const fb = getPaymentFallback(order)
    return <div className="od-payicon" style={{ background: fb.bg, color: fb.color, fontSize: "7px", fontWeight: 700 }}>{fb.letter}</div>
  })()

  return (
    <>
      <div className="od-head">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="od-num">{getOrderDisplayNumber(order)}</span>
            <span className={`od-ostatus ${orderState.cls}`}>{orderState.label}</span>
          </div>
          <div className="od-sub">
            {new Date(order.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" })}
            {" · "}{flag} {ctry?.label || cc}{chip ? ` · ${chip.label}` : ""}
          </div>
        </div>
        <button className="od-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="od-body">
        {/* Quick status strip */}
        <div className="od-strip">
          <div className="od-ministat"><div className="od-ml">Payment</div><PaymentBadge status={paymentStatus} /></div>
          <div className="od-ministat"><div className="od-ml">Fulfillment</div><DeliveryBadge status={deliveryStatus} /></div>
          <div className="od-ministat"><div className="od-ml">Book sent</div>
            <span className="od-badge" style={bookSent ? { background: colors.greenBg, color: colors.green } : { background: "rgba(0,0,0,0.04)", color: colors.textSec }}>
              <span className="od-dot" style={{ background: bookSent ? colors.green : colors.textSec }} />{bookSent ? "Yes" : "No"}
            </span>
          </div>
        </div>

        {/* Customer */}
        <div className="od-sec"><h4>Customer</h4>
          <div className="od-row" style={{ marginBottom: "10px" }}>
            <div className="od-avatar" style={{ background: av.bg, color: av.fg }}>{initials(customerName, order.email)}</div>
            <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }}>{customerName}</div></div>
          </div>
          <div className="od-kv"><span className="k">Email</span><span className="v">{order.email}</span></div>
          {phone && <div className="od-kv"><span className="k">Phone</span><span className="v">{phone}</span></div>}
        </div>

        {/* Shipping address */}
        {order.shipping_address && (
          <div className="od-sec"><h4>Shipping address</h4>
            <div className="od-addr">
              {customerName}<br />
              {order.shipping_address.address_1}{order.shipping_address.address_2 ? <>, {order.shipping_address.address_2}</> : null}<br />
              {order.shipping_address.postal_code} {order.shipping_address.city}<br />
              {flag} {ctry?.label || cc}
            </div>
          </div>
        )}

        {/* Items */}
        <div className="od-sec"><h4>Items</h4>
          {(order.items || []).map((it: any, i: number) => (
            <div className="od-item" key={i}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.title || it.product_title}{it.quantity > 1 ? <span className="muted"> ×{it.quantity}</span> : null}
              </span>
              <span className="od-amt">{formatCurrency((Number(it.unit_price) || 0) * (it.quantity || 1), order.currency_code)}</span>
            </div>
          ))}
          <div style={{ marginTop: "10px" }}>
            {subtotal > 0 && <div className="od-break"><span className="muted">Subtotal</span><span className="od-amt muted">{formatCurrency(subtotal, order.currency_code)}</span></div>}
            <div className="od-break"><span className="muted">Shipping</span><span className="od-amt muted">{formatCurrency(shipping, order.currency_code)}</span></div>
            {tax > 0 && <div className="od-break"><span className="muted">Tax</span><span className="od-amt muted">{formatCurrency(tax, order.currency_code)}</span></div>}
            <div className="od-break tot"><span>Total</span><span className="od-amt">{formatCurrency(total, order.currency_code)}</span></div>
          </div>
        </div>

        {/* Payment */}
        <div className="od-sec"><h4>Payment</h4>
          <div className="od-row" style={{ marginBottom: "8px" }}>
            {payIcon}<span style={{ fontWeight: 500 }}>{getPaymentMethodName(order)}</span>
            <span style={{ marginLeft: "auto" }}><PaymentBadge status={paymentStatus} /></span>
          </div>
          {txn && <div className="od-kv"><span className="k">Transaction ID</span><span className="v mono">{txn}</span></div>}
        </div>

        {/* Fulfillment */}
        <div className="od-sec"><h4>Fulfillment — {wms}</h4>
          {issue && <div className="od-banner">🚫 Allocation issue — out of stock</div>}
          <div className="od-stepper">
            {PIPELINE.map((s, i) => {
              const cls = i < curIdx ? "done" : i === curIdx ? "cur" : ""
              return (
                <div className={`od-step ${cls}`} key={s}>
                  <div className="od-stepdot" /><div className="od-steplabel">{STEP_LABEL[s]}</div>
                </div>
              )
            })}
          </div>
          {tracking
            ? <div className="od-track">📦 <b>{carrier}</b><span className="mono" style={{ color: colors.textSec }}>{tracking}</span></div>
            : <div style={{ fontSize: "12px", color: colors.textMuted, marginTop: "8px" }}>No tracking number yet</div>}
        </div>
      </div>

      <div className="od-foot">
        <button className="od-btn primary" onClick={goFull}>↗ Open full page</button>
        <button className="od-btn" onClick={markBookSent} disabled={updateMetadata.isPending}>
          {bookSent ? "Unmark book sent" : "✓ Mark book sent"}
        </button>
        <button className="od-btn" onClick={() => { toast.info("Use the full order page to send to WMS"); }}>📦 Send to WMS</button>
        <button className="od-btn" onClick={() => { toast.info("Use the full order page to refund"); }}>↩ Refund</button>
      </div>
    </>
  )
}

function DrawerStyles() {
  return (
    <style>{`
      .odrawer-scrim {
        position: fixed; inset: 0; background: rgba(20,22,40,0.35);
        opacity: 0; pointer-events: none; transition: opacity 0.2s, backdrop-filter 0.2s; z-index: 150;
      }
      .odrawer-scrim.open { opacity: 1; pointer-events: auto; backdrop-filter: blur(1.5px); }
      /* width forced with !important to beat the dashboard's full-width nuclear CSS */
      .odrawer {
        position: fixed !important; top: 0; right: 0; bottom: 0;
        width: 440px !important; max-width: 92vw !important; min-width: 0 !important;
        background: #fff; box-shadow: -8px 0 40px rgba(0,0,0,0.16);
        transform: translateX(100%); transition: transform 0.26s cubic-bezier(0.4,0,0.2,1);
        z-index: 160; display: flex; flex-direction: column; font-family: ${fontStack}; flex: none !important;
      }
      .odrawer.open { transform: translateX(0); }
      @media (max-width: 560px) { .odrawer { width: 100vw !important; max-width: 100vw !important; } }
      .od-head { padding: 18px 20px; border-bottom: 1px solid ${colors.border}; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .od-num { font-size: 16px; font-weight: 700; color: ${colors.accent}; }
      .od-sub { font-size: 12px; color: ${colors.textMuted}; margin-top: 4px; }
      .od-ostatus { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 20px; }
      .os-open { background: ${colors.blueBg}; color: ${colors.blue}; }
      .os-done { background: ${colors.greenBg}; color: ${colors.green}; }
      .os-canc { background: rgba(0,0,0,0.05); color: ${colors.textSec}; }
      .od-close { width: 30px; height: 30px; border-radius: 7px; border: 1px solid ${colors.border}; background: #fff; cursor: pointer; color: ${colors.textSec}; flex-shrink: 0; transition: all 0.18s ease; }
      .od-close:hover { background: #F4F5FA; transform: rotate(90deg); }
      .od-body { flex: 1; overflow-y: auto; padding: 18px 20px; }
      .od-strip { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 18px; }
      .od-ministat { border: 1px solid ${colors.border}; border-radius: 9px; padding: 9px 10px; }
      .od-ml { font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px; color: ${colors.textMuted}; font-weight: 600; margin-bottom: 5px; }
      .od-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
      .od-dot { width: 6px; height: 6px; border-radius: 50%; }
      .od-sec { margin-bottom: 18px; }
      .od-sec h4 { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px; color: ${colors.textMuted}; font-weight: 600; margin-bottom: 9px; }
      .od-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
      .od-avatar { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 13px; font-weight: 700; }
      .od-kv { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 13px; padding: 4px 0; }
      .od-kv .k { color: ${colors.textMuted}; white-space: nowrap; }
      .od-kv .v { font-weight: 500; text-align: right; color: ${colors.text}; word-break: break-all; }
      .od-kv .v.mono { font-variant-numeric: tabular-nums; font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
      .od-addr { font-size: 13px; line-height: 1.55; color: ${colors.text}; }
      .od-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 11px; border: 1px solid ${colors.border}; border-radius: 9px; font-size: 13px; transition: border-color 0.15s, transform 0.15s; }
      .od-item + .od-item { margin-top: 7px; }
      .od-item:hover { border-color: rgba(108,92,231,0.3); transform: translateX(2px); }
      .od-amt { font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .od-break { display: flex; justify-content: space-between; font-size: 13px; padding: 5px 0; }
      .od-break.tot { border-top: 1px solid ${colors.border}; margin-top: 5px; padding-top: 9px; font-weight: 700; }
      .muted { color: ${colors.textMuted}; }
      .od-payicon { width: 20px; height: 20px; border-radius: 4px; background: #f0f1f5; padding: 2px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
      .od-payicon img { width: 100%; height: 100%; object-fit: contain; }
      .od-banner { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; font-size: 12.5px; font-weight: 600; margin: 6px 0 10px; background: ${colors.redBg}; color: ${colors.red}; }
      .od-stepper { display: flex; align-items: flex-start; gap: 0; margin-top: 4px; }
      .od-step { display: flex; flex-direction: column; align-items: center; flex: 1; position: relative; }
      .od-stepdot { width: 14px; height: 14px; border-radius: 50%; background: #E4E6EE; border: 2px solid #E4E6EE; z-index: 1; }
      .od-step.done .od-stepdot { background: ${colors.green}; border-color: ${colors.green}; }
      .od-step.cur .od-stepdot { background: #fff; border-color: ${colors.accent}; box-shadow: 0 0 0 3px ${colors.accentBg}; }
      .od-steplabel { font-size: 8.5px; color: ${colors.textMuted}; margin-top: 5px; text-align: center; white-space: nowrap; transform: scale(0.92); }
      .od-step.cur .od-steplabel { color: ${colors.accent}; font-weight: 700; }
      .od-step.done .od-steplabel { color: ${colors.green}; }
      .od-step::before { content: ""; position: absolute; top: 7px; left: -50%; width: 100%; height: 2px; background: #E4E6EE; }
      .od-step:first-child::before { display: none; }
      .od-step.done::before, .od-step.cur::before { background: ${colors.green}; }
      .od-track { display: flex; align-items: center; gap: 8px; padding: 9px 11px; border: 1px solid ${colors.border}; border-radius: 9px; font-size: 12.5px; margin-top: 8px; }
      .od-track .mono { font-family: ui-monospace, Menlo, monospace; }
      .od-foot { padding: 14px 20px; border-top: 1px solid ${colors.border}; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .od-btn { padding: 9px 12px; border-radius: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer; border: 1px solid ${colors.border}; background: #fff; color: ${colors.text}; font-family: ${fontStack}; transition: all 0.18s cubic-bezier(0.34,1.56,0.64,1); }
      .od-btn:hover { transform: translateY(-1px); background: #F4F5FA; }
      .od-btn:active { transform: translateY(0) scale(0.97); }
      .od-btn.primary { background: ${colors.accent}; color: #fff; border-color: ${colors.accent}; }
      .od-btn.primary:hover { background: #5b4bd6; }
      .od-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .odrawer .od-sec, .odrawer .od-strip { animation: odFadeUp 0.32s ease both; }
      .odrawer.open .od-strip { animation-delay: 0.02s; }
      .odrawer.open .od-sec:nth-of-type(2) { animation-delay: 0.06s; }
      .odrawer.open .od-sec:nth-of-type(3) { animation-delay: 0.10s; }
      .odrawer.open .od-sec:nth-of-type(4) { animation-delay: 0.14s; }
      @keyframes odFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    `}</style>
  )
}
