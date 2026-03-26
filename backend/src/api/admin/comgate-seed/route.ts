import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GATEWAY_CONFIG_MODULE } from "../../../modules/gateway-config"

/**
 * POST /admin/comgate-seed
 * Seeds Comgate payment methods into the gateway config.
 * Call from browser: https://www.marketing-hq.eu/admin/comgate-seed
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const gatewayConfigService = req.scope.resolve(GATEWAY_CONFIG_MODULE) as any

    // Find active Comgate gateway
    const gateways = await gatewayConfigService.listGatewayConfigs(
      { provider: "comgate", is_active: true },
      { take: 1, relations: ["payment_methods"] }
    )

    if (!gateways.length) {
      res.status(404).json({ error: "No active Comgate gateway config found. Create one in admin → Payment Gateways first." })
      return
    }

    const gateway = gateways[0]
    const results: string[] = []
    results.push(`Found Comgate gateway: ${gateway.id} (${gateway.display_name})`)

    // Delete existing methods (clean slate)
    const existingMethods = gateway.payment_methods || []
    if (existingMethods.length > 0) {
      results.push(`Removing ${existingMethods.length} existing payment methods...`)
      await gatewayConfigService.deletePaymentMethodConfigs(
        existingMethods.map((m: any) => m.id)
      )
    }

    // Define payment methods
    const methods = [
      {
        code: "creditcard",
        display_name: "Karta płatnicza",
        icon: "creditcard",
        available_countries: ["cz", "pl"],
        supported_currencies: ["CZK", "PLN"],
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
        available_countries: ["cz", "pl"],
        supported_currencies: ["CZK", "PLN"],
        is_active: true,
        sort_order: 3,
        gateway_id: gateway.id,
      },
      {
        code: "googlepay",
        display_name: "Google Pay",
        icon: "googlepay",
        available_countries: ["cz", "pl"],
        supported_currencies: ["CZK", "PLN"],
        is_active: true,
        sort_order: 4,
        gateway_id: gateway.id,
      },
      {
        code: "blik",
        display_name: "BLIK",
        icon: "blik",
        available_countries: ["pl"],
        supported_currencies: ["PLN"],
        is_active: true,
        sort_order: 5,
        gateway_id: gateway.id,
      },
      {
        code: "przelew_bankowy",
        display_name: "Przelew bankowy",
        icon: "bank",
        available_countries: ["pl"],
        supported_currencies: ["PLN"],
        is_active: true,
        sort_order: 6,
        gateway_id: gateway.id,
      },
    ]

    // Create each method
    for (const method of methods) {
      await gatewayConfigService.createPaymentMethodConfigs(method)
      results.push(`✅ Created: ${method.code} (${method.display_name})`)
    }

    results.push(`Done! ${methods.length} methods seeded.`)

    res.json({
      success: true,
      gateway: gateway.display_name,
      methods_created: methods.length,
      log: results,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * GET /admin/comgate-seed — show current status
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const gatewayConfigService = req.scope.resolve(GATEWAY_CONFIG_MODULE) as any

    const gateways = await gatewayConfigService.listGatewayConfigs(
      { provider: "comgate" },
      { relations: ["payment_methods"] }
    )

    res.json({
      gateways: gateways.map((g: any) => ({
        id: g.id,
        display_name: g.display_name,
        is_active: g.is_active,
        methods: (g.payment_methods || []).map((m: any) => ({
          code: m.code,
          display_name: m.display_name,
          is_active: m.is_active,
          countries: m.available_countries,
          currencies: m.supported_currencies,
        })),
      })),
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
