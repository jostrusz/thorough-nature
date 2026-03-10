import { ExecArgs } from "@medusajs/framework/types"

/**
 * Seed Comgate payment methods for the psi-superzivot project.
 * Creates 4 PaymentMethodConfig records: creditcard, bank_transfer, applepay, googlepay.
 *
 * Usage: npx medusa exec src/scripts/seed-comgate-methods.ts
 */
export default async function seedComgateMethods({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  const gatewayConfigService = container.resolve("gatewayConfig")

  logger.info("[Seed] Creating Comgate payment methods...")

  // Find the Comgate gateway config
  const gateways = await gatewayConfigService.listGatewayConfigs(
    { provider: "comgate", is_active: true },
    { take: 1, relations: ["payment_methods"] }
  )

  if (!gateways.length) {
    logger.error("[Seed] No active Comgate gateway config found. Create one in admin first.")
    return
  }

  const gateway = gateways[0]
  logger.info(`[Seed] Found Comgate gateway: ${gateway.id} (${gateway.display_name})`)

  // Delete existing payment methods for this gateway (clean slate)
  if (gateway.payment_methods?.length > 0) {
    logger.info(`[Seed] Removing ${gateway.payment_methods.length} existing payment methods...`)
    await gatewayConfigService.deletePaymentMethodConfigs(
      gateway.payment_methods.map((m: any) => m.id)
    )
  }

  // Define the 4 payment methods for Czech market
  const methods = [
    {
      code: "creditcard",
      display_name: "Platební karta",
      icon: "creditcard",
      available_countries: ["cz"],
      supported_currencies: ["CZK"],
      is_active: true,
      sort_order: 1,
      gateway_id: gateway.id,
    },
    {
      code: "bank_transfer",
      display_name: "Bankovní převod",
      icon: "bank_transfer",
      available_countries: ["cz"],
      supported_currencies: ["CZK"],
      is_active: true,
      sort_order: 2,
      gateway_id: gateway.id,
    },
    {
      code: "applepay",
      display_name: "Apple Pay",
      icon: "applepay",
      available_countries: ["cz"],
      supported_currencies: ["CZK"],
      is_active: true,
      sort_order: 3,
      gateway_id: gateway.id,
    },
    {
      code: "googlepay",
      display_name: "Google Pay",
      icon: "googlepay",
      available_countries: ["cz"],
      supported_currencies: ["CZK"],
      is_active: true,
      sort_order: 4,
      gateway_id: gateway.id,
    },
  ]

  // Create each method
  for (const method of methods) {
    await gatewayConfigService.createPaymentMethodConfigs(method)
    logger.info(`[Seed] Created method: ${method.code} (${method.display_name})`)
  }

  logger.info("[Seed] Comgate payment methods seeded successfully!")
  logger.info("[Seed] Methods: creditcard, bank_transfer, applepay, googlepay")
}
