import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GATEWAY_CONFIG_MODULE } from "../../../../../modules/gateway-config"
import type GatewayConfigModuleService from "../../../../../modules/gateway-config/service"

/**
 * POST /admin/gateway-configs/:id/methods
 *
 * Batch update payment methods for a gateway.
 * Replaces all existing methods with the provided list.
 *
 * Body: { methods: [{ code, display_name, icon, available_countries, supported_currencies, is_active, sort_order }] }
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const { methods } = req.body as { methods: Record<string, any>[] }
  const gatewayService = req.scope.resolve(
    GATEWAY_CONFIG_MODULE
  ) as GatewayConfigModuleService

  try {
    // Verify gateway exists
    await gatewayService.retrieveGatewayConfig(id)

    // Get existing methods
    const [existingMethods] = await gatewayService.listAndCountPaymentMethodConfigs(
      { gateway_id: id }
    )

    // Delete all existing methods
    if (existingMethods.length > 0) {
      await gatewayService.deletePaymentMethodConfigs(
        existingMethods.map((m: any) => m.id)
      )
    }

    // Create new methods
    if (methods && Array.isArray(methods)) {
      for (const method of methods) {
        await gatewayService.createPaymentMethodConfigs({
          ...method,
          gateway_id: id,
        })
      }
    }

    // Return updated gateway with methods
    const updated = await gatewayService.retrieveGatewayConfig(id, {
      relations: ["payment_methods"],
    })

    res.json({ gateway_config: updated })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
