# Claude Code — Profitability System Implementation

## Overview

Implement a complete profitability tracking system for the EverChapter MedusaJS 2.0 admin panel. This involves:
1. **Profitability Stats Section** — 8 project cards displayed above the orders table on the Orders HQ page
2. **Project Configuration Admin Page** — a new admin extension page where per-project costs and Meta Ads accounts are configured
3. **Meta Ads API Integration** — background sync of ad spend data every 5 minutes
4. **Backend Calculation Engine** — daily_project_stats table with pre-computed profitability data

Work on the `staging` branch. After every logical group of changes: `git add . && git commit -m 'description' && git push origin staging`.

---

## PHASE 1: Database & Backend Models

### 1.1 Create `project_config` table

Create a new module/model at `backend/src/modules/profitability/` with these fields:

```
project_config:
  id                  string (PK, auto UUID)
  project_name        string (e.g. "Laat Los")
  project_slug        string (unique, e.g. "laat-los-nl")
  flag_emoji          string (e.g. "🇳🇱")
  country_tag         string (e.g. "NL/BE")
  sales_channel_id    string (FK to Medusa sales_channel)
  book_cost_eur       decimal (default 1.80)
  shipping_cost_eur   decimal (default 5.00)
  pick_pack_cost_eur  decimal (default 1.50)
  payment_fee_rate    decimal (default 0.03, i.e. 3%)
  meta_ad_account_id  string | null (e.g. "act_123456789")
  is_active           boolean (default true)
  display_order       integer (for sorting in the grid)
  created_at          datetime
  updated_at          datetime
```

### 1.2 Create `meta_ads_config` table (global)

```
meta_ads_config:
  id                  string (PK)
  access_token        text (encrypted Meta Ads API long-lived token)
  token_status        string ("valid" | "expired" | "error")
  last_validated_at   datetime
  created_at          datetime
  updated_at          datetime
```

### 1.3 Create `daily_project_stats` table

```
daily_project_stats:
  id                  string (PK, auto UUID)
  project_config_id   string (FK)
  date                date (e.g. "2026-03-04")
  revenue             decimal (total from paid orders)
  tax_amount          decimal (sum of taxes from orders)
  order_count         integer
  item_count          integer (total line items)
  refund_amount       decimal (total refunds for that day)
  ad_spend            decimal (from Meta Ads API)
  book_cost_total     decimal (item_count × book_cost_eur)
  shipping_cost_total decimal (order_count × shipping_cost_eur)
  pick_pack_total     decimal (order_count × pick_pack_cost_eur)
  payment_fee_total   decimal (revenue × payment_fee_rate)
  net_profit          decimal (calculated)
  last_synced_at      datetime
  created_at          datetime
  updated_at          datetime
```

Profit formula:
```
net_profit = revenue - tax_amount - refund_amount - ad_spend - book_cost_total - shipping_cost_total - pick_pack_total - payment_fee_total
```

### 1.4 Migrations

Create Medusa migrations for all three tables. Run `npx medusa db:migrate` to apply.

---

## PHASE 2: API Routes (Backend)

### 2.1 Project Config CRUD

Create API routes at `backend/src/api/admin/profitability/`:

- `GET /admin/profitability/projects` — list all project configs (ordered by display_order)
- `GET /admin/profitability/projects/:id` — get single project config
- `POST /admin/profitability/projects` — create project config
- `PUT /admin/profitability/projects/:id` — update project config
- `DELETE /admin/profitability/projects/:id` — delete project config

### 2.2 Meta Ads Config

- `GET /admin/profitability/meta-ads-config` — get current Meta Ads token status
- `POST /admin/profitability/meta-ads-config` — save/update Meta Ads access token
- `POST /admin/profitability/meta-ads-config/validate` — test the token and return list of available ad accounts
- `GET /admin/profitability/meta-ads-accounts` — list all ad accounts available with the stored token (calls Meta Ads API: `GET /me/adaccounts?fields=id,name,currency,account_status`)

### 2.3 Stats & Profitability

- `GET /admin/profitability/stats?period=today|yesterday|this_week|this_month|custom&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` — returns profitability data for all active projects for the given period. Aggregates daily_project_stats rows. For "today", computes live from Medusa DB + cached ad spend. When `period=custom`, the `date_from` and `date_to` query params are required.
- `GET /admin/profitability/stats/:project_id?period=...&date_from=...&date_to=...` — single project detail
- `POST /admin/profitability/sync` — manually trigger a full sync (recalculate all projects for today)

### 2.4 Authentication

All routes must be protected with Medusa admin authentication middleware (the user must be logged in to the admin panel). Use the standard `authenticate("user", ["bearer", "session"])` middleware.

