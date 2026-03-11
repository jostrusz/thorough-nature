# Claude Code Prompt — Admin Orders Redesign 2026

## Úkol

Redesignuj orders dashboard a order detail stránku v MedusaJS admin panelu podle HTML náhledů. Zachovej 100% existující funkčnosti (hooks, akce, modaly, bulk actions). Mění se POUZE vizuální vrstva (inline styly a JSX struktura).

## Design reference soubory

Přečti si tyto dva HTML náhledy, které definují cílový design:

1. `orders-dashboard-2026.html` — orders list s tabulkou a filtry
2. `order-detail-2026.html` — detail objednávky po rozkliknutí

## Design system — CSS proměnné (používej všude konzistentně)

```
--bg: #F5F6FA                    /* pozadí stránky */
--bg-card: #FFFFFF               /* pozadí karet */
--bg-hover: #F8F9FC              /* hover řádku tabulky */
--border: rgba(0,0,0,0.07)       /* okraje karet */
--border-active: rgba(0,0,0,0.14) /* hover okraj */
--text-primary: #1A1D2E          /* hlavní text */
--text-secondary: #6B7185        /* sekundární text */
--text-muted: #9CA3B8            /* tlumený text */
--accent: #6C5CE7                /* akcentová fialová */
--accent-bg: rgba(108,92,231,0.08)
--green: #00B37A                 /* paid, fulfilled, ok */
--green-bg: rgba(0,179,122,0.08)
--red: #E74C3C                   /* failed, refunded */
--red-bg: rgba(231,76,60,0.07)
--yellow: #D4A017                /* pending, warning */
--yellow-bg: rgba(212,160,23,0.08)
--blue: #3B82F6                  /* shipped, authorized, info */
--blue-bg: rgba(59,130,246,0.07)
--orange: #E67E22                /* unfulfilled */
--orange-bg: rgba(230,126,34,0.07)
--shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.03)
--radius: 14px
--radius-sm: 10px
--radius-xs: 6px
```

## Platební ikony — SVG z CDN

Místo barevných avatarů zákazníků zobrazuj ikonu platební metody vlevo od jména zákazníka:

```
iDEAL:      https://raw.githubusercontent.com/datatrans/payment-logos/master/assets/apm/ideal.svg
Klarna:     https://raw.githubusercontent.com/datatrans/payment-logos/master/assets/apm/klarna.svg
Bancontact: https://raw.githubusercontent.com/datatrans/payment-logos/master/assets/apm/bancontact.svg
PayPal:     https://raw.githubusercontent.com/datatrans/payment-logos/master/assets/apm/paypal.svg
Google Pay: https://raw.githubusercontent.com/datatrans/payment-logos/master/assets/wallets/google-pay.svg
Apple Pay:  https://raw.githubusercontent.com/datatrans/payment-logos/master/assets/wallets/apple-pay.svg
Visa:       https://raw.githubusercontent.com/datatrans/payment-logos/master/assets/cards/visa.svg
Mastercard: https://raw.githubusercontent.com/datatrans/payment-logos/master/assets/cards/mastercard.svg
Comgate:    žádná ikona — zobraz šedý čtvereček s písmenem "C"
Przelewy24: žádná ikona — zobraz červený čtvereček s "P24"
```

Mapování payment_provider_id → ikona:
- `pp_mollie_*` → závisí na payment method v metadatech (ideal/bancontact/creditcard/etc.)
- `pp_klarna_*` → klarna.svg
- `pp_paypal_*` → paypal.svg
- `pp_comgate_*` → šedý "C"
- `pp_przelewy24_*` → červený "P24"
- fallback → šedý "?" čtvereček

---

## FÁZE 1 — Orders List Page (dashboard)

### Soubory k úpravě:

