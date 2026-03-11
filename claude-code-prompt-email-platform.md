# Claude Code Prompt: Email Marketing Platform s AI

## Kontext
Pracuji na Medusa 2.0 e-commerce platformě (monorepo: /backend + /storefront).
Staging branch, auto-deploy na Railway.
Vizuální reference: /email-platform-preview.html, /orders-dashboard-preview.html
Architektura: /email-client-architecture.md

Platforma prodává knihy v EU (NL, BE, DE, AT, PL, CZ, SE, HU, LU).
Každý projekt = jiná kniha = vlastní pixel, emaily, branding.

Už existuje (nebo bude existovat) analytics modul a meta-pixel modul — tato implementace se s nimi musí integrovat.

---

## ČÁST 1: DATA MODEL — Subscriber & Email entities

### 1a. Medusa modul: /backend/src/modules/email-client/

Vytvoř nový Medusa modul s těmito entitami:

**Subscriber**
```
- id (PK, UUID)
- project_id (string, indexed)
- email (string, unique per project, indexed)
- first_name (string, nullable)
- last_name (string, nullable)
- phone (string, nullable)
- language (string) — "nl", "de", "pl", "cs", "sv", "hu"
- country (string, 2-letter ISO)
- source (string) — "checkout", "popup", "landing_page", "import", "manual", "facebook_lead"
- visitor_id (string, nullable) — propojení s analytics visitor
- engagement_score (integer, default 50) — 0-100
- lifecycle_stage (enum) — "new", "engaged", "customer", "repeat_customer", "vip", "at_risk", "churned"
- status (enum) — "active", "unsubscribed", "bounced", "complained", "cleaned"
- total_emails_sent (integer, default 0)
- total_opens (integer, default 0)
- total_clicks (integer, default 0)
- total_purchases (integer, default 0)
- total_revenue (decimal, default 0)
- last_open_at (timestamp, nullable)
- last_click_at (timestamp, nullable)
- last_purchase_at (timestamp, nullable)
- gdpr_consent (boolean, default false)
- gdpr_consent_at (timestamp, nullable)
- gdpr_consent_ip (string, nullable)
- gdpr_consent_source (string, nullable)
- subscribed_at (timestamp)
- unsubscribed_at (timestamp, nullable)
- metadata (jsonb, default {})
- created_at, updated_at
```

**SubscriberTag**
```
- id (PK, UUID)
- subscriber_id (FK → Subscriber, indexed)
- tag (string, indexed) — např. "purchased", "abandoned_cart", "vip", "from_facebook"
- auto_applied (boolean) — true pokud přidán systémem
- created_at
```
Compound unique index na (subscriber_id, tag).

**SubscriberGroup**
```
- id (PK, UUID)
- project_id (string, indexed)
- name (string)
- type (enum) — "static", "dynamic"
- dynamic_conditions (jsonb, nullable) — podmínky pro dynamickou skupinu
- subscriber_count (integer, default 0) — cache
- created_at, updated_at
```

**SubscriberGroupMembership**
```
- subscriber_id (FK)
- group_id (FK)
- created_at
```
Compound PK na (subscriber_id, group_id).

**EmailTemplate**
```
- id (PK, UUID)
- project_id (string, indexed)
- name (string)
- subject (string)
- preview_text (string, nullable)
- html_content (text) — React Email kompatibilní HTML
- json_content (jsonb, nullable) — strukturovaný obsah pro editor
- type (enum) — "campaign", "sequence", "transactional"
- created_at, updated_at
```

