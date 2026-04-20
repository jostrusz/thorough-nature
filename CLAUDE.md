# Claude Code Instructions — thorough-nature

## 👤 O uživateli

- **Jaroslav Ostruszka** — Bangkok, Thailand (**UTC+7**, cron/schedule v lokálním čase = Bangkok)
- Firmy: Performance Marketing Solution s.r.o. (CZ, MID Novalnet 14838), EverChapter OÜ (Estonia)
- Email: `jaroslavostruszka@gmail.com` (osobní), `info@performance-marketing-solution.com` (firemní)
- **Komunikuje česky** → odpovídej česky, technické termíny (subscriber, webhook, cron, payment gateway, middleware) ponech anglicky
- **Styl: akční, přímý.** Když řekne "udělej to" → okamžitě dělej, neptej se znova. Nepoužívej vatovité předmluvy ("Výborně, pojďme na to...").
- **Frustruje ho**: halucinace (model IDs, package versions, URLs, field names), pomalost, walls of text, vágní odpovědi ("asi", "možná", "pravděpodobně bez ověření")
- **Oceňuje**: tabulky, bullet points, emoji jako vizuální kotvy (🔴 🟡 🟢 ✅ ⚠️), konkrétní čísla a paths, věcnost

## 🎯 7 book funnel projektů

| Slug | Hlavní doména | Jazyk | Trh | Kniha |
|---|---|---|---|---|
| `loslatenboek` | loslatenboek.nl, tijdomloslaten.nl | NL | 🇳🇱 | Laat los wat je kapotmaakt |
| `dehondenbijbel` | dehondenbijbel.nl | NL | 🇳🇱 | De Hondenbijbel (dog book) |
| `het-leven` | pakjeleventerug.nl | NL | 🇳🇱 | Pak je leven terug |
| `lass-los` | lasslosbuch.de, bucherfurdich.de | DE | 🇩🇪🇦🇹 | Lass los, was dich kaputt macht |
| `odpusc-ksiazka` | odpusc-ksiazka.pl, ksiazkidladuszy.pl | PL | 🇵🇱 | Odpuść to, co cię niszczy |
| `slapp-taget` | slapptagetboken.se, bokochkaffe.com | SE | 🇸🇪 | Släpp taget |
| `psi-superzivot` | psi-superzivot.cz, knihyprodusi.cz | CZ | 🇨🇿 | Psí superživot (dog book) |

Každý projekt má **vlastní vanilla HTML checkout** v `/storefront/src/projects/<slug>/pages/checkout.html`. Toto je **primární revenue path — 95+ % objemu**. Generický Medusa Next.js checkout v `/storefront/src/app/[countryCode]/(checkout)/` existuje, ale není hlavní.

## 🧰 Tech stack

| Vrstva | Technologie |
|---|---|
| Backend | Medusa v2 (TypeScript, `// @ts-nocheck` je project-wide konvence) |
| Runtime | Node 22.11.0, pnpm 9.10.0 |
| DB | PostgreSQL (Railway) |
| Hosting | Railway (region **us-west2**) |
| Backend public URL | `https://www.marketing-hq.eu` |
| Postgres debug | Host `maglev.proxy.rlwy.net`, Port `50028`, User `postgres`, DB `railway` (password v Railway env `DATABASE_URL`) |
| Payment gateways | Airwallex, PayPal (2 účty), Klarna, Mollie, Comgate, Przelewy24, Stripe, Novalnet, COD |
| Fulfillment | Dextrum mySTOCK (CZ WMS, port 9341) pro NL/BE/DE/PL/CZ/AT; PostNord Linker pro SE |
| Email | Resend (transactional + marketing) |
| Invoicing | Fakturoid |
| Customer support | SupportBox |
| Search | MeiliSearch |
| File storage | MinIO (Railway "Bucket" service) |

## 🚀 Deployment workflow (KRITICKÉ)

1. **Vždy pracuj na `staging` branch** — nikdy přímo na master
2. Po změnách: `git add <konkrétní soubory>` → `git commit -m '...'` → `git push origin staging`
3. Staging auto-deployuje na Railway (~3-5 min build)
4. **Před push na master se VŽDY zeptej** — user explicitně řekne "dej to i na produkci"
5. Merge: `git checkout master && git pull --ff-only && git merge staging --no-edit && git push origin master && git checkout staging`
6. Po deployi nabídni ověření přes `mcp__railway-mcp-server__get-logs` nebo Postgres query

