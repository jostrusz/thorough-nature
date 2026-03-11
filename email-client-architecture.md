# Email Marketing Client — Architektura a Design

## Přehled systému

Stavíme interní email marketing platformu integrovanou přímo do Medusa e-commerce platformy. Klient kombinuje funkce MailerLite/Klaviyo (subscriber management, automations, campaigns) s výhodami vlastního řešení (přímé napojení na e-shop data, zero-latency triggery, žádné měsíční poplatky za tisíce subscriberů).

Odesílání přes Resend API. Dva oddělené subdomény: `mail.domena.com` pro transakční emaily, `news.domena.com` pro marketing — izolace reputace.

---

## 1. SUBSCRIBER MANAGEMENT

### 1a. Subscriber profil

Každý subscriber má kompletní profil:

- **Identifikace:** email (primární klíč), jméno, příjmení, telefon, jazyk, země
- **Projekt:** ke kterému projektu patří (Laat los, Odpuść, Psí superživot...)
- **Zdroj akvizice:** odkud přišel (facebook_ad, organic, popup, checkout, manual_import)
- **Tagy:** flexibilní systém tagů (viz níže)
- **Skóre engagementu:** 0-100 bodů na základě aktivity (otevírání, klikání, nákupy)
- **Lifecycle stage:** new → engaged → customer → repeat_customer → vip → at_risk → churned
- **Consent:** GDPR souhlas, datum souhlasu, IP souhlasu, zdroj souhlasu
- **Statistiky:** total_emails_sent, total_opens, total_clicks, total_purchases, total_revenue, last_open_date, last_click_date, last_purchase_date

### 1b. Tagovací systém

Tagy jsou klíčové pro segmentaci. Dva typy:

**Manuální tagy** — přidáš ručně nebo přes import:
- `vip`, `influencer`, `wholesale`, `gift_buyer`

**Automatické tagy** — systém přidává na základě chování:
- `purchased` — koupil cokoliv
- `purchased:{product_id}` — koupil konkrétní produkt
- `repeat_buyer` — koupil 2+×
- `high_value` — celkové nákupy > €100
- `abandoned_cart` — nechal košík (automaticky odstraněn po nákupu)
- `email_engaged` — otevřel email v posledních 30 dnech
- `email_inactive_30d` — neotevřel email 30+ dní
- `email_inactive_90d` — neotevřel 90+ dní
- `clicked_upsell` — klikl na upsell nabídku
- `from_facebook`, `from_google`, `from_email` — zdroj akvizice
- `opened_last_campaign` — otevřel poslední kampaň
- `visited_sales_page` — navštívil sales page (z analytics)
- `scrolled_75pct` — proscrolloval 75%+ sales page

### 1c. Skupiny (Lists)

Skupiny organizují subscribery per projekt a per účel:

- **Projektové skupiny:** Laat los — NL, Laat los — BE, Odpuść — PL, Psí superživot — CZ...
- **Funkční skupiny:** Customers (koupili), Leads (nekoupili), Newsletter, Abandoned Cart
- **Dynamické skupiny:** automaticky se plní na základě podmínek (např. "všichni kdo koupili v posledních 30 dnech a jsou z NL")

Subscriber může být ve více skupinách. Skupiny se používají jako cíl pro kampaně a sekvence.

### 1d. Segmentace

Pokročilá segmentace kombinací podmínek:

```
PŘÍKLAD: "Engaged leads z Facebooku, kteří navštívili sales page ale nekoupili"
→ tag HAS "from_facebook"
  AND tag HAS "visited_sales_page"
  AND tag NOT HAS "purchased"
  AND engagement_score > 30
  AND project = "loslatenboek"
```

Segmenty se používají pro:
- Cílení kampaní
- Spouštění automatizací
- Exclude listy (aby zákazníci nedostávali akviziční emaily)
- Reporting

---

## 2. KAMPANĚ (One-time Broadcasts)

### 2a. Campaign Builder

Vizuální editor pro tvorbu jednorázových kampaní:

**Krok 1 — Nastavení:**
- Název kampaně (interní)
- Projekt (filtruje dostupné skupiny)
- Příjemci: vyber skupinu/segment + exclude skupinu
- Odhadovaný počet příjemců (live preview)