**EmailCampaign**
```
- id (PK, UUID)
- project_id (string, indexed)
- name (string)
- status (enum) — "draft", "scheduled", "sending", "sent", "paused"
- template_id (FK → EmailTemplate)
- subject_line (string)
- subject_line_b (string, nullable) — A/B variant
- preview_text (string, nullable)
- sender_name (string)
- sender_email (string)
- reply_to (string)
- target_group_id (FK → SubscriberGroup, nullable)
- target_segment (jsonb, nullable) — segmentační podmínky
- exclude_group_id (FK → SubscriberGroup, nullable)
- estimated_recipients (integer, default 0)
- sent_count (integer, default 0)
- delivered_count (integer, default 0)
- bounced_count (integer, default 0)
- opened_count (integer, default 0)
- unique_opened_count (integer, default 0)
- clicked_count (integer, default 0)
- unique_clicked_count (integer, default 0)
- unsubscribed_count (integer, default 0)
- complained_count (integer, default 0)
- conversion_count (integer, default 0)
- revenue (decimal, default 0)
- ab_test_enabled (boolean, default false)
- ab_test_winner_metric (string, nullable) — "open_rate" nebo "click_rate"
- ab_test_sample_pct (integer, default 20)
- ab_test_wait_hours (integer, default 4)
- ab_test_winner (string, nullable) — "a" nebo "b"
- scheduled_at (timestamp, nullable)
- sent_at (timestamp, nullable)
- send_rate_limit (integer, nullable) — max emails per hour
- created_at, updated_at
```

**EmailSendLog**
```
- id (PK, UUID)
- campaign_id (FK → EmailCampaign, nullable)
- sequence_id (FK → EmailSequence, nullable)
- sequence_node_id (FK → SequenceNode, nullable)
- subscriber_id (FK → Subscriber, indexed)
- project_id (string, indexed)
- resend_email_id (string, nullable) — ID z Resend API
- subject (string)
- status (enum) — "queued", "sent", "delivered", "opened", "clicked", "bounced", "complained"
- opened_at (timestamp, nullable)
- clicked_at (timestamp, nullable)
- clicked_links (jsonb, default []) — [{url, clicked_at}]
- bounced_at (timestamp, nullable)
- bounce_type (string, nullable) — "hard" nebo "soft"
- unsubscribed_at (timestamp, nullable)
- conversion_order_id (string, nullable)
- conversion_amount (decimal, nullable)
- sent_at (timestamp)
- created_at
```

**EmailSequence**
```
- id (PK, UUID)
- project_id (string, indexed)
- name (string)
- type (enum) — "welcome", "abandoned_cart", "post_purchase", "winback", "browse_abandonment", "vip", "sunset", "custom"
- status (enum) — "active", "paused", "draft"
- trigger_type (enum) — "group_join", "tag_added", "tag_removed", "purchase", "cart_abandoned", "page_visited", "date_based", "manual", "custom_event"
- trigger_config (jsonb) — konfigurace triggeru (group_id, tag_name, event_name...)
- goal_type (string, nullable) — "purchase", "tag_added", "clicked"
- goal_config (jsonb, nullable)
- total_enrolled (integer, default 0)
- total_completed (integer, default 0)
- total_goal_reached (integer, default 0)
- total_revenue (decimal, default 0)
- created_at, updated_at
```

**SequenceNode**
```
- id (PK, UUID)
- sequence_id (FK → EmailSequence, indexed)
- type (enum) — "email", "wait", "condition", "ab_split", "add_tag", "remove_tag", "move_to_group", "webhook", "notify", "end"
- position (integer) — pořadí v sekvenci
- parent_node_id (FK → SequenceNode, nullable) — pro větvení
- branch (string, nullable) — "yes", "no", "a", "b" — pro condition/split
- config (jsonb) — konfigurace uzlu:
  Pro "email": { template_id, subject, sender_name }
  Pro "wait": { delay_hours, delay_days, until_day_of_week, until_time }
  Pro "condition": { type: "has_tag"|"purchased"|"opened_previous"|"clicked_previous"|"engagement_above", value }
  Pro "ab_split": { ratio_a: 50, ratio_b: 50 }
  Pro "add_tag"/"remove_tag": { tag: "purchased" }
  Pro "move_to_group": { group_id }
  Pro "webhook": { url, method, headers }
  Pro "notify": { message, channel: "email"|"slack" }
- stats_sent (integer, default 0)
- stats_opened (integer, default 0)
- stats_clicked (integer, default 0)
- stats_converted (integer, default 0)
- created_at, updated_at
```