**🚫 NIKDY:**
- `git add .` nebo `git add -A` (riziko commitnutí `.env`, `favicon.jpg`, temp souborů)
- `--no-verify`, `--amend` (vyjma explicitního požadavku)
- Force push na master/staging
- Přepsat `git config`

## 🏗️ Architektura — klíčové patterns

### Medusa v2 module struktura

```
backend/src/modules/<module-name>/
├── index.ts          # Module(MODULE_NAME, { service: ServiceClass }) nebo
│                     # ModuleProvider(Modules.PAYMENT, { services: [...] })
├── service.ts        # extends MedusaService nebo AbstractPaymentProvider
├── models/           # model.define("table_name", { ...fields })
├── migrations/       # Mikro-ORM migrations
└── api-client.ts     # HTTP wrapper pokud volá external API
```

### API routes (file-based)

```
backend/src/api/
├── admin/           # /admin/* — Medusa admin auth required
├── store/           # /store/* — public store (publishable API key)
├── public/          # /public/* — plně veřejné, custom CORS handling
└── webhooks/        # /webhooks/<provider>/route.ts — žádný auth, signature verify
```

**Pouze `GET`, `POST`, `DELETE`** — nikdy `PUT` ani `PATCH` (Medusa v2 konvence).

### Subscribers + cron jobs

- Subscribers: `/backend/src/subscribers/<event-name>.ts`
  - **VŽDY wrap v `try/catch`** — subscriber nesmí nikdy throw (blokoval by order flow)
  - Logger pattern: `[Module Name] Something happened`
- Cron jobs: `/backend/src/jobs/<job-name>.ts` s exportem `config = { name, schedule }`

### Payment providers — multi-tenant pattern

Všichni extend `AbstractPaymentProvider` s 10 metodami: `initiatePayment`, `authorizePayment`, `capturePayment`, `refundPayment`, `cancelPayment`, `deletePayment`, `getPaymentStatus`, `retrievePayment`, `updatePayment`, `getWebhookActionAndData`.

**Credentials load přes přímý `pg.Pool`** (payment provider DI scope nemá moduly):

```ts
const { rows } = await pool.query(
  `SELECT id, mode, live_keys, test_keys, project_slugs, priority
   FROM gateway_config
   WHERE provider = 'XXX' AND is_active = true AND deleted_at IS NULL
   ORDER BY priority ASC`
)
let config = projectSlug
  ? rows.find(r => Array.isArray(r.project_slugs) && r.project_slugs.includes(projectSlug))
  : null
if (!config) config = rows.find(r => !r.project_slugs?.length) || rows[0]
```

### Webhook handlery — safety net pattern

Pro **redirect-based** payment methods (iDEAL, Bancontact, BLIK, P24, PayPal, Klarna) **vždy** implement safety net:
1. Webhook přijde, žádný order se shodujícím intent_id
2. Wait 30s (`setTimeout`)
3. Re-check (cart mohl být dokončen normálně)
4. Find uncompleted cart podle `payment_session.data.intentId`
5. Call `completeCartWorkflow` → vznikne order
6. Update order.metadata + emit `payment.captured` event

**Canonical reference**: `/backend/src/api/webhooks/airwallex/route.ts`

### Admin UI patterns

- React + Medusa UI components (`@medusajs/ui`) + React Query (`@tanstack/react-query`)
- Data access: **`sdk.client.fetch<...>("/admin/...", {method:"GET"})`** — nikdy raw `fetch`
- Navigace: **`<Link to="/marketing/...">` z `react-router-dom`** — nikdy `<a href="#/...">` (Medusa v2 hash routing ignoruje, tlačítka nic nedělají)
- Route config: `defineRouteConfig({ label, nested? })` — `nested` jen pro built-in Medusa paths
- Pre-existing TS errors v `admin/routes/custom-orders`, `admin/lib/sdk.ts`, `admin/components/orders/order-timeline.tsx` jsou OK — **neřeš je** pokud to nesouvisí s úkolem

### Order metadata — cross-cutting store

Klíčové fieldy v `order.metadata`:
- `project_id` (loslatenboek, dehondenbijbel, ...)
- `payment_provider` (airwallex, paypal, novalnet, ...) + `payment_method`
- `custom_display_id` (`BE2026-2506` — country prefix + year + sequential)
- `dextrum_status` (WAITING → IMPORTED → PROCESSED → DISPATCHED → DELIVERED)
- Gateway-specific IDs: `airwallexPaymentIntentId`, `paypalOrderId`, `novalnetTid`, `stripePaymentIntentId`, atd.
- `completed_by` (`airwallex_webhook_safety_net` když order vznikl přes safety net)

