import { useState } from "react";

// ═══════════════════════════════════════════
// DESIGN TOKENS — matching existing admin system
// ═══════════════════════════════════════════
const T = {
  bg: "#FFFFFF", bgPage: "#F6F6F7", border: "#E1E3E5", borderSubtle: "#F1F1F1",
  text: "#1A1A1A", textSec: "#6D7175", textTer: "#8C9196", link: "#2C6ECB",
  green: "#008060", radius: "10px", radiusSm: "6px",
  font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
};

// Badge styles matching order-badges.tsx EXACTLY
const DELIVERY_STYLES = {
  NEW:              { bg: "#DBEAFE", text: "#1E40AF", dot: "#1E40AF", label: "New" },
  WAITING:          { bg: "#FFD79D", text: "#7A4F01", dot: "#7A4F01", label: "Waiting" },
  IMPORTED:         { bg: "#E0E7FF", text: "#3730A3", dot: "#3730A3", label: "Imported" },
  PROCESSED:        { bg: "#FEF3C7", text: "#92400E", dot: "#92400E", label: "Processed" },
  PACKED:           { bg: "#A4E8F2", text: "#0E4F5C", dot: "#0E4F5C", label: "Packed" },
  DISPATCHED:       { bg: "#D1FAE5", text: "#047857", dot: "#047857", label: "Dispatched" },
  IN_TRANSIT:       { bg: "#A4E8F2", text: "#0E4F5C", dot: "#0E4F5C", label: "In Transit" },
  DELIVERED:        { bg: "#AEE9D1", text: "#0D5740", dot: "#0D5740", label: "Delivered" },
  ALLOCATION_ISSUE: { bg: "#FED3D1", text: "#9E2B25", dot: "#9E2B25", label: "Stock Issue" },
  PARTIALLY_PICKED: { bg: "#FFD79D", text: "#7A4F01", dot: "#7A4F01", label: "Partial Pick" },
  CANCELLED:        { bg: "#E4E5E7", text: "#44474A", dot: "#44474A", label: "Cancelled" },
  FAILED:           { bg: "#FED3D1", text: "#9E2B25", dot: "#9E2B25", label: "Failed" },
};