**SequenceEnrollment**
```
- id (PK, UUID)
- sequence_id (FK → EmailSequence, indexed)
- subscriber_id (FK → Subscriber, indexed)
- current_node_id (FK → SequenceNode, nullable)
- status (enum) — "active", "completed", "goal_reached", "cancelled", "paused"
- next_action_at (timestamp, nullable, indexed) — kdy má engine provést další akci
- enrolled_at (timestamp)
- completed_at (timestamp, nullable)
- goal_reached_at (timestamp, nullable)
- metadata (jsonb, default {}) — stav pro podmínky (opened_previous, clicked_previous...)
- created_at, updated_at
```

**SuppressionList**
```
- id (PK, UUID)
- email (string, indexed, unique)
- reason (enum) — "hard_bounce", "complaint", "unsubscribe", "manual"
- project_id (string, nullable) — null = globální
- created_at
```

**AIInsight**
```
- id (PK, UUID)
- project_id (string, nullable)
- priority (enum) — "critical", "important", "suggestion"
- category (string) — "deliverability", "engagement", "revenue", "list_health", "ab_test", "sequence"
- title (string)
- description (text)
- impact_estimate (string, nullable)
- action_type (string, nullable) — "start_ab_test", "edit_sequence", "create_segment", "pause_campaign", "reschedule"
- action_config (jsonb, nullable)
- status (enum) — "new", "read", "applied", "dismissed"
- created_at, updated_at
```

**ABTest**
```
- id (PK, UUID)
- project_id (string, indexed)
- name (string)
- type (enum) — "subject_line", "content", "send_time", "sender_name"
- source_type (enum) — "campaign", "sequence_node"
- source_id (string) — campaign_id nebo sequence_node_id
- variant_a (jsonb) — { subject: "...", ... }
- variant_b (jsonb)
- metric (enum) — "open_rate", "click_rate", "conversion_rate"
- sample_size_per_variant (integer)
- variant_a_sent (integer, default 0)
- variant_a_opens (integer, default 0)
- variant_a_clicks (integer, default 0)
- variant_a_conversions (integer, default 0)
- variant_b_sent (integer, default 0)
- variant_b_opens (integer, default 0)
- variant_b_clicks (integer, default 0)
- variant_b_conversions (integer, default 0)
- winner (string, nullable) — "a" nebo "b"
- confidence (decimal, nullable) — statistická signifikance 0-100
- status (enum) — "running", "completed", "auto_applied"
- auto_apply (boolean, default false) — automaticky aplikovat vítěze
- started_at (timestamp)
- completed_at (timestamp, nullable)
- created_at, updated_at
```

---

## ČÁST 2: SERVICES

### 2a. SubscriberService
```
- create(data) — vytvoř subscribera, přidej do skupin, nastav tagy
- update(id, data)
- findByEmail(email, projectId)
- findByVisitorId(visitorId)
- addTag(subscriberId, tag, autoApplied?)
- removeTag(subscriberId, tag)
- hasTags(subscriberId, tags[]) — boolean
- updateEngagementScore(subscriberId) — přepočítej na základě aktivity
- updateLifecycleStage(subscriberId) — přepočítej lifecycle
- getSegment(conditions) — vrať subscribery odpovídající podmínkám
- importFromCSV(csv, projectId, groupId)
- exportToCSV(projectId, filters)
- suppress(email, reason, projectId?)
- isSuppressed(email) — boolean
```

