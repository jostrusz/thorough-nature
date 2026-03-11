# Claude Code Prompt: Analytics & Conversion Tracking System

## Kontext
Pracuji na Medusa 2.0 e-commerce platformě (monorepo: /backend + /storefront) deployované na Railway.
Je to multi-project platforma — každý projekt je jiná kniha prodávaná v jiném EU trhu.
Pracuj na staging branchi. Po změnách: git add . && git commit && git push origin staging.

Vizuální reference dashboardu je v /orders-dashboard-preview.html a /analytics-dashboard-preview.html — drž se tohoto designu.

## Co implementovat

Potřebuji kompletní analytický a konverzní tracking systém s těmito částmi:

---

## ČÁST 1: Backend — Tracking Data Model & Collection

### 1a. Nový Medusa modul: /backend/src/modules/analytics/

#### Databázové entity:

**PageView**
- id (PK, UUID)
- project_id (string, indexed) — identifikátor projektu (např. "loslatenboek")
- session_id (string, indexed) — unikátní session identifikátor
- visitor_id (string, indexed) — persistent visitor ID (z cookie)
- page_url (string) — plná URL
- page_path (string) — cesta bez domény
- page_title (string)
- referrer (string, nullable)
- utm_source (string, nullable)
- utm_medium (string, nullable)
- utm_campaign (string, nullable)
- utm_content (string, nullable)
- utm_term (string, nullable)
- traffic_source (string) — normalizovaný zdroj: "facebook", "google", "email", "direct", "instagram", "other"
- traffic_medium (string) — normalizovaný medium: "cpc", "organic", "email", "referral", "none"
- device_type (string) — "mobile", "desktop", "tablet"
- browser (string)
- os (string)
- country (string, 2-letter ISO)
- city (string, nullable)
- ip_address (string)
- user_agent (string)
- fbclid (string, nullable)
- fbc (string, nullable)
- fbp (string, nullable)
- time_on_page (integer, nullable) — sekundy, aktualizováno při odchodu
- scroll_depth (integer, nullable) — procenta 0-100
- created_at (timestamp)

**ConversionEvent**
- id (PK, UUID)
- project_id (string, indexed)
- session_id (string, indexed)
- visitor_id (string, indexed)
- event_type (string) — "page_view", "view_content", "add_to_cart", "initiate_checkout", "add_payment_info", "purchase"
- event_data (jsonb) — custom data specifická pro event
- page_url (string)
- created_at (timestamp)

**VisitorSession**
- id (PK, UUID)
- project_id (string, indexed)
- visitor_id (string, indexed)
- session_id (string, unique)
- first_page_url (string)
- last_page_url (string)
- entry_referrer (string, nullable)
- utm_source, utm_medium, utm_campaign, utm_content, utm_term
- traffic_source (string)
- traffic_medium (string)
- device_type (string)
- browser (string)
- os (string)
- country (string)
- pages_viewed (integer, default 1)
- duration_seconds (integer, default 0)
- is_bounce (boolean, default true) — true pokud pages_viewed === 1
- has_conversion (boolean, default false)
- conversion_type (string, nullable) — nejvyšší dosažený event
- order_id (string, nullable) — pokud session vedla k nákupu
- created_at (timestamp)
- updated_at (timestamp)

**EmailCampaign**
- id (PK, UUID)
- project_id (string, indexed)
- email_name (string) — interní název kampaně (např. "Abandoned Cart - 1h")
- email_subject (string)
- email_preview_text (string, nullable)
- email_type (string) — "welcome_series", "abandoned_cart", "post_purchase", "newsletter", "promotion", "re_engagement"
- sent_count (integer, default 0)
- delivered_count (integer, default 0)
- bounced_count (integer, default 0)
- opened_count (integer, default 0)
- unique_opened_count (integer, default 0)
- clicked_count (integer, default 0)
- unique_clicked_count (integer, default 0)
- unsubscribed_count (integer, default 0)
- conversion_count (integer, default 0)
- revenue (decimal, default 0)
- sent_at (timestamp)
- created_at (timestamp)
- updated_at (timestamp)

**EmailConversion**
- id (PK, UUID)
- email_campaign_id (FK → EmailCampaign)
- project_id (string, indexed)
- visitor_id (string)
- customer_email (string)
- customer_name (string, nullable)
- order_id (string)
- order_amount (decimal)
- currency (string)
- clicked_link (string, nullable) — na jaký link klikl
- time_to_conversion (integer) — sekundy od kliknutí emailu po purchase
- created_at (timestamp)

