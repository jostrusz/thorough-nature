// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"

/**
 * Seed the Revolut gateway + all 6 Revolut Merchant payment methods so they can
 * be toggled per project in the admin Payment Gateways UI.
 *
 * Methods (Revolut Merchant API, all rendered INLINE via the Web SDK against the
 * order token — no redirect):
 *   card               — inline PCI card field
 *   apple_pay          — inline wallet button
 *   google_pay         — inline wallet button
 *   revolut_pay        — inline Revolut Pay button (A2A / card)
 *   pay_by_bank        — inline open-banking widget
 *   sepa_direct_debit  — inline SEPA mandate (EUR / SEPA only)
 *
 * The gateway is created INACTIVE with empty keys — fill in the Merchant API
 * keys (public_key, secret_key, webhook_secret) and set is_active=true + the
 * project_slugs in the admin once you have them from the Revolut Business
 * dashboard. Currency support (Revolut Help Center):
 *   card / wallets / revolut_pay — broad, incl. CZK, EUR, PLN, SEK, NOK, HUF
 *   pay_by_bank — per-country open-banking coverage
 *   sepa_direct_debit — EUR (SEPA zone) only
 *
 * Idempotent: re-running replaces the method rows (clean slate) but never
 * overwrites the gateway's keys / is_active / project_slugs once set.
 *
 * Usage: npx medusa exec src/scripts/seed-revolut-methods.ts
 */
export default async function seedRevolutMethods({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  const gatewayConfigService = container.resolve("gatewayConfig")

  logger.info("[Seed] Setting up Revolut gateway + payment methods...")

  // 1. Find or create the Revolut gateway (inactive scaffold until keys are set).
  let gateways = await gatewayConfigService.listGatewayConfigs(
    { provider: "revolut" },
    { take: 1, relations: ["payment_methods"] }
  )

  let gateway = gateways[0]
  if (!gateway) {
    gateway = await gatewayConfigService.createGatewayConfigs({
      provider: "revolut",
      display_name: "Revolut (Merchant)",
      mode: "test",
      is_active: false, // ← activate in admin once Merchant API keys are filled in
      live_keys: { public_key: "", secret_key: "", webhook_secret: "" },
      test_keys: { public_key: "", secret_key: "", webhook_secret: "" },
      supported_currencies: ["EUR", "GBP", "CZK", "PLN", "SEK", "NOK", "HUF", "DKK", "USD"],
      project_slugs: [],
      priority: 5,
      metadata: { integration: "web-sdk-inline", note: "Fill keys + activate in admin" },
    })
    logger.info(`[Seed] Created inactive Revolut gateway: ${gateway.id}`)
  } else {
    logger.info(`[Seed] Found existing Revolut gateway: ${gateway.id} (${gateway.display_name})`)
  }

  // 2. Clean-slate the method rows (never touches gateway keys/activation).
  const existing = gateway.payment_methods || []
  if (existing.length > 0) {
    await gatewayConfigService.deletePaymentMethodConfigs(existing.map((m: any) => m.id))
    logger.info(`[Seed] Removed ${existing.length} existing Revolut method(s)`)
  }

  // SEPA countries (SEPA Direct Debit is EUR-only).
  const SEPA = [
    "at", "be", "cy", "de", "ee", "es", "fi", "fr", "gr", "ie", "it", "lt",
    "lu", "lv", "mt", "nl", "pt", "si", "sk",
  ]
  // Open-banking coverage for Pay by Bank (broad EU + UK).
  const PBB = [
    "gb", "ie", "nl", "be", "de", "at", "fr", "it", "es", "pt", "fi", "ee",
    "lt", "lv", "pl", "se", "no", "dk",
  ]

  const methods = [
    {
      code: "card",
      display_name: "Credit/Debit Card",
      icon: "card",
      available_countries: [],
      supported_currencies: [], // all supported
      is_active: true,
      sort_order: 0,
      config: { type: "inline", component: "revolut-card-field" },
      gateway_id: gateway.id,
    },
    {
      code: "apple_pay",
      display_name: "Apple Pay",
      icon: "applepay",
      available_countries: [],
      supported_currencies: [],
      is_active: true,
      sort_order: 1,
      config: { type: "inline", component: "revolut-wallet" },
      gateway_id: gateway.id,
    },
    {
      code: "google_pay",
      display_name: "Google Pay",
      icon: "googlepay",
      available_countries: [],
      supported_currencies: [],
      is_active: true,
      sort_order: 2,
      config: { type: "inline", component: "revolut-wallet" },
      gateway_id: gateway.id,
    },
    {
      code: "revolut_pay",
      display_name: "Revolut Pay",
      icon: "revolut_pay",
      available_countries: [],
      supported_currencies: [],
      is_active: true,
      sort_order: 3,
      config: { type: "inline", component: "revolut-pay-button" },
      gateway_id: gateway.id,
    },
    {
      code: "pay_by_bank",
      display_name: "Pay by Bank",
      icon: "bank_transfer",
      available_countries: PBB,
      supported_currencies: ["EUR", "GBP", "SEK", "NOK", "DKK", "PLN"],
      is_active: true,
      sort_order: 4,
      config: { type: "inline", component: "revolut-pay-by-bank" },
      gateway_id: gateway.id,
    },
    {
      code: "sepa_direct_debit",
      display_name: "SEPA Direct Debit",
      icon: "sepa",
      available_countries: SEPA,
      supported_currencies: ["EUR"],
      is_active: true,
      sort_order: 5,
      config: { type: "inline", component: "revolut-sepa" },
      gateway_id: gateway.id,
    },
  ]

  for (const m of methods) {
    await gatewayConfigService.createPaymentMethodConfigs(m)
    logger.info(`[Seed] Created Revolut method: ${m.code} (${m.display_name})`)
  }

  logger.info("[Seed] Revolut methods seeded. Next: fill Merchant API keys + set is_active + project_slugs in admin.")
}