### 2b. CampaignService
```
- create(data) — vytvoř kampaň jako draft
- update(id, data)
- schedule(id, scheduledAt)
- send(id) — spustí odesílání:
  1. Načti příjemce (group + segment - exclude - suppressed - unsubscribed)
  2. Pokud A/B test: rozděl na sample A, sample B, zbytek
  3. Pro každého příjemce: vytvoř EmailSendLog, přidej do fronty
  4. Odesílej v batchích přes Resend (100/batch, respektuj rate limit)
  5. Po odeslání A/B sample: čekej ab_test_wait_hours, vyhodnoť winner, pošli zbytek
  6. Aktualizuj statistiky
- pause(id)
- getStats(id) — vrať kompletní statistiky
- getLinkPerformance(id) — vrať kliknutí per link
- getTopConverters(id) — vrať zákazníky kteří koupili
```

### 2c. SequenceService
```
- create(data) — vytvoř sekvenci s nodes
- update(id, data)
- addNode(sequenceId, nodeData)
- updateNode(nodeId, data)
- removeNode(nodeId)
- reorderNodes(sequenceId, nodeIds[])
- activate(id) / pause(id)
- enrollSubscriber(sequenceId, subscriberId) — zapiš do sekvence, nastav first node
- cancelEnrollment(enrollmentId)
- getStats(id) — per-node statistiky
- getEnrollments(id, status?) — seznam enrollmentů
```

### 2d. SequenceEngine (Cron Job — každou minutu)
```
Hlavní smyčka:
1. SELECT * FROM sequence_enrollment WHERE status = 'active' AND next_action_at <= NOW()
2. Pro každý enrollment:
   a. Načti current_node
   b. Zkontroluj goal (pokud dosažen → status = 'goal_reached', END)
   c. Podle node.type:
      - "email": Odešli email přes EmailSenderService, zapiš do EmailSendLog
                 Nastav next_action_at = null (čeká na next node trigger)
                 Posuň na další node
      - "wait": Nastav next_action_at = NOW + delay
                Posuň current_node na next
      - "condition": Evaluuj podmínku (has_tag? purchased? opened?)
                     Posuň na YES nebo NO branch
      - "ab_split": Náhodně přiřaď branch A nebo B
      - "add_tag"/"remove_tag": Proveď tag operaci, posuň na next
      - "move_to_group": Přesuň, posuň na next
      - "webhook": Pošli HTTP request, posuň na next
      - "notify": Pošli notifikaci adminovi, posuň na next
      - "end": status = 'completed'
   d. Ulož enrollment stav
3. Loguj do konzole + metriky
```

### 2e. EmailSenderService (Resend API wrapper)
```
- send(to, subject, html, options) → resend.emails.send()
  - Automaticky: přidej UTM parametry ke všem linkům v HTML
  - Automaticky: přidej tracking pixel (1x1 gif) pro open tracking
  - Automaticky: přidej unsubscribe header (RFC 8058)
  - Automaticky: přidej List-Unsubscribe-Post header
  - Automaticky: zkontroluj suppression list
  - Konfiguruj: from = "{sender_name} <{sender_email}>" přes project subdoménu

- sendBatch(emails[]) → resend.batch.send() — max 100

- sendCampaign(campaignId):
  1. Načti příjemce
  2. Rozděl do batchů po 100
  3. Pro každý batch: sendBatch() s delay mezi batchi (rate limiting)
  4. Aktualizuj campaign stats průběžně
  5. Retry failed sends (3 pokusy, exponential backoff)

- handleWebhook(event):
  Podle event.type:
  - "email.delivered" → update EmailSendLog status, increment campaign delivered_count
  - "email.opened" → update EmailSendLog opened_at, increment opens, update subscriber last_open_at
  - "email.clicked" → update EmailSendLog clicked_links, increment clicks, update subscriber
  - "email.bounced" → update status, add to SuppressionList if hard bounce
  - "email.complained" → update status, add to SuppressionList, unsubscribe
```