**Krok 2 — Obsah:**
- Subject line (s A/B test možností — až 3 varianty)
- Preview text
- Sender name a reply-to email
- Email editor: buď HTML editor, nebo React Email template system
- Personalizace: {{first_name}}, {{product_name}}, {{order_number}}, {{country}}...
- Dynamický obsah: bloky, které se zobrazí/skryjí podle tagů subscribera

**Krok 3 — Plánování:**
- Poslat ihned
- Naplánovat na konkrétní datum/čas
- Smart Send Time: poslat každému subscriberovi v jeho optimální čas (na základě historických dat otevírání)
- Throttling: kolik emailů za hodinu (pro warmup nebo velké seznamy)

**Krok 4 — Review & Send:**
- Preview emailu
- Test email na vlastní adresu
- Kontrola: spam score, broken links, chybějící unsubscribe link
- Potvrzení a odeslání

### 2b. A/B Testing

- Test subject lines (až 3 varianty)
- Test sender name
- Test obsahu (2 varianty)
- Winner kritérium: open rate nebo click rate
- Test sample: 20% seznamu, winner jde na zbylých 80%
- Automatické vyhodnocení po X hodinách

### 2c. Campaign Analytics

Po odeslání kampaně:
- **Delivery:** sent, delivered, bounced, delivery rate
- **Engagement:** opens, unique opens, open rate, clicks, unique clicks, CTR, CTOR (click-to-open rate)
- **Conversions:** purchases z tohoto emailu, revenue, conversion rate, AOV
- **Health:** unsubscribes, spam complaints, bounce types (hard/soft)
- **Link performance:** click heatmapa — kolik kliknutí na každý link
- **Timeline:** graf otevření/kliknutí v prvních 48 hodinách
- **Device breakdown:** mobile vs desktop vs tablet
- **Top converters:** seznam zákazníků, kteří nakoupili z emailu

---

## 3. SEKVENCE (Automated Flows)

### 3a. Vizuální Sequence Builder

Drag-and-drop editor pro automatizované sekvence (jako MailerLite/Klaviyo):

**Uzly (Nodes):**

1. **Trigger** (startovní bod):
   - Subscriber joins group
   - Tag added/removed
   - Purchase completed
   - Cart abandoned
   - Page visited (z analytics)
   - Custom event
   - Date-based (birthday, anniversary)
   - Manual enrollment

2. **Action nodes:**
   - 📧 Send Email — s template, subject, sender
   - 🏷 Add/Remove Tag
   - 📋 Move to Group
   - ⏱ Wait (delay: hodiny, dny, nebo "until next business day")
   - 🔀 Condition Split (IF/ELSE na základě tagů, engagementu, nákupní historie)
   - 🎯 A/B Split (50/50 nebo custom poměr)
   - 📊 Goal (ukončovací podmínka — např. "purchased")
   - 🔔 Notify (interní notifikace — např. "VIP zákazník nekoupil 30 dní")
   - 🛑 End sequence
   - Webhook (pro napojení na externí systémy)

3. **Condition logika:**
   - Has tag / doesn't have tag
   - Purchased / didn't purchase
   - Opened previous email / didn't open
   - Clicked previous email / didn't click
   - Engagement score above/below threshold
   - Country is / isn't
   - Days since last purchase
   - Cart value above/below

### 3b. Povinné sekvence (Industry Standard Flows)

Tyto sekvence by měl systém obsahovat jako předpřipravené šablony:

**1. Welcome Series (5 emailů, 14 dní)**
```
TRIGGER: Subscriber joins "Leads" group
├── [Immediately] Email 1: Vítej + slíbená nabídka/ebook/sleva
├── [Wait 2 days]
├── [Condition: Purchased?]
│   ├── YES → Move to "Customers" group → END
│   └── NO ↓
├── Email 2: Příběh za produktem + social proof
├── [Wait 3 days]
├── [Condition: Purchased?]
│   ├── YES → END
│   └── NO ↓
├── Email 3: Nejčastější otázky + recenze zákazníků
├── [Wait 3 days]
├── [Condition: Purchased?]
│   ├── YES → END
│   └── NO ↓
├── Email 4: Urgence — limitovaná nabídka
├── [Wait 4 days]
├── Email 5: Poslední šance + silná nabídka
└── END → Tag "completed_welcome" + Move to "Newsletter"
```