1. **`backend/src/admin/routes/custom-orders/page.tsx`** (419 řádků)
2. **`backend/src/admin/components/orders/orders-table.tsx`** (467 řádků)
3. **`backend/src/admin/components/orders/order-tabs.tsx`** (94 řádků)
4. **`backend/src/admin/components/orders/stat-cards.tsx`** (129 řádků)
5. **`backend/src/admin/components/orders/order-badges.tsx`** (173 řádků)
6. **`backend/src/admin/components/orders/bulk-actions-bar.tsx`** (72 řádků)

### 1.1 — page.tsx redesign

Aktuální inline styly přepiš na nový design system:

```tsx
const dashboardStyle: React.CSSProperties = {
  maxWidth: "1400px",
  margin: "0 auto",
  padding: "32px 48px",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  background: "#F5F6FA",
  minHeight: "100vh",
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "24px",
}

const h1Style: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  letterSpacing: "-0.5px",
  color: "#1A1D2E",
}
```

Header: vlevo `<h1>Orders</h1>` + badge s celkovým počtem (fialová `--accent-bg`), vpravo tlačítka Export + Create Order.

Tlačítka:
```tsx
const btnOutline: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 16px",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid rgba(0,0,0,0.07)",
  background: "#FFFFFF",
  color: "#6B7185",
  transition: "all 0.15s",
}

const btnPrimary: React.CSSProperties = {
  ...btnOutline,
  background: "#6C5CE7",
  color: "#fff",
  border: "1px solid #6C5CE7",
  boxShadow: "0 1px 4px rgba(108,92,231,0.25)",
}
```

Karta tabulky:
```tsx
const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.07)",
  borderRadius: "14px",
  overflow: "hidden",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.03)",
}
```

Pagination:
```tsx
const pageBtnActive: React.CSSProperties = {
  ...pageBtn,
  background: "#6C5CE7",
  color: "#fff",
  borderColor: "#6C5CE7",
  fontWeight: 600,
}
```

### 1.2 — orders-table.tsx redesign

**DŮLEŽITÉ:** Sloupec Gateway ODSTRAŇ z tabulky. Místo avataru zákazníka (barevný čtvereček s iniciálami) zobrazuj IKONU PLATEBNÍ METODY.

Sloupce v tabulce (v tomto pořadí):
1. Checkbox
2. Order (číslo objednávky, fialová `--accent` barva, kliknutelné)
3. Customer (ikona platební metody 32×32px + jméno + email)
4. Payment (badge: Paid/Pending/Failed/Refunded/Authorized)
5. Fulfillment (badge: Fulfilled/Unfulfilled/Shipped/Delivered/Returned)
6. Items (počet položek, šedý text)
7. Total (cena, bold, tabular-nums)
8. Country (vlajka emoji + kód)
9. Date (šedý text, formát "28 Feb, 09:14")
10. Row actions (tři tečky, viditelné jen na hover)

Customer cell JSX:
```tsx
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
  {/* Gateway icon místo avataru */}
  <div style={{
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    background: "#f0f1f5",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  }}>
    <img
      src={getPaymentMethodIcon(order)}
      alt={getPaymentMethodName(order)}
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
    />
  </div>
  <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ fontWeight: 500, fontSize: "13px" }}>
      {order.shipping_address?.first_name} {order.shipping_address?.last_name}
    </div>
    <div style={{ fontSize: "11px", color: "#9CA3B8", marginTop: "1px" }}>
      {order.email}
    </div>
  </div>
</div>
```