### 2f. AutomationService (Event Listeners)
```
Naslouchá eventům a spouští sekvence:

Event: subscriber.created
→ Najdi sekvence s trigger_type = "group_join" kde subscriber je v target group
→ Zapiš subscribera do sekvence

Event: subscriber.tag_added
→ Najdi sekvence s trigger_type = "tag_added" kde tag odpovídá
→ Zapiš subscribera
→ Speciální logika:
  - tag "abandoned_cart" → spustí Abandoned Cart flow
  - tag "email_inactive_30d" → spustí Win-Back flow
  - tag "email_inactive_90d" → spustí Sunset flow

Event: order.placed
→ Přidej tag "purchased" + "purchased:{product_id}" subscriberovi
→ Odstraň tag "abandoned_cart"
→ Aktualizuj total_purchases, total_revenue, lifecycle_stage
→ Spustí Post-Purchase flow
→ Zkontroluj: pokud repeat purchase → přidej "repeat_buyer" tag
→ Zkontroluj: pokud total_revenue > €100 → přidej "vip" tag

Event: analytics.page_viewed (z analytics modulu)
→ Pokud page je sales page a subscriber nemá tag "purchased":
  → Počkej 4h, zkontroluj purchase, pokud ne → tag "browse_abandoned"

Event: analytics.cart_abandoned (z analytics modulu)
→ Přidej tag "abandoned_cart" subscriberovi

Event: email.opened / email.clicked (z webhook)
→ Aktualizuj engagement_score
→ Odstraň "email_inactive_*" tagy pokud existují
→ Aktualizuj metadata v SequenceEnrollment (opened_previous = true)
```

### 2g. EngagementScoringJob (Cron — 1× denně, 3:00 AM)
```
Pro každého aktivního subscribera:
1. Spočítej skóre na základě:
   - Otevřel email v posledních 7 dnech: +20 bodů
   - Otevřel email v posledních 30 dnech: +10 bodů
   - Klikl v posledních 30 dnech: +15 bodů
   - Nakoupil v posledních 30 dnech: +30 bodů
   - Nakoupil v posledních 90 dnech: +15 bodů
   - Neotevřel 30+ dní: -20 bodů
   - Neotevřel 60+ dní: -30 bodů
   - Neotevřel 90+ dní: -40 bodů
   - Celkový open rate > 50%: +10 bodů
2. Clamp na 0-100
3. Aktualizuj engagement_score
4. Aktualizuj lifecycle_stage:
   - score > 80 + purchases > 0: "vip" nebo "repeat_customer"
   - score > 50 + purchases > 0: "customer"
   - score > 50: "engaged"
   - score 20-50: "at_risk"
   - score < 20 + 90d+ inactive: "churned"
5. Přidej/odstraň automatické tagy:
   - Pokud 30d+ bez otevření → tag "email_inactive_30d"
   - Pokud 90d+ → tag "email_inactive_90d"
```

### 2h. ListHygieneJob (Cron — 1× denně, 4:00 AM)
```
1. Odstraň hard bounced adresy → SuppressionList
2. Odstraň complained adresy → SuppressionList
3. Aktualizuj subscriber_count na všech skupinách
4. Přepočítej dynamic group membership
5. Loguj statistiky: removed X hard bounces, Y complaints
```

---

## ČÁST 3: AI MARKETING ADVISOR

### 3a. AIAdvisorService