**2. Abandoned Cart (3 emaily, 48h)**
```
TRIGGER: Tag "abandoned_cart" added
├── [Wait 1 hour]
├── [Condition: Purchased?]
│   ├── YES → END
│   └── NO ↓
├── Email 1: "Zapomněl jsi něco" — připomínka s produktem
├── [Wait 23 hours]
├── [Condition: Purchased?]
│   ├── YES → END
│   └── NO ↓
├── Email 2: Social proof + urgence ("jen X kusů")
├── [Wait 24 hours]
├── [Condition: Purchased?]
│   ├── YES → END
│   └── NO ↓
├── Email 3: Sleva 10% — poslední šance
└── END → Remove tag "abandoned_cart"
```

**3. Post-Purchase (4 emaily, 30 dní)**
```
TRIGGER: Purchase completed
├── [Immediately] Email 1: Potvrzení + co čekat (shipping info)
├── [Wait 3 days]
├── Email 2: Tipy k produktu / "jak z knihy vytěžit maximum"
├── [Wait 7 days]
├── Email 3: Žádost o recenzi (s odkazem)
├── [Wait 14 days]
├── Email 4: Upsell — doplňkový produkt / e-book verze
└── END → Tag "completed_post_purchase"
```

**4. Win-Back / Re-engagement (3 emaily, inaktivní 30+ dní)**
```
TRIGGER: Tag "email_inactive_30d" added
├── Email 1: "Chybíš nám" — připomínka + nový obsah
├── [Wait 7 days]
├── [Condition: Opened?]
│   ├── YES → Remove tag "email_inactive_30d" → END
│   └── NO ↓
├── Email 2: Speciální nabídka jen pro tebe
├── [Wait 14 days]
├── [Condition: Opened?]
│   ├── YES → END
│   └── NO ↓
├── Email 3: "Chceš dál dostávat emaily?" — explicitní opt-in
├── [Wait 7 days]
├── [Condition: Clicked re-confirm?]
│   ├── YES → END (zůstane v seznamu)
│   └── NO → Unsubscribe + Tag "churned"
└── END
```

**5. Browse Abandonment (2 emaily)**
```
TRIGGER: Event "visited_sales_page" + tag NOT "purchased" + wait 4h
├── [Condition: Purchased?]
│   ├── YES → END
│   └── NO ↓
├── Email 1: "Viděl jsi [produkt] — tady je proč ho lidé milují"
├── [Wait 2 days]
├── [Condition: Purchased?]
│   ├── YES → END
│   └── NO ↓
├── Email 2: Social proof + omezenás nabídka
└── END
```

**6. VIP Nurture**
```
TRIGGER: Tag "repeat_buyer" added OR total_revenue > €100
├── Email 1: Poděkování + VIP status oznámení
├── [Wait 7 days]
├── Email 2: Exkluzivní obsah / behind-the-scenes
├── [Wait 30 days]
├── Email 3: Early access k novému produktu
└── LOOP (opakuj při novém obsahu)
```

**7. Sunset (Čištění seznamu)**
```
TRIGGER: Tag "email_inactive_90d" added
├── Email 1: "Potvrzení zájmu" — klikni pokud chceš zůstat
├── [Wait 14 days]
├── [Condition: Clicked?]
│   ├── YES → Remove inactive tags → END
│   └── NO → Unsubscribe → Tag "sunset_removed"
└── END
```

### 3c. Sequence Analytics

Pro každou sekvenci:
- Celkový počet subscriberů v sekvenci (aktivní, dokončení, vypadlí)
- Per-email: open rate, CTR, conversions, revenue
- Funnel: kolik lidí prošlo celou sekvencí
- Goal completion rate (kolik dosáhlo cíle — např. nákupu)
- Čas do goal completion
- A/B test výsledky per split node

---

## 4. TRIGGERY A AUTOMATIZACE

### 4a. Event-based triggery (z analytics systému)

Systém naslouchá eventům z analytics trackeru a spouští akce:

