# Marketing Platform — Implementation Plan

> **Cílová vize:** Postavit vlastní marketing platformu v stylu Klaviyo **uvnitř Medusa backendu**, unifikovanou přes všechny značky, s Resendem jako delivery vrstvou, s Claude AI integrací na tvorbu obsahu, segmentaci a brand voice.

---

## 0. TL;DR — rozhodnutí

| # | Bod | Volba |
|---|---|---|
| 1 | Pořadí fází | **Phase 0 → 1 → 2 → 3 striktně sekvenčně** |
| 2 | Multi-brand | **Unified from day one** — `brand_id` všude + dropdown switcher v top baru |
| 3 | Doména | **Dedicated marketing subdomain** (`news.<brand>.tld`) oddělená od transakční (`mail.<brand>.tld`) |
| 4 | Brand voice | **Brand voice profile** — styl + 5–10 ukázek → Claude Sonnet systémový prompt |
| 5 | Popup/forms | **Per-brand custom styling + možnost HTML injection**. Preheader a unsubscribe blok jsou **separátně** a HTML je nemůže ovlivnit |
| 6 | Double opt-in | **Default OFF**, přepínatelné per-project |
| 7 | Resend plán | **Deferred** (zatím Pro — řešíme za běhu až narazíme na limit) |

---

## 1. ŽELEZNÉ BEZPEČNOSTNÍ ZÁRUKY (must never break)

> **Tato sekce je TOP priority. Cokoliv níže v plánu, co by sem zasáhlo = bug a musí být opraveno před mergem.**

### 1.1 Existující emailová infrastruktura, které se NIKDY nedotkneme

**Modul `src/modules/email-notifications/`** (transakční Resend provider pro Medusa Notification Module):
- `src/modules/email-notifications/services/resend.ts` — `ResendNotificationService` s identifierem `RESEND_NOTIFICATION_SERVICE`
- `src/modules/email-notifications/templates/**` — **všechny** react-email šablony:
  - Generic: `order-placed.tsx`, `abandoned-checkout.tsx`, `ebook-delivery.tsx`, `shipment-notification.tsx`, `invite-user.tsx`, `admin-order-notification.tsx`, `base.tsx`
  - Brand-prefixed sady: `dh-*`, `lb-*`, `ll-*`, `ok-*`, `ps-*`, `st-*`
  - `index.tsx` (template registry + `EmailTemplates` enum + `resolveTemplateKey`)
- `src/modules/email-notifications/README.md`

**Registrace v `medusa-config.js`**:
```js
// ŘÁDKY 137–162 MEDUSA-CONFIG.JS — STAY UNTOUCHED
{
  key: Modules.NOTIFICATION,
  resolve: '@medusajs/notification',
  options: {
    providers: [
      { resolve: './src/modules/email-notifications', id: 'resend', ... }
    ]
  }
}
```

**Subscribery** v `src/subscribers/` — všechny volající `notificationModuleService.createNotifications()`:
- `order-placed.ts`, `order-placed-dextrum.ts`, `order-placed-ebook-fallback.ts`, `order-placed-digital-download.ts`, `order-placed-admin-notification.ts`, `order-placed-fakturoid.ts`
- `order-edit-admin-notification.ts`, `order-edit-customer-notification.ts`, `order-edit-fakturoid.ts`, `order-edit-ntfy.ts`
- `order-fulfillment-created.ts`
- `invite-created.ts`
- `refund-handler.ts`
- Všechny ostatní `order-placed-*` subscribery

**Cron joby**:
- `src/jobs/abandoned-checkout-recovery.ts` — 3-krokový abandoned cart flow. Používá `Modules.NOTIFICATION` a naše `EmailTemplates.*_ABANDONED_CHECKOUT_*` klíče. **BEZE ZMĚNY.**

**Utility helpers**:
- `src/utils/project-email-config.ts` — brand → from/reply-to/locale mapa
- `src/utils/render-email-html.ts`
- `src/utils/email-logger.ts`
- `src/utils/resolve-billing-entity.ts`
- `src/utils/idempotency-guard.ts`

**Modul `src/modules/resend-config/`** — separátní konfigurace Resend API klíčů per-brand:
- `models/resend-config.ts`, `service.ts`, `migrations/*`
- Admin routy `/admin/resend-config/*`

### 1.2 Izolační strategie nového modulu

