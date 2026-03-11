# Claude Code Prompt: Email Marketing Platform v2 — Simplified

## Kontext
Medusa 2.0 e-commerce platforma (monorepo: /backend + /storefront). Staging branch, Railway deploy.
Vizuální reference: /email-platform-v2-preview.html + /orders-dashboard-preview.html
Architektonický dokument: /email-client-architecture.md
Platforma prodává knihy v EU (NL, BE, DE, AT, PL, CZ, SE, HU, LU). Každý projekt = jiná kniha.

Existující/plánované moduly: analytics (tracking), meta-pixel (FB CAPI). Tato implementace se s nimi integruje.

---

## DESIGN FILOSOFIE

"ConvertKit jednoduchost + Klaviyo power."
- Žádný visual flowchart builder — sekvence jsou LINEÁRNÍ TIMELINE (vertikální seznam kroků)
- Email editor je čistý textový editor (styl Notion/Medium), NE drag-and-drop block builder
- Kampaně se tvoří step-by-step formulářem (3 kroky)
- AI je všude přítomná — ne jako oddělená sekce, ale jako asistent v každém kroku
- Vše je per-project (projekt = kniha = pixel = emaily = branding)

---

## ČÁST 1: DATA MODEL

### Medusa modul: /backend/src/modules/email-client/

#### Entity:

**Subscriber**
- id (UUID), project_id (indexed), email (unique per project, indexed)
- first_name, last_name, phone (nullable)
- language (nl/de/pl/cs/sv/hu), country (2-letter ISO)
- source (enum): "popup", "inline_form", "checkout", "import", "manual", "facebook_lead"
- visitor_id (nullable) — propojení s analytics
- name_forms (jsonb, nullable) — předpočítané skloňované tvary pro PL/CZ/HU:
  { first_name: { nominative, vocative, dative, accusative, genitive, instrumental, locative },
    city: { nominative, locative, genitive } }
- engagement_score (int 0-100, default 50)
- lifecycle_stage (enum): new, engaged, customer, repeat_customer, vip, at_risk, churned
- status (enum): active, unsubscribed, bounced, complained, cleaned
- total_emails_sent, total_opens, total_clicks, total_purchases (int, default 0)
- total_revenue (decimal, default 0)
- last_open_at, last_click_at, last_purchase_at (nullable timestamps)
- optimal_send_hour (int 0-23, nullable) — AI-computed best hour to send
- gdpr_consent (bool), gdpr_consent_at, gdpr_consent_ip, gdpr_consent_source
- subscribed_at, unsubscribed_at (nullable)
- metadata (jsonb, default {})
- created_at, updated_at

**SubscriberTag**
- id, subscriber_id (FK, indexed), tag (string, indexed), auto_applied (bool)
- Unique index: (subscriber_id, tag)

**SubscriberGroup**
- id, project_id (indexed), name, type (static/dynamic)
- dynamic_conditions (jsonb, nullable), subscriber_count (int cache)

**SubscriberGroupMembership**
- subscriber_id (FK), group_id (FK) — compound PK

**EmailTemplate**
- id, project_id (indexed), name, subject, preview_text (nullable)
- html_content (text), json_content (jsonb, nullable)
- type (campaign/sequence/transactional)
- created_at, updated_at

**EmailCampaign**
- id, project_id (indexed), name
- status (enum): draft, scheduled, sending, sent, paused
- template_id (FK), subject_line, subject_line_b (nullable), preview_text (nullable)
- sender_name, sender_email, reply_to
- target_group_id (FK, nullable), target_segment (jsonb, nullable), exclude_group_id (FK, nullable)
- estimated_recipients (int)
- sent_count, delivered_count, bounced_count (int defaults 0)
- opened_count, unique_opened_count, clicked_count, unique_clicked_count (int defaults 0)
- unsubscribed_count, complained_count, conversion_count (int defaults 0)
- revenue (decimal, default 0)
- ab_test_enabled (bool, default false)
- ab_test_winner_metric (open_rate/click_rate, nullable)
- ab_test_sample_pct (int, default 20), ab_test_wait_hours (int, default 4)
- ab_test_winner (a/b, nullable)
- scheduled_at, sent_at (nullable)
- send_rate_limit (int, nullable)
- created_at, updated_at