**CustomerJourney**
- id (PK, UUID)
- project_id (string, indexed)
- visitor_id (string, indexed)
- order_id (string, nullable, indexed)
- touchpoints (jsonb) — pole touchpointů: [{timestamp, type, source, page_url, duration, details}]
- first_touch_source (string) — první zdroj kontaktu
- first_touch_medium (string)
- first_touch_campaign (string, nullable)
- last_touch_source (string) — poslední zdroj před konverzí
- last_touch_medium (string)
- last_touch_campaign (string, nullable)
- total_touchpoints (integer)
- total_sessions (integer)
- days_to_conversion (integer, nullable)
- devices_used (string[]) — pole zařízení
- created_at (timestamp)
- updated_at (timestamp)

### 1b. Store API Routes pro sběr dat:

**POST /store/analytics/pageview**
- Přijme data o page view ze storefrontu
- Vytvoří/aktualizuje PageView a VisitorSession
- Automaticky parsuje UTM parametry z URL
- Normalizuje traffic_source z referrer + UTM (Facebook, Google, Email, Direct...)
- Parsuje device/browser/OS z User-Agent
- Geolokace z IP (použij jednoduchý lookup nebo free API)
- Vrátí { session_id, visitor_id }

**POST /store/analytics/event**
- Přijme conversion event (add_to_cart, initiate_checkout, purchase...)
- Uloží ConversionEvent
- Aktualizuje VisitorSession (has_conversion, conversion_type)
- Pokud event_type === "purchase", aktualizuje CustomerJourney

**POST /store/analytics/heartbeat**
- Přijme session_id + time_on_page + scroll_depth
- Aktualizuje PageView s aktuálním time_on_page a scroll_depth
- Aktualizuje VisitorSession duration

**POST /store/analytics/email-webhook**
- Webhook endpoint pro email provider (Resend)
- Přijme eventy: delivered, opened, clicked, bounced, unsubscribed
- Aktualizuje příslušný EmailCampaign statistiky
- Při clicked: vytvoří session s traffic_source: "email"

### 1c. Admin API Routes pro dashboard:

**GET /admin/analytics/overview?project_id=&period=today|7d|30d|custom&from=&to=**
Vrátí:
- visitors (unique visitor_id count)
- page_views
- sessions
- conversion_rate (purchases / sessions)
- revenue
- orders_count
- avg_order_value
- cpa (pokud máme ad spend data z Meta)
- bounce_rate
- avg_session_duration
- avg_pages_per_session
- comparison s předchozím obdobím (% change)

**GET /admin/analytics/traffic-sources?project_id=&period=**
Vrátí per source:
- source, medium
- visitors, sessions
- conversion_rate
- revenue, orders
- cpa, roas (pokud máme ad spend)
- bounce_rate

**GET /admin/analytics/funnel?project_id=&period=**
Vrátí funnel data:
- [{step: "page_view", count, percentage}, {step: "view_content", count, percentage, dropoff}, ...]

**GET /admin/analytics/projects-comparison?period=**
Vrátí per project:
- project_id, visitors, orders, conv_rate, revenue, ad_spend, roas, profit, margin

**GET /admin/analytics/email-campaigns?project_id=&period=**
Vrátí seznam email kampaní s metrikami

**GET /admin/analytics/email-campaign/:id**
Vrátí detail kampaně + seznam konverzí (EmailConversion) + click map

**GET /admin/analytics/customer-journey/:visitor_id**
Vrátí kompletní cestu zákazníka s touchpointy

**GET /admin/analytics/customer-journey/by-order/:order_id**
Vrátí cestu zákazníka pro konkrétní objednávku

**GET /admin/analytics/conversion-paths?project_id=&period=**
Vrátí nejčastější cesty ke konverzi:
- [{path: ["facebook/cpc", "email/abandoned_cart", "direct/none"], count, percentage, avg_revenue}]

**GET /admin/analytics/daily-stats?project_id=&period=**
Vrátí denní data pro grafy:
- [{date, visitors, conversions, revenue, per_source: {facebook: X, google: Y, email: Z}}]

### 1d. Subscriber: order.placed → Analytics

Při každé nové objednávce:
- Najdi VisitorSession podle session_id z objednávky (potřebujeme session_id předat přes checkout metadata)
- Aktualizuj VisitorSession: has_conversion=true, conversion_type="purchase", order_id
- Finalizuj CustomerJourney — nastav last_touch, spočítej days_to_conversion
- Pokud session přišla z emailu, vytvoř EmailConversion záznam
- Ulož ConversionEvent type="purchase" s order daty

