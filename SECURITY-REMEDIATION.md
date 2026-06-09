# 🛡️ Security Remediation Plan — funkční dopad & řešení pro 100% funkčnost

> Detailní analýza každé opravy: **co to ovlivní, co ne, a jak to udělat tak, aby se nic nerozbilo.**
> Vše ověřeno proti reálnému kódu (file:line), žádné odhady. Read-only audit, tento dokument je jediná změna.

---

## 0. Princip: proč se nic nemusí rozbít

Většina kritických nálezů je na **mrtvých endpointech** (žádný caller v celém repu) → smazání = nulový dopad.
Riziková je jen hrstka oprav, které sahají do **revenue path** (webhook podpisy, upsell cena). Pro ně platí jediné pravidlo:

> **Nikdy nepřepínat rovnou na „reject". Vždy: provisioning secret/env → shadow (log-only) fáze → ověření na reálném provozu v `payment_journey_log` → teprve pak enforce.**

A u všeho, co potřebuje env proměnnou: **nejdřív nastavit v Railway, počkat na restart, teprve pak deploynout kód.**

---

## 1. Vlna 1 — ZERO RISK (smazání mrtvého kódu + maskování)

Nic z toho nemá v repu callera (ověřeno grep napříč backend + storefront + admin). Dopad na funkčnost = **žádný**.

| # | Soubor | Akce | Proč je to bezpečné |
|---|---|---|---|
| 1.1 | `backend/src/api/dextrum-debug/route.ts` | **smazat** | Self-labeled „DELETE THIS". 0 callerů. Anonymní proxy do WMS |
| 1.2 | `backend/src/api/dextrum-debug/warehouse-setup/route.ts` | **smazat** | 0 callerů. Anonymní **zápis** do produkčního WMS |
| 1.3 | `backend/src/api/store/dextrum-debug/route.ts` | **smazat** | 0 callerů. Duplikát přes publishable key |
| 1.4 | `backend/src/api/tools/cart-lookup/route.ts` | **smazat** | 0 callerů. `admin/cart-lookup` je autentizovaný **superset** (umí cart_id, email, intent_id) |
| 1.5 | `backend/src/api/admin/debug-klarna/route.ts` | **smazat** | 0 callerů. Leakuje prefixy/délky klíčů |
| 1.6 | `backend/src/api/public/meta-pixel-test-code/route.ts` | **smazat** nebo přesunout pod `/admin/` | 0 callerů, volá se ručně z browseru. Přesun zachová debug utilitu bez public exposure |
| 1.7 | `backend/src/api/store/custom/orders/[id]/upsell-charge/route.ts` | **smazat** | 0 callerů (jen design docs). Orphan s client-trusted cenou |
| 1.8 | `backend/src/api/store/custom/orders/[id]/upsell-session/route.ts` | **smazat** | 0 callerů. Orphan |

### 1.9 — Maskovat single-gateway GET (zero impact)
**Soubor:** `backend/src/api/admin/gateway-configs/[id]/route.ts:18`
**Co to ovlivní:** Nic. Admin UI (`settings-billing/page.tsx`) čte gateway **výhradně z LIST endpointu** `GET /admin/gateway-configs`, který už maskuje. Edit formulář běží na maskovaných klíčích a save přes `stripMaskedKeys()` korektně round-tripuje. **Žádný kód ani UI nečte unmasked výstup z `[id]` GET.**
**Řešení:** Aplikovat stejný `maskKeys()` jako list endpoint na response single-gateway GET.

### 1.10 — `/public/*` CORS `Allow-Credentials: true` → `false` (zero impact)
**Soubor:** `backend/src/api/middlewares.ts:30`
**Co to ovlivní:** Nic. Ověřeno: žádná z 18 `/public/*` routes nečte cookie/Authorization (jediné `req.headers` čtení je `accept` pro content-negotiation v `marketing/u/[token]:232`). Žádný storefront caller nepoužívá `credentials:'include'`/`withCredentials`. Token-based routes autorizují přes token v URL path, ne cookie.
**Řešení:** Změnit řádek 30 na `"false"` (nebo odstranit). **Nesahat** na reflektovaný Origin (řádek 27) — multi-doménový setup (7 projektů × 2 domény) by to mohlo rozbít, to je separátní analýza.