**EmailSendLog**
- id, campaign_id (FK, nullable), sequence_id (FK, nullable), sequence_step_id (FK, nullable)
- subscriber_id (FK, indexed), project_id (indexed)
- resend_email_id (string, nullable)
- subject (string)
- status (enum): queued, sent, delivered, opened, clicked, bounced, complained
- opened_at, clicked_at, clicked_links (jsonb, default [])
- bounced_at, bounce_type (hard/soft, nullable)
- unsubscribed_at (nullable)
- conversion_order_id (nullable), conversion_amount (decimal, nullable)
- sent_at, created_at

**EmailSequence**
- id, project_id (indexed), name
- type (enum): welcome, abandoned_cart, post_purchase, winback, browse_abandonment, vip, sunset, custom
- status (enum): active, paused, draft
- trigger_type (enum): group_join, tag_added, tag_removed, purchase, cart_abandoned, page_visited, custom_event
- trigger_config (jsonb) — { group_id, tag_name, event_name... }
- goal_event (string, nullable) — "purchased", "tag:some_tag", "clicked"
- total_enrolled, total_completed, total_goal_reached (int defaults 0)
- total_revenue (decimal, default 0)
- created_at, updated_at

**SequenceStep** (DŮLEŽITÉ: ne "Node" — pojmenuj "Step" pro jednoduchost)
- id, sequence_id (FK, indexed)
- position (int) — pořadí v lineární timeline
- type (enum): email, wait, condition, add_tag, remove_tag, move_to_group, notify, end
- config (jsonb):
  - email: { template_id, subject, sender_name, sender_email }
  - wait: { delay_value: 2, delay_unit: "days" | "hours" }
  - condition: { check: "has_tag" | "purchased" | "opened_previous" | "clicked_previous" | "engagement_above", value: "purchased" | 50, if_true: "skip_to_end" | "skip_next" | "continue", if_false: "continue" }
  - add_tag/remove_tag: { tag: "completed_welcome" }
  - move_to_group: { group_id: "..." }
  - notify: { message: "VIP customer inactive" }
- stats_sent, stats_opened, stats_clicked, stats_converted (int defaults 0)
- ai_suggestion (string, nullable) — poslední AI doporučení pro tento step
- created_at, updated_at

**SequenceEnrollment**
- id, sequence_id (FK, indexed), subscriber_id (FK, indexed)
- current_step_id (FK, nullable)
- status (enum): active, completed, goal_reached, cancelled
- next_action_at (timestamp, nullable, indexed)
- enrolled_at, completed_at, goal_reached_at (nullable)
- step_history (jsonb, default []) — [{step_id, action, timestamp, result}]
- created_at, updated_at

**SuppressionList**
- id, email (indexed, unique), reason (hard_bounce/complaint/unsubscribe/manual)
- project_id (nullable — null = global)
- created_at

**AIInsight**
- id, project_id (nullable)
- priority (enum): critical, important, suggestion
- category: deliverability, engagement, revenue, list_health, ab_test, sequence
- title, description (text), impact_estimate (nullable)
- action_type (nullable): start_ab_test, edit_sequence, create_segment, pause_campaign, reschedule, auto_optimize
- action_config (jsonb, nullable)
- status (enum): new, read, applied, dismissed
- created_at, updated_at

**ABTest**
- id, project_id (indexed), name
- type (enum): subject_line, content, send_time
- source_type (campaign/sequence_step), source_id (string)
- variant_a, variant_b (jsonb)
- metric (enum): open_rate, click_rate, conversion_rate
- sample_size_per_variant (int)
- variant_a_sent, variant_a_opens, variant_a_clicks, variant_a_conversions (int defaults 0)
- variant_b_sent, variant_b_opens, variant_b_clicks, variant_b_conversions (int defaults 0)
- winner (a/b, nullable), confidence (decimal 0-100, nullable)
- status (enum): running, completed, auto_applied
- auto_apply (bool, default false)
- started_at, completed_at (nullable), created_at, updated_at

**MarketingCalendarEvent**
- id, project_id (nullable — null = all projects)
- title, description (nullable)
- event_type (enum): campaign, holiday, custom
- date (date)
- campaign_id (FK, nullable)
- country (nullable — pro country-specific holidays)
- ai_suggested (bool, default false)
- created_at

---

## ČÁST 2: SERVICES

