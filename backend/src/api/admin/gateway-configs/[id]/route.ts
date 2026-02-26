import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GATEWAY_CONFIG_MODULE } from "../../../../modules/gateway-config"
import type GatewayConfigModuleService from "../../../../modules/gateway-config/service"

/**
 * GET /admin/gateway-configs/:id — Get single gateway with payment methods
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const gatewayService = req.scope.resolve(
    GATEWAY_CONFIG_MODULE
  ) as GatewayConfigModuleService

  try {
    const gateway = await gatewayService.retrieveGatewayConfig(id, {
      relations: ["payment_methods"],
    })
    res.json({ gateway_config: gateway })
  } catch (error: any) {
    res.status(404).json({ error: "Gateway config not found" })
  }
}

/**
 * POST /admin/gateway-configs/:id — Update a gateway config
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
    const data = req.body as Record<string, any>
    const gateway = await gatewayService.updateGatewayConfigs({
      id,
      ...data,
    })

    const full = await gatewayService.retrieveGatewayConfig(id, {
      relations: ["payment_methods"],
    })

    res.json({ gateway_config: full })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * DELETE /admin/gateway-configs/:id — Delete a gateway config
 * Cascade-deletes child payment_method_config records first
 * (FK has no ON DELETE CASCADE).
 */
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const gatewayService = req.scope.resolve(
    GATEWAY_CONFIG_MODULE
  ) as GatewayConfigModuleService

  try {
    // 1. Delete child payment method configs first
    const methods = await gatewayService.listPaymentMethodConfigs(
      { gateway_id: id } as any,
      { take: 1000 }
    )

    if (methods.length > 0) {
      const methodIds = methods.map((m: any) => m.id)
      await gatewayService.deletePaymentMethodConfigs(methodIds)
    }

    // 2. Now delete the gateway itself
    await gatewayService.deleteGatewayConfigs(id)
    res.json({ success: true, deleted: id })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