| Event | Trigger | Akce |
|-------|---------|------|
| Subscriber se zaregistruje | `subscriber.created` | Spustí Welcome Series |
| Zákazník přidá do košíku a neobjedná do 1h | `cart.abandoned` | Přidá tag `abandoned_cart` → spustí Abandoned Cart flow |
| Zákazník dokončí nákup | `order.placed` | Spustí Post-Purchase flow, odstraní `abandoned_cart` tag, přidá `purchased` tag |
| Navštívil sales page ale nekoupil do 4h | `browse.abandoned` | Spustí Browse Abandonment flow |
| Subscriber neotevřel email 30 dní | `engagement.inactive_30d` | Přidá tag `email_inactive_30d` → spustí Re-engagement flow |
| Subscriber neotevřel 90 dní | `engagement.inactive_90d` | Spustí Sunset flow |
| Celkové nákupy > €100 | `customer.high_value` | Přidá tag `vip` → spustí VIP flow |
| Zákazník koupil podruhé | `customer.repeat_purchase` | Přidá tag `repeat_buyer` |
| Subscriber klikl na upsell link | `email.clicked_upsell` | Přidá tag `interested_upsell` |
| Nový nákup z jiného projektu | `customer.cross_project` | Přidá do příslušné projektové skupiny |

### 4b. Cron-based triggery

Pravidelně (1×/den) systém kontroluje:
- Subscribery, kteří neotevřeli email 30/60/90 dní → automatické přetagování
- Engagement score přepočet (na základě otevírání, klikání, nákupů za posledních 90 dní)
- Lifecycle stage update (new → engaged → customer → vip → at_risk → churned)
- List hygiene: smazání hard bounced adres

### 4c. Webhook triggery (externí)

- Resend webhook: email.delivered, email.opened, email.clicked, email.bounced, email.complained
- Platební brána: payment.succeeded, payment.failed, refund.created
- Shipping: order.shipped, order.delivered

---

## 5. DORUČITELNOST

### 5a. Infrastruktura

- **Oddělené subdomény:** `mail.domena.com` (transakční), `news.domena.com` (marketing)
- **DNS autentizace:** SPF, DKIM, DMARC pro obě subdomény
- **Dedicated IP:** přes Resend (pro vysoké objemy 500+/den)
- **Warmup plán:** postupné navyšování objemu — 50/den → 100 → 250 → 500 → 1000+ přes 4 týdny

### 5b. Automatické ochrany

- **Suppression list:** automaticky přidávej hard bounced, unsubscribed, complained
- **Rate limiting:** maximální počet emailů za hodinu per subdoména
- **Bounce threshold:** pokud bounce rate kampaně překročí 2%, automaticky zastav odesílání
- **Spam score check:** před odesláním kampaně zkontroluj obsah na spam triggery
- **List hygiene:** pravidelné čištění neaktivních (90d+ bez otevření)
- **Double opt-in:** volitelně per projekt (doporučeno pro DE/AT kvůli přísnějšímu GDPR)

### 5c. Monitoring

- **Dashboard metrik:** delivery rate, bounce rate, spam complaint rate, unsubscribe rate per projekt
- **Alerting:** notifikace pokud bounce rate > 2% nebo complaint rate > 0.1%
- **Resend webhook processing:** real-time zpracování delivery eventů
- **DNS monitoring:** kontrola SPF/DKIM/DMARC platnosti

---

## 6. AI MARKETING ADVISOR

### 6a. Co AI sleduje

AI modul pravidelně analyzuje emailová data a poskytuje insights:

**Performance monitoring:**
- Porovnání open rate/CTR každého emailu vs. průměr projektu
- Detekce poklesu engagementu (týdenní trend)
- Identifikace nejlepších a nejhorších emailů per sekvence

**Automatické doporučení:**