### 2a. SubscriberService
- create(data) — vytvořit, přidat do default skupiny, spustit name declension pokud PL/CZ/HU
- update(id, data), delete(id)
- findByEmail(email, projectId), findByVisitorId(visitorId)
- addTag(id, tag, autoApplied?), removeTag(id, tag), hasTags(id, tags[])
- search(projectId, filters, pagination) — fulltext search + tag/lifecycle/engagement filtry
- importFromCSV(csv, projectId, groupId)
- exportToCSV(projectId, filters)

### 2b. NameDeclensionService
- generateForms(firstName, lastName, city, country, language):
  Pokud language je "pl", "cs", nebo "hu":
  1. Zkontroluj Redis cache (key: `declension:${language}:${firstName}`)
  2. Pokud cache miss → zavolej Claude API:
     Prompt: "Vyskloňuj {language} {gender} jméno '{firstName}' ve všech pádech. Vrať JSON: {nominative, genitive, dative, accusative, vocative, instrumental, locative}"
  3. Ulož do Redis cache (TTL 30 dní) + do subscriber.name_forms
  4. Pro město: stejný postup
  Pokud language je "nl", "de", "sv", "en" → ulož jen nominativ, neskloňuj

### 2c. CampaignService
- create(data) — draft
- update(id, data)
- schedule(id, scheduledAt)
- send(id):
  1. Načti příjemce (group + segment - exclude - suppression list - unsubscribed)
  2. Pokud A/B test: rozděl sample, pošli varianty, čekej, vyhodnoť, pošli winner zbytku
  3. Pokud Smart Send: pro každého subscribera naplánuj na jeho optimal_send_hour
  4. Batched odesílání přes Resend (100/batch, respektuj send_rate_limit)
  5. Aktualizuj statistiky průběžně
- pause(id), getStats(id), getLinkPerformance(id), getTopConverters(id)

### 2d. SequenceService
- create(data + steps[])
- update(id, data), activate(id), pause(id)
- addStep(sequenceId, stepData, afterPosition)
- updateStep(stepId, data), removeStep(stepId)
- reorderSteps(sequenceId, stepIds[])
- enrollSubscriber(sequenceId, subscriberId)
- cancelEnrollment(enrollmentId)
- getStats(id) — per-step statistiky

### 2e. SequenceEngine (Cron Job — každou minutu)
```
1. SELECT enrollments WHERE status='active' AND next_action_at <= NOW() LIMIT 100
2. Pro každý enrollment:
   a. Načti current step
   b. Zkontroluj goal → pokud splněn → status='goal_reached', END
   c. Proveď step podle type:
      - email: Odešli email přes EmailSenderService → posuň na next step
      - wait: next_action_at = NOW + delay → DONE (čeká)
      - condition: Evaluuj → if_true/if_false akce (skip_to_end, skip_next, continue)
      - add_tag/remove_tag: Proveď → posuň na next
      - move_to_group: Proveď → posuň na next
      - notify: Pošli notifikaci → posuň na next
      - end: status='completed'
   d. Ulož enrollment + step_history
```

### 2f. EmailSenderService (Resend wrapper)
- send(to, subject, html, options):
  1. Zkontroluj suppression list → pokud suppressed, skip
  2. Přepiš linky v HTML — přidej UTM parametry:
     utm_source=email, utm_medium={type}, utm_campaign={name}, utm_content=link_{n}
     Plus: ?eid={campaign_id|step_id}&sid={subscriber_id}
  3. Přidej unsubscribe header (RFC 8058 one-click)
  4. Přidej List-Unsubscribe-Post header
  5. Resolvuj personalizaci:
     - {{first_name}} → subscriber.first_name (nominativ)
     - {{first_name.vocative}} → subscriber.name_forms.first_name.vocative
     - {{first_name.dative}} → subscriber.name_forms.first_name.dative
     - atd. pro všechny pády
     - {{city}}, {{city.locative}}, {{city.genitive}}
     - {{last_product_name}}, {{order_number}}, {{unsubscribe_url}}
  6. Pošli přes resend.emails.send()
  7. Vytvoř EmailSendLog záznam
  8. Retry 3× s exponential backoff při selhání

- sendBatch(emails[]) — max 100 per Resend API call
- sendCampaign(campaignId) — orchestruje batch sending s rate limiting
- handleWebhook(event) — zpracuj Resend webhook eventy