---

## PHASE 3: Meta Ads Integration & Background Jobs

### 3.1 Meta Ads Service

Create `backend/src/modules/profitability/services/meta-ads.service.ts`:

- `getAdAccounts(accessToken)` — fetch all ad accounts
- `getAccountSpend(accessToken, adAccountId, dateFrom, dateTo)` — fetch spend using the Meta Ads Insights API:
  ```
  GET /{ad_account_id}/insights?fields=spend&time_range={"since":"2026-03-04","until":"2026-03-04"}&level=account
  ```
- Handle rate limits (200 calls/hour per ad account — more than enough for 8 projects every 5 min)
- Handle token expiration gracefully (set token_status to "expired", log warning)

### 3.2 Background Cron Job (every 5 minutes)

Create a scheduled job at `backend/src/jobs/sync-ad-spend.ts`:

```typescript
// Runs every 5 minutes
// 1. Load meta_ads_config to get the access token
// 2. For each active project_config that has a meta_ad_account_id:
//    a. Fetch today's spend from Meta Ads API
//    b. Upsert daily_project_stats for today with the new ad_spend value
// 3. Also recalculate today's revenue/orders from Medusa DB
// 4. Recalculate net_profit for today
```

Use MedusaJS scheduled jobs pattern:
```typescript
export default function syncAdSpendJob(container) {
  return {
    name: "sync-ad-spend",
    schedule: "*/5 * * * *", // every 5 minutes
    handler: async () => { ... }
  }
}
```

### 3.3 Refund Subscriber

Create `backend/src/subscribers/refund-handler.ts`:

- Listen to `order.refund_created` event
- When triggered:
  1. Find the order's original creation date
  2. Determine which project_config it belongs to (via sales_channel_id)
  3. Update the daily_project_stats row for that date: increment `refund_amount`, recalculate `net_profit`

### 3.4 Daily Stats Recalculation

Create a nightly job `backend/src/jobs/recalculate-daily-stats.ts` (runs at 00:05 each day):
- Recalculates yesterday's final numbers from the Medusa DB (captures any late-arriving data)
- Ensures data integrity

---

## PHASE 4: Admin UI — Project Configuration Page

### 4.1 New Admin Route

Create `backend/src/admin/routes/profitability-settings/page.tsx`

This is a full admin page for configuring profitability projects. Design it to match the existing admin design system (use the same `design-tokens.ts` for colors, shadows, radii, fontStack).

**Page Layout:**

