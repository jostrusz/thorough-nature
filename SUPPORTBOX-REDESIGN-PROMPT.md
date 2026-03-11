# SupportBox Redesign — Claude Code Prompt

## Kontext
V MedusaJS 2.0 backendu existuje custom modul SupportBox s 3 admin stránkami:
- `backend/src/admin/routes/supportbox/page.tsx` — Dashboard (seznam tiketů)
- `backend/src/admin/routes/supportbox/[id]/page.tsx` — Detail tiketu + konverzace
- `backend/src/admin/routes/supportbox/settings/page.tsx` — Nastavení e-mailových účtů

Backend API routes jsou v `backend/src/api/admin/supportbox/` a modely v `backend/src/modules/supportbox/`.

## Úkol
Kompletní redesign SupportBox admin UI. Zachovat veškerou stávající funkcionalitu, ale zásadně vylepšit design, UX a rozšířit customer/order data v sidebaru. **Žádné AI funkce nepřidávat.**

---

## 1. GLOBÁLNÍ DESIGN SYSTÉM

### Pravidla
- Používej **výhradně** `@medusajs/ui` komponenty (Container, Button, Badge, Input, Select, Textarea, Heading, Table, Tabs, Label, Switch, IconButton, Tooltip, Drawer) + `@medusajs/icons`
- **Inline CSS styly** přes `style={{}}` — Medusa admin NEPODPORUJE Tailwind ani CSS moduly
- Veškerý design musí vizuálně splývat s nativním Medusa 2.0 admin dashboardem
- Barevná paleta: white `#FFFFFF`, background `#F9FAFB`, border `#E5E7EB`, text primary `#111827`, text secondary `#6B7280`, accent green `#10B981`, accent blue `#3B82F6`, accent orange `#F59E0B`, accent red `#EF4444`

### Hover & Transition Animace
Každý interaktivní element musí mít hover efekt. Implementuj to přes React `useState` pro hover state + inline `style` s `transition`:

```tsx
const [isHovered, setIsHovered] = useState(false)

<div
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
  style={{
    backgroundColor: isHovered ? "#F3F4F6" : "#FFFFFF",
    transform: isHovered ? "translateY(-1px)" : "translateY(0)",
    boxShadow: isHovered ? "0 4px 12px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    cursor: "pointer",
    borderRadius: "12px",
  }}
>
```

Pro tabulkové řádky:
```tsx
const [hoveredRow, setHoveredRow] = useState<string | null>(null)

<tr
  onMouseEnter={() => setHoveredRow(ticket.id)}
  onMouseLeave={() => setHoveredRow(null)}
  style={{
    backgroundColor: hoveredRow === ticket.id ? "#F9FAFB" : "transparent",
    transition: "background-color 0.15s ease",
  }}
>
```

### Spacing & Typography
- Padding containerů: `24px` (desktop), karty: `20px`
- Gap mezi sekcemi: `24px`
- Border radius: `12px` (karty), `8px` (inputy, badges)
- Font sizes: heading `20px/600`, subheading `14px/600`, body `13px/400`, caption `12px/400`
- Vše musí být **vzdušné** — dostatek whitespace kolem elementů

---

## 2. DASHBOARD (page.tsx) — Kompletní Redesign

### Layout
```
┌─────────────────────────────────────────────────────────┐
│  SupportBox                              [⚙ Settings]   │
├────────────┬────────────────────────────────────────────┤
│            │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  INBOXES   │  │ New  │ │Solved│ │ Old  │ │Total │      │
│            │  │  12  │ │  45  │ │  89  │ │ 146  │      │
│ ┌────────┐ │  └──────┘ └──────┘ └──────┘ └──────┘      │
│ │All (46)│ │                                            │
│ └────────┘ │  [🔍 Search...        ] [Status ▼] [Sort ▼]│
│ ┌────────┐ │                                            │
│ │info@.. │ │  ┌─────────────────────────────────────┐   │
│ │  (12)  │ │  │ 🟢 Re: My order #1234               │   │
│ └────────┘ │  │    jan@email.com · 2 min ago         │   │
│ ┌────────┐ │  │    "Dobrý den, chtěl bych se..."     │   │
│ │supp@.. │ │  └─────────────────────────────────────┘   │
│ │  (34)  │ │  ┌─────────────────────────────────────┐   │
│ └────────┘ │  │ ⚪ Tracking question                 │   │
│            │  │    petra@mail.cz · 1 hour ago        │   │
│            │  │    "Kde je moje zásilka?"             │   │
│            │  └─────────────────────────────────────┘   │
│            │                                            │
└────────────┴────────────────────────────────────────────┘
```