| Vektor kolize | Stará infrastruktura | Nový modul |
|---|---|---|
| Medusa core notification provider | `id: 'resend'`, identifier `RESEND_NOTIFICATION_SERVICE`, kanál `'email'` | **Nový modul NENÍ provider pro Medusa Notification Module.** Používá vlastní `ResendClient` přímo (vlastní API key z `marketing_brand` tabulky) |
| Resend API klíč | `RESEND_API_KEY` env var | **Per-brand API key** uložený v `marketing_brand.resend_api_key` (může být jiný než transakční, nebo stejný — ale použit samostatně) |
| Resend `from` adresa | `RESEND_FROM_EMAIL` env / per-brand fromEmail v `project-email-config.ts` | **Marketingová subdoména** `news.<brand>.tld` — jiná doména = Resend ji ověřuje separátně, transakční deliverability není zasažena |
| Template registry | `EmailTemplates` enum v `email-notifications/templates/index.tsx` | **Nový `MarketingTemplates` enum v `src/modules/marketing/templates/index.ts`**. Žádná kolize klíčů |
| Event listening | `order.placed`, `order.fulfillment.created`, `order.edited`, `invite.created`, `refund.issued` | Marketing subscribery emitují **vlastní events** (`marketing.contact.created`, `marketing.event.ingested`) a poslouchají **read-only** na `order.placed` pro přepis Medusa objednávky do marketingového eventu. **Nikdy nevolá `createNotifications` pro transakční šablonu.** |
| Cron joby | `abandoned-checkout-recovery.ts` běží každých 15 min | Nové joby pod **jiným jménem**: `marketing-flow-runner`, `marketing-metrics-aggregator`, `marketing-doi-expiry` |
| Admin routy | `/admin/supportbox/*`, `/admin/resend-config/*`, atd. | **Namespace `/admin/marketing/*`** |
| Public routy | `/public/*` (advertorials, meta-capi, domain-resolve, ...) | **Namespace `/public/marketing/*`** — tracking pixel, click redirect, unsubscribe, form submit, form JS snippet |
| Store routy | `/store/*` | `/store/marketing/*` (authenticated self-service: preference center, GDPR export) |
| Webhook routy | `/webhooks/*` (comgate, supportbox, ...) | **`/webhooks/marketing/resend`** — bounce/complaint/delivered events z Resendu |
| Tabulky DB | Medusa core + `resend_config`, `supportbox_*`, atd. | **Prefix `marketing_*`** — `marketing_brand`, `marketing_contact`, `marketing_list`, `marketing_segment`, `marketing_template`, `marketing_campaign`, `marketing_flow`, `marketing_flow_run`, `marketing_event`, `marketing_message`, `marketing_suppression`, `marketing_form`, `marketing_consent_log` |

### 1.3 Regresní testy, které MUSÍ projít po každé fázi

Skripty / manuální test scénáře:
1. **Order placed → order confirmation email** — zadat testovací objednávku, zkontrolovat že dorazí z původní transakční adresy (např. `devries@loslatenboek.nl`), a šablona je ta původní (`lb-order-placed` / odpovídající brand prefix).
2. **Abandoned cart flow** — ponechat košík 35 min, po 30 min musí přijít step 1 z transakční infrastruktury.
3. **Admin invite** — pozvat uživatele z `/admin/settings/users`, zkontrolovat dorazí `invite-user` email.
4. **Shipment notification** — označit objednávku fulfilled, dorazí `*-shipment-notification` email.
5. **Refund handler** — vrátit objednávku, zkontrolovat že se nepokazila notifikace.

Každá fáze končí tím, že všech 5 scénářů prošlo na stagingu.

---