### 1e. Traffic Source Attribution Logic

Implementuj tuto logiku pro normalizaci traffic source:

```
if (utm_source) {
  // UTM parametry mají prioritu
  if utm_source contains "facebook" or "fb" or "ig" or "instagram" → traffic_source: "facebook"
  if utm_source contains "google" → traffic_source: "google"
  if utm_source contains "email" or "mail" or "resend" or "newsletter" → traffic_source: "email"
  if utm_source contains "tiktok" → traffic_source: "tiktok"
  // atd.
} else if (referrer) {
  // Parsuj referrer
  if referrer contains "facebook.com" or "fb.com" or "instagram.com" → "facebook"
  if referrer contains "google." → "google"
  if referrer contains "t.co" or "twitter.com" or "x.com" → "twitter"
  // atd.
} else {
  traffic_source: "direct"
  traffic_medium: "none"
}
```

### 1f. Email Campaign Attribution

Když někdo klikne na odkaz v emailu:
1. Email provider (Resend) pošle webhook s click eventem
2. URL v emailu musí obsahovat UTM parametry: utm_source=email&utm_medium=campaign_type&utm_campaign=campaign_name&utm_content=link_id
3. Při page view s těmito UTM → traffic_source: "email", propojit s EmailCampaign
4. Pokud návštěvník z emailu nakoupí → vytvořit EmailConversion

---

## ČÁST 2: Storefront — Tracking Script

### 2a. /storefront/src/lib/analytics-tracker.ts

Hlavní tracking knihovna:

**initTracker(projectId: string)**
- Vygeneruje nebo přečte visitor_id z cookie (expiruje za 2 roky)
- Vygeneruje session_id (nový pokud uplynulo 30+ min od poslední aktivity)
- Uloží session start cookie
- Parsuje UTM parametry z URL a uloží do sessionStorage
- Zachytí fbclid z URL

**trackPageView()**
- Volej na každé stránce
- Pošle na POST /store/analytics/pageview:
  - project_id, visitor_id, session_id
  - page_url, page_path, page_title
  - referrer (document.referrer)
  - UTM parametry (ze sessionStorage)
  - fbc, fbp (z cookies)
  - screen resolution, language
- Spustí heartbeat interval (každých 15 sekund posílá time_on_page a scroll_depth)
- Při page unload (beforeunload/visibilitychange) pošle finální heartbeat

**trackEvent(eventType: string, eventData: object)**
- Pošle na POST /store/analytics/event
- Obsahuje: project_id, visitor_id, session_id, event_type, event_data, page_url

**trackConversion(orderData: object)**
- Speciální metoda pro purchase event
- Pošle kompletní order data včetně customer info

**startHeartbeat() / stopHeartbeat()**
- Interval tracker pro time on page a scroll depth

### 2b. AnalyticsProvider (React Context)

/storefront/src/lib/context/analytics-context.tsx:
- Inicializuje tracker při mount
- Automaticky trackuje page views při route změnách (Next.js router events)
- Poskytuje trackEvent a trackConversion child komponentám

### 2c. useAnalytics() hook:
Vrací: { trackEvent, trackConversion, sessionId, visitorId }

### 2d. Tracking na stránkách:

**Všechny stránky (layout):**
- PageView tracking automaticky přes AnalyticsProvider

**Sales page / Product page:**
- ViewContent event s product daty
- Scroll depth tracking (automaticky přes heartbeat)
- Time on page tracking

**Add to Cart button:**
- AddToCart event s product_id, variant_id, price, quantity

**Checkout page:**
- InitiateCheckout event s cart daty (content_ids, value, currency)

**Payment step:**
- AddPaymentInfo event

**Thank you / Order confirmation page:**
- Purchase event s kompletními order daty
- PLUS: tady se propojí session s objednávkou

### 2e. UTM Parameter Persistence

- Při prvním příchodu s UTM parametry → ulož do sessionStorage
- Tyto parametry se posílají se VŠEMI eventy v rámci session
- Při novém příchodu s novými UTM → přepiš (last-click attribution)
- Zároveň ulož first-touch UTM do localStorage (pro first-touch attribution)

### 2f. Scroll & Engagement Tracking

- Při scrollu trackuj milestones: 25%, 50%, 75%, 100%
- Time on page přes heartbeat (15s interval)
- Při odchodu ze stránky pošli finální data
- Tyto data jsou klíčová pro pochopení engagementu na sales pages

---

## ČÁST 3: Admin Dashboard — Analytics Page

### 3a. Nová stránka v Medusa Admin