```
- generateDailyInsights(projectId?):
  1. Agreguj data za posledních 7 dní:
     - Campaign performance (open rates, CTR, conv rates)
     - Sequence performance (goal rates, drop-offs)
     - Subscriber trends (growth, churn, engagement distribution)
     - Deliverability (bounce rate, complaint rate)
     - A/B test results
  2. Porovnej s:
     - Historickými průměry projektu (30d, 90d)
     - Industry benchmarky (e-commerce knihy: open 25-35%, CTR 3-5%)
  3. Pošli data jako kontext do Claude API (Anthropic):
     Prompt: "Jsi expert na email marketing pro e-commerce s knihami.
     Analyzuj tato data a vygeneruj 3-5 konkrétních, actionable insights.
     Každý insight musí mít: priority (critical/important/suggestion),
     title, description, impact_estimate, action_type."
  4. Parsuj response, ulož jako AIInsight záznamy
  5. Pokud critical insight → pošli notifikaci adminovi

- generateWeeklyReport(projectId?):
  Kompletní AI report s:
  - Souhrn týdne (nejlepší/nejhorší kampaň, trendy)
  - Top 3 prioritní doporučení
  - A/B test výsledky a doporučení
  - Predikce pro příští týden
  Uloží jako AIInsight + pošle email adminovi

- evaluateSubjectLine(subjectLine, projectId):
  Pošle do Claude API s historickými daty o úspěšných subject lines.
  Vrátí: predicted_open_rate, suggestions[], improved_variants[]

- suggestABTest(campaignId nebo sequenceNodeId):
  Analyzuj aktuální performance a navrhni A/B test.
  Vrátí: test_name, variant_a, variant_b, expected_lift, rationale
```

### 3b. ABTestService
```
- create(data) — vytvoř A/B test
- evaluate(testId):
  Spočítej statistickou signifikanci (chi-squared test nebo z-test).
  Pokud confidence > 95%:
    - Označ winner
    - Pokud auto_apply: aplikuj winner na source (campaign/sequence node)
    - Vytvoř AIInsight s výsledkem
- autoCreateFromAI(insightId):
  AI navrhne test → automaticky vytvoř ABTest s parametry z insight.action_config
```

### 3c. AI-Powered Auto-Optimization
```
AIAutoOptimizer (volitelné, zapnout per projekt):

Při aktivaci může AI automaticky:
1. Měnit subject lines v sekvencích na základě A/B test výsledků
2. Měnit timing (wait delays) na základě engagement dat
3. Spouštět nové A/B testy když performance klesne pod threshold
4. Přesouvat send time kampaní na optimální hodinu

Každá auto-změna se loguje a admin dostane notifikaci.
Admin může v Settings zapnout/vypnout auto-optimization per projekt.

DŮLEŽITÉ: AI NIKDY nemění obsah emailu automaticky — jen subject lines, timing a segmentaci. Obsahové změny vždy jen doporučí.
```

---

## ČÁST 4: API ENDPOINTS

### 4a. Admin API (/admin/email/)

**Subscribers:**
- GET /admin/email/subscribers?project_id=&group_id=&tag=&lifecycle=&engagement=&search=&page=&limit=
- GET /admin/email/subscribers/:id — detail s historií
- POST /admin/email/subscribers — vytvořit
- PUT /admin/email/subscribers/:id — update
- POST /admin/email/subscribers/:id/tags — přidat tag
- DELETE /admin/email/subscribers/:id/tags/:tag — odebrat tag
- POST /admin/email/subscribers/import — CSV import
- GET /admin/email/subscribers/export?project_id=&filters= — CSV export

**Groups:**
- GET /admin/email/groups?project_id=
- POST /admin/email/groups
- PUT /admin/email/groups/:id
- DELETE /admin/email/groups/:id
- GET /admin/email/groups/:id/subscribers

**Campaigns:**
- GET /admin/email/campaigns?project_id=&status=&page=&limit=
- GET /admin/email/campaigns/:id — detail + stats
- POST /admin/email/campaigns — vytvořit draft
- PUT /admin/email/campaigns/:id — update
- POST /admin/email/campaigns/:id/schedule — naplánovat
- POST /admin/email/campaigns/:id/send — odeslat ihned
- POST /admin/email/campaigns/:id/pause — pozastavit
- GET /admin/email/campaigns/:id/links — link performance
- GET /admin/email/campaigns/:id/converters — top converters
- POST /admin/email/campaigns/:id/test — odeslat test email