Přidej helper funkci do orders-table.tsx:
```tsx
function getPaymentMethodIcon(order: any): string {
  const payments = order.payment_collections?.flatMap((pc: any) => pc.payments || []) || []
  const payment = payments[0]
  const providerId = payment?.provider_id || ""
  const method = order.metadata?.payment_method || payment?.data?.method || ""

  const BASE = "https://raw.githubusercontent.com/datatrans/payment-logos/master/assets"

  if (providerId.includes("klarna")) return `${BASE}/apm/klarna.svg`
  if (providerId.includes("paypal")) return `${BASE}/apm/paypal.svg`

  // Mollie — rozliš podle metody
  if (providerId.includes("mollie")) {
    if (method === "ideal") return `${BASE}/apm/ideal.svg`
    if (method === "bancontact") return `${BASE}/apm/bancontact.svg`
    if (method === "creditcard") return `${BASE}/cards/visa.svg`
    if (method === "applepay") return `${BASE}/wallets/apple-pay.svg`
    if (method === "googlepay") return `${BASE}/wallets/google-pay.svg`
    return `${BASE}/apm/ideal.svg` // fallback pro Mollie
  }

  // Ostatní nemají SVG ikonu — vrátí prázdný string, komponenta zobrazí fallback
  return ""
}

function getPaymentMethodFallback(order: any): { letter: string; bg: string } {
  const payments = order.payment_collections?.flatMap((pc: any) => pc.payments || []) || []
  const providerId = payments[0]?.provider_id || ""

  if (providerId.includes("comgate")) return { letter: "C", bg: "#444" }
  if (providerId.includes("przelewy") || providerId.includes("p24")) return { letter: "P24", bg: "#D40E2F" }
  return { letter: "?", bg: "#9CA3B8" }
}
```

Tabulka header styly:
```tsx
const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "11px 20px",
  fontSize: "11px",
  fontWeight: 600,
  color: "#9CA3B8",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  borderBottom: "1px solid rgba(0,0,0,0.07)",
  background: "#F5F6FA",
  userSelect: "none",
  cursor: "pointer",
  whiteSpace: "nowrap",
}

const tdStyle: React.CSSProperties = {
  padding: "14px 20px",
  fontSize: "13px",
  borderBottom: "1px solid rgba(0,0,0,0.04)",
  verticalAlign: "middle",
}
```

Badge styly — přepiš v order-badges.tsx:
```tsx
// Paid
{ background: "rgba(0,179,122,0.08)", color: "#00B37A" }
// Failed
{ background: "rgba(231,76,60,0.07)", color: "#E74C3C" }
// Pending
{ background: "rgba(212,160,23,0.08)", color: "#D4A017" }
// Refunded
{ background: "rgba(0,0,0,0.04)", color: "#6B7185" }
// Authorized
{ background: "rgba(59,130,246,0.07)", color: "#3B82F6" }
// Unfulfilled
{ background: "rgba(230,126,34,0.07)", color: "#E67E22" }
// Fulfilled/Delivered
{ background: "rgba(0,179,122,0.08)", color: "#00B37A" }
// Shipped
{ background: "rgba(59,130,246,0.07)", color: "#3B82F6" }
// Returned
{ background: "rgba(0,0,0,0.04)", color: "#6B7185" }
```

Každý badge má `::before` puntík (6px, border-radius: 50%, barva = text barva).

### 1.3 — order-tabs.tsx redesign

Filter tabs — pozadí skupiny `rgba(0,0,0,0.03)`, border-radius 8px, padding 3px. Aktivní tab: bílé pozadí, shadow, fontWeight 600. Každý tab má count badge (fialový pro aktivní, šedý pro neaktivní).

### 1.4 — stat-cards.tsx redesign

Stat karty v bento gridu (4 sloupce). Každá karta:
- Bílé pozadí, border, border-radius 14px, shadow
- Nahoře 2px gradient linka (zelená pro positive, červená pro negative, žlutá pro warning)
- Trend badge vpravo nahoře (zelená ▲ nebo červená ▼)
- Velká hodnota (28px, fontWeight 700)
- Popisek (13px, text-secondary)

---

## FÁZE 2 — Order Detail Page

### Soubory k úpravě:

1. **`backend/src/admin/routes/custom-orders/[id]/page.tsx`** (619 řádků)
2. **`backend/src/admin/components/orders/order-detail-header.tsx`** (216 řádků)
3. **`backend/src/admin/components/orders/order-detail-items.tsx`** (209 řádků)
4. **`backend/src/admin/components/orders/order-detail-payment.tsx`** (496 řádků)
5. **`backend/src/admin/components/orders/order-detail-customer.tsx`** (707 řádků)
6. **`backend/src/admin/components/orders/order-detail-metadata.tsx`** (336 řádků)
7. **`backend/src/admin/components/orders/order-detail-timeline.tsx`** (644 řádků)
8. **`backend/src/admin/components/orders/order-fulfillment-card.tsx`** (262 řádků)
9. **`backend/src/admin/components/orders/order-payment-activity.tsx`** (248 řádků)
10. **`backend/src/admin/components/orders/order-notes-card.tsx`** (163 řádků)

### 2.1 — page.tsx (detail) redesign

Page layout: max-width 1100px, centrované.

**NOVÝ PRVEK — Health Bar** (přidej mezi header a dvousloupcový layout):

Health Bar je řada 5 boxů, která ukazuje na první pohled stav objednávky:

```tsx
const HealthBar = ({ order }: { order: any }) => {
  const payments = order.payment_collections?.flatMap((pc: any) => pc.payments || []) || []
  const payment = payments[0]
  const paymentStatus = order.payment_status || payment?.status || "pending"
  const fulfillmentStatus = order.fulfillment_status || "not_fulfilled"
  const wmsStatus = order.metadata?.dextrum_status
  const hasInvoice = order.metadata?.fakturoid_invoice_id || order.metadata?.quickbooks_invoice_id
  const paymentMethod = order.metadata?.payment_method || payment?.data?.method || ""
  const paymentGateway = payment?.provider_id?.includes("mollie") ? "Mollie" :
    payment?.provider_id?.includes("klarna") ? "Klarna" :
    payment?.provider_id?.includes("paypal") ? "PayPal" :
    payment?.provider_id?.includes("comgate") ? "Comgate" : ""

  const items = [
    {
      label: "Payment",
      status: paymentStatus === "captured" || paymentStatus === "paid" ? "ok" :
              paymentStatus === "pending" || paymentStatus === "authorized" ? "warn" : "bad",
      value: paymentStatus === "captured" || paymentStatus === "paid"
        ? `✓ Paid · ${paymentMethod || paymentGateway}`
        : paymentStatus === "authorized" ? `● Authorized`
        : paymentStatus === "pending" ? `● Pending`
        : `✕ ${paymentStatus}`,
    },
    {
      label: "Fulfillment",
      status: fulfillmentStatus === "fulfilled" || fulfillmentStatus === "delivered" ? "ok" :
              fulfillmentStatus === "shipped" ? "info" : "warn",
      value: fulfillmentStatus === "fulfilled" ? "✓ Fulfilled" :
             fulfillmentStatus === "shipped" ? "↻ Shipped" :
             fulfillmentStatus === "delivered" ? "✓ Delivered" :
             "● Not shipped",
    },
    {
      label: "WMS",
      status: wmsStatus === "DELIVERED" ? "ok" :
              wmsStatus === "DISPATCHED" || wmsStatus === "IN_TRANSIT" ? "info" :
              wmsStatus ? "info" : "neutral",
      value: wmsStatus ? (wmsStatus === "DELIVERED" ? "✓ Delivered" : `↻ ${wmsStatus}`) : "— Not sent",
    },
    {
      label: "Invoice",
      status: hasInvoice ? "ok" : "neutral",
      value: hasInvoice
        ? `✓ ${order.metadata?.fakturoid_invoice_id ? "Fakturoid" : "QuickBooks"}`
        : "— No invoice",
    },
    {
      label: "Customer",
      status: "ok",
      value: `✓ ${order.email ? "Verified" : "Unknown"}`,
    },
  ]

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "24px" }}>
      {items.map((item, i) => (
        <div key={i} style={{
          background: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: "10px",
          padding: "14px 16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.03)",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "2px",
            background: item.status === "ok" ? "#00B37A" :
                        item.status === "warn" ? "#D4A017" :
                        item.status === "bad" ? "#E74C3C" :
                        item.status === "info" ? "#3B82F6" : "#9CA3B8",
          }} />
          <div style={{ fontSize: "11px", color: "#9CA3B8", textTransform: "uppercase", letterSpacing: "0.4px", fontWeight: 600, marginBottom: "6px" }}>
            {item.label}
          </div>
          <div style={{ fontSize: "14px", fontWeight: 600 }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  )
}
```