```
┌──────────────────────────────────────────────────────┐
│ ⚙️  Profitability Settings                           │
│                                                      │
│ ┌─── Meta Ads API Token ──────────────────────────┐  │
│ │ Access Token: ●●●●●●●●●●●●●●●●abc   [Validate] │  │
│ │ Status: ✅ Valid  |  Last checked: 2 min ago     │  │
│ │ Available accounts: 5                            │  │
│ └─────────────────────────────────────────────────┘  │
│                                                      │
│ ┌─── Projects ────────────────────── [+ Add New] ─┐  │
│ │                                                  │  │
│ │  🇳🇱 Laat Los  NL/BE                    [Edit]  │  │
│ │  ├─ Sales Channel: NL/BE Webshop                 │  │
│ │  ├─ Book: €1.80 | Ship: €5.00 | P&P: €1.50      │  │
│ │  ├─ Payment Fee: 3%                              │  │
│ │  └─ Meta Ads: act_123... (NL Ad Account)         │  │
│ │                                                  │  │
│ │  🇩🇪 Lass Los  DE/AT/LU                 [Edit]  │  │
│ │  ├─ Sales Channel: DE Webshop                    │  │
│ │  ├─ Book: €1.80 | Ship: €5.00 | P&P: €1.50      │  │
│ │  ├─ Payment Fee: 3%                              │  │
│ │  └─ Meta Ads: act_456... (DE Ad Account)         │  │
│ │                                                  │  │
│ │  ... (more projects)                             │  │
│ └─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**Edit/Create Modal fields:**
- Project Name (text input)
- Flag Emoji (emoji picker or text input)
- Country Tag (text, e.g. "NL/BE")
- Sales Channel (dropdown — fetch from Medusa `GET /admin/sales-channels`)
- Book Cost EUR (number input, default 1.80)
- Shipping Cost EUR (number input, default 5.00)
- Pick & Pack EUR (number input, default 1.50)
- Payment Fee % (number input, default 3)
- Meta Ads Account (dropdown — populated from the validated Meta Ads token's available accounts)
- Active (toggle)
- Display Order (number)

**Styles:** Use React inline styles only (same pattern as orders page). Use design-tokens.ts for all shared values. Do NOT use CSS modules, styled-components, or Tailwind.

### 4.2 Route Config

```typescript
export const config = defineRouteConfig({
  label: "Profitability",
  icon: /* some icon from @medusajs/icons */,
})
```

---

## PHASE 5: Admin UI — Profitability Stats on Orders HQ

### 5.1 Modify Orders HQ Page

File: `backend/src/admin/routes/custom-orders/page.tsx`

**Changes:**
1. **REMOVE** the `<StatCards>` component import and usage entirely (delete the stat cards section that shows "Orders Today", "Revenue Today", "Unfulfilled", "In Transit")
2. **ADD** a new `<ProfitabilitySection>` component above the orders section (after the page header divider, before the "Orders" title)

### 5.2 Create ProfitabilitySection Component

Create `backend/src/admin/components/orders/profitability-section.tsx`

This component renders:
1. **Section header** with "Project Profitability" title, live dot (green pulsing), and period selector (Today / Yesterday / This Week / This Month / Custom Range)

**Period selector behavior:**
- The first 4 buttons (Today, Yesterday, This Week, This Month) are quick-select pill buttons in a segmented control
- The 5th option is a "Custom" button that, when clicked, expands a date range picker inline (two date inputs: From and To)
- Use native HTML `<input type="date">` styled to match the design system (rounded, same font, border color from design-tokens)
- When a custom range is active, show the selected range as a label, e.g. "Mar 1 – Mar 4" next to the date inputs
- The custom range picker should appear smoothly (slide-down or fade-in animation, 0.2s ease)
- Both date inputs are required when "Custom" is active. Validate that `date_from <= date_to`
- Maximum allowed range: 90 days (show a toast warning if exceeded)
2. **Project cards grid** — 4 columns, 2 rows (grid-template-columns: repeat(4, 1fr))
3. **Total summary bar** at the bottom
4. **Section divider** after the total bar

**Each project card contains:**
- Glow bar at top (2.5px height) — colored based on performance:
  - `excellent`: green gradient (profit margin > 30%)
  - `good`: light green gradient (profit margin > 15%)
  - `warning`: yellow gradient (profit margin > 0%)
  - `danger`: red gradient (profit margin <= 0%)
  - `neutral`: gray gradient (no data)
- Card inner (padding: 10px 12px 11px):
  - Project name row: flag emoji (14px) + name (12px, weight 600) + country tag badge (9px, bg gray)
  - Net Profit value (20px, weight 800, green if positive, red if negative)
  - "Net Profit" label (10px, uppercase, gray)
  - Divider (1px)
  - Metrics row: Revenue (left) | Orders (center) | Ad Spend (right, gray color)
    - Labels: 9px uppercase gray
    - Values: 13px weight 700

**Total summary bar:**
- White card with 1px border, 12px border-radius
- Animated gradient top border (2px, shifting through purple-green-blue-yellow)
- Left: "Total All Projects" label with chart icon
- Right: Revenue | Orders | Ad Spend | Net Profit

**Card styles — EXACT specs (compact design):**
```css
.project-card {
  background: #FFFFFF;
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 10px;
  padding: 0;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: pointer;
}
.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.07), 0 2px 6px rgba(0,0,0,0.03);
}
.card-inner { padding: 10px 12px 11px; }
.project-name { font-size: 12px; font-weight: 600; }
.profit-value { font-size: 20px; font-weight: 800; letter-spacing: -0.8px; }
.profit-label { font-size: 10px; text-transform: uppercase; }
.metric-label { font-size: 9px; text-transform: uppercase; }
.metric-value { font-size: 13px; font-weight: 700; }
```

### 5.3 Data Hook

Create `backend/src/admin/hooks/use-profitability.ts`:

```typescript
type Period = "today" | "yesterday" | "this_week" | "this_month" | "custom"