### 2g. AutomationService (Event Listeners)

Naslouchá eventům a spouští odpovídající akce:

**subscriber.created:**
- Pokud source = "popup" nebo "inline_form": přidej do "Leads" skupiny → spustí Welcome sekvenci
- Pokud source = "checkout": přidej do "Customers" skupiny → spustí Post-Purchase sekvenci
- Spustí NameDeclensionService pro PL/CZ/HU

**order.placed:**
- Najdi/vytvoř subscribera z order email
- Přidej tagy: "purchased", "purchased:{product_id}"
- Odstraň tag "abandoned_cart" (ukončí Abandoned Cart sekvenci)
- Aktualizuj: total_purchases, total_revenue, lifecycle_stage
- Zapíše do Post-Purchase sekvence
- Zkontroluj repeat purchase → "repeat_buyer" tag
- Zkontroluj total_revenue > €100 → "vip" tag

**analytics.cart_abandoned (z analytics modulu):**
- Přidej tag "abandoned_cart" → spustí Abandoned Cart sekvenci

**analytics.page_viewed (z analytics modulu):**
- Pokud sales page + 4h bez purchase + nemá tag "purchased":
  → tag "browse_abandoned" → spustí Browse Abandonment sekvenci

**email.webhook.opened:**
- Aktualizuj subscriber: last_open_at, total_opens, engagement_score
- Odstraň "email_inactive_*" tagy
- Aktualizuj enrollment metadata: opened_previous = true

**email.webhook.clicked:**
- Aktualizuj subscriber: last_click_at, total_clicks
- Aktualizuj EmailSendLog: clicked_links
- Aktualizuj enrollment metadata: clicked_previous = true

**email.webhook.bounced:**
- Hard bounce → SuppressionList + subscriber status = "bounced"
- Soft bounce → zaloguj, při 3. soft bounce → suppress

**email.webhook.complained:**
- SuppressionList + subscriber status = "complained" + unsubscribe

### 2h. EngagementScoringJob (Cron — denně 3:00 AM)
Pro každého aktivního subscribera:
```
score = 50 (base)
+ 20 pokud otevřel v posledních 7 dnech
+ 10 pokud otevřel v posledních 30 dnech
+ 15 pokud klikl v posledních 30 dnech
+ 30 pokud koupil v posledních 30 dnech
+ 15 pokud koupil v posledních 90 dnech
- 20 pokud neotevřel 30+ dní
- 30 pokud neotevřel 60+ dní
- 40 pokud neotevřel 90+ dní
= clamp(0, 100)
```
Aktualizuj engagement_score, lifecycle_stage, automatické tagy.
Spočítej optimal_send_hour z historie otevírání (hodina s nejvíce opens).

### 2i. ListHygieneJob (Cron — denně 4:00 AM)
- Odstraň hard bounced → suppression
- Aktualizuj subscriber_count na skupinách
- Přepočítej dynamic group membership

---

## ČÁST 3: AI SYSTÉM

### 3a. AIAdvisorService

**generateDailyInsights(projectId?):**
1. Agreguj data za 7 dní (campaign stats, sequence stats, subscriber trends, deliverability)
2. Porovnej s historickými průměry + industry benchmarky
3. Zavolej Claude API s daty jako kontext:
```
Prompt: "Jsi senior email marketing expert pro e-commerce s knihami.
Analyzuj tato data a vygeneruj 3-5 actionable insights.
Formát: [{priority, title, description, impact_estimate, action_type, action_config}]

Data:
- Campaign stats posledních 7 dní: [...]
- Sequence performance: [...]
- Subscriber trends: [...]
- Deliverability metrics: [...]
- Benchmarky: open rate 25-35%, CTR 3-5% pro e-commerce knihy

Zaměř se na:
1. Co urgentně opravit (klesající metriky, deliverability problémy)
2. Co optimalizovat (slabé subject lines, vysoké drop-offy v sekvencích)
3. Příležitosti (nevyužité segmenty, chybějící sekvence, upcoming holidays)"
```
4. Parsuj response → ulož jako AIInsight záznamy

**generateWeeklyReport(projectId?):**
Kompletní týdenní AI report → uložit + poslat email adminovi

**evaluateSubjectLine(subject, projectId):**
Pošli do Claude API s historickými daty o úspěšných subject lines → predicted open rate + suggestions