**Critical subscriber**: `order-placed-payment-metadata.ts` kopíruje provider IDs z `payment.data` do `order.metadata`. Bez něj webhook handlery neumí najít order. **Při přidání nového payment provideru vždy přidat větev.**

## 🛡️ Konvence kódu

- `// @ts-nocheck` na začátku souborů co volají Medusa v2 (project-wide)
- **Žádné path aliases** (`@/...`) — použij relativní importy (`../../../modules/X`)
- **Logger prefixy** `[Module Name]` pro grep-ability:
  - `[Dextrum Hold]`, `[Airwallex Webhook]`, `[Marketing Dispatcher]`, `[Payment Metadata]`
- DB queries:
  - Single-table CRUD → `MedusaService` metody (`listX`, `createXs`, `updateXs`, `deleteXs`)
  - Joins / aggregations / JSON contains → **direct `pg.Pool`**
- **Amounts jsou v MAJOR units** (`49.99` = €49.99). **Nikdy nemultiplikovat ×100 ani nedividovat.** (výjimka: api-client pro providera co vyžaduje minor units → konverze jen v api-client layer)

## 🔧 Dostupné MCP servery

Klíčové (často používané):
- **`railway-mcp-server`** — `get-logs`, `list-deployments`, `list-variables`, `set-variables`
- **`nylas-full`** — Gmail pro `jaroslavostruszka@gmail.com` (grant `3a289a92-75ec-4ec3-8148-3103769ca44c`) + 2 další schránky
- **`plugin_medusa-dev_MedusaDocs`** — `ask_medusa_question` pro oficiální Medusa docs lookup
- **`fakturoid`** — kompletní invoice management (list, create, update, pay, webhook)
- **`meta_ads`** — Meta Ads insights, campaigns, audiences
- **`scheduled-tasks`** — durable Claude scheduled tasks (survives Claude Code restart)
- **`Claude_Preview`** — interaktivní preview MCP serverů při vývoji

## 📚 Skills — kdy load

**REQUIRED (auto-load při backend/frontend práci):**
- `medusa-dev:building-with-medusa` — POVINNĚ při jakémkoli Medusa backend úkolu
- `medusa-dev:building-storefronts` — při storefront úpravách
- `medusa-dev:building-admin-dashboard-customizations` — při admin UI

**User-level (volat proactively podle tématu):**
- `marketing-hub` — kontext k 7 projektům (audience, tone, ad library) — použij před psaním marketing contentu
- `reporting` — denní/týdenní profitabilita per projekt (revenue − ad spend)
- `ucetnictvi-pms` — měsíční účetnictví pro Performance Marketing
- `everchapter-accounting` — účetnictví pro estonský EverChapter OÜ
- `fakturoid-invoicing` — vystavování faktur z emailů / dat
- `invoice-email-matching` — párování plateb s fakturami
- `email-search-defaults` — hledání v 3 Nylas schránkách paralelně
- `negative-comments-moderation` — Meta ads komentáře
- `viral-video-creation`, `image-creation` — content creation (Nano Banana + Kling)
- `the-art-of-life-book` — psaní LIFE RESET™ knihy

## 🧠 Postupy pro typy úkolů

### Diagnostika "něco nefunguje"

1. **Reálná data first**, ne hypotézy:
   - Railway logs (`get-logs` s filtrem)
   - Postgres query (`PGPASSWORD=... psql -h maglev... -c "SQL"`)
2. **Lokalizuj v čase** — první výskyt? Korelace s deploy?
3. **Lokalizuj v kódu** — `Grep`, ne assumptions
4. **Verifikuj fix** — po opravě znovu zkontroluj logy / data
5. **Říkej co reálně víš** vs co hádáš

### Diagnostika plateb — **payment_journey_log** (Payment Journey Debugger)

Na každé platbě jsou zachyceny chronologické události pro forensic debugging
INCOMPLETE / failed / CREATED-but-abandoned plateb. Zdroj pravdy pro diagnózu:

**Tabulka:** `payment_journey_log` (columns: `intent_id`, `cart_id`, `email`,
`project_slug`, `event_type`, `event_data` jsonb, `error_code`, `occurred_at`).