Detail page layout:
```tsx
const pageStyle: React.CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto",
  padding: "32px 48px",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
}

// Dvousloupcový grid
<div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px", alignItems: "start" }}>
```

### 2.2 — Card styl (pro všechny karty na detail stránce)

Přepiš card styl ve VŠECH komponentách:
```tsx
const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.07)",
  borderRadius: "14px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.03)",
  marginBottom: "16px",
  overflow: "hidden",
}

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px",
  borderBottom: "1px solid rgba(0,0,0,0.07)",
  fontSize: "14px",
  fontWeight: 600,
  color: "#1A1D2E",
}
```

### 2.3 — Payment card (order-detail-payment.tsx)

Přidej velký blok s ikonou platební metody nahoře:
```tsx
<div style={{
  display: "flex",
  alignItems: "center",
  gap: "12px",
  marginBottom: "16px",
  padding: "12px 14px",
  background: "#F5F6FA",
  borderRadius: "10px",
}}>
  <div style={{
    width: "36px", height: "36px", borderRadius: "8px",
    background: "#f0f1f5", padding: "5px",
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    <img src={getPaymentMethodIcon(order)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
  </div>
  <div>
    <div style={{ fontSize: "14px", fontWeight: 600 }}>{paymentMethodName} via {gatewayName}</div>
    <div style={{ fontSize: "12px", color: "#9CA3B8" }}>{paymentId} · {capturedDate}</div>
  </div>
  <div style={{ marginLeft: "auto", fontSize: "16px", fontWeight: 700 }}>{formattedTotal}</div>
</div>
```

### 2.4 — Timeline (order-detail-timeline.tsx)

Timeline tečky — barvy dle design systému:
- Zelená (green-bg + green): payment captured, fulfilled, delivered
- Modrá (blue-bg + blue): shipped, WMS events
- Červená (red-bg + red): failed, refunded, canceled
- Šedá (rgba(0,0,0,0.04) + text-muted): order created, comments
- Fialová (accent-bg + accent): invoice created, integration events

Čára mezi tečkami: 1px solid rgba(0,0,0,0.07), absolutně pozicovaná.

---

## FÁZE 3 — Společný styl soubor

Vytvoř nový soubor `backend/src/admin/components/orders/design-tokens.ts`:

```tsx
// Design tokens 2026
export const colors = {
  bg: "#F5F6FA",
  bgCard: "#FFFFFF",
  bgHover: "#F8F9FC",
  border: "rgba(0,0,0,0.07)",
  borderActive: "rgba(0,0,0,0.14)",
  text: "#1A1D2E",
  textSec: "#6B7185",
  textMuted: "#9CA3B8",
  accent: "#6C5CE7",
  accentBg: "rgba(108,92,231,0.08)",
  green: "#00B37A",
  greenBg: "rgba(0,179,122,0.08)",
  red: "#E74C3C",
  redBg: "rgba(231,76,60,0.07)",
  yellow: "#D4A017",
  yellowBg: "rgba(212,160,23,0.08)",
  blue: "#3B82F6",
  blueBg: "rgba(59,130,246,0.07)",
  orange: "#E67E22",
  orangeBg: "rgba(230,126,34,0.07)",
} as const

export const shadows = {
  card: "0 1px 3px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.03)",
  sm: "0 1px 3px rgba(0,0,0,0.04)",
  btn: "0 1px 4px rgba(108,92,231,0.25)",
} as const

export const radii = {
  card: "14px",
  sm: "10px",
  xs: "6px",
} as const

export const cardStyle: React.CSSProperties = {
  background: colors.bgCard,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.card,
  boxShadow: shadows.card,
  marginBottom: "16px",
  overflow: "hidden",
}

export const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px",
  borderBottom: `1px solid ${colors.border}`,
  fontSize: "14px",
  fontWeight: 600,
  color: colors.text,
}

// Payment icon URL helper
const ICON_BASE = "https://raw.githubusercontent.com/datatrans/payment-logos/master/assets"

export function getPaymentIconUrl(order: any): string {
  const payments = order.payment_collections?.flatMap((pc: any) => pc.payments || []) || []
  const payment = payments[0]
  const providerId = payment?.provider_id || ""
  const method = order.metadata?.payment_method || payment?.data?.method || ""

  if (providerId.includes("klarna")) return `${ICON_BASE}/apm/klarna.svg`
  if (providerId.includes("paypal")) return `${ICON_BASE}/apm/paypal.svg`
  if (providerId.includes("mollie")) {
    const map: Record<string, string> = {
      ideal: "apm/ideal.svg",
      bancontact: "apm/bancontact.svg",
      creditcard: "cards/visa.svg",
      applepay: "wallets/apple-pay.svg",
      googlepay: "wallets/google-pay.svg",
    }
    return `${ICON_BASE}/${map[method] || "apm/ideal.svg"}`
  }
  return ""
}

export function getPaymentFallback(order: any): { letter: string; bg: string; color: string } {
  const payments = order.payment_collections?.flatMap((pc: any) => pc.payments || []) || []
  const providerId = payments[0]?.provider_id || ""
  if (providerId.includes("comgate")) return { letter: "C", bg: "#444", color: "#fff" }
  if (providerId.includes("przelewy") || providerId.includes("p24")) return { letter: "P24", bg: "#D40E2F", color: "#fff" }
  return { letter: "?", bg: "#9CA3B8", color: "#fff" }
}
```

Importuj `design-tokens.ts` ve VŠECH komponentách a nahraď lokální barvy/styly.

---

## Pravidla

1. **NEPŘIDÁVEJ** žádné nové npm balíčky — vše je řešeno inline styly + SVG ikony z CDN
2. **NEZMĚŇ** žádné hooky, handlery, API volání, business logiku — mění se POUZE vizuální vrstva
3. **ZACHOVEJ** 100% existující funkčnosti: bulk actions, modaly (cancel, refund, duplicate), export, pagination, search, sort, tab filtry, editace zákazníka, timeline komentáře, Dextrum WMS, Fakturoid, QuickBooks
4. **ZACHOVEJ** hover efekty — přepiš je na nové barvy (bg-hover, border-active)
5. **Font:** Inter (importuj z Google Fonts pokud ještě není) — fallback na system fonts
6. **Ikona platební metody:** 32×32px se zaoblenými rohy 8px, šedé pozadí #f0f1f5, padding 4px. Pokud ikona není dostupná (Comgate, P24), zobraz barevný čtvereček s písmenem
7. **Max-width:** orders list = 1400px, order detail = 1100px

## Verifikace

Po dokončení zkontroluj:
- [ ] Orders list se načte bez chyb
- [ ] Platební ikony se zobrazují správně u každého řádku
- [ ] Kliknutí na objednávku otevře detail
- [ ] Health Bar na detailu ukazuje správné stavy
- [ ] Všechny akce fungují (refund, fulfill, cancel, duplicate, archive)
- [ ] Modaly se otevírají a zavírají
- [ ] Search filtruje objednávky
- [ ] Tab filtry fungují
- [ ] Pagination funguje
- [ ] Bulk actions fungují
- [ ] Export funguje
- [ ] Timeline zobrazuje události
- [ ] Editace zákazníka funguje
- [ ] Notes se ukládají
- [ ] Dextrum WMS sekce se zobrazuje
- [ ] Fakturoid/QuickBooks odkazy fungují