| Situace | AI insight |
|---------|------------|
| Open rate kampaně < průměr projektu | "Subject line 'X' měl o 23% nižší open rate než průměr. Zkus: kratší subject, přidej emoji, nebo personalizaci {{first_name}}." |
| Email 3 v sekvenci má vysoký drop-off | "68% subscriberů odpadne po emailu 3 v Welcome Series. Zvažuj: silnější CTA, přidej testimonial, nebo zkrať delay z 3 na 2 dny." |
| Abandoned cart recovery rate klesá | "Recovery rate klesl z 12% na 8% za poslední 2 týdny. Doporučuji: testuj nový subject line, zvyš slevu z 5% na 10%, nebo přidej urgenci." |
| Konkrétní den/čas má lepší engagement | "Emaily odeslané v úterý 10:00 mají o 34% vyšší open rate než čtvrteční. Přesuň hlavní kampaně na úterý." |
| Segment s vysokým engagementem nekupuje | "245 subscriberů otevírá každý email ale nekoupili. Zkus: speciální nabídku jen pro tento segment, nebo quiz k identifikaci bariéry." |
| Win-back flow nefunguje | "Win-back flow konvertuje jen 2.1% (benchmark: 5-8%). Zkus: změň timing z 30 na 21 dní, přidej silnější incentiv." |
| Email z flow má vysoký unsubscribe | "Email 5 Welcome Series má 3.2% unsubscribe rate. Obsah může být příliš prodejní. Zkus: přidej hodnotu místo nabídky." |
| Nový A/B test výsledek | "Varianta B ('Osobní příběh Jany') měla o 41% vyšší CTR než A ('Sleva 10%'). Story-based subjects fungují lépe pro tento projekt." |

**Týdenní AI report:**
Automaticky generovaný souhrn s top 3 doporučeními, trendy, a prioritizovanými akcemi.

### 6b. Prediktivní funkce

- **Churn prediction:** "Tito 89 subscriberů pravděpodobně odejdou v příštích 14 dnech na základě klesajícího engagementu. Doporučuji proaktivní re-engagement."
- **Best send time:** per subscriber optimální čas odesílání na základě historie otevírání
- **Subject line scoring:** odhad open rate před odesláním na základě historických dat
- **Revenue forecast:** "Na základě aktuálního email pipeline očekávej €X revenue z emailů tento týden"

---

## 7. DASHBOARD — EMAIL ANALYTICS

### 7a. Hlavní přehled (per projekt)

**Stat karty:**
- Subscribers (total + new this period)
- Avg Open Rate (trend)
- Avg Click Rate (trend)
- Email Revenue (tento měsíc)

**Grafy:**
- Subscribers growth (line chart, 30 dní)
- Open rate & CTR trend (line chart, 30 dní)
- Revenue per email (bar chart)
- Engagement distribution (pie: engaged, at_risk, inactive, churned)

### 7b. Kampaně tab

Tabulka všech kampaní:
- Název, datum odeslání, příjemci, open rate, CTR, conversions, revenue
- Kliknutím → detail kampaně (full stats + link heatmap + top converters)
- Filtrování per projekt

### 7c. Sekvence tab

Tabulka všech sekvencí:
- Název, typ, aktivní subscribery, completion rate, goal conv rate, revenue
- Kliknutím → vizuální flow s per-node statistikami

### 7d. Subscribers tab

Tabulka subscriberů s filtrováním:
- Email, jméno, projekt, tagy, engagement score, lifecycle stage, last activity
- Kliknutím → profil subscribera s historií emailů a akcí

### 7e. AI Insights tab

- Feed AI doporučení seřazených podle priority/impactu
- Každý insight má: popis situace, doporučení, odhadovaný dopad, tlačítko "Apply" (kde to jde)
- Týdenní AI report

---

## 8. INTEGRACE S ANALYTICS SYSTÉMEM

### 8a. Propojení email → analytics

Každý email obsahuje tracking links s UTM parametry:
```
utm_source=email
utm_medium={email_type} (welcome, abandoned_cart, newsletter, promotion...)
utm_campaign={campaign_name}
utm_content={link_id}
?eid={email_campaign_id}&vid={subscriber_visitor_id}
```

Když subscriber klikne na link v emailu:
1. Analytics tracker zaznamená page view s traffic_source: "email"
2. Propojí se s EmailCampaign přes `eid` parametr
3. Pokud subscriber nakoupí → EmailConversion záznam
4. Customer Journey zobrazí email touchpoint v timeline

### 8b. Propojení analytics → email

Analytics eventy triggerují email akce:
- Page visit → browse abandonment trigger
- Add to cart bez purchase → abandoned cart trigger
- High scroll depth bez konverze → engagement tag
- Opakovaná návštěva sales page → tag "high_intent"

### 8c. Propojení s Meta Pixel