> ✅ **Vlna 1 = jeden commit, rovnou na staging. Nic nerozbije.**

---

## 2. Vlna 2 — Secrets do env (Railway-first, pak kód)

Tady je dopad **podmíněný pořadím**. Když se nejdřív nastaví env, dopad = nula. Když ne, rozbije se fulfillment.

### 2.1 — Hardcoded Linker API key
**Soubor:** `backend/src/api/admin/postnord/orders/[id]/send/route.ts:5` → použití na `:129` (`apikey` header)
**Co to ovlivní:** Odeslání švédských (`slapp-taget`) orderů do PostNord WMS. Manuální admin akce, ne checkout. Jediné použití v repu.
**Co se rozbije, když to udělám špatně:** Změna na `process.env.LINKER_API_KEY` bez nastavené env → 401 z Linker API → SE fulfillment stojí.

**Řešení (pořadí kritické):**
1. **Railway PRVNÍ:** `LINKER_API_KEY = f9bc589f47ddaee80e9aa3abb4fd40ed` (stávající hodnota), počkat na restart.
2. **Pak kód** (fail-fast, ať secret zmizí z gitu):
   ```ts
   const LINKER_API_KEY = process.env.LINKER_API_KEY
   // na začátku POST handleru:
   if (!LINKER_API_KEY) { res.status(500).json({ error: "LINKER_API_KEY not configured" }); return }
   ```
3. **Rotace** ⚠️ blokovaná na externí koordinaci: klíč je v git historii → kompromitovaný. Nový `apikey` vydává PostNord/Linker. Postup: vyžádat nový → nastavit do Railway → ověřit 1 test SE orderem → deaktivovat starý u Linker.

### 2.2 — mySTOCK webhook hardcoded heslo
**Soubor:** `backend/src/api/webhooks/mystock/route.ts:64-65` (`MYSTOCK_WEBHOOK_PASSWORD || "YTA2...Y5"`)
**Co to ovlivní:** Příjem delivery-status webhooků z WMS → DISPATCHED/DELIVERED updaty, Klarna capture, PayPal tracking, shipment emaily/SMS pro CZ/NL/DE/PL/AT.
**⚠️ Silná inference, že produkce běží PRÁVĚ na hardcoded fallbacku** — `MYSTOCK_WEBHOOK_PASSWORD` není v `.env.template` ani nikde v docs (jen `MYSTOCK_WEBHOOK_SECRET`, což je jiná, nepoužívaná proměnná).
**Co se rozbije, když to udělám špatně:** Odebrání fallbacku bez nastavené env → Basic Auth vždy 401 → **tichý výpadek celého fulfillment reportingu**.

**Řešení (pořadí kritické):**
0. **Ověřit `list-variables` v Railway** — je `MYSTOCK_WEBHOOK_PASSWORD` vůbec nastavené?
1. **Railway PRVNÍ:** `MYSTOCK_WEBHOOK_USERNAME = mystock`, `MYSTOCK_WEBHOOK_PASSWORD = YTA2VdKNszJMdxnS1RKVNnntWBEurxY5` (stávající hodnoty).
2. **Pak kód:** odebrat fallback + `timingSafeEqual` (constant-time) + fail-closed když env chybí + `indexOf(":")` místo `split(":")` (heslo může mít `:`).
3. **Rotace** ⚠️ koordinace s mySTOCK/Kvados — nové heslo musí nastavit i oni (posílají ho).

---

## 3. Vlna 3 — Webhook podpisy (revenue-critical, shadow rollout)

### 3.0 — Klíčové fakty (platí pro všechny)
- **`gateway_config` NEMÁ dedikovaný sloupec** pro webhook secret. Je to klíč uvnitř `live_keys`/`test_keys` JSON blobu (`models/gateway-config.ts:13-15`). **Žádná migrace schématu není potřeba.**
- Admin formulář (`settings-billing/page.tsx:850-878`) **už renderuje** pole „Webhook Secret" pro každý provider kromě Stripe (PayPal → „Webhook ID", Novalnet → „Payment Access Key", PayU → „Second Key"). Provisioning = **pouze zadat hodnotu**, ne kódovat.
- **Raw-body middleware** existuje jen pro `stripe`, `mystock`, `payu`, `marketing/resend`, `V1/event`. Providery co podepisují raw bytes (Airwallex, Revolut) potřebují přidat entry do `middlewares.ts`.