**autoOptimizeSequenceStep(stepId):**
1. Načti step statistiky + porovnej s průměrem sekvence
2. Pokud open rate < průměr - 10%: vygeneruj 3 nové subject line varianty
3. Automaticky spustí A/B test s nejlepší variantou
4. Zaloguj do AI changelog

**suggestCampaignForHoliday(holidayEvent):**
Vygeneruj návrh kampaně (subject line, key messaging, timing) pro nadcházející svátek/událost

### 3b. ABTestService
- create(data)
- evaluate(testId): chi-squared test pro statistickou signifikanci
  Pokud confidence > 95%: označ winner, pokud auto_apply → aplikuj winner
- autoStart(sourceType, sourceId): AI spustí A/B test když detekuje pokles performance

### 3c. AI Auto-Optimization Engine (volitelné per projekt)

Konfigurovatelné auto-akce (každá zapnutelná/vypnutelná):

| Feature | Co dělá | Default |
|---------|---------|---------|
| Auto A/B test subject lines | Při poklesu open rate automaticky generuje a testuje nové varianty | ON |
| Smart send time | Posílá email každému subscriberovi v jeho optimal_send_hour | ON |
| Auto list cleanup | Odstraňuje 90d+ neaktivní (přes Sunset sekvenci) | ON |
| Weekly AI report | Generuje a posílá týdenní analýzu | ON |
| Auto-pause bad campaigns | Pauzuje pokud bounce >2% nebo complaint >0.1% | ON |
| Auto-optimize content | AI přepisuje underperforming emaily (vyžaduje schválení) | OFF |

Každá auto-akce se loguje do AI Changelog tabulky.

---

## ČÁST 4: SUBSCRIBER ENTRY POINTS

### 4a. Popup formulář

Store API endpoint: POST /store/email/subscribe
```
Body: {
  email: string,
  first_name: string (optional),
  project_id: string,
  source: "popup",
  gdpr_consent: true,
  page_url: string (odkud přišel)
}
```
Response: { success: true, subscriber_id }

Storefront komponenta: PopupSubscribeForm
- Zobrazí se po X sekundách nebo při exit intent
- Konfigurováno per projekt (text, nabídka, timing)
- Po submitu: vytvoř subscribera → přidej do "Leads" skupiny → spustí Welcome sekvenci

### 4b. Inline formulář

Stejný endpoint, source: "inline_form"
Storefront komponenta: InlineSubscribeForm
- Embednutý natvrdo na stránce (sales page, blog, footer)
- Per-projekt konfigurace

### 4c. Checkout (automaticky)

Při order.placed subscriber:
- AutomationService detekuje order
- Najde/vytvoří subscribera z order.email
- source: "checkout"
- Přidá do "Customers" skupiny
- Spustí Post-Purchase sekvenci (NE Welcome — ten je pro leady)

---

## ČÁST 5: MARKETING CALENDAR

### 5a. MarketingCalendarService

- getEventsForMonth(year, month, projectId?) — vrátí eventy + kampaně + svátky
- createEvent(data)
- getUpcomingHolidays(projectId, daysAhead):
  Vrátí relevantní svátky pro projekt (podle country) s AI-generovanými návrhy kampaní

### 5b. Předdefinované svátky per country

Uložené v seedu nebo konfiguraci:

**NL/BE:** Koningsdag (Apr 27), Sinterklaas (Dec 5), Moederdag (May 11), Vaderdag (Jun 15), Valentijnsdag (Feb 14), Kerst (Dec 25), Black Friday, Nieuwjaar
**DE/AT:** Muttertag (May 11), Vatertag (May 29), Weihnachten (Dec 25), Ostern, Valentinstag, Black Friday
**PL:** Dzień Kobiet (Mar 8), Dzień Matki (May 26), Dzień Ojca (Jun 23), Wielkanoc, Boże Narodzenie, Black Friday, Walentynki
**CZ:** Den matek (May 10), Velikonoce, Vánoce, Valentýn, Black Friday, Den otců
**SE:** Mors dag (May 25), Fars dag (Nov 9), Jul (Dec 25), Alla hjärtans dag, Black Friday
**HU:** Anyák napja (May 3), Valentin-nap, Karácsony, Húsvét

**Mezinárodní:** International Women's Day (Mar 8), World Book Day (Apr 23), Earth Day (Apr 22), Mental Health Day (Oct 10), New Year