## 2. ARCHITEKTURA — overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     MEDUSA BACKEND (monolith)                    │
│                                                                  │
│  ┌──────── existing transactional ────────┐                      │
│  │ email-notifications (Resend provider)  │                      │
│  │ subscribers/*, jobs/abandoned-*        │  ← UNCHANGED         │
│  │ templates/{dh,lb,ll,ok,ps,st}-*        │                      │
│  └────────────────────────────────────────┘                      │
│                                                                  │
│  ┌────────── NEW marketing module ─────────┐                     │
│  │  src/modules/marketing/                 │                     │
│  │    models/         (13+ entities)       │                     │
│  │    services/       (brand, contact,     │                     │
│  │                     segment, campaign,  │                     │
│  │                     flow, event,        │                     │
│  │                     template, resend-   │                     │
│  │                     client, ai, form)   │                     │
│  │    templates/      (react-email blocks) │                     │
│  │    workflows/      (Medusa workflows)   │                     │
│  │    migrations/                          │                     │
│  │    index.ts                             │                     │
│  │                                         │                     │
│  │  src/subscribers/marketing-*.ts         │                     │
│  │  src/jobs/marketing-*.ts                │                     │
│  │  src/api/admin/marketing/**             │                     │
│  │  src/api/public/marketing/**  (public)   │                     │
│  │  src/admin/routes/marketing/**          │                     │
│  └─────────────────────────────────────────┘                     │
│                                                                  │
│                   │                                              │
│                   ▼                                              │
│            Resend API (separate                                  │
│            marketing subdomain per brand)                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. DATA MODEL

Všechny tabulky mají `brand_id` (FK → `marketing_brand.id`), `created_at`, `updated_at`. Indexy na `brand_id` a relevantních lookup polích.

### 3.1 Core entities

```ts
// src/modules/marketing/models/brand.ts
marketing_brand {
  id                  string pk
  slug                string unique   // "dehondenbijbel", "loslatenboek", ...
  display_name        string
  project_id          string         // matches order.metadata.project_id
  storefront_domain   string         // "loslatenboek.nl"
  marketing_from_email string        // "news@news.loslatenboek.nl"
  marketing_from_name string
  marketing_reply_to  string
  resend_api_key_encrypted string    // own key — separate from transactional
  resend_domain_id    string?        // Resend domain record id
  resend_audience_id  string?        // Resend Audience id (default audience)
  primary_color       string         // hex for templates
  logo_url            string?
  locale              string         // "nl", "de", "pl", "sv", "cs"
  timezone            string         // "Europe/Amsterdam"
  double_opt_in_enabled boolean default false   // ← user decision #6
  brand_voice_profile jsonb?         // { tone, style_guide, sample_emails[] }
  enabled             boolean default true
  metadata            jsonb?
}

marketing_contact {
  id                  string pk
  brand_id            fk
  email               string
  phone               string?
  first_name          string?
  last_name           string?
  locale              string?
  country_code        string?
  timezone            string?
  status              enum('subscribed','unconfirmed','unsubscribed','bounced','complained','suppressed')
  source              string         // "popup", "checkout", "manual", "import", "api"
  consent_version     string?        // GDPR proof
  consent_ip          string?
  consent_user_agent  string?
  consent_at          timestamp?
  unsubscribed_at     timestamp?
  external_id         string?        // link to Medusa customer_id
  properties          jsonb?         // arbitrary custom props used in segmentation
  computed            jsonb?         // { rfm_score, clv, churn_risk, last_open_at, ... }
  tags                text[]
  metadata            jsonb?
  UNIQUE(brand_id, email)
}

marketing_list {
  id                  string pk
  brand_id            fk
  name                string
  description         string?
  type                enum('static','dynamic')
  metadata            jsonb?
}

marketing_list_membership {
  list_id             fk
  contact_id          fk
  added_at            timestamp
  source              string?
  PRIMARY KEY(list_id, contact_id)
}

marketing_segment {
  id                  string pk
  brand_id            fk
  name                string
  description         string?
  query               jsonb          // DSL — viz 3.2
  is_suppression      boolean default false
  cached_count        integer?
  cached_at           timestamp?
}

marketing_template {
  id                  string pk
  brand_id            fk
  name                string
  subject             string
  preheader           string         // ← separate field, never from HTML body
  from_name           string?
  from_email          string?
  reply_to            string?
  block_json          jsonb          // block-based editor output (source of truth)
  compiled_html       text?          // cached MJML/react-email render
  compiled_text       text?          // plaintext fallback
  editor_type         enum('blocks','html','visual')
  version             integer default 1
  status              enum('draft','ready','archived')
  brand_voice_used    boolean default false
  metadata            jsonb?
}

marketing_campaign {
  id                  string pk
  brand_id            fk
  name                string
  template_id         fk
  list_id             fk?
  segment_id          fk?
  suppression_segment_ids string[]
  send_at             timestamp?       // null = send immediately when status=scheduled
  sent_at             timestamp?
  status              enum('draft','scheduled','sending','sent','paused','failed')
  metrics             jsonb?           // aggregated counters
  ab_test             jsonb?           // { variants: [{ template_id, weight }], winner_metric, winner_template_id }
  metadata            jsonb?
}

marketing_flow {
  id                  string pk
  brand_id            fk
  name                string
  description         string?
  trigger             jsonb          // { type: 'event'|'segment_enter'|'date_property'|'webhook', config: {...} }
  definition          jsonb          // nodes + edges (visual graph)
  status              enum('draft','live','paused','archived')
  version             integer default 1
  stats               jsonb?
}

marketing_flow_run {
  id                  string pk
  flow_id             fk
  contact_id          fk
  current_node_id     string?
  state               enum('running','waiting','completed','exited','errored')
  started_at          timestamp
  next_run_at         timestamp?     // for waits
  context             jsonb          // triggering event + computed data
  completed_at        timestamp?
  error               text?
}

marketing_event {
  id                  uuid pk
  brand_id            fk
  contact_id          fk?
  email               string         // for events before contact exists
  type                string         // "page_view","product_viewed","cart_updated","order_placed","email_opened","email_clicked","form_submitted"
  payload             jsonb
  occurred_at         timestamp
  processed_at        timestamp?
  -- PARTITION BY RANGE (occurred_at)  ← optional optimization later
}

marketing_message {
  id                  string pk
  brand_id            fk
  contact_id          fk
  campaign_id         fk?
  flow_id             fk?
  flow_run_id         fk?
  template_id         fk
  resend_email_id     string?
  subject_snapshot    string
  to_email            string
  from_email          string
  status              enum('queued','sent','delivered','opened','clicked','bounced','complained','failed','suppressed')
  sent_at             timestamp?
  delivered_at        timestamp?
  first_opened_at     timestamp?
  first_clicked_at    timestamp?
  bounced_at          timestamp?
  complained_at       timestamp?
  bounce_reason       string?
  opens_count         integer default 0
  clicks_count        integer default 0
  error               text?
}

marketing_suppression {
  id                  string pk
  brand_id            fk
  email               string
  reason              enum('unsubscribed','bounced_hard','complained','manual','gdpr_erasure')
  source_message_id   fk?
  suppressed_at       timestamp
  UNIQUE(brand_id, email)
}

marketing_form {
  id                  string pk
  brand_id            fk
  slug                string
  name                string
  type                enum('popup','embedded','flyout','banner','landing')
  config              jsonb          // trigger, timing, position, ...
  styling             jsonb          // colors, fonts, spacing — "popup style"
  custom_html         text?          // ← user decision #5: raw HTML injection allowed
  custom_css          text?
  fields              jsonb          // [{name, label, type, required}]
  success_action      jsonb          // { type: 'message'|'redirect', value }
  target_list_ids     string[]?
  target_segment_id   fk?
  double_opt_in       boolean?       // null=inherit brand default, true/false=override
  consent_text        text           // GDPR consent checkbox text
  status              enum('draft','live','paused')
  metrics             jsonb?         // { views, submits, conversion_rate }
}

marketing_consent_log {
  id                  uuid pk
  brand_id            fk
  contact_id          fk?
  email               string
  action              enum('subscribed','confirmed','unsubscribed','preference_changed','gdpr_erasure')
  source              string         // "form:<slug>", "checkout", "manual_import", ...
  consent_text_snapshot text
  ip_address          string?
  user_agent          string?
  occurred_at         timestamp
}

marketing_ai_job {
  id                  string pk
  brand_id            fk
  type                enum('subject_generation','body_generation','segment_from_prompt','brand_voice_training')
  input               jsonb
  output              jsonb?
  model               string         // "claude-sonnet-4-5-20250929" etc. — verified via docs
  tokens_in           integer?
  tokens_out          integer?
  status              enum('queued','running','completed','failed')
  error               text?
}
```

> **TODO při implementaci:** všechny Claude model ID verifikovat z aktuální Anthropic dokumentace před commitem (memory-rule: no hallucinated IDs). V době psaní plánu **necommitujeme konkrétní model ID do kódu** — load from env `ANTHROPIC_MODEL`.

### 3.2 Segment Query DSL

```json
{
  "op": "and",
  "conditions": [
    { "type": "event_exists", "event": "order_placed", "in_last_days": 30 },
    {
      "type": "property",
      "field": "computed.lifetime_value",
      "op": "gte",
      "value": 100
    },
    {
      "op": "or",
      "conditions": [
        { "type": "list", "list_id": "lst_vip", "mode": "in" },
        { "type": "tag", "value": "high_engagement" }
      ]
    },
    { "type": "not", "condition": { "type": "suppressed" } }
  ]
}
```

Evaluator = pure TypeScript function `evaluate(query, contactContext): boolean` + SQL builder pro batch queries.

### 3.3 Flow node types

```ts
type FlowNode =
  | { id, type: 'trigger', config: {...} }
  | { id, type: 'send_email', config: { template_id, from_override? } }
  | { id, type: 'wait', config: { duration_ms | until_event | until_iso | until_local_time } }
  | { id, type: 'branch_if', config: { query: SegmentQuery, then_node, else_node } }
  | { id, type: 'branch_split', config: { variants: [{ weight, next }] } }
  | { id, type: 'update_contact', config: { set_properties, add_tags, remove_tags } }
  | { id, type: 'add_to_list' | 'remove_from_list', config: { list_id } }
  | { id, type: 'webhook', config: { url, payload_template } }
  | { id, type: 'exit' }
```

---

## 4. BRAND SWITCHING UX

### 4.1 Top-bar brand switcher (admin)

- Admin widget injektovaný do Medusa UI via `src/admin/widgets/marketing-brand-switcher.tsx`
- Dropdown vpravo vedle avataru: seznam `marketing_brand` + "All brands"
- Výběr ukládán do `localStorage` key `marketing_active_brand_id` + duplicated v url query `?brand=`
- Všechny Admin API calls v `/admin/marketing/*` MUSÍ akceptovat `x-marketing-brand-id` header NEBO `?brand=` query param
- Guard: pokud není brand vybrán, admin ukáže prompt "Vyber značku pro zobrazení marketingu"

### 4.2 React hook

```ts
// src/admin/lib/use-marketing-brand.ts
export function useMarketingBrand(): {
  brandId: string | null
  brand: Brand | null
  setBrandId: (id: string) => void
  withBrandHeader: (init?: RequestInit) => RequestInit
}
```

---

## 5. FÁZE 0 — FOUNDATION (nepřerušitelný základ)

> **Cíl**: Založit modul, data model, brandy, subscriber pipeline, Resend client, suppression, tracking pixel — **bez jakékoliv UI pro koncového admina**. Existující email flow musí být nedotčen.

### 5.1 Deliverables

| # | Task | Files |
|---|---|---|
| P0-1 | Vytvořit modul `src/modules/marketing/` + prázdné models, service skeleton | `index.ts`, `service.ts`, `models/*.ts` |
| P0-2 | Migrace všech tabulek | `migrations/Migration<timestamp>_MarketingInit.ts` |
| P0-3 | Registrovat modul v `medusa-config.js` **jen jako custom module** (ne jako notification provider) | `medusa-config.js` line ~93 (po `advertorial`) |
| P0-4 | Seed script: vytvořit `marketing_brand` řádky pro všech 6 stávajících projektů (dehondenbijbel, loslatenboek, slapp-taget, odpusc-ksiazka, lass-los, psi-superzivot) | `src/scripts/seed-marketing-brands.ts` |
| P0-5 | Per-brand Resend API key — env var `MARKETING_RESEND_API_KEY_<SLUG>` optional override, jinak fallback na `RESEND_API_KEY` | `services/resend-client.ts` |
| P0-6 | `ResendMarketingClient` class (own wrapper, NOT registered as Medusa NotificationProvider) — posílá přes Resend, loguje do `marketing_message`, respektuje suppression | `services/resend-client.ts` |
| P0-7 | Subscribery přepisující Medusa události do `marketing_event`: listen na `order.placed`, `order.updated`, `cart.updated`, `customer.created`, `customer.updated` a ingestuje je **read-only** | `src/subscribers/marketing-event-ingestor.ts` |
| P0-8 | Contact upsert při každém `marketing_event` — pokud kontakt neexistuje, vytvoří ho se `status='subscribed'` *pouze když dorazil z checkout/order eventu*; jinak `status='unconfirmed'` | `services/contact.ts` |
| P0-9 | Suppression list: bounce/complaint webhook endpoint + manuální suppression API | `src/api/webhooks/marketing/resend/route.ts` |
| P0-10 | Tracking pixel endpoint: `/public/marketing/o/:message_id.gif` (open) + `/public/marketing/c/:message_id?url=<target>` (click → redirect) | `src/api/public/marketing/o/[id]/route.ts`, `c/[id]/route.ts` |
| P0-11 | Unsubscribe endpoint: `/public/marketing/u/:contact_token` — GET zobrazí potvrzení, POST označí jako unsubscribed + `List-Unsubscribe` RFC 8058 one-click POST endpoint | `src/api/public/marketing/u/[token]/route.ts` |
| P0-12 | Resend domain setup helper — vytvoří `news.<domain>` záznam via Resend API, vrátí DNS recordy pro DKIM/SPF/DMARC | `services/resend-domain.ts` |
| P0-13 | Brand switcher widget (schovaný za feature flag) | `src/admin/widgets/marketing-brand-switcher.tsx` |
| P0-14 | Admin API: `/admin/marketing/brands` CRUD + `/admin/marketing/brands/:id/setup-domain` | `src/api/admin/marketing/brands/**` |

### 5.2 Resend Client — kritické principy

```ts
// services/resend-client.ts
class ResendMarketingClient {
  constructor(private brand: MarketingBrand) {
    if (!brand.resend_api_key_encrypted) throw new Error('brand missing resend key')
    this.client = new Resend(decrypt(brand.resend_api_key_encrypted))
  }

  async send(params: {
    contact: MarketingContact
    template: MarketingTemplate
    campaignId?: string
    flowRunId?: string
  }): Promise<MarketingMessage> {
    // 1. SUPPRESSION CHECK — hard stop
    if (await this.isSuppressed(this.brand.id, params.contact.email)) {
      return this.recordSuppressed(...)
    }
    // 2. STATUS CHECK
    if (params.contact.status !== 'subscribed') {
      return this.recordSuppressed(...)
    }
    // 3. Render body (compiled_html + inject per-message tracking pixels & unsub link)
    const { html, text, subject, preheader } = await this.renderForContact(params)
    // 4. Send via Resend
    const result = await this.client.emails.send({
      from: `${this.brand.marketing_from_name} <${this.brand.marketing_from_email}>`,
      to: params.contact.email,
      subject,
      html,
      text,
      reply_to: this.brand.marketing_reply_to,
      headers: {
        'List-Unsubscribe': `<${this.unsubscribeUrl(params.contact)}>, <mailto:${this.unsubMailto(params.contact)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      tags: [
        { name: 'brand', value: this.brand.slug },
        ...(params.campaignId ? [{ name: 'campaign', value: params.campaignId }] : []),
        ...(params.flowRunId ? [{ name: 'flow_run', value: params.flowRunId }] : []),
      ],
    })
    // 5. Record in marketing_message
    return this.recordSent(result.data.id, ...)
  }
}
```

### 5.3 HTML rendering pipeline (template → email)

**Source of truth = `marketing_template.block_json`.** Compile pipeline:

```
block_json  →  mjml string  →  mjml.compile()  →  html
                                      ↓
                              html-to-text  →  plaintext
```

**Preheader** se injektuje **po** kompilaci jako první `<div style="display:none">{preheader}</div>` uvnitř `<body>` — garantuje, že jakékoliv custom HTML od uživatele **nemůže** preheader zneplatnit.

**Unsubscribe blok** se injektuje jako footer **vždy**, i když uživatel vložil vlastní HTML. Implementace: template compiler po MJML renderu regex-nahradí placeholder `<!-- MARKETING_UNSUB_FOOTER -->` (pokud existuje) nebo appenduje blok před `</body>`. Blok obsahuje:
- Brand adresu (povinné GDPR / CAN-SPAM)
- "You received this because..."
- Unsubscribe link `{unsub_url}` (per-contact token)
- "Update preferences" link

### 5.4 DoD fáze 0

- [ ] `npx medusa db:migrate` projde
- [ ] Seed vytvořil 6 `marketing_brand` řádků
- [ ] `POST /admin/marketing/brands/:id/test-send` pošle test email z marketing subdomény bez toho, aby se dotkl `email-notifications` modulu
- [ ] `ResendMarketingClient` má unit testy na suppression logic
- [ ] Všech 5 regresních testů z §1.3 prošlo

---

## 6. FÁZE 1 — FORMS & POPUPS & CONTACTS

> **Cíl**: Umožnit sběr kontaktů přes formuláře/popupy, správu kontaktů, listů a segmentů. Double opt-in flow. Per-brand custom styling + HTML injection.

### 6.1 Deliverables

| # | Task |
|---|---|
| P1-1 | Admin UI `/admin/marketing/contacts` — list, detail, bulk actions (tag, unsubscribe, delete, export CSV) |
| P1-2 | Admin UI `/admin/marketing/lists` — create/edit static & dynamic list |
| P1-3 | Admin UI `/admin/marketing/segments` — visual query builder nad DSL z §3.2 + **"Segment from prompt"** (AI-assisted) |
| P1-4 | `SegmentEvaluatorService` — TypeScript + SQL builder; endpoint `/admin/marketing/segments/:id/preview` vrátí count + sample 20 |
| P1-5 | Admin UI `/admin/marketing/forms` — form builder |
| P1-6 | Styling editor s per-brand custom styling + **HTML/CSS injection textarea** |
| P1-7 | **Preheader a unsubscribe blok jako separátní fields** v editoru forem — user decision #5 |
| P1-8 | Public rendering endpoint `/public/marketing/forms/:slug.js` — vrací JS snippet, který do stránky injektuje popup |
| P1-9 | Public submit endpoint `POST /public/marketing/forms/:slug/submit` — upsert contactu, log consent, trigger DOI flow pokud `double_opt_in=true` |
| P1-10 | DOI flow: "confirm your subscription" email → klik → `marketing_contact.status = 'subscribed'` |
| P1-11 | Import CSV (bulk) s consent proof fields |
| P1-12 | GDPR: export all data for contact, erasure endpoint |
| P1-13 | Checkout integration: při `order.placed` s `order.metadata.marketing_opt_in=true` upsert kontaktu s `source='checkout'` a consent snapshotem |

### 6.2 Forms — styling & HTML injection

```ts
// marketing_form.styling (JSONB)
{
  layout: 'modal' | 'slide-in' | 'banner' | 'inline',
  position: 'center' | 'bottom-right' | ...,
  theme: {
    background: '#ffffff',
    text: '#111111',
    accent: '#ff6600',
    font_family: 'Inter, sans-serif',
    border_radius: '12px',
    padding: '32px'
  },
  headline: 'Get 10% off your first order',
  subheadline: '...',
  button_text: 'Subscribe',
  image_url: 'https://...'
}

// marketing_form.custom_html (TEXT)
// Raw HTML rendered INSIDE the form body.
// SECURITY: sanitized with DOMPurify on client-side AND server-side.
// Allowed tags: h1-h6, p, div, span, img, a, ul, ol, li, strong, em, br, hr
// Blocked: script, iframe, object, embed, on* attributes, javascript: urls
// CANNOT override: preheader, unsubscribe footer, consent checkbox
```

**Rendered form DOM structure** (enforced):
```html
<div class="mkt-form-root" data-brand="{slug}" data-form="{slug}">
  <div class="mkt-form-preheader">{preheader}</div>   <!-- separate, never affected by custom_html -->
  <div class="mkt-form-body">
    {styled_headline}
    {styled_subheadline}
    {custom_html_sanitized}                            <!-- user's raw HTML goes here -->
    {styled_fields}
    {consent_checkbox}
  </div>
  <div class="mkt-form-footer">
    {unsubscribe_info}                                 <!-- separate -->
  </div>
</div>
```

### 6.3 Double opt-in

```
Form submit
  └─> contact created with status='unconfirmed'
      └─> if brand.double_opt_in_enabled OR form.double_opt_in=true:
          └─> send DOI email (Claude-generated, fallback hard-coded)
              └─> contains /public/marketing/confirm/:token link
                  └─> status='subscribed' + consent_log entry
      └─> else:
          └─> status='subscribed' immediately, log consent
```

**User decision #6**: `double_opt_in_enabled = false` by default on brand. Form může override na true.

### 6.4 DoD fáze 1

- [ ] Test popup na staging storefrontu → submit → kontakt se objeví v `/admin/marketing/contacts` pod správným brandem
- [ ] Přepnutí brand switcheru v top baru → kontakty se zfiltrovaly
- [ ] Segment builder vytvoří segment "objednali v posledních 30 dnech" → preview vrátí správný count
- [ ] DOI flow na jednom brandu → email dorazí z marketing subdomény
- [ ] Původní checkout transakční email funguje beze změn (regression test §1.3)

---

## 7. FÁZE 2 — TEMPLATES, EDITOR, CAMPAIGNS

> **Cíl**: Block-based email editor, brand voice AI, jednorázové kampaně, A/B testy.

### 7.1 Deliverables

| # | Task |
|---|---|
| P2-1 | Block editor admin UI — drag&drop `Text, Heading, Image, Button, Divider, Spacer, Columns, Product, Social, Raw HTML` |
| P2-2 | Template preview — live render pomocí stejného pipeline jako při odesílání |
| P2-3 | **Brand voice training**: admin UI "Paste 5-10 sample emails + describe style" → uložit do `marketing_brand.brand_voice_profile` |
| P2-4 | AI writer: endpoint `/admin/marketing/ai/generate-copy` — použije brand voice profile jako systemprompt + user instrukci |
| P2-5 | Subject line AI: 5 variant + predicted open rate (heuristika nebo Claude scoring) |
| P2-6 | Campaign builder — recipient (list/segment), template, suppression, send-at, A/B |
| P2-7 | Campaign send worker — bere queue jobs, chunkuje po 100 kontaktech, rate-limited dle Resend planu (Pro = 10 req/s default, konfigurovatelně) |
| P2-8 | A/B test — splituje audience, po definovaném time window vyhodnotí winner metric (open rate / click rate / revenue) a pošle zbytku |
| P2-9 | Metrics dashboard — delivered, opened, clicked, bounced, complained, unsubscribed, revenue attributed |
| P2-10 | Revenue attribution — UTM params na click trackerovi + join přes `marketing_message → marketing_event(order_placed)` v okně 7 dní |

### 7.2 Send worker — rate limiting

```ts
// src/jobs/marketing-campaign-dispatcher.ts
// Runs every 1 minute.
// Finds campaigns where status='sending', picks up next batch from marketing_message queue,
// sends via ResendMarketingClient, updates status.
//
// Rate limit per brand: read from marketing_brand.metadata.resend_rate_limit (default 10/s).
// Uses Bottleneck or simple token bucket on brand_id key.
```

### 7.3 Brand voice AI flow

```ts
// services/brand-voice.ts
async function generateWithBrandVoice(
  brandId: string,
  userPrompt: string,
  target: 'subject' | 'body' | 'preheader'
): Promise<string> {
  const brand = await brandService.retrieve(brandId)
  const profile = brand.brand_voice_profile ?? {}

  const systemPrompt = `
You are a copywriter for ${brand.display_name}.
Tone: ${profile.tone ?? 'professional, friendly'}
Style guide: ${profile.style_guide ?? 'n/a'}
Locale: ${brand.locale}
Do-not-use words: ${(profile.avoid ?? []).join(', ')}

Here are ${profile.sample_emails?.length ?? 0} sample emails written in the brand voice:
${(profile.sample_emails ?? []).map((s, i) => `--- SAMPLE ${i+1} ---\n${s}\n`).join('\n')}

Now write a ${target} matching this exact voice.
`.trim()

  const model = process.env.ANTHROPIC_MODEL // verified at deploy, not hardcoded
  if (!model) throw new Error('ANTHROPIC_MODEL not configured')

  const response = await anthropic.messages.create({
    model,
    max_tokens: target === 'body' ? 2000 : 200,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })
  return response.content[0].text
}
```

### 7.4 DoD fáze 2

- [ ] Vytvořit template v editoru → preview vypadá stejně jako v Gmailu / Apple Mail
- [ ] Brand voice profile — vložit 5 sample emailů, vygenerovat body, výstup se stylově shoduje
- [ ] Naplánovat kampaň na 100 test kontaktů → všechny doručeny, metrics update v real-time
- [ ] A/B test na 2 subject varianty → winner detekován a rozesláno zbytku
- [ ] Regrese §1.3 projde

---

## 8. FÁZE 3 — FLOWS, AI, MCP

> **Cíl**: Automation flows (welcome, abandoned browse, post-purchase, winback), predictive AI, MCP integrace.

### 8.1 Deliverables

| # | Task |
|---|---|
| P3-1 | Visual flow builder (React Flow library) |
| P3-2 | Flow runtime engine — state machine executing nodes, persists `marketing_flow_run` |
| P3-3 | Flow trigger subscribers: event-based (`marketing.event.ingested`), segment-enter (diff-based cron), date-property (birthdays etc.) |
| P3-4 | **6 core flows templates** (Sturtevant framework) s brand-voice-generated copy: Welcome series, Browse abandonment, Checkout abandonment, Post-purchase thank-you, Winback (90 days), Birthday |
| P3-5 | **⚠️ IMPORTANT**: New "Checkout Abandonment" flow v marketing modulu **NESMÍ** duplikovat emaily s existujícím `abandoned-checkout-recovery.ts`. Guardrail: marketing flow kontroluje `cart.metadata.recovery_email_sent` a `recovery_email_step` — pokud existuje, přeskočí. Alternativně: užívatel explicitně rozhodne ve flow, že transakční cron migrátuje do marketing flow (migration script, za-běhu rozhodnutí). Default: **marketing abandonment flow je disabled dokud admin nevypne transakční cron pro daný brand** |
| P3-6 | Predictive AI: CLV score, churn risk, best-send-time — computed v `marketing_contact.computed` cron jobem |
| P3-7 | Send-time optimization — per-contact best hour z `marketing_event` open histogramu |
| P3-8 | MCP server exposující marketing nástroje: `create_campaign`, `send_test`, `query_segment`, `generate_copy`, `get_campaign_stats` |
| P3-9 | Claude Code integrace dokumentace |

### 8.2 Conflict resolution s existujícím abandoned-checkout-recovery

Toto je **kritický** bod, protože:
1. Máme transakční cron `src/jobs/abandoned-checkout-recovery.ts` který rozesílá 3-krokový flow přes Medusa Notification Module (hardcoded brand templates).
2. Nový marketing modul může teoreticky taky reagovat na abandoned carts.

**Řešení:**

```ts
// marketing_brand NEW fields:
abandoned_cart_owner: enum('transactional_legacy', 'marketing_flow', 'none') default 'transactional_legacy'
```

- Default `transactional_legacy` = existující cron pokračuje, marketing flow pro abandoned cart je **disabled** pro tento brand
- Admin může per-brand přepnout na `marketing_flow` — pak:
  - `src/jobs/abandoned-checkout-recovery.ts` přidá guard: **skip brands where `marketing_brand.abandoned_cart_owner != 'transactional_legacy'`**
  - Marketing flow trigger začne reagovat
- Guard je implementován tak, že při starte jobu fetchne seznam brandů s `abandoned_cart_owner != 'transactional_legacy'` a jejich `project_id` filtruje z `projectId === 'X'` switch-case.

**Nic jiného** v `abandoned-checkout-recovery.ts` se nemění. Žádný rewrite, jen přidaný filter ať se nepřekrývají.

### 8.3 DoD fáze 3

- [ ] Vytvořit welcome flow z presetu → nový kontakt trigger → email 1 → wait 2 dny → email 2
- [ ] Flow runtime přežije restart backendu (persist state, resume)
- [ ] Transakční abandoned cart flow stále funguje pro brandy s `abandoned_cart_owner='transactional_legacy'`
- [ ] MCP server volatelný z Claude Code → vytvoří draft kampaň
- [ ] Regrese §1.3 projde

---

## 9. GDPR & PRIVACY

| Požadavek | Implementace |
|---|---|
| Art. 6 lawful basis | Opt-in (form) nebo legitimate interest (transakční, existující customer) — zaznamenáno v `marketing_consent_log.source` |
| Art. 7 proof of consent | `marketing_consent_log` s IP, UA, text snapshot, timestamp |
| Art. 13 info at collection | Consent checkbox text uložen ve form definici a snapshotovaný při submitu |
| Art. 15 access | `GET /store/marketing/me?token=...` vrátí všechna data kontaktu |
| Art. 17 erasure | `POST /admin/marketing/contacts/:id/erase` nuluje PII, zanechává `marketing_message` jen s hashovaným emailem pro audit, přidává do suppression |
| Art. 21 object | Unsubscribe link v každém emailu, one-click RFC 8058 |
| Art. 30 records | `marketing_consent_log` je immutable audit |
| Data retention | Cron `marketing-retention` maže eventy > 2 roky (configurable per brand) |
| Tracking pixel | Lze vypnout per brand (`marketing_brand.metadata.tracking_enabled=false`) pro PECR compliance |

---

## 10. SUBDOMAIN & DELIVERABILITY

Pro každý brand:
- Marketing doména: `news.<apex>` — např. `news.loslatenboek.nl`
- Transakční doména (stávající): `mail.<apex>` nebo přímo `<apex>` — nedotýkáme se
- DKIM / SPF / DMARC setupovány oddělně pro `news.*` (Resend helper automatizuje vytvoření domain recordu + vrátí DNS records k přidání)
- DMARC policy pro `news.*`: `p=quarantine` default, admin může zvednout na `reject` po 30 dnech bez issues
- BIMI — optional doc, uživatel sám nahraje SVG + certifikát
- IP warmup: Resend shared pool zvládá, dedicated IP zatím ne (Resend Pro)

---

## 11. MIGRATION PLAN (order of execution)

1. **Merge Phase 0** na staging, smoke test, 5 regresních testů §1.3, 48 hodin monitoring
2. **Deploy na produkci** (staging → master PR se schválením)
3. Seed brandů + Resend domain setup `news.*` pro každý brand
4. DNS ve frontě: uživatel přidá DKIM/SPF záznamy
5. **Merge Phase 1**, stejný postup
6. Test popup na jedné značce (např. slapp-taget) — malá audience
7. **Merge Phase 2**, pošlat první kampaň na malý segment (10 kontaktů)
8. Postupné zvyšování objemu, sledovat bounce/complaint rate
9. **Merge Phase 3** až po min. 2 týdnech zdravého chodu Phase 2
10. Migrace abandoned cart flow z transakčního cronu na marketing flow per-brand **pouze po explicitním user rozhodnutí**

---

## 12. SAFETY CHECKLIST (před každým mergem)

- [ ] `src/modules/email-notifications/**` — žádné změny
- [ ] `src/subscribers/*` — žádné nové subscribery s prefixem jiným než `marketing-`; existující nedotčené
- [ ] `src/jobs/abandoned-checkout-recovery.ts` — změny POUZE v podobě guard filteru pro `abandoned_cart_owner`; zbytek logiky netknutý
- [ ] `src/utils/project-email-config.ts` — netknutý
- [ ] `medusa-config.js` — jediná změna je přidání `{ resolve: "./src/modules/marketing" }` do modules array. Notification module blok (řádky 137-162) **netknutý**
- [ ] `EmailTemplates` enum v `email-notifications/templates/index.tsx` — netknutý
- [ ] Všech 5 regresních scénářů §1.3 prošlo
- [ ] `RESEND_NOTIFICATION_SERVICE` identifier se nikde v marketing modulu nevyskytuje (grep check)
- [ ] Marketing modul nevolá `Modules.NOTIFICATION` resolve
- [ ] Grep `notificationModuleService.createNotifications` v `src/modules/marketing/**` = 0 výsledků

---

## 13. TECH STACK — finalized

| Vrstva | Nástroj |
|---|---|
| Email delivery | Resend (přímo přes `resend` npm balíček — separátní instance, ne přes Medusa Notification Module) |
| Email rendering | MJML (pro flexibilitu blokového editoru) + `mjml` npm; backup react-email pro system emaily |
| HTML sanitization | `isomorphic-dompurify` (server + client) |
| Segment evaluator | TypeScript pure function + SQL builder (Knex-like s parametrizací) |
| Flow runtime | XState nebo vlastní mini state machine nad BullMQ/pg-boss |
| Queue | Medusa workflow engine (Redis) — už je v `medusa-config.js` |
| Visual flow editor | `reactflow` |
| Form builder | custom React + DOMPurify |
| AI | Anthropic SDK; model ID z env `ANTHROPIC_MODEL` (no hardcode) |
| Metrics | Postgres + materialized views pro agregace |
| MCP | `@modelcontextprotocol/sdk` |

---

## 14. DECISION POINTS STILL OPEN (to confirm before Phase 0 merge)

1. **Resend API key per brand**: budeš mít **jeden** účet Resend s více doménami (→ jeden API key, všechny brandy sdílejí), nebo **více Resend účtů** (→ key per brand)? Default plán počítá s jedním účtem, víc domén — ale data model podporuje oboje.
2. **Encryption at rest pro API keys**: budeme mít master secret v env (`MARKETING_KEYSTORE_SECRET`) a šifrovat `resend_api_key_encrypted` pomocí `crypto.createCipheriv('aes-256-gcm', ...)`. Pokud stačí plaintext v DB (stejný přístup jako stávající `resend-config`), zjednodušíme.
3. **Tracking pixel default**: ON or OFF? Industry: ON. EU/GDPR hodně práva: OFF bez explicit consentu. Doporučení: ON ale s consent logem a možností vypnout per brand.
4. **Storage pro `block_json` snapshots při versioningu**: buď `marketing_template_version` tabulka (čistší, historizovaný), nebo jen `block_json` pole + `compiled_html` pole (jednodušší). Doporučení: začít s jednoduchou verzí.

---

## 15. NEXT STEPS

1. Schválit tento plán (případně doupřesnit body z §14)
2. Já vytvořím Phase 0 PR — branch `staging`, commit po malých logických blocích, každý commit samostatně buildovatelný
3. Po Phase 0 merge → 48h monitoring → Phase 1
4. Po Phase 1 merge → test popup → Phase 2
5. Po Phase 2 merge → první malá kampaň → Phase 3

---

**Konec plánu.** Po jeho schválení spouštím Phase 0.