Email konverze se reportují do Meta CAPI:
- Subscriber z Facebooku koupí přes email → Meta vidí konverzi
- Pomáhá Facebooku optimalizovat pro lidi, kteří konvertují přes email funnel
- Attribution chain: FB Ad → Lead → Email → Purchase

---

## 9. TECHNICKÁ ARCHITEKTURA

### 9a. Backend moduly

```
/backend/src/modules/
├── email-client/          ← NOVÝ hlavní modul
│   ├── models/
│   │   ├── subscriber.ts
│   │   ├── subscriber-tag.ts
│   │   ├── subscriber-group.ts
│   │   ├── email-campaign.ts
│   │   ├── email-template.ts
│   │   ├── email-sequence.ts
│   │   ├── sequence-node.ts
│   │   ├── sequence-enrollment.ts
│   │   ├── email-send-log.ts
│   │   └── suppression-list.ts
│   ├── services/
│   │   ├── subscriber.service.ts
│   │   ├── campaign.service.ts
│   │   ├── sequence.service.ts
│   │   ├── email-sender.service.ts    (Resend API wrapper)
│   │   ├── automation.service.ts      (trigger processing)
│   │   ├── segmentation.service.ts
│   │   ├── deliverability.service.ts
│   │   └── ai-advisor.service.ts
│   ├── subscribers/           (event listeners)
│   ├── jobs/                  (cron: engagement scoring, list hygiene, AI reports)
│   └── api/
│       ├── admin/             (dashboard API)
│       └── store/             (subscribe endpoint, webhook receiver)
├── analytics/             ← existující modul
└── meta-pixel/            ← existující modul
```

### 9b. Resend API integrace

```typescript
// Email Sender Service — obaluje Resend API
class EmailSenderService {
  // Jednotlivý email
  async send(to, subject, html, options) {}

  // Batch (až 100 najednou)
  async sendBatch(emails[]) {}

  // Campaign broadcast (s throttlingem)
  async sendCampaign(campaignId, recipientIds[], batchSize, delayBetweenBatches) {}

  // Webhook handler
  async handleWebhook(event: ResendWebhookEvent) {}
}
```

Resend podporuje:
- Batch sending (až 100 emailů/request)
- Scheduled sends (budoucí timestamp)
- Webhooky: delivered, opened, clicked, bounced, complained
- React Email templates (JSX → HTML)
- Dedicated IP s auto-warmupem

### 9c. Sequence Engine

```
Sequence Engine (cron job, běží každou minutu):
1. Načti všechny aktivní enrollmenty kde next_action_at <= NOW
2. Pro každý enrollment:
   a. Načti aktuální node v sekvenci
   b. Evaluuj conditions (pokud je condition node)
   c. Proveď akci (send email / add tag / wait / split)
   d. Posuň enrollment na další node
   e. Nastav next_action_at (pokud je wait node)
   f. Pokud goal dosažen nebo end node → ukonči enrollment
3. Loguj vše do sequence_enrollment_log
```

### 9d. AI Advisor Engine

```
AI Advisor (cron job, běží 1× denně):
1. Agreguj statistiky za posledních 7/30 dní per projekt
2. Porovnej s benchmarky a historickými daty
3. Identifikuj anomálie a příležitosti
4. Generuj insights přes LLM (Claude API) s kontextem dat
5. Ulož insights do ai_insights tabulky s prioritou a typem
6. Pošli weekly digest email adminovi
```

---

## 10. DELIVERABILITY CHECKLIST PER PROJEKT

Při zakládání nového projektu systém automaticky provede:

1. ☐ Vytvoř marketing subdoménu (news.projekt-domena.com)
2. ☐ Nastav SPF záznam
3. ☐ Nastav DKIM přes Resend
4. ☐ Nastav DMARC (p=none pro začátek → p=quarantine → p=reject)
5. ☐ Warmup plán: 50 → 100 → 250 → 500 → 1000/den přes 4 týdny
6. ☐ Nastav reply-to na monitorovaný email (ne no-reply!)
7. ☐ Přidej unsubscribe header (RFC 8058 one-click)
8. ☐ Nastav suppression list webhook
9. ☐ Nastav Google Postmaster Tools pro doménu
10. ☐ Vytvoř default šablony per jazyk projektu