### 5c. AI Holiday Campaign Suggestions

AIAdvisorService.suggestCampaignForHoliday():
- 2 týdny před svátkem generuje návrh: subject line, messaging angle, timing, segment
- Příklad pro Dzień Kobiet (PL, Mar 8):
  "78% your PL audience is female. Suggest: 'Odpuść to co cię niszczy — prezent dla siebie na Dzień Kobiet' s 10% slevou, odeslat 6. března."

---

## ČÁST 6: PŘEDPŘIPRAVENÉ SEKVENCE (šablony)

Při vytvoření nového projektu systém nabídne automatické vytvoření těchto sekvencí:

### Welcome Series (5 steps)
```
Trigger: subscriber joins "Leads" group | Goal: tag "purchased"
1. [Email] Vítej + slíbená nabídka (immediately)
2. [Wait] 2 dny
3. [Condition] Purchased? → Yes: skip to end
4. [Email] Příběh + social proof
5. [Wait] 3 dny
6. [Condition] Purchased? → Yes: skip to end
7. [Email] FAQ + recenze
8. [Wait] 3 dny
9. [Email] Urgence
10. [Wait] 4 dny
11. [Email] Poslední šance + silná nabídka
12. [End] Tag "completed_welcome" + Move to "Newsletter"
```

### Abandoned Cart (3 emails, 48h)
```
Trigger: tag "abandoned_cart" added | Goal: tag "purchased"
1. [Wait] 1 hodina
2. [Condition] Purchased? → Yes: skip to end
3. [Email] Připomínka s produktem
4. [Wait] 23 hodin
5. [Condition] Purchased?
6. [Email] Social proof + urgence
7. [Wait] 24 hodin
8. [Condition] Purchased?
9. [Email] Sleva 10% — poslední šance
10. [End] Remove tag "abandoned_cart"
```

### Post-Purchase (4 emails, 30 days)
```
Trigger: order.placed | Goal: tag "repeat_buyer"
1. [Email] Potvrzení + co čekat
2. [Wait] 3 dny
3. [Email] Tipy k produktu
4. [Wait] 7 dní
5. [Email] Žádost o recenzi
6. [Wait] 14 dní
7. [Email] Upsell — doplňkový produkt
8. [End] Tag "completed_post_purchase"
```

### Win-Back (30d inactive)
```
Trigger: tag "email_inactive_30d" | Goal: opened any email
1. [Email] "Chybíš nám" + nový obsah
2. [Wait] 7 dní
3. [Condition] Opened? → Yes: remove inactive tags, end
4. [Email] Speciální nabídka
5. [Wait] 14 dní
6. [Condition] Opened? → Yes: end
7. [Email] "Chceš dál dostávat emaily?" — re-confirm link
8. [Wait] 7 dní
9. [Condition] Clicked re-confirm? → Yes: end
10. [End] Unsubscribe + tag "churned"
```

### Browse Abandonment (2 emails)
```
Trigger: tag "browse_abandoned" | Goal: tag "purchased"
1. [Email] "Viděl jsi [produkt]" + social proof
2. [Wait] 2 dny
3. [Condition] Purchased?
4. [Email] Omezená nabídka
5. [End]
```

### Sunset / List Cleanup (90d inactive)
```
Trigger: tag "email_inactive_90d"
1. [Email] "Potvrzení zájmu" — klikni pokud chceš zůstat
2. [Wait] 14 dní
3. [Condition] Clicked? → Yes: remove inactive tags, end
4. [End] Unsubscribe + tag "sunset_removed"
```

---

## ČÁST 7: API ENDPOINTS

### Admin API (/admin/email/)

**Dashboard:** GET /overview, /subscriber-growth, /recent-campaigns, /active-sequences, /ai-health-score (vše s ?project_id=&period=)

**Subscribers:** GET / (list+search), GET /:id, POST /, PUT /:id, POST /:id/tags, DELETE /:id/tags/:tag, POST /import, GET /export

**Groups:** GET /, POST /, PUT /:id, DELETE /:id

**Campaigns:** GET /, GET /:id, POST /, PUT /:id, POST /:id/send, POST /:id/schedule, POST /:id/pause, POST /:id/test, GET /:id/links, GET /:id/converters