### Inbox Sidebar (levý panel, šířka 260px)
- Každý inbox jako karta s:
  - Display name (bold)
  - Email address (secondary color)
  - **Počet nových tiketů** v kruhovém badge (zelený, pokud > 0)
  - Active/Inactive indikátor (zelená/šedá tečka, ne Badge)
- Klik na inbox = filtr tiketů
- Aktivní inbox: `borderLeft: "3px solid #10B981"`, `backgroundColor: "#F0FDF4"`
- Hover efekt na každém inbox buttonu

### Stat Cards (4 karty v gridu)
- **4 stat karty**: New (zelená ikona), Solved (modrá), Old (oranžová), Total (šedá)
- Každá karta: ikona vlevo + číslo + label
- Hover: jemný shadow lift
- Klikatelné — po kliku nastaví statusFilter

### Ticket List (NE tabulka, ale karty)
**Nahradit tabulku kartovým seznamem.** Každý tiket jako horizontální karta:

```tsx
<div style={{
  padding: "16px 20px",
  borderBottom: "1px solid #F3F4F6",
  display: "flex",
  alignItems: "center",
  gap: "16px",
  cursor: "pointer",
  // + hover efekt
}}>
  {/* Status indicator */}
  <div style={{
    width: "10px", height: "10px", borderRadius: "50%",
    backgroundColor: status === "new" ? "#10B981" : status === "solved" ? "#9CA3AF" : "#F59E0B",
    flexShrink: 0,
  }} />

  {/* Content */}
  <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
      <span style={{ fontSize: "13px", fontWeight: "600", color: "#111827" }}>{subject}</span>
      <span style={{ fontSize: "12px", color: "#9CA3AF", flexShrink: 0 }}>{timeAgo}</span>
    </div>
    <div style={{ fontSize: "12px", color: "#6B7280", marginBottom: "4px" }}>
      {from_name || from_email}
    </div>
    {/* Preview prvního inbound message (max 80 znaků) */}
    <div style={{ fontSize: "12px", color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {messagePreview}
    </div>
  </div>

  {/* Badges */}
  <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
    {hasUnread && <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#3B82F6" }} />}
    <Badge color={statusColor}>{statusLabel}</Badge>
  </div>
</div>
```

### Funkce timeAgo
Implementuj helper funkci:
```tsx
function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(date).toLocaleDateString()
}
```

### Message Preview
Z ticket.messages vezmi první inbound message, ořízni na 80 znaků, strip HTML:
```tsx
const firstInbound = ticket.messages?.find((m: any) => m.direction === "inbound")
const preview = firstInbound?.body_text?.substring(0, 80) ||
  firstInbound?.body_html?.replace(/<[^>]*>/g, "").substring(0, 80) || ""
```

### Unread indikátor
Tiket je "unread" pokud `status === "new"` a poslední message je `direction === "inbound"`. Zobrazit modrou tečku.

---

## 3. TICKET DETAIL ([id]/page.tsx) — Kompletní Redesign

### Layout
```
┌──────────────────────────────────────────────────────────────┐
│  ← Back    Re: My order #1234           [Reopen] [✓ Solved] │
├────────────────────────────────────┬─────────────────────────┤
│                                    │  CUSTOMER               │
│  CONVERSATION                      │  ┌───────────────────┐  │
│                                    │  │ 👤 Jan Novák       │  │
│  ┌──── Customer ──────────────┐    │  │ jan@email.com      │  │
│  │ Dobrý den, chtěl bych...  │    │  │ +420 123 456 789   │  │
│  │              12:34, Mar 10 │    │  │ Prague, CZ         │  │
│  └────────────────────────────┘    │  │ Customer since 2024│  │
│                                    │  │ 5 orders · €234    │  │
│         ┌──── Support ────────┐    │  └───────────────────┘  │
│         │ Dobrý den, vaše... │    │                         │
│         │        14:22, Mar 10│    │  ALL ORDERS (5)         │
│         └─────────────────────┘    │  ┌───────────────────┐  │
│                                    │  │ #1234 · €49.90     │  │
│  ┌──── Customer ──────────────┐    │  │ ✅ Fulfilled       │  │
│  │ Děkuji, ale ještě...      │    │  │ 📦 GLS: ABC123     │  │
│  │              15:01, Mar 10 │    │  │ 🔗 Track shipment  │  │
│  └────────────────────────────┘    │  ├───────────────────┤  │
│                                    │  │ #1189 · €29.90     │  │
│  ┌─────────────────────────────┐   │  │ ⏳ Processing      │  │
│  │ Reply...                    │   │  └───────────────────┘  │
│  │                             │   │                         │
│  │              [Clear] [Send] │   │  ORDER TIMELINE         │
│  └─────────────────────────────┘   │  ● Mar 10 - Delivered   │
│                                    │  ● Mar 8  - In transit  │
│                                    │  ● Mar 7  - Shipped     │
│                                    │  ● Mar 5  - Ordered     │
└────────────────────────────────────┴─────────────────────────┘
```

