import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GATEWAY_CONFIG_MODULE } from "../../../../../modules/gateway-config"
import type GatewayConfigModuleService from "../../../../../modules/gateway-config/service"

/**
 * POST /admin/gateway-configs/:id/toggle
 *
 * Quick-switch: Toggle gateway active/inactive for checkout.
 * This is the "emergency button" — one click to enable/disable a gateway.
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const gatewayService = req.scope.resolve(
    GATEWAY_CONFIG_MODULE
  ) as GatewayConfigModuleService

  try {
    // Get current state
    const current = await gatewayService.retrieveGatewayConfig(id)

    // Toggle is_active
    const newActive = !current.is_active

    await gatewayService.updateGatewayConfigs({
      id,
      is_active: newActive,
    })

    const updated = await gatewayService.retrieveGatewayConfig(id, {
      relations: ["payment_methods"],
    })

    res.json({
      gateway_config: updated,
      message: newActive
        ? `${updated.display_name} activated on checkout`
        : `${updated.display_name} deactivated from checkout`,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