Vytvoř admin route/widget pro analytics dashboard. Design se řídí podle /analytics-dashboard-preview.html.

### 3b. Alternativně: Standalone Dashboard

Pokud je admin widget příliš limitující, vytvoř standalone Next.js stránku na storefrontu
pod /admin/analytics (chráněnou autentizací), která volá admin API endpoints.

### 3c. Dashboard sekce:

1. **Project selector** — přepínání mezi projekty
2. **Stat cards** — Visitors, Conv. Rate, Revenue, CPA
3. **Traffic Sources tabulka** — s filtrem per source
4. **Conversion Funnel** — vizuální funnel s drop-off
5. **Email Performance** — tabulka kampaní s click-to-detail
6. **Email Detail Panel** — slide-in panel s metrikami kampaně + seznam konverzí
7. **Project Comparison** — když je vybrán "All Projects"
8. **Top Conversion Paths** — nejčastější cesty ke konverzi
9. **Daily Stats Chart** — visitors + conversions per den/kanál

### 3d. Order Detail — Customer Journey Widget

V detailu objednávky (buď jako Medusa Admin widget nebo custom page) přidej sekci "Customer Journey":
- Načti z GET /admin/analytics/customer-journey/by-order/:orderId
- Zobraz:
  - First touch / Last touch attribution
  - UTM parametry
  - Timeline touchpointů (vizuální vertikální timeline)
  - Celkový počet touchpointů, sessions, dny do konverze
  - Zařízení použitá
  - Stránky navštívené

---

## ČÁST 4: Integrace s Meta Pixel + CAPI

Analytics systém musí spolupracovat s Meta Pixel implementací:
- Sdílej visitor_id a session_id mezi analytics a Meta tracking
- Při Purchase eventu: pošli ZÁROVEŇ na analytics API i Meta CAPI (se stejným event_id)
- Customer Journey by měla zahrnovat i Facebook ad click jako touchpoint (z fbclid)
- UTM z Facebook ads (utm_source=facebook) se automaticky propojí s traffic_source: "facebook"

---

## ČÁST 5: Email Integration

### 5a. Resend Webhook Handler

Endpoint POST /store/analytics/email-webhook přijímá webhooky z Resend:
- email.delivered → increment delivered_count
- email.opened → increment opened_count, unique_opened_count (deduplicate)
- email.clicked → increment clicked_count, zaznamenej clicked link
- email.bounced → increment bounced_count
- email.unsubscribed → increment unsubscribed_count

### 5b. Email Link Tracking

Všechny linky v emailech musí mít UTM parametry:
- utm_source=email
- utm_medium={email_type} (welcome, abandoned_cart, newsletter...)
- utm_campaign={campaign_name}
- utm_content={link_position} (hero_cta, footer_link, text_link...)

Plus unikátní tracking parameter: ?eid={email_campaign_id}&vid={visitor_id}
→ Při page view s eid parametrem propojíme session s email kampaní.

### 5c. Email → Purchase Attribution

1. Zákazník dostane email s linkem obsahujícím UTM + eid + vid
2. Klikne → přijde na stránku → analytics tracker zaznamená page view s traffic_source: "email"
3. Nakoupí → Purchase event se propojí s email kampaní přes eid
4. Vytvoří se EmailConversion záznam

---

## TECHNICKÉ POŽADAVKY

- Všechny timestamps v UTC
- Visitor ID: UUID v4, uložený v first-party cookie (2 roky)
- Session ID: UUID v4, nová session po 30 minutách neaktivity
- Heartbeat interval: 15 sekund
- Scroll depth: trackuj při scroll eventu, debounce 200ms
- Geolokace: z IP přes MaxMind GeoLite2 free databázi nebo jednoduchý lookup
- User-Agent parsing: použij ua-parser-js nebo podobnou knihovnu
- Database indexy na: project_id, visitor_id, session_id, created_at, traffic_source
- API response caching: cache overview a traffic-sources na 60 sekund (Redis)
- Batch insert: pageviews a heartbeaty posílej v batchi pokud je vysoký traffic

## PERFORMANCE

- PageView tracking nesmí blokovat rendering stránky (async)
- Heartbeat nesmí zatěžovat server — použij debouncing a batching
- Dashboard API endpointy musí používat agregační queries (GROUP BY), ne client-side processing
- Pro denní/týdenní/měsíční statistiky zvažuj materializované views nebo cron job na pre-agregaci

## PO DOKONČENÍ

git add . && git commit -m 'feat: Analytics & conversion tracking system with email attribution, customer journey, and per-project dashboards' && git push origin staging