**Sequences:**
- GET /admin/email/sequences?project_id=
- GET /admin/email/sequences/:id — detail + nodes + stats
- POST /admin/email/sequences
- PUT /admin/email/sequences/:id
- POST /admin/email/sequences/:id/activate
- POST /admin/email/sequences/:id/pause
- GET /admin/email/sequences/:id/enrollments
- POST /admin/email/sequences/:id/nodes — přidat node
- PUT /admin/email/sequences/:id/nodes/:nodeId
- DELETE /admin/email/sequences/:id/nodes/:nodeId
- POST /admin/email/sequences/:id/nodes/reorder

**Templates:**
- GET /admin/email/templates?project_id=&type=
- POST /admin/email/templates
- PUT /admin/email/templates/:id
- DELETE /admin/email/templates/:id
- POST /admin/email/templates/:id/preview — render HTML

**A/B Tests:**
- GET /admin/email/ab-tests?project_id=&status=
- GET /admin/email/ab-tests/:id
- POST /admin/email/ab-tests
- POST /admin/email/ab-tests/:id/evaluate — vyhodnotit
- POST /admin/email/ab-tests/:id/apply-winner — aplikovat vítěze

**AI Advisor:**
- GET /admin/email/ai/insights?project_id=&priority=&status=
- PUT /admin/email/ai/insights/:id — update status (read, applied, dismissed)
- POST /admin/email/ai/generate — manuálně spustit generování insights
- POST /admin/email/ai/evaluate-subject — ohodnotit subject line
- POST /admin/email/ai/suggest-ab-test — navrhnout A/B test
- GET /admin/email/ai/weekly-report?project_id= — poslední weekly report

**Dashboard:**
- GET /admin/email/dashboard/overview?project_id=&period=
  Vrátí: total_subscribers, new_subscribers, avg_open_rate, avg_ctr, email_revenue,
         comparison s předchozím obdobím
- GET /admin/email/dashboard/subscriber-growth?project_id=&period=
  Vrátí: [{date, total, new, unsubscribed}]
- GET /admin/email/dashboard/recent-campaigns?project_id=&limit=
- GET /admin/email/dashboard/active-sequences?project_id=
- GET /admin/email/dashboard/engagement-distribution?project_id=
  Vrátí: {high: X, medium: Y, low: Z, churned: W}
- GET /admin/email/dashboard/ai-health-score?project_id=
  Vrátí: {overall: 74, deliverability: 92, engagement: 71, revenue: 68, list_health: 65}

### 4b. Store API (/store/email/)

- POST /store/email/subscribe — nový subscriber (z popup, landing page)
  Body: { email, first_name, project_id, source, gdpr_consent }
  Automaticky: double opt-in email (pokud nastaveno), přidání do "Leads" skupiny

- POST /store/email/unsubscribe — odhlášení
  Body: { email, project_id }
  Automaticky: status = "unsubscribed", odstraň ze všech sekvencí

- GET /store/email/unsubscribe?token= — one-click unsubscribe z emailu
  Vrátí potvrzovací stránku

- POST /store/email/webhook/resend — Resend webhook endpoint
  Zpracovává: delivered, opened, clicked, bounced, complained
  Validuje: Resend webhook signature

---

## ČÁST 5: UTM LINK REWRITING

### Automatické UTM parametry

EmailSenderService při odesílání automaticky přepíše všechny linky v HTML:

```
Originální link: https://loslatenboek.nl/product
↓
Přepsaný: https://loslatenboek.nl/product?utm_source=email&utm_medium=welcome&utm_campaign=welcome_series_email_1&utm_content=hero_cta&eid={campaign_id}&sid={subscriber_id}
```

Parametry:
- utm_source=email (vždy)
- utm_medium={sequence.type nebo "campaign"}
- utm_campaign={sequence.name nebo campaign.name} (URL-safe)
- utm_content={link_position} — automaticky: "link_1", "link_2"... nebo custom
- eid={campaign_id nebo sequence_node_id} — pro propojení s analytics
- sid={subscriber_id} — pro propojení subscriber → session

Analytics tracker na frontendu detekuje sid parametr a propojí visitor_id se subscriber_id.

---

## ČÁST 6: DORUČITELNOST