// ═══════════════════════════════════════════
// BADGE — matching od-badge pattern
// ═══════════════════════════════════════════
function Badge({ status }) {
  const s = DELIVERY_STYLES[status] || DELIVERY_STYLES.NEW;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
      whiteSpace: "nowrap", background: s.bg, color: s.text,
      transition: "transform 0.15s ease, box-shadow 0.15s ease", cursor: "default",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

// ═══════════════════════════════════════════
// CARD — matching od-card pattern
// ═══════════════════════════════════════════
function Card({ title, children, style: extraStyle, headerRight }) {
  return (
    <div style={{
      background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.radius,
      marginBottom: 16, overflow: "hidden",
      transition: "box-shadow 0.25s ease, transform 0.25s ease", ...extraStyle,
    }}>
      {title && (
        <div style={{
          fontSize: 14, fontWeight: 600, color: T.text, padding: "16px 20px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          {title}
          {headerRight}
        </div>
      )}
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════
// TIMELINE ICON — matching EventIcon pattern
// ═══════════════════════════════════════════
function TimelineIcon({ type, color }) {
  const base = { width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
  const icons = {
    order:    { bg: "#AEE9D1", svg: <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="#0D5740" strokeWidth="2"><circle cx="10" cy="10" r="3" fill="#0D5740"/></svg> },
    payment:  { bg: "#AEE9D1", svg: <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="#0D5740" strokeWidth="2"><rect x="2" y="4" width="16" height="12" rx="2"/><path d="M2 9h16"/></svg> },
    warehouse:{ bg: "#E0E7FF", svg: <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="#3730A3" strokeWidth="2"><path d="M3 10l7-6 7 6M5 9v7h10V9"/></svg> },
    picking:  { bg: "#FEF3C7", svg: <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="#92400E" strokeWidth="2"><path d="M4 10h12M10 4v12"/></svg> },
    packed:   { bg: "#A4E8F2", svg: <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="#0E4F5C" strokeWidth="2"><rect x="3" y="6" width="14" height="10" rx="1"/><path d="M3 6l7-3 7 3"/></svg> },
    dispatch: { bg: "#D1FAE5", svg: <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="#047857" strokeWidth="2"><path d="M3 13h2l2 3h6l2-3h2M3 8h14v5H3z"/></svg> },
    transit:  { bg: "#A4E8F2", svg: <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="#0E4F5C" strokeWidth="2"><circle cx="10" cy="10" r="6"/><path d="M10 7v3l2 2"/></svg> },
    delivered:{ bg: "#AEE9D1", svg: <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="#0D5740" strokeWidth="2"><polyline points="4 10 8 14 16 6"/></svg> },
    error:    { bg: "#FED3D1", svg: <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="#9E2B25" strokeWidth="2"><line x1="5" y1="5" x2="15" y2="15"/><line x1="15" y1="5" x2="5" y2="15"/></svg> },
    label:    { bg: "#F3F4F6", svg: <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="#6B7280" strokeWidth="1.5"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 10h6M7 7h6M7 13h3"/></svg> },
  };
  const ic = icons[type] || icons.order;
  return <div style={{ ...base, background: color || ic.bg }}>{ic.svg}</div>;
}

// ═══════════════════════════════════════════
// DUMMY DATA
// ═══════════════════════════════════════════
const ORDERS = [
  {
    id: "NL-1089", displayId: "#1089", project: "Laat los (NL)", customer: "Jan de Vries",
    email: "jan.devries@email.nl", phone: "+31 6 1234 5678",
    address: "Keizersgracht 123, 1015CJ Amsterdam, NL",
    items: [{ name: "Laat los wat je kapotmaakt", qty: 1, price: "€24.95" }, { name: "De Hondenbijbel", qty: 2, price: "€29.95" }],
    total: "€84.85", currency: "EUR", payment: "Stripe", paymentStatus: "captured",
    carrier: "PostNL", status: "DISPATCHED",
    tracking: "3SPOST1234567890", trackingUrl: "https://postnl.nl/track/3SPOST1234567890",
    weight: "1.4 kg", dims: "32 × 22 × 6 cm", sscc: "00871234560012345678",
    mystockId: "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
    timeline: [
      { time: "Today at 2:00 PM", type: "dispatch", title: "Dispatched", detail: "Carrier: PostNL · Tracking: 3SPOST1234567890", statusTo: "DISPATCHED" },
      { time: "Today at 12:31 PM", type: "label", title: "Label printed", detail: "PostNL shipping label generated · WMS Event 2" },
      { time: "Today at 12:30 PM", type: "packed", title: "Package assembled", detail: "1 package: 1.4kg, 32×22×6cm · SSCC: 00871234560012345678 · WMS Event 26", statusTo: "PACKED" },
      { time: "Today at 12:05 PM", type: "picking", title: "All items picked", detail: "3/3 items picked from shelf B-14, C-02 · WMS Event 7.3", statusTo: "PROCESSED" },
      { time: "Today at 11:42 AM", type: "picking", title: "Picking started", detail: "Warehouse started picking items · WMS Event 17" },
      { time: "Today at 10:15 AM", type: "warehouse", title: "Sent to warehouse", detail: "POST /V1/orderIncoming/ → 201 · mySTOCK ID: a1b2c3d4... · 3 items, re-fetched", statusTo: "IMPORTED" },
      { time: "Today at 10:00 AM", type: "payment", title: "Payment captured", detail: "Stripe · ID: pi_3QxYz..." },
      { time: "Today at 10:00 AM", type: "order", title: "Order created", detail: "15-min hold started", statusTo: "NEW" },
    ],
  },
  {
    id: "BE-1090", displayId: "#1090", project: "Laat los (BE)", customer: "Marie Claes",
    email: "marie.claes@email.be", phone: "+32 475 123 456",
    address: "Bondgenotenlaan 45, 3000 Leuven, BE",
    items: [{ name: "Laat los wat je kapotmaakt", qty: 1, price: "€24.95" }],
    total: "€24.95", currency: "EUR", payment: "Stripe", paymentStatus: "captured",
    carrier: "bpost", status: "PROCESSED", tracking: null, trackingUrl: null,
    weight: null, dims: null, sscc: null, mystockId: "f9e8d7c6-b5a4-3210-...",
    timeline: [
      { time: "Today at 1:20 PM", type: "picking", title: "All items picked", detail: "1/1 items picked · WMS Event 7.3", statusTo: "PROCESSED" },
      { time: "Today at 11:15 AM", type: "warehouse", title: "Sent to warehouse", detail: "POST → 201", statusTo: "IMPORTED" },
      { time: "Today at 11:00 AM", type: "payment", title: "Payment captured", detail: "Stripe" },
      { time: "Today at 11:00 AM", type: "order", title: "Order created", statusTo: "NEW" },
    ],
  },
  {
    id: "PL-1091", displayId: "#1091", project: "Odpuść (PL)", customer: "Anna Kowalska",
    email: "anna.kowalska@email.pl", phone: "+48 501 234 567",
    address: "ul. Marszałkowska 12/4, 00-590 Warszawa, PL",
    items: [{ name: "Odpuść to, co cię niszczy", qty: 1, price: "89.00 zł" }],
    total: "89.00 zł", currency: "PLN", payment: "Stripe", paymentStatus: "captured",
    carrier: "InPost", status: "DELIVERED",
    tracking: "IP620012345678901234", trackingUrl: "https://inpost.pl/tracking/IP620012345678901234",
    weight: "0.6 kg", dims: "24 × 17 × 3 cm", sscc: null,
    mystockId: "11223344-5566-7788-...",
    timeline: [
      { time: "Yesterday at 2:30 PM", type: "delivered", title: "Delivered", detail: "Odebráno z paczkomatu WAW04A · WMS Event 29", statusTo: "DELIVERED" },
      { time: "Yesterday at 8:15 AM", type: "transit", title: "In transit", detail: "Paczka w sortowni Warszawa · WMS Event 29", statusTo: "IN_TRANSIT" },
      { time: "Feb 23 at 1:00 PM", type: "dispatch", title: "Dispatched", detail: "InPost · IP620012345678901234", statusTo: "DISPATCHED" },
      { time: "Feb 23 at 10:45 AM", type: "packed", title: "Packed", detail: "0.6kg, 24×17×3cm", statusTo: "PACKED" },
      { time: "Feb 23 at 10:30 AM", type: "picking", title: "All items picked", detail: "WMS Event 7.3", statusTo: "PROCESSED" },
      { time: "Feb 23 at 9:15 AM", type: "warehouse", title: "Sent to warehouse", statusTo: "IMPORTED" },
      { time: "Feb 23 at 9:00 AM", type: "order", title: "Order created", statusTo: "NEW" },
    ],
  },
  {
    id: "NL-1085", displayId: "#1085", project: "Laat los (NL)", customer: "Sanne Bakker",
    email: "sanne.bakker@email.nl", phone: "+31 6 8765 4321",
    address: "Prinsengracht 263, 1016GV Amsterdam, NL",
    items: [{ name: "Laat los wat je kapotmaakt", qty: 3, price: "€24.95" }],
    total: "€74.85", currency: "EUR", payment: "Stripe", paymentStatus: "captured",
    carrier: "PostNL", status: "ALLOCATION_ISSUE", tracking: null, trackingUrl: null,
    weight: null, dims: null, sscc: null, mystockId: "aabbccdd-1122-3344-...",
    timeline: [
      { time: "Yesterday at 5:00 PM", type: "error", title: "Stock issue", detail: "Requested: 3× Laat los · Available: 1 · WMS Event 34", statusTo: "ALLOCATION_ISSUE" },
      { time: "Yesterday at 4:15 PM", type: "warehouse", title: "Sent to warehouse", statusTo: "IMPORTED" },
      { time: "Yesterday at 4:00 PM", type: "order", title: "Order created", statusTo: "NEW" },
    ],
  },
  {
    id: "CZ-1092", displayId: "#1092", project: "Psí superživot (CZ)", customer: "Petra Nováková",
    email: "petra.novakova@email.cz", phone: "+420 777 123 456",
    address: "Vinohradská 48, 120 00 Praha 2, CZ",
    items: [{ name: "Psí superživot", qty: 1, price: "499 Kč" }],
    total: "499 Kč", currency: "CZK", payment: "Stripe", paymentStatus: "captured",
    carrier: "Zásilkovna", status: "WAITING", tracking: null, trackingUrl: null,
    weight: null, dims: null, sscc: null, mystockId: null,
    timeline: [
      { time: "Today at 2:50 PM", type: "payment", title: "Payment captured", detail: "Stripe" },
      { time: "Today at 2:50 PM", type: "order", title: "Order created", detail: "15-min hold until 3:05 PM", statusTo: "WAITING" },
    ],
  },
  {
    id: "NL-1088", displayId: "#1088", project: "Hondenbijbel (NL)", customer: "Pieter van Dam",
    email: "pieter@email.nl", phone: "+31 6 2345 6789",
    address: "Damrak 1, 1012LG Amsterdam, NL",
    items: [{ name: "De Hondenbijbel", qty: 1, price: "€29.95" }],
    total: "€29.95", currency: "EUR", payment: "Stripe", paymentStatus: "captured",
    carrier: "PostNL", status: "IN_TRANSIT",
    tracking: "3SPOST9876543210", trackingUrl: "https://postnl.nl/track/3SPOST9876543210",
    weight: "0.8 kg", dims: "26 × 19 × 3 cm", sscc: null,
    mystockId: "55443322-1100-aabb-...",
    timeline: [
      { time: "Today at 10:00 AM", type: "transit", title: "In transit", detail: "Sorteercentrum Den Haag · WMS Event 29", statusTo: "IN_TRANSIT" },
      { time: "Yesterday at 1:00 PM", type: "dispatch", title: "Dispatched", detail: "PostNL · 3SPOST9876543210", statusTo: "DISPATCHED" },
      { time: "Yesterday at 9:45 AM", type: "packed", title: "Packed", detail: "0.8kg", statusTo: "PACKED" },
      { time: "Yesterday at 9:30 AM", type: "picking", title: "Items picked", statusTo: "PROCESSED" },
      { time: "Yesterday at 8:15 AM", type: "warehouse", title: "Sent to warehouse", statusTo: "IMPORTED" },
      { time: "Yesterday at 8:00 AM", type: "order", title: "Order created", statusTo: "NEW" },
    ],
  },
];

const STOCK = [
  { product: "Laat los wat je kapotmaakt", isbn: "978-90-XXXX-01", available: 145, physical: 160, reserved: 15, blocked: 0 },
  { product: "De Hondenbijbel", isbn: "978-90-XXXX-02", available: 0, physical: 2, reserved: 0, blocked: 2 },
  { product: "Odpuść to, co cię niszczy", isbn: "978-83-XXXX-01", available: 500, physical: 500, reserved: 0, blocked: 0 },
  { product: "Psí superživot", isbn: "978-80-XXXX-01", available: 85, physical: 90, reserved: 5, blocked: 0 },
  { product: "Släpp taget om det som förstör dig", isbn: "978-91-XXXX-01", available: 218, physical: 220, reserved: 2, blocked: 0 },
  { product: "Lass los, was dich kaputt macht", isbn: "978-3-XXXX-01", available: 310, physical: 315, reserved: 5, blocked: 0 },
];

const SYNCS = [
  { time: "Today at 2:15 PM", type: "Scheduled", checked: 47, updated: 2, oos: 0, bis: 1, dur: "1.3s", changes: [{ p: "Laat los", f: 148, t: 145 }, { p: "Odpuść", f: 0, t: 500 }] },
  { time: "Today at 2:02 PM", type: "Event #34", checked: 1, updated: 1, oos: 0, bis: 0, dur: "0.3s", changes: [{ p: "Laat los", f: 150, t: 148 }] },
  { time: "Today at 2:00 PM", type: "Scheduled", checked: 47, updated: 0, oos: 0, bis: 0, dur: "1.1s", changes: [] },
  { time: "Today at 1:45 PM", type: "Scheduled", checked: 47, updated: 3, oos: 1, bis: 0, dur: "1.4s", changes: [{ p: "Hondenbijbel", f: 3, t: 0 }, { p: "Psí superživot", f: 89, t: 85 }, { p: "Släpp taget", f: 220, t: 218 }] },
];

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "orders", label: "WMS Orders", icon: "📋" },
  { id: "inventory", label: "Inventory", icon: "📦" },
  { id: "sync-log", label: "Sync Log", icon: "🔄" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

// ═══════════════════════════════════════════
// STAT CARDS — matching stat-cards.tsx
// ═══════════════════════════════════════════
function StatCards() {
  const cardStyle = { background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 20, transition: "box-shadow 0.2s ease" };
  const labelStyle = { fontSize: 13, color: T.textSec, fontWeight: 500, marginBottom: 8 };
  const valueStyle = { fontSize: 28, fontWeight: 600, color: T.text, letterSpacing: "-0.5px" };
  const changeStyle = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, marginTop: 6, padding: "2px 8px", borderRadius: 12 };

  const active = ORDERS.filter(o => !["DELIVERED","CANCELLED"].includes(o.status)).length;
  const issues = ORDERS.filter(o => ["ALLOCATION_ISSUE","FAILED","PARTIALLY_PICKED"].includes(o.status)).length;
  const delivered = ORDERS.filter(o => o.status === "DELIVERED").length;
  const inTransit = ORDERS.filter(o => ["DISPATCHED","IN_TRANSIT"].includes(o.status)).length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
      <div style={cardStyle}>
        <div style={labelStyle}>Active in WMS</div>
        <div style={valueStyle}>{active}</div>
        <span style={{ ...changeStyle, color: T.textSec, background: "#F1F1F1" }}>processing</span>
      </div>
      <div style={cardStyle}>
        <div style={labelStyle}>In Transit</div>
        <div style={valueStyle}>{inTransit}</div>
        <span style={{ ...changeStyle, color: "#0E4F5C", background: "#A4E8F2" }}>on the way</span>
      </div>
      <div style={cardStyle}>
        <div style={{ ...labelStyle, color: issues > 0 ? "#D72C0D" : T.textSec }}>Issues</div>
        <div style={{ ...valueStyle, color: issues > 0 ? "#D72C0D" : T.text }}>{issues}</div>
        <span style={{ ...changeStyle, color: issues > 0 ? "#9E2B25" : T.textSec, background: issues > 0 ? "#FED3D1" : "#F1F1F1" }}>need attention</span>
      </div>
      <div style={cardStyle}>
        <div style={labelStyle}>Delivered (7d)</div>
        <div style={valueStyle}>{delivered}</div>
        <span style={{ ...changeStyle, color: "#0D5740", background: "#AEE9D1" }}>▲ 12% vs last week</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ORDER TABLE — matching orders-table.tsx
// ═══════════════════════════════════════════
function OrderRow({ order, onClick }) {
  const [hover, setHover] = useState(false);
  const flags = { NL: "🇳🇱", BE: "🇧🇪", PL: "🇵🇱", CZ: "🇨🇿", SE: "🇸🇪", DE: "🇩🇪", AT: "🇦🇹", HU: "🇭🇺", LU: "🇱🇺" };
  const cc = order.address.split(", ").pop()?.trim();
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "grid", gridTemplateColumns: "90px 1fr 130px 100px 120px 100px",
        alignItems: "center", padding: "12px 20px",
        borderBottom: `1px solid ${T.borderSubtle}`, cursor: "pointer",
        background: hover ? "#FAFBFC" : "transparent", transition: "background 0.12s",
      }}>
      <span style={{ fontWeight: 600, fontSize: 13, fontFamily: "monospace" }}>{order.id}</span>
      <div>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{flags[cc] || ""} {order.customer}</span>
        <div style={{ fontSize: 11, color: T.textTer, marginTop: 1 }}>{order.items.map(i => `${i.name} ×${i.qty}`).join(", ")}</div>
      </div>
      <span style={{ fontSize: 12, color: T.textSec }}>{order.carrier}</span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{order.total}</span>
      <Badge status={order.status} />
      <span style={{ fontSize: 11, color: T.textTer }}>{order.timeline[order.timeline.length - 1]?.time?.split(" at ")[0]}</span>
    </div>
  );
}

// ═══════════════════════════════════════════
// ORDER DETAIL — full card matching existing design
// ═══════════════════════════════════════════
function OrderDetail({ order, onBack }) {
  return (
    <div style={{ maxWidth: 720 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: T.link, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 16 }}>
        ← Back to orders
      </button>

      {/* Header */}
      <Card title={
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <span style={{ fontSize: 16 }}>Order {order.id}</span>
          <Badge status={order.status} />
          <span style={{ fontSize: 12, color: T.textTer, fontWeight: 400, marginLeft: "auto" }}>{order.project}</span>
        </div>
      }>
        <div style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Customer</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{order.customer}</div>
              <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>{order.email}</div>
              <div style={{ fontSize: 12, color: T.textSec }}>{order.phone}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Shipping Address</div>
              <div style={{ fontSize: 13, color: T.text }}>{order.address}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Items — matching order-detail-items.tsx */}
      <Card title="Items">
        <div style={{ padding: "0 20px" }}>
          {order.items.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i < order.items.length - 1 ? `1px solid ${T.borderSubtle}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 6, background: "#F6F6F7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📚</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: T.textSec }}>Qty: {item.qty}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{item.price}</div>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Total</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{order.total}</span>
          </div>
        </div>
      </Card>

      {/* Tracking — only shown when available */}
      {order.tracking && (
        <Card title={<span>Tracking <Badge status={order.status} /></span>}>
          <div style={{ padding: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "8px 0", fontSize: 13 }}>
              <span style={{ color: T.textSec }}>Carrier</span>
              <span style={{ fontWeight: 500 }}>{order.carrier}</span>
              <span style={{ color: T.textSec }}>Number</span>
              <span style={{ fontFamily: "monospace", fontWeight: 500 }}>{order.tracking}</span>
              <span style={{ color: T.textSec }}>Link</span>
              <a href={order.trackingUrl} target="_blank" rel="noreferrer" style={{ color: T.link, textDecoration: "none", fontSize: 12 }}>Open tracking page →</a>
            </div>
            {order.weight && (
              <div style={{ marginTop: 12, padding: "8px 12px", background: "#F6F6F7", borderRadius: 6, fontSize: 12, color: T.textSec }}>
                Package: {order.weight} · {order.dims}{order.sscc ? ` · SSCC: ${order.sscc}` : ""}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Dextrum / WMS Reference */}
      <Card title="Dextrum · WMS Reference">
        <div style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "6px 0", fontSize: 12 }}>
            <span style={{ color: T.textSec }}>Order Code</span>
            <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{order.id}</span>
            <span style={{ color: T.textSec }}>mySTOCK UUID</span>
            <span style={{ fontFamily: "monospace", color: T.textSec }}>{order.mystockId || "—"}</span>
            <span style={{ color: T.textSec }}>Payment</span>
            <span>{order.payment} · {order.paymentStatus}</span>
            <span style={{ color: T.textSec }}>Carrier</span>
            <span>{order.carrier}</span>
          </div>
        </div>
      </Card>

      {/* Timeline — matching order-detail-timeline.tsx */}
      <Card title="Warehouse History">
        <div style={{ padding: "16px 20px" }}>
          {order.timeline.map((ev, i) => (
            <div key={i} style={{ display: "flex", gap: 12, paddingBottom: i < order.timeline.length - 1 ? 12 : 0, position: "relative" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                <TimelineIcon type={ev.type} />
                {i < order.timeline.length - 1 && (
                  <div style={{ width: 2, flex: 1, background: T.border, marginTop: 4, minHeight: 8 }} />
                )}
              </div>
              <div style={{ flex: 1, paddingTop: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{ev.title}</span>
                  {ev.statusTo && <Badge status={ev.statusTo} />}
                </div>
                {ev.detail && <div style={{ fontSize: 12, color: T.textSec, marginTop: 2, whiteSpace: "pre-line" }}>{ev.detail}</div>}
                <div style={{ fontSize: 12, color: T.textTer, marginTop: 2 }}>{ev.time}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════
// CUSTOMER CARD — Dextrum info section
// ═══════════════════════════════════════════
function CustomerCard({ onSelectOrder }) {
  const customer = { name: "Jan de Vries", email: "jan.devries@email.nl", phone: "+31 6 1234 5678", address: "Keizersgracht 123, 1015CJ Amsterdam, NL", ordersCount: 12, totalSpent: "€847.40" };
  const custOrders = ORDERS.filter(o => o.customer === customer.name);
  return (
    <div style={{ maxWidth: 720 }}>
      {/* Customer header */}
      <Card title={<span>Customer · {customer.name}</span>}>
        <div style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Contact</div>
              <div style={{ fontSize: 13 }}>{customer.email}</div>
              <div style={{ fontSize: 13, color: T.textSec }}>{customer.phone}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Address</div>
              <div style={{ fontSize: 13 }}>{customer.address}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Summary</div>
              <div style={{ fontSize: 13 }}>{customer.ordersCount} orders · {customer.totalSpent}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Dextrum section on customer card */}
      <Card title={<span style={{ display: "flex", alignItems: "center", gap: 8 }}>Dextrum · Warehouse Info <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#E0E7FF", color: "#3730A3", fontWeight: 600 }}>WMS</span></span>}>
        <div style={{ padding: 20 }}>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Total WMS orders", value: "12", color: T.text },
              { label: "Active in WMS", value: "1", color: "#3730A3" },
              { label: "Delivered", value: "10", color: "#0D5740" },
              { label: "Issues", value: "1", color: "#9E2B25" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center", padding: "8px 0" }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: T.textTer }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Last shipment */}
          <div style={{ padding: "10px 14px", background: "#F6F6F7", borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.textSec, marginBottom: 4 }}>Last shipment</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 500 }}>NL-1089</span>
                <span style={{ fontSize: 12, color: T.textSec, marginLeft: 8 }}>PostNL · 3SPOST1234567890</span>
              </div>
              <Badge status="DISPATCHED" />
            </div>
          </div>

          {/* Recent WMS orders */}
          <div style={{ fontSize: 12, fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Recent WMS Orders</div>
          {custOrders.map(o => (
            <div key={o.id} onClick={() => onSelectOrder(o)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.borderSubtle}`, cursor: "pointer" }}>
              <div>
                <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600 }}>{o.id}</span>
                <span style={{ fontSize: 12, color: T.textSec, marginLeft: 8 }}>{o.items.map(i => `${i.name} ×${i.qty}`).join(", ")}</span>
              </div>
              <Badge status={o.status} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════
// INVENTORY VIEW
// ═══════════════════════════════════════════
function InventoryView() {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Inventory</h2>
          <div style={{ fontSize: 12, color: T.textTer, marginTop: 2 }}>Last sync: Today at 2:15 PM · 47 products · 2 updated</div>
        </div>
        <button style={{ padding: "6px 14px", borderRadius: T.radiusSm, fontSize: 13, fontWeight: 500, cursor: "pointer", background: T.text, color: "#fff", border: "none" }}>Sync Now</button>
      </div>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 80px 80px 80px 80px", padding: "10px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 11, color: T.textTer, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          <span>Product</span><span>ISBN</span><span>Available</span><span>Physical</span><span>Reserved</span><span>Blocked</span>
        </div>
        {STOCK.map((s, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 110px 80px 80px 80px 80px", padding: "12px 20px", borderBottom: `1px solid ${T.borderSubtle}`, fontSize: 13, background: s.available === 0 ? "#FEF2F2" : "transparent" }}>
            <div>
              <div style={{ fontWeight: 500 }}>{s.product}</div>
              {s.available === 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: "#FED3D1", color: "#9E2B25", marginTop: 2 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#9E2B25" }}/>OUT OF STOCK</span>}
              {s.available > 0 && s.available <= 10 && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: "#FFD79D", color: "#7A4F01", marginTop: 2 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#7A4F01" }}/>LOW STOCK</span>}
            </div>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: T.textSec }}>{s.isbn}</span>
            <span style={{ fontWeight: 700, color: s.available === 0 ? "#9E2B25" : s.available <= 10 ? "#7A4F01" : "#0D5740" }}>{s.available}</span>
            <span style={{ color: T.textSec }}>{s.physical}</span>
            <span style={{ color: T.textSec }}>{s.reserved}</span>
            <span style={{ color: s.blocked > 0 ? "#9E2B25" : T.textSec }}>{s.blocked}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════
// SYNC LOG VIEW
// ═══════════════════════════════════════════
function SyncLogView() {
  const [exp, setExp] = useState(null);
  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>Inventory Sync Log</h2>
      {SYNCS.map((log, i) => (
        <Card key={i} style={{ marginBottom: 8 }}>
          <div onClick={() => setExp(exp === i ? null : i)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, fontFamily: "monospace", color: T.textTer }}>{log.time}</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, fontWeight: 600, background: log.type.includes("Event") ? "#FED3D1" : "#E0E7FF", color: log.type.includes("Event") ? "#9E2B25" : "#3730A3" }}>{log.type}</span>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: T.textSec }}>
              <span>Checked: <strong>{log.checked}</strong></span>
              <span style={{ color: log.updated > 0 ? "#7A4F01" : T.textTer }}>Updated: <strong>{log.updated}</strong></span>
              {log.oos > 0 && <span style={{ color: "#9E2B25" }}>OOS: <strong>{log.oos}</strong></span>}
              {log.bis > 0 && <span style={{ color: "#0D5740" }}>Back: <strong>{log.bis}</strong></span>}
              <span style={{ color: T.textTer }}>{log.dur}</span>
              <span style={{ color: T.textTer }}>{exp === i ? "▲" : "▼"}</span>
            </div>
          </div>
          {exp === i && log.changes.length > 0 && (
            <div style={{ padding: "0 20px 12px", borderTop: `1px solid ${T.borderSubtle}` }}>
              {log.changes.map((c, j) => (
                <div key={j} style={{ fontSize: 12, padding: "6px 0", display: "flex", justifyContent: "space-between", borderBottom: j < log.changes.length - 1 ? `1px solid ${T.borderSubtle}` : "none" }}>
                  <span>{c.p}</span>
                  <span>
                    <span style={{ color: T.textTer }}>{c.f}</span> → <strong style={{ color: c.t === 0 ? "#9E2B25" : c.t > c.f ? "#0D5740" : "#7A4F01" }}>{c.t}</strong>
                    <span style={{ color: T.textTer, marginLeft: 4 }}>({c.t - c.f > 0 ? "+" : ""}{c.t - c.f})</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          {exp === i && log.changes.length === 0 && (
            <div style={{ padding: "8px 20px 12px", fontSize: 12, color: T.textTer, borderTop: `1px solid ${T.borderSubtle}` }}>No changes detected</div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════
// SETTINGS VIEW — Dextrum config panel
// ═══════════════════════════════════════════
function SettingsView() {
  const fieldRow = { display: "grid", gridTemplateColumns: "160px 1fr", gap: "8px 12px", fontSize: 13, alignItems: "center" };
  const fieldLabel = { color: T.textSec, fontSize: 13 };
  const fieldValue = { fontFamily: "monospace", fontSize: 12, background: "#F6F6F7", padding: "6px 10px", borderRadius: 6, border: `1px solid ${T.border}` };

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>Dextrum Settings</h2>
      <Card title="API Connection">
        <div style={{ padding: 20 }}>
          <div style={fieldRow}>
            <span style={fieldLabel}>API URL</span><div style={fieldValue}>https://demo.mystock.cz</div>
            <span style={fieldLabel}>Username</span><div style={fieldValue}>api_everchapter</div>
            <span style={fieldLabel}>Password</span><div style={fieldValue}>••••••••••</div>
            <span style={fieldLabel}>Warehouse Code</span><div style={fieldValue}>MAIN</div>
          </div>
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <button style={{ padding: "6px 14px", borderRadius: T.radiusSm, fontSize: 13, fontWeight: 500, cursor: "pointer", background: T.text, color: "#fff", border: "none" }}>Test Connection</button>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: "#AEE9D1", color: "#0D5740" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0D5740" }}/>Connected</span>
          </div>
        </div>
      </Card>

      <Card title="Partner & Operating Units">
        <div style={{ padding: 20 }}>
          <div style={fieldRow}>
            <span style={fieldLabel}>Partner ID</span><div style={fieldValue}>a1b2c3d4-e5f6-7890-abcd-1234567890ab</div>
            <span style={fieldLabel}>Partner Code</span><div style={fieldValue}>EVERCHAPTER</div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>Project Mapping</div>
          {[
            { p: "laat-los-nl", u: "uuid-nl-op-unit", c: "PostNL", cod: false },
            { p: "laat-los-be", u: "uuid-be-op-unit", c: "bpost", cod: false },
            { p: "odpusc-pl", u: "uuid-pl-op-unit", c: "InPost", cod: true },
            { p: "psi-superzivot", u: "uuid-cz-op-unit", c: "Zásilkovna", cod: true },
          ].map(pr => (
            <div key={pr.p} style={{ display: "grid", gridTemplateColumns: "140px 1fr 90px 60px", fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${T.borderSubtle}`, alignItems: "center" }}>
              <span style={{ fontWeight: 500 }}>{pr.p}</span>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: T.textSec }}>{pr.u}</span>
              <span style={{ color: T.textSec }}>{pr.c}</span>
              {pr.cod ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#7A4F01", background: "#FFD79D", padding: "2px 6px", borderRadius: 10 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "#7A4F01" }}/>COD</span>
              ) : <span style={{ fontSize: 11, color: T.textTer }}>—</span>}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Webhook">
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: T.textSec, marginBottom: 4 }}>Give this URL to mySTOCK as your event endpoint:</div>
          <div style={{ fontFamily: "monospace", fontSize: 12, background: "#E0E7FF", padding: "10px 14px", borderRadius: 6, color: "#3730A3", fontWeight: 500 }}>
            https://api.yourstore.com/webhooks/mystock
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 16, fontSize: 12, color: T.textSec }}>
            <span>Events received: <strong>1,247</strong></span>
            <span>Processed: <strong style={{ color: "#0D5740" }}>1,245</strong></span>
            <span>Errors: <strong style={{ color: "#9E2B25" }}>2</strong></span>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════
function DashboardView({ onSelect }) {
  const statuses = ["WAITING","IMPORTED","PROCESSED","PACKED","DISPATCHED","IN_TRANSIT","DELIVERED","ALLOCATION_ISSUE"];
  const counts = {};
  ORDERS.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Dextrum Dashboard</h2>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#0D5740" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0D5740" }}/>mySTOCK connected</span>
      </div>
      <StatCards />
      {/* Status breakdown */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {statuses.filter(s => counts[s]).map(s => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, background: DELIVERY_STYLES[s].bg, border: `1px solid ${DELIVERY_STYLES[s].bg}` }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: DELIVERY_STYLES[s].text }}>{counts[s]}</span>
            <span style={{ fontSize: 11, color: DELIVERY_STYLES[s].text, fontWeight: 500 }}>{DELIVERY_STYLES[s].label}</span>
          </div>
        ))}
      </div>
      {/* Orders table */}
      <Card title="Recent WMS Orders" headerRight={<span style={{ fontSize: 12, color: T.textTer, fontWeight: 400 }}>{ORDERS.length} orders</span>}>
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 130px 100px 120px 100px", padding: "10px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 11, color: T.textTer, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          <span>Code</span><span>Customer</span><span>Carrier</span><span>Total</span><span>Status</span><span>Date</span>
        </div>
        {ORDERS.map(o => <OrderRow key={o.id} order={o} onClick={() => onSelect(o)} />)}
      </Card>
    </div>
  );
}

function OrdersView({ onSelect }) {
  const [filter, setFilter] = useState("ALL");
  const filtered = filter === "ALL" ? ORDERS : ORDERS.filter(o => o.status === filter);
  return (
    <div>
      <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600 }}>WMS Orders</h2>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {["ALL", ...Object.keys(DELIVERY_STYLES)].map(s => {
          const active = filter === s;
          const st = DELIVERY_STYLES[s];
          return (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: "4px 10px", borderRadius: 12, fontSize: 11, cursor: "pointer", fontWeight: 600, transition: "all 0.12s",
              border: active ? "none" : `1px solid ${T.border}`,
              background: active ? (s === "ALL" ? T.text : st?.bg) : T.bg,
              color: active ? (s === "ALL" ? "#fff" : st?.text) : T.textSec,
            }}>{s === "ALL" ? "All" : st?.label}</button>
          );
        })}
      </div>
      <Card>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: T.textTer, fontSize: 13 }}>No orders with this status</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 130px 100px 120px 100px", padding: "10px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 11, color: T.textTer, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              <span>Code</span><span>Customer</span><span>Carrier</span><span>Total</span><span>Status</span><span>Date</span>
            </div>
            {filtered.map(o => <OrderRow key={o.id} order={o} onClick={() => onSelect(o)} />)}
          </>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
export default function DextrumPreview() {
  const [page, setPage] = useState("dashboard");
  const [order, setOrder] = useState(null);

  const handleSelect = (o) => { setOrder(o); setPage("order-detail"); };
  const handleBack = () => { setOrder(null); setPage("orders"); };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: T.font, background: T.bgPage, color: T.text }}>
      {/* Sidebar — Medusa admin style */}
      <div style={{ width: 220, background: T.bg, borderRight: `1px solid ${T.border}`, padding: "20px 0", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "0 16px 20px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, letterSpacing: -0.3 }}>Dextrum</div>
          <div style={{ fontSize: 11, color: T.textTer, marginTop: 2 }}>Warehouse Management</div>
        </div>
        <div style={{ padding: "8px 0", flex: 1 }}>
          {NAV.map(n => {
            const active = page === n.id || (page === "order-detail" && n.id === "orders") || (page === "customer" && n.id === "orders");
            return (
              <div key={n.id} onClick={() => { setPage(n.id); setOrder(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 16px",
                  cursor: "pointer", fontSize: 13, fontWeight: 500,
                  background: active ? "#F6F6F7" : "transparent",
                  color: active ? T.text : T.textSec,
                  borderLeft: active ? `3px solid ${T.green}` : "3px solid transparent",
                  transition: "all 0.12s",
                }}>
                <span style={{ fontSize: 14 }}>{n.icon}</span> {n.label}
              </div>
            );
          })}
          {/* Customer card link */}
          <div style={{ padding: "16px 16px 0", borderTop: `1px solid ${T.border}`, marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Demo</div>
            <div onClick={() => { setPage("customer"); setOrder(null); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", cursor: "pointer", fontSize: 13, fontWeight: 500, color: page === "customer" ? T.text : T.textSec }}>
              <span style={{ fontSize: 14 }}>👤</span> Customer Card
            </div>
          </div>
        </div>
        {/* Connection status */}
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}`, fontSize: 11 }}>
          <div style={{ color: T.textTer }}>mySTOCK API</div>
          <div style={{ color: "#0D5740", fontWeight: 500, marginTop: 2 }}>● Connected</div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: 24, overflowY: "auto", maxWidth: "calc(100vw - 220px)" }}>
        {page === "dashboard" && <DashboardView onSelect={handleSelect} />}
        {page === "orders" && <OrdersView onSelect={handleSelect} />}
        {page === "order-detail" && order && <OrderDetail order={order} onBack={handleBack} />}
        {page === "customer" && <CustomerCard onSelectOrder={handleSelect} />}
        {page === "inventory" && <InventoryView />}
        {page === "sync-log" && <SyncLogView />}
        {page === "settings" && <SettingsView />}
      </div>
    </div>
  );
}