### 3.1 — Rollout pattern (jak zůstat 100% funkční)
Per-provider env flag `WEBHOOK_SIG_ENFORCE_<PROVIDER>` = `off` | `shadow` | `on`.

```ts
// na začátku handleru, PŘED order lookupem:
const verdict = await verifySignature(req, secrets) // 'valid'|'invalid'|'no_secret'|'no_rawbody'
logPaymentEvent({
  intent_id: <providerOrderId>,
  event_type: "webhook_signature_check",
  event_data: { provider, verdict, has_secret: secrets.length > 0, has_rawbody: !!req.rawBody },
  error_code: verdict === "valid" ? null : verdict,
}).catch(() => {})

const mode = process.env[`WEBHOOK_SIG_ENFORCE_${PROVIDER}`] || "shadow"
if (mode === "on" && verdict === "invalid") {
  return res.status(403).json({ error: "Invalid signature" })
}
// shadow & off → zpracovat normálně (jen log)
```

**Fáze pro každý provider:**
1. **Shadow:** deploy s `mode=shadow`. Zpracovává normálně, jen loguje verdict.
2. **Ověření na reálném provozu:** `SELECT verdict, count(*) FROM payment_journey_log WHERE event_type='webhook_signature_check' GROUP BY 1` za 24–72 h. Enforce až když `valid ≈ total` a reálné `invalid ≈ 0`. U Revolut/Airwallex navíc potvrdit `has_rawbody=true`.
3. **Enforce:** `mode=on`. **`no_secret`/`no_rawbody` zůstávají NEBLOKUJÍCÍ** (zpracují se) — chybějící config nikdy neshodí order, blokuje se jen `verdict='invalid'`.

### 3.2 — Per-provider stav a postup

| Provider | Stav dnes | Secret k dispozici? | Raw body? | Bezpečné enforce hned? | Co je potřeba |
|---|---|---|---|---|---|
| **PayPal** | Podpis se počítá, **výsledek se zahodí** (`route.ts:80-86`, `signatureVerified` se nikde nečte) | Možná (Webhook ID v `webhook_secret`) | Ne (PayPal ověřuje server-side) | Ne — un-provisioned řádky by daly 403 | Potvrdit Webhook ID na **obou** PayPal účtech, pak shadow |
| **Airwallex** | **Žádný podpis** (0 výskytů hmac/crypto) | **Ne** | Ano (chybí middleware) | Ne | Přidat raw-body middleware + zadat webhook secret, pak shadow |
| **Revolut** | HMAC kód **správný ale mrtvý** (`rawBody` je undefined → podmínka vždy false, `route.ts:337`) | Pravděpodobně ne | Ano (chybí middleware) | Ne | Přidat raw-body middleware + zadat secret → kód pak enforcuje sám |
| **Klarna** | Žádný podpis, safety net **bez amount kontroly** | Ne (nemá native signature) | Ne | Ne | URL-token schéma jako Brite (`?token=<secret>`) |
| **Novalnet** | **Už enforcuje** (SHA-256 checksum, 401, `route.ts:249`) | Ano (`payment_access_key`) | Ne | **Skoro** — utáhnout fallbacky | Odmítnout když chybí checksum / access key v live mode |
| **Comgate** | **Už bezpečné** — netrustuje payload, re-fetchuje status z API | Ano (API creds) | Ne | Už OK | Volitelně validovat formát `transId` |

### 3.3 — Detail nejvyšší priority

**PayPal (nejvyšší impact/effort):** Verifikace už je zadrátovaná, jen se ignoruje. V shadow stačí logovat existující výsledek + env-gated 403. **PŘED enforce ověřit `live_keys->>'webhook_id'` na obou aktivních PayPal řádcích** — jinak 403 na všechny jejich webhooky.

**Airwallex:** Přidat do `middlewares.ts` blok pro `/webhooks/airwallex` (kopie PayU `bodyParser:false` + `rawBodyReader`). Implementovat HMAC-SHA256 nad `x-timestamp + rawBody`, header `x-signature`, secret z dashboardu. Toto je **canonical vzor** co kopírovali ostatní → opravit pořádně.

**Revolut:** Nejčistší — kód už je hotový a správný (constant-time compare). Stačí přidat raw-body middleware entry + zadat `webhook_secret`. Pak enforcuje automaticky.