### Conversation Thread (levý panel, flex: 1)
- Chat-bubble styl
- **Inbound (zákazník)**: zarovnáno vlevo, `backgroundColor: "#F3F4F6"`, `borderRadius: "12px 12px 12px 4px"`
- **Outbound (support)**: zarovnáno vpravo, `backgroundColor: "#ECFDF5"`, `borderRadius: "12px 12px 4px 12px"`
- Každá zpráva: sender name nahoře, timestamp dole vpravo (šedý, malý)
- Mezi zprávami `gap: "12px"`
- Auto-scroll dolů na poslední zprávu

### Reply Box
- Textarea s `borderRadius: "12px"`, `border: "1px solid #E5E7EB"`, min-height `100px`
- Focus state: `borderColor: "#10B981"`, `boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.1)"`
- Tlačítka pod textarea vpravo: Clear (secondary), Send (primary, zelený)
- Send button disabled + opacity když prázdný text

### Right Sidebar (šířka 380px) — ROZŠÍŘIT

#### Customer Card
Rozšířit volání API. V `CustomerSidebar` komponentě:
1. Fetchnout zákazníka přes `/admin/customers?q={email}`
2. Pokud nalezen — zobrazit:
   - **Jméno** (first_name + last_name)
   - **Email** (klikatelný mailto link)
   - **Telefon**
   - **Adresa** (z customer.addresses[0]: city, country_code)
   - **Customer since** (created_at formátovaný)
   - **Počet objednávek + celková útrata** — fetchnout přes nový API call

#### All Orders Section
**NOVÉ** — Rozšířit API endpoint `GET /admin/supportbox/tickets/[id]` aby vracel VŠECHNY objednávky zákazníka (ne jen poslední):

**Backend změna v `backend/src/api/admin/supportbox/tickets/[id]/route.ts`:**
```typescript
// Místo take: 1, vrátit všechny objednávky zákazníka
const { data: orders } = await query.graph({
  entity: "order",
  fields: [
    "id", "display_id", "status", "email", "total", "currency_code",
    "created_at", "metadata", "items.*",
    "fulfillments.*", "fulfillments.labels.*"
  ],
  filters: { email: ticket.from_email },
  pagination: { order: { created_at: "DESC" } },
})

// Vrátit pole allOrders místo jednoho matchedOrder
const allOrders = (orders || []).map((order: any) => ({
  order_id: order.id,
  display_id: order.display_id,
  status: order.status,
  total: order.total,
  currency_code: order.currency_code,
  created_at: order.created_at,
  delivery_status: order.metadata?.dextrum_status || null,
  tracking_number: order.metadata?.dextrum_tracking_number || null,
  tracking_link: order.metadata?.dextrum_tracking_link || null,
  carrier: order.metadata?.dextrum_carrier || null,
  fulfillments: (order.fulfillments || []).map((f: any) => ({
    id: f.id,
    created_at: f.created_at,
    shipped_at: f.shipped_at,
    delivered_at: f.delivered_at,
    labels: (f.labels || []).map((l: any) => ({
      tracking_number: l.tracking_number,
      tracking_url: l.tracking_url,
      label_url: l.label_url,
    }))
  })),
  items: (order.items || []).map((i: any) => ({
    title: i.title,
    quantity: i.quantity,
    unit_price: i.unit_price,
    thumbnail: i.thumbnail,
  })),
}))

res.json({ ticket, allOrders })
```

#### Order Cards v Sidebaru
Každá objednávka jako karta:
```tsx
<div style={{
  padding: "16px",
  border: "1px solid #E5E7EB",
  borderRadius: "12px",
  marginBottom: "12px",
  // + hover efekt
}}>
  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
    <span style={{ fontWeight: "600", fontSize: "13px" }}>#{order.display_id}</span>
    <span style={{ fontSize: "13px", fontWeight: "600" }}>
      {formatCurrency(order.total, order.currency_code)}
    </span>
  </div>

  {/* Status badge */}
  <Badge color={getStatusColor(order.status)}>{order.status}</Badge>

  {/* Delivery status */}
  {order.delivery_status && (
    <div style={{ marginTop: "8px", fontSize: "12px", color: "#6B7280" }}>
      📦 {order.carrier}: {order.tracking_number}
    </div>
  )}

  {/* Tracking link */}
  {order.tracking_link && (
    <a href={order.tracking_link} target="_blank" rel="noopener"
      style={{ fontSize: "12px", color: "#3B82F6", textDecoration: "none", display: "block", marginTop: "4px" }}>
      🔗 Track shipment →
    </a>
  )}

  {/* Items */}
  <div style={{ marginTop: "8px", borderTop: "1px solid #F3F4F6", paddingTop: "8px" }}>
    {order.items.map((item, i) => (
      <div key={i} style={{ fontSize: "12px", color: "#6B7280", marginBottom: "2px" }}>
        {item.title} × {item.quantity}
      </div>
    ))}
  </div>

  {/* Date */}
  <div style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "8px" }}>
    Ordered {new Date(order.created_at).toLocaleDateString()}
  </div>
</div>
```

