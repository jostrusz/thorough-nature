# Claude Code Command — Payment Gateways Integration

## Příkaz (zkopíruj a vlož do Claude Code):

```
Implementuj kompletní payment gateways integraci podle souboru PAYMENT-GATEWAYS-IMPLEMENTATION.md v root adresáři projektu.

DŮLEŽITÉ INSTRUKCE:

1. PRACUJ NA STAGING BRANCHI. Ověř: git checkout staging && git pull origin staging

2. PŘEČTI SI CELÝ SOUBOR PAYMENT-GATEWAYS-IMPLEMENTATION.md — obsahuje 13 sekcí, ~45 souborů, ~10300 řádků kompletního kódu. Každý FILE má přesnou cestu a kompletní TypeScript kód. NEIMPROVIZUJ — použij přesně kód z dokumentu.

3. POŘADÍ IMPLEMENTACE (dodržuj striktně):

   FÁZE 1 — Payment Provider Moduly (5 nových modulů):
   - Vytvoř backend/src/modules/payment-mollie/ (api-client.ts, service.ts, index.ts)
   - Vytvoř backend/src/modules/payment-comgate/ (api-client.ts, service.ts, index.ts)
   - Vytvoř backend/src/modules/payment-przelewy24/ (api-client.ts, service.ts, index.ts)
   - Vytvoř backend/src/modules/payment-klarna/ (api-client.ts, service.ts, index.ts)
   - Vytvoř backend/src/modules/payment-airwallex/ (api-client.ts, service.ts, index.ts)
   - Každý modul čte credentials z gateway_config modelu (live_keys / test_keys podle mode)

   FÁZE 2 — Webhook Routes:
   - Vytvoř backend/src/api/webhooks/mollie/route.ts
   - Vytvoř backend/src/api/webhooks/comgate/route.ts
   - Vytvoř backend/src/api/webhooks/przelewy24/route.ts
   - Vytvoř backend/src/api/webhooks/klarna/route.ts
   - Vytvoř backend/src/api/webhooks/airwallex/route.ts
   - Každý webhook loguje do order.metadata.payment_activity_log[]

   FÁZE 3 — Medusa Config:
   - Uprav backend/medusa-config.js — zaregistruj všech 5 nových payment modulů

   FÁZE 4 — Tracking Dispatcher:
   - Vytvoř backend/src/subscribers/tracking-dispatcher.ts
   - Reaguje na Dextrum status DISPATCHED, posílá tracking na Stripe/PayPal/Mollie/Klarna

   FÁZE 5 — Admin UI:
   - Vytvoř backend/src/admin/components/orders/order-payment-activity.tsx (Payment Activity Log)
   - Uprav backend/src/admin/routes/custom-orders/[id]/page.tsx — přidej PaymentActivityLog komponentu
   - Uprav backend/src/admin/routes/settings-billing/page.tsx:
     a) PŘEJMENUJ tab label z "Billing" na "Payment Gateways" (v defineRouteConfig i v Heading)
     b) Přidej statement descriptor pole (max 16 znaků, validace: /^[A-Za-z0-9 .\-]{1,16}$/)
     c) Přidej multi-account podporu — víc účtů na jednoho providera (accordion per provider, "Add another account" tlačítko)
     d) Přidej Test Connection tlačítko per account
     e) Přidej gateway-specific credential fieldy per provider
   - Vytvoř backend/src/services/gateway-router.ts (multi-account routing podle sales_channel + currency + priority)
   - Uprav backend/src/admin/components/billing/payment-method-icons.tsx — nahraď textové labely SVG logami (16 platebních metod)
   - Uprav backend/src/admin/components/orders/order-detail-payment.tsx — přidej tracking badge

   FÁZE 6 — Upsell:
   - Vytvoř backend/src/api/store/custom/orders/[id]/upsell-charge/route.ts (one-click pro karty/PayPal)
   - Vytvoř backend/src/api/store/custom/orders/[id]/upsell-session/route.ts (mini-checkout pro redirect metody)
   - Uprav backend/src/api/store/custom/orders/[id]/upsell-accept/route.ts — rozšiř o platební logiku
   - Uprav storefront/src/projects/loslatenboek/pages/upsell.html — přidej one-click + mini-checkout JS logiku
   - Vytvoř backend/src/subscribers/upsell-invoice.ts (Fakturoid: přidá line item + druhý payment record)

   FÁZE 7 — Storefront:
   - Uprav storefront/src/lib/constants.tsx — přidej mapping pro všech 7 payment providerů
   - Uprav storefront/src/modules/checkout/components/payment/index.tsx — SVG loga
   - Uprav storefront/src/modules/checkout/components/payment-button/index.tsx — handlery pro Mollie/P24/Klarna/Comgate/Airwallex

   FÁZE 8 — Apple Pay Domain Verification:
   - Vytvoř backend/src/api/store/apple-pay-verification/route.ts

4. KLÍČOVÁ PRAVIDLA:
   - Všechny API klíče (LIVE i TEST) jsou uloženy v admin UI pod Settings → Payment Gateways, v gateway_config modelu v polích live_keys a test_keys. NEPOUŽÍVEJ .env pro gateway credentials.
   - Stávající gateway_config model UŽ MÁ pole: provider, mode (live/test), live_keys (JSON), test_keys (JSON), supported_currencies, priority, is_active, sales_channel_ids, billing_entity_id, payment_methods (hasMany). NEMĚŇ strukturu modelu, pouze přidej statement_descriptor pole.
   - Každý payment event (success, error, webhook, tracking) se MUSÍ logovat do order.metadata.payment_activity_log[]
   - Upsell MUSÍ být potvrzen zákazníkem na upsell stránce PŘED stržením platby
   - Fakturoid: JEDNA faktura per objednávka, upsell = nový line item + druhý payment record (POST /invoices/{id}/payments.json)
   - BaseLinker NEEXISTUJE — pouze Dextrum

5. PO DOKONČENÍ:
   - Spusť: pnpm build (v backend/ i storefront/)
   - Oprav případné TypeScript chyby
   - Commitni: git add . && git commit -m 'feat: Payment gateways integration — 7 providers, tracking, upsell, activity log, multi-account support' && git push origin staging

6. NEZAPOMEŇ na npm dependencies:
   - axios (pro API clienty) — pravděpodobně už je v package.json
   - Zkontroluj, zda jsou všechny importy dostupné
```

---

## Poznámky

- Dokument PAYMENT-GATEWAYS-IMPLEMENTATION.md obsahuje kompletní kód pro každý soubor
- Claude Code by měl číst soubor sekci po sekci a implementovat přesně podle instrukcí
- Pokud narazí na konflikt se stávajícím kódem, má zachovat stávající funkčnost a pouze přidat nové
- Staging branch se automaticky deployuje na Railway