### 6a. Infrastruktura per projekt

Každý projekt má:
- Marketing subdoménu: news.{projekt-domena}.{tld}
- Transakční subdoménu: mail.{projekt-domena}.{tld}
- SPF, DKIM (přes Resend), DMARC záznamy
- Reply-to na monitorovaný email (ne no-reply!)

### 6b. Warmup Manager

Pro nové projekty/domény:
```
WarmupPlan:
- Week 1: max 50 emails/day — posílej POUZE nejvíce engagovaným subscriberům
- Week 2: max 100/day
- Week 3: max 250/day
- Week 4: max 500/day
- Week 5+: plný objem

WarmupService:
- getMaxDailyVolume(projectId) — vrátí aktuální limit
- isWarmupActive(projectId) — boolean
- getSendableSubscribers(projectId, limit) — vrátí subscribery seřazené podle engagement_score DESC
```

Při odesílání kampaně: EmailSenderService respektuje warmup limity a prioritizuje engagované subscribery.

### 6c. Automatické ochrany

- Suppression list check před každým odesláním
- Hard bounce → automaticky suppressed
- Complaint → automaticky unsubscribed + suppressed
- Bounce rate > 2% per campaign → automaticky pause + AI alert
- Complaint rate > 0.1% → automaticky pause + critical AI alert
- Unsubscribe rate > 1% → AI warning

---

## ČÁST 7: INTEGRACE S EXISTUJÍCÍMI MODULY

### 7a. S Analytics modulem
- Subscriber.visitor_id ↔ Analytics.visitor_id — propojení identit
- Email click → Analytics page_view s traffic_source: "email"
- Analytics event → Email automation trigger (browse abandonment, cart abandonment)
- Customer Journey zahrnuje email touchpointy

### 7b. S Meta Pixel modulem
- Email → Purchase konverze se reportuje i do Meta CAPI
- Facebook lead ads → automaticky vytvoř subscribera
- Attribution chain: FB Ad → Subscriber → Email Sequence → Purchase

### 7c. S Medusa Orders
- order.placed subscriber → přidej "purchased" tag, aktualizuj revenue
- order.refunded → odstraň "purchased" tag pokud full refund
- Checkout metadata obsahuje subscriber_id pro propojení

---

## ČÁST 8: FRONTEND — DASHBOARD STRÁNKY

Vytvoř stránky na storefrontu pod /admin/email/ (chráněné autentizací) nebo jako Medusa Admin widgety.

Design se řídí podle /email-platform-preview.html:

1. Dashboard — stat karty, recent campaigns, active sequences, subscriber growth chart
2. Campaigns — tabulka kampaní, detail panel, A/B test zobrazení
3. Sequences — karta per sekvence, vizuální flow diagram s per-node statistikami
4. Subscribers — tabulka s filtry, profil panel s historií
5. AI Advisor — health score, insights feed, A/B test dashboard
6. Settings — per-project konfigurace (subdomény, warmup, auto-optimization toggle)

---

## TECHNICKÉ POŽADAVKY

- Resend SDK: npm install resend
- UUID generování: crypto.randomUUID()
- Cron jobs: Medusa scheduled jobs nebo node-cron
- AI: Anthropic SDK pro Claude API volání (npm install @anthropic-ai/sdk)
- Email HTML: React Email kompatibilní (npm install @react-email/components)
- Statistická signifikance: jednoduchý z-test implementovaný v TypeScriptu
- Database indexy: na všechny FK, project_id, status, created_at, next_action_at
- Redis: pro rate limiting a job queue
- Batch processing: max 100 emails per Resend API call
- Error handling: retry s exponential backoff (1s, 2s, 4s) pro Resend API
- Logging: strukturované logy pro debugging (campaign_id, subscriber_id, resend_email_id)

## PO DOKONČENÍ

git add . && git commit -m 'feat: Email marketing platform with subscriber management, campaigns, sequences, AI advisor, and A/B testing' && git push origin staging