**Sequences:** GET /, GET /:id, POST /, PUT /:id, POST /:id/activate, POST /:id/pause, GET /:id/enrollments, POST /:id/steps, PUT /:id/steps/:stepId, DELETE /:id/steps/:stepId, POST /:id/steps/reorder

**Templates:** GET /, POST /, PUT /:id, DELETE /:id, POST /:id/preview

**A/B Tests:** GET /, GET /:id, POST /, POST /:id/evaluate, POST /:id/apply-winner

**AI:** GET /insights, PUT /insights/:id, POST /generate-insights, POST /evaluate-subject, POST /suggest-ab-test, GET /weekly-report, GET /changelog

**Calendar:** GET /events?month=&year=&project_id=, POST /events, GET /upcoming-holidays?project_id=

### Store API (/store/email/)
- POST /subscribe — popup/inline form subscription
- POST /unsubscribe — odhlášení
- GET /unsubscribe?token= — one-click unsubscribe stránka
- POST /webhook/resend — Resend webhook receiver (validated)

---

## ČÁST 8: INTEGRACE

### S Analytics modulem
- subscriber.visitor_id ↔ analytics visitor_id
- sid parametr v email links → propojení subscriber identity s analytics session
- Analytics cart_abandoned event → email automation trigger
- Analytics page_viewed → browse abandonment trigger
- Email konverze → analytics EmailConversion záznam

### S Meta Pixel modulem
- Email purchase konverze → Meta CAPI (FB vidí email funnel konverze)
- FB lead ads → automaticky vytvoř subscribera
- Attribution chain: FB Ad → Subscriber → Email → Purchase

### S Medusa Orders
- order.placed → subscriber tags, revenue update, post-purchase sekvence
- order.refunded → úprava tagů a revenue
- Checkout metadata obsahuje subscriber_id

---

## ČÁST 9: DORUČITELNOST

### Per-projekt subdomény
- marketing: news.{domena}
- transakční: mail.{domena}
- SPF + DKIM (přes Resend) + DMARC per subdoména
- reply-to na monitorovaný email (NE no-reply)

### Warmup Manager
```
Week 1: max 50/day → posílej jen highest engagement subscribers
Week 2: max 100/day
Week 3: max 250/day
Week 4: max 500/day
Week 5+: plný objem
```
EmailSenderService respektuje warmup limity.

### Auto-ochranná pravidla
- Suppression check před každým odesláním
- Hard bounce → suppress, soft bounce po 3× → suppress
- Campaign bounce rate > 2% → auto-pause + AI critical alert
- Complaint rate > 0.1% → auto-pause + critical alert
- Unsubscribe rate > 1% → AI warning

---

## ČÁST 10: FRONTEND

Vytvoř stránky pod /admin/email/ (nebo Medusa Admin widgety).
Design přesně podle /email-platform-v2-preview.html:

1. **Dashboard** — stat karty, AI quick insight bar, recent campaigns, active sequences
2. **Campaigns** — tabulka + 3-step creation form + detail panel
3. **Sequences** — karty + LINEÁRNÍ TIMELINE editor (vertikální seznam step karet s [+ Add Step])
4. **Subscribers** — tabulka s filtry + 3 entry point karty + profil panel
5. **AI Autopilot** — health score, auto-action toggles, insights feed, A/B tests, changelog
6. **Calendar** — měsíční grid + holiday suggestions sidebar
7. **Settings** — per-project: subdoména, warmup status, AI auto-optimization toggles, default sender

---

## TECHNICKÉ POŽADAVKY

- Resend SDK: `npm install resend`
- Anthropic SDK: `npm install @anthropic-ai/sdk` (pro AI features)
- React Email: `npm install @react-email/components` (pro email šablony)
- UUID: `crypto.randomUUID()`
- Cron: Medusa scheduled jobs
- Redis: rate limiting, name declension cache, job queue
- Batch: max 100 emails per Resend call
- Retry: 3× exponential backoff (1s, 2s, 4s)
- DB indexy: FK, project_id, status, created_at, next_action_at, email
- Logging: strukturované (campaign_id, subscriber_id, resend_email_id)
- Webhook validation: ověřuj Resend webhook signatures

## PO DOKONČENÍ
```
git add . && git commit -m 'feat: Email marketing platform v2 — linear sequences, AI autopilot, campaign calendar, personalization with declension' && git push origin staging
```