#### Order Timeline
Pod order kartami zobrazit timeline VŠECH objednávek:
```tsx
<div style={{ position: "relative", paddingLeft: "20px" }}>
  {/* Vertikální čára */}
  <div style={{
    position: "absolute", left: "7px", top: "4px", bottom: "4px",
    width: "2px", backgroundColor: "#E5E7EB"
  }} />

  {timelineEvents.map((event, i) => (
    <div key={i} style={{ position: "relative", marginBottom: "16px" }}>
      {/* Tečka */}
      <div style={{
        position: "absolute", left: "-17px", top: "4px",
        width: "10px", height: "10px", borderRadius: "50%",
        backgroundColor: i === 0 ? "#10B981" : "#D1D5DB",
        border: "2px solid white",
      }} />
      <div style={{ fontSize: "12px", fontWeight: "500", color: "#111827" }}>{event.label}</div>
      <div style={{ fontSize: "11px", color: "#9CA3AF" }}>{event.date}</div>
    </div>
  ))}
</div>
```

Timeline events se sestaví z order dat:
- `created_at` → "Order placed"
- `fulfillment.created_at` → "Shipped" + carrier info
- `fulfillment.shipped_at` → "In transit"
- `fulfillment.delivered_at` → "Delivered"
- `metadata.dextrum_status` → aktuální Dextrum status

---

## 4. SETTINGS (settings/page.tsx) — Vylepšení Designu

### Vylepšení
- Config karty s hover efektem (lift + shadow)
- Status indikátor: zelená/šedá **tečka** místo Badge (čistější)
- Formulář ve **Drawer** komponentě z `@medusajs/ui` místo inline — čistější UX
- Lepší organizace IMAP polí do gridu (2 sloupce: host + port vedle sebe)
- Confirmation dialog při mazání (vlastní modal místo `window.confirm`)
- Success/error toasty s auto-dismiss a animací (fade in/out)

---

## 5. TECHNICKÉ POŽADAVKY

### Nesmí se změnit:
- Žádné API endpointy KROMĚ rozšíření `GET /admin/supportbox/tickets/[id]` (přidat allOrders)
- Databázové modely zůstávají stejné
- Webhook endpoint se nemění
- Reply/Solve/Reopen mutations zůstávají

### Musí se dodržet:
- `// @ts-nocheck` na začátku každého souboru
- Importy z `@medusajs/ui`, `@medusajs/icons`, `react`, `react-router-dom`, `@tanstack/react-query`
- `sdk.client.fetch` pro API volání (importováno z `../../lib/sdk` nebo `../../../lib/sdk`)
- `defineRouteConfig` pro navigační konfiguraci na dashboard stránce
- Pracuj na **staging** branchi

### Soubory k editaci:
1. `backend/src/admin/routes/supportbox/page.tsx` — kompletní přepis
2. `backend/src/admin/routes/supportbox/[id]/page.tsx` — kompletní přepis
3. `backend/src/admin/routes/supportbox/settings/page.tsx` — design vylepšení
4. `backend/src/api/admin/supportbox/tickets/[id]/route.ts` — rozšířit o allOrders

### Po dokončení:
```bash
git add . && git commit -m 'SupportBox UI redesign: modern card-based layout, hover animations, expanded customer sidebar with all orders + tracking + timeline' && git push origin staging
```

---

## 6. SHRNUTÍ PRIORIT

1. **Vzdušný, moderní design** — hodně whitespace, zaoblené rohy (12px), jemné stíny
2. **Hover animace** na VŠEM klikatelném (karty, řádky, buttony, inbox items)
3. **Kartový seznam tiketů** místo tabulky s preview zprávy a timeAgo
4. **Kompletní customer profil** v sidebaru (adresa, celková útrata, datum registrace)
5. **VŠECHNY objednávky** zákazníka v sidebaru (ne jen poslední)
6. **Tracking number + tracking link** u každé objednávky
7. **Order timeline** vizualizace historie objednávky
8. **Unread indikátor** na nových tiketech
9. **Inbox badge** s počtem nových tiketů per inbox
10. **Konzistentní design** splývající s Medusa 2.0 admin UI