**Event typy** (chronologicky v typickém flow):
- `checkout_viewed` → `payment_methods_loaded` → `payment_method_selected`
  → `submit_clicked` → `airwallex_intent_created` → `airwallex_confirm_request`
  → `airwallex_confirm_response` → `payment_return` → `airwallex_webhook_received`

**Workflow při diagnóze zákaznické stížnosti / INCOMPLETE platby:**

1. Admin endpoint (JSON timeline, vyžaduje admin cookie):
   ```
   GET /admin/payment-debug?intent_id=int_XXX
   GET /admin/payment-debug?email=customer@example.com
   GET /admin/payment-debug?cart_id=cart_XXX
   GET /admin/payment-debug?hours=24[&project_slug=loslatenboek]  ← funnel mode
   ```
2. Nebo přímo SQL:
   ```sql
   SELECT occurred_at, event_type, error_code, event_data
   FROM payment_journey_log
   WHERE lower(email) = lower('customer@example.com')
   ORDER BY occurred_at DESC LIMIT 50;
   ```
3. **Kde funnel typicky odpadá** — porovnat `count(event_type)` za stejné okno:
   - `checkout_viewed > payment_methods_loaded` → ad-blocker / CORS
   - `submit_clicked > airwallex_intent_created` → backend crash
   - `airwallex_confirm_response.error_code` → Airwallex rejection reason
   - `payment_return` chybí → zákazník se nevrátil z banky
   - `airwallex_webhook_received` má `failure_code` / `failure_reason`

**Kód:**
- Backend log helper: `backend/src/modules/payment-debug/utils/log.ts`
  (`logPaymentEvent()` — fire-and-forget, never throws)
- Instrumentace: `payment-airwallex/service.ts` (intent_created, confirm_*),
  `webhooks/airwallex/route.ts` (webhook_received)
- Public endpoint: `backend/src/api/public/payment-event/route.ts` (přijímá z frontendu)
- Storefront proxy: `storefront/src/app/api/payment-event/route.ts`
  (same-origin proti ad-blockerům)
- Checkout HTML trackery: `window.PaymentTracker` injected v každém
  `storefront/src/projects/*/pages/checkout.html`
- Admin query endpoint: `backend/src/api/admin/payment-debug/route.ts`

**Retention:** zatím žádný cleanup cron — do ~3 měsíců doplnit (TODO).

### Implementace nové fíčury

1. Pokud komplexní → **napsat plán první** (2-3 hodiny+ práce)
2. **TodoWrite** pro 3+ krok workflow
3. **Load medusa-dev skill** PŘED kódováním
4. Studuj **1-2 podobné moduly** jako vzor (canonical: Airwallex)
5. **Paralelní agenti** pro nezávislé části — ne sériově
6. **TS check** před commitem (`cd backend && npx tsc --noEmit -p .`)
7. Filtruj pre-existing errors, soustředit se jen na nové soubory
8. Commit konkrétními soubory, push staging
9. **Zeptat se před master merge**

### Refactor / oprava bugu

1. Najít root cause (ne jen symptom)
2. **Grep stejný pattern jinde** v codebase — bug je často copy-pasted
3. Fix + ověření že nikde jinde stejný problém není
4. Smoke test pokud možno

## ⚠️ Project-specific gotchas

| Gotcha | Popis |
|---|---|
| **`project_slugs` PLURAL (JSON array)** | Pole `project_slugs` v `gateway_config` tabulce je JSON array, ne scalar. Medusa `listX({project_slug: x})` throw — musí se načíst všechno + filtrovat v JS (`r.project_slugs.includes(slug)`) |
| **30-denní TTL firewall whitelist (Dextrum)** | Dextrum/Kvados firewall pravidla vyprší po 30 dnech defaultně. Po whitelistu IP vždy poprosit "natvrdo bez expirace" |
| **Safety-net activations u redirect metod** | BLIK, iDEAL, Bancontact, P24, PayPal, Klarna — safety-net je **normální** (zákazník nezavřel browser na bank potvrzovací stránce). Není to bug. |
| **Safety-net u inline credit card + gap >10 min** | Tohle už je reálný edge case (např. Drop-in iframe 3DS fail). Investigovat. |
| **SE orders ≠ Dextrum** | Švédské orders (`slapp-taget`) jedou přes **PostNord Linker WMS**, ne Dextrum. `dextrum_status=WAITING` u SE = PostNord integration issue. |
| **Novalnet AI model** | `claude-opus-4-5` NENÍ ověřený alias. Default je `claude-3-5-sonnet-latest`, override přes env `MARKETING_AI_MODEL`. Nikdy nehalucinovat model IDs. |
| **Marketing `wait_for_event` flow node** | Má bug — po 7denním timeout se re-parkuje místo advance. Nepoužívat dokud se neopraví. |
| **Dextrum IP whitelist** | Railway egress IP `162.220.232.99` musí být whitelisted v Dextrum firewall pro port 9341. Alternativa: Make.com proxy (6 AWS EU IPs). |
| **PL2026-329** | Známý zaseknutý Zásilkovna order (chybí pickupPlaceCode). Plní error log opakovanými retries — buď refund nebo doplnit pickup point. |