### 3.4 — Safety net amount validace
Nezávisle na podpisech: **přidat amount validaci do safety-net funkcí** kde chybí (Klarna, PayPal, Comgate, Novalnet). Airwallex a Revolut už porovnávají částku proti **trusted re-query** cart total — to je vzor. Amount validace **není** náhrada za podpis (forged payload může mít správnou částku), ale je to druhá vrstva.

---

## 4. Vlna 4 — Upsell IDOR (živý endpoint, opatrně)

### 4.1 — `upsell-accept` (JEDINÝ živý — 8 call-sites v 6 projektech)
**Soubor:** `backend/src/api/store/custom/orders/[id]/upsell-accept/route.ts:194-195, 534-535`

**Co to ovlivní:** Post-purchase upsell flow (live). Frontend posílá `unit_price` + `compare_at_unit_price` ze statického `config.json` a server je trustuje verbatim.

**⚠️ KRITICKÉ omezení — NELZE vynutit base variant price:**
Jde o **legitimní slevu**: `upsellProduct: { price: 25, originalPrice: 35 }`. Zákazník platí slevenných €25, base variant cena je €35. Kdybych vynutil `unit_price = variant.calculated_price`, účtoval bych €35 → **rozbil bych slevu**.

**Řešení (zachová slevu, opraví IDOR i tampering):**
1. **Cena ze server-side zdroje, ne z body.** Přesunout `{ variantId, price, originalPrice }` per projekt z client `config.json` do backend-resolvable zdroje (malý `upsell_offer` lookup keyed `project_id`+`variant_id`, nebo `variant.metadata.upsell_price`, nebo Medusa **price-list / sale price**). V handleru: vzít `project_id` z `order.metadata` → resolvovat server-stored offer → **ignorovat** `unit_price` z body (nebo akceptovat jen když přesně sedí).
2. **Ownership token (oprava IDOR):** endpoint teď bere libovolné `order_id` bez důkazu vlastnictví. Vázat akci na token v `order.metadata.upsell_token` vygenerovaný při checkoutu a předaný upsell stránce; odmítnout mismatch. (Existující payment-verify chrání platbu online flow, ale ne cenu ani ownership.)

**Rollout:** Stejně shadow — nejdřív logovat „server-derived price vs client price" mismatch, ověřit že legitimní €25 sedí, teprve pak začít odmítat/přepisovat.

### 4.2 — `details` / `update-details` IDOR
**Soubory:** `store/custom/orders/[id]/details` (GET), `update-details` (POST)
**Co to ovlivní:** Thank-you stránka (čte detail) + případná editace adresy.
**Řešení:** Stejný ownership token jako 4.1. `update-details` (přepis emailu/adresy) je nejrizikovější (přesměrování zásilky) — token povinný.

---

## 5. Doporučené pořadí nasazení

| Vlna | Co | Risk | Railway změna | Kdy enforce |
|---|---|---|---|---|
| **1** | Smazat mrtvé debug/upsell endpointy, maskovat `[id]` GET, CORS | 🟢 nula | — | hned |
| **2** | Linker + mystock secrets → env | 🟡 podmíněný pořadím | ✅ env PRVNÍ | po restartu |
| **3** | Webhook podpisy (PayPal → Airwallex → Revolut → Klarna), Novalnet utáhnout | 🟡 revenue | flag + secrety | po shadow ověření |
| **4** | Upsell server-side cena + ownership tokeny | 🟡 revenue | — | po shadow ověření |

**Vlna 1 jde nasadit okamžitě a bezpečně.** Vlny 2–4 vyžadují Railway přístup (env, `list-variables`) a ověření na reálném provozu mezi shadow a enforce.

---

## 6. Co se NErozbije (potvrzeno)

- ✅ Standardní checkout (95 % objemu) — amount je server-side trusted (`input.amount` z Medusa flow), nesaháme na něj
- ✅ SQL — vše parameterizované, žádná změna potřeba
- ✅ Admin UI gateway editace — běží na maskovaných klíčích z LIST endpointu
- ✅ `/public/*` frontend volání — žádné nepoužívá credentials
- ✅ Comgate, PayU, Novalnet, marketing/resend webhooky — už bezpečné
- ✅ Cookies, open-redirect, reflected XSS — čisté už teď
