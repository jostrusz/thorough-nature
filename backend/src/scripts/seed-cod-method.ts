// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"

/**
 * Seed COD (Dobírka / Cash on Delivery) payment method for the psi-superzivot project.
 * Creates a GatewayConfig for COD provider + 1 PaymentMethodConfig (cod).
 *
 * Usage: npx medusa exec src/scripts/seed-cod-method.ts
 */
export default async function seedCodMethod({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  const gatewayConfigService = container.resolve("gatewayConfig")

  logger.info("[Seed COD] Creating COD gateway config and payment method...")

  // Check if COD gateway already exists
  const existing = await gatewayConfigService.listGatewayConfigs(
    { provider: "cod" },
    { take: 1 }
  )

  if (existing.length > 0) {
    logger.warn("[Seed COD] COD gateway config already exists (id=" + existing[0].id + "). Skipping.")
    return
  }

  // Create GatewayConfig for COD
  const gateway = await gatewayConfigService.createGatewayConfigs({
    provider: "cod",
    display_name: "Dobírka",
    is_active: true,
    supported_currencies: ["CZK"],
    project_slugs: ["psi-superzivot"],
    metadata: {
      fee: 30,
      fee_currency: "CZK",
    },
  })

  logger.info(`[Seed COD] Created COD gateway: ${gateway.id}`)

  // Create PaymentMethodConfig for COD
  await gatewayConfigService.createPaymentMethodConfigs({
    code: "cod",
    display_name: "Dobírka",
    icon: "cod",
    available_countries: ["cz"],
    supported_currencies: ["CZK"],
    is_active: true,
    sort_order: 5,
    gateway_id: gateway.id,
  })

  logger.info("[Seed COD] Created payment method: cod (Dobírka)")
  logger.info("[Seed COD] COD payment method seeded successfully!")
  logger.info("[Seed COD] Available for: psi-superzivot project, CZK currency, CZ country")
}