export function useProfitability(
  period: Period,
  dateFrom?: string,  // "YYYY-MM-DD" — required when period is "custom"
  dateTo?: string     // "YYYY-MM-DD" — required when period is "custom"
) {
  const params = new URLSearchParams({ period })
  if (period === "custom" && dateFrom && dateTo) {
    params.set("date_from", dateFrom)
    params.set("date_to", dateTo)
  }

  return useQuery({
    queryKey: ["profitability", period, dateFrom, dateTo],
    queryFn: async () => {
      const response = await sdk.client.fetch(`/admin/profitability/stats?${params}`)
      return response
    },
    refetchInterval: period === "today" ? 60_000 : false, // auto-refresh only for "today"
    enabled: period !== "custom" || (!!dateFrom && !!dateTo), // don't fetch until both dates are set
  })
}
```

The response shape:
```typescript
interface ProfitabilityResponse {
  projects: Array<{
    project_id: string
    project_name: string
    project_slug: string
    flag_emoji: string
    country_tag: string
    revenue: number
    tax_amount: number
    order_count: number
    item_count: number
    refund_amount: number
    ad_spend: number
    book_cost_total: number
    shipping_cost_total: number
    pick_pack_total: number
    payment_fee_total: number
    net_profit: number
    profit_margin: number // (net_profit / revenue) * 100
  }>
  totals: {
    revenue: number
    order_count: number
    ad_spend: number
    net_profit: number
  }
  period: string
  last_synced_at: string
}
```

### 5.4 Loading State

Show skeleton cards (same 4×2 grid) with pulsing animation while data loads. Match the skeleton style from the existing orders table (shimmer effect with `@keyframes skeleton-pulse`).

---

## PHASE 6: Refund Handling

When an order is refunded (via Medusa's built-in refund flow):
1. The subscriber `refund-handler.ts` catches the event
2. Looks up the order's `sales_channel_id` to find the matching `project_config`
3. Looks up the order's `created_at` date
4. Updates `daily_project_stats` for that project+date: adds the refund amount to `refund_amount`
5. Recalculates `net_profit` for that row

---

## IMPORTANT IMPLEMENTATION NOTES

### Styling Rules
- **React inline styles ONLY** — no CSS modules, no Tailwind, no styled-components
- All shared values from `design-tokens.ts` (colors, radii, shadows, fontStack)
- Inject keyframe animations via `<style>` tags in a Styles component (see existing `DashboardStyles` pattern in page.tsx)
- All components use TypeScript (.tsx)

### Existing Code Structure
The admin code follows this pattern:
- Routes: `backend/src/admin/routes/{route-name}/page.tsx`
- Components: `backend/src/admin/components/orders/`
- Hooks: `backend/src/admin/hooks/`
- Design tokens: `backend/src/admin/components/orders/design-tokens.ts`

### Design Reference
The exact visual design is available at: `profitability-dashboard-2026.html` in the project root. This HTML file is a pixel-perfect mockup of how the profitability section should look. Replicate the design exactly using React inline styles.

### Existing project-settings page
There is already a `backend/src/admin/routes/project-settings/page.tsx` file that handles order_bump, upsell, and Foxentry settings. The new profitability settings should be a SEPARATE admin page at `profitability-settings/page.tsx`, not added to the existing project-settings page.

### 8 Projects (initial seed data)
When implementing, seed or allow creating these 8 projects:

| # | Name | Flag | Countries | Sales Channel |
|---|------|------|-----------|---------------|
| 1 | Laat Los | 🇳🇱 | NL/BE | NL/BE channel |
| 2 | Lass Los | 🇩🇪 | DE/AT/LU | DE channel |
| 3 | Odpuść | 🇵🇱 | PL | PL channel |
| 4 | Släpp Taget | 🇸🇪 | SE | SE channel |
| 5 | Psí Superživot | 🇨🇿 | CZ/SK | CZ/SK channel |
| 6 | Hondenbijbel | 🇳🇱 | NL/BE | NL/BE Dog channel |
| 7 | Biblia Kotów | 🇵🇱 | PL | PL Cat channel |
| 8 | Kutyabiblia | 🇭🇺 | HU | HU channel |

Default costs for all: Book €1.80, Shipping €5.00, Pick & Pack €1.50, Payment Fee 3%.

### Currency
All financial values are in EUR. Use `Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" })` for formatting.

### Performance
- The profitability stats API for "today" should respond within 200ms (read from daily_project_stats + cached ad spend)
- Historical periods (yesterday, this_week, this_month, custom) are pure DB aggregations — should be <50ms
- Custom range up to 90 days aggregates daily_project_stats rows — still fast (<100ms)
- Meta Ads API calls happen only in the background job, never in the request path

### Error Handling
- If Meta Ads token is invalid/expired, show a warning banner on the profitability section: "⚠️ Ad spend data may be outdated. Check Profitability Settings."
- If a project has no Meta Ads account assigned, show ad_spend as "—" (dash)
- If no data exists for a period, show €0.00 with neutral/gray color

---

## Commit Strategy

Make commits in this order:
1. `feat: add profitability database models and migrations`
2. `feat: add profitability API routes (CRUD + stats)`
3. `feat: add Meta Ads service and sync-ad-spend cron job`
4. `feat: add refund subscriber for profitability tracking`
5. `feat: add profitability settings admin page`
6. `feat: add profitability section to Orders HQ page`
7. `chore: remove stat-cards component, replace with profitability section`

After each commit: `git push origin staging`