## 📌 Klíčové reference files (vzor pro nové komponenty)

| Co hledat | Kde je vzor |
|---|---|
| Canonical payment provider | `/backend/src/modules/payment-airwallex/service.ts` (plně implementovaný multi-tenant) |
| Canonical webhook handler se safety-net | `/backend/src/api/webhooks/airwallex/route.ts` |
| Admin page template (moderní design) | `/backend/src/admin/routes/marketing/page.tsx` (dashboard hub) |
| Admin page s forms + slide-overs | `/backend/src/admin/routes/settings-billing/page.tsx` |
| Cron job template | `/backend/src/jobs/abandoned-checkout-recovery.ts` |
| Subscriber pattern (try/catch defensive) | `/backend/src/subscribers/marketing-event-ingestor.ts` |
| Payment metadata copying | `/backend/src/subscribers/order-placed-payment-metadata.ts` |
| Multi-tenant gateway config pattern | `/backend/src/modules/payment-airwallex/service.ts` (funkce `getAirwallexClient`) |

## 🚫 NIKDY dělat

- **Halucinovat**: model IDs (Anthropic/OpenAI), package versions, URL endpoints, API field names. Vždy ověř přes `WebFetch`, `WebSearch`, `package.json`, nebo přiznat "tohle nevím".
- `git add .` nebo `git add -A`
- Push přímo na master bez explicitního povolení
- Skip hooks (`--no-verify`) nebo amend commitů
- Spustit migrations na produkci bez explicitního povolení
- Refundovat / chargeovat / odeslat email zákazníkovi **sám** — vždy **připravit + nechat schválit**
- Long sleep loops (`sleep 300 && ...`) — používat `run_in_background` nebo `Monitor`
- Přepsat `git config`

## ✅ VŽDY dělat

- **Verifikovat v reálných datech** před tvrzením (Railway logs, Postgres query)
- **Konkrétní paths a line numbers** v reportech
- **Tabulky a bullet pointy** místo dlouhých odstavců
- **Česky komunikace, anglicky code/comments**
- **Paralelizovat** nezávislé tool calls (multiple Bash/Read/Edit v jednom messagi)
- **TodoWrite** pro 3+ krokové úkoly
- **Load medusa-dev skill** při každé backend práci (projektový princip)
- **Commit konkrétními soubory** (`git add backend/src/X backend/src/Y`), ne wildcardy
- **Zeptat se před destructive operations** (migrations, mass updates, refunds)
- Po deploy **nabídnout ověření** přes Railway logs / Postgres query

## 📞 Typické akce/flows uživatele

- **"Napiš mi jak to uděláš"** = chce plán first, ne implementaci
- **"Ok udělej to"** = full zelená, prováděj TodoWrite + implementaci
- **"Otestuju si to sám"** = neklíčem credentials, neprovádět E2E test
- **"Dej to na staging"** = commit + push origin staging
- **"Dej to i na produkci"** = merge staging → master + push origin master (VŽDY potvrzení)
- **"Prověř to Opus 4.7"** / **"zkontroluj to"** = spustit několik paralelních review agentů s čerstvým kontextem (security, correctness, integration, UI/API contract)

## 🎯 Memory & kontext

- **User memory souborů** v `/Users/jaroslavostruszka/.claude/projects/-Users-jaroslavostruszka-thorough-nature/memory/MEMORY.md`
- Feedback notes v paralelních souborech (např. `feedback_no_hallucinated_ids.md`)
- Tyto soubory mají přednost před obecnými doporučeními
