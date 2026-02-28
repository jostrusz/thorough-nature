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
 *
 * Key protection: If live_keys or test_keys contain masked values
 * (e.g. "AS0n****g0VS"), those individual key fields are stripped
 * and the existing database values are preserved. This prevents
 * accidentally overwriting real API keys with masked placeholders.
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

    // Protect against saving masked keys back to the database.
    // The admin list endpoint masks keys for display (e.g. "AS0n****g0VS").
    // If those masked values are sent back in an update, we must preserve
    // the original unmasked values from the database.
    if (data.live_keys || data.test_keys) {
      const existing = await gatewayService.retrieveGatewayConfig(id)

      if (data.live_keys && typeof data.live_keys === "object") {
        data.live_keys = stripMaskedKeys(
          data.live_keys,
          existing.live_keys || {}
        )
      }
      if (data.test_keys && typeof data.test_keys === "object") {
        data.test_keys = stripMaskedKeys(
          data.test_keys,
          existing.test_keys || {}
        )
      }
    }

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

/**
 * Strip masked key values and replace them with existing (unmasked) database values.
 * A key is considered "masked" if it contains "****".
 * - If the incoming value is masked → use existing DB value
 * - If the incoming value is new/unmasked → use the new value
 * - Keys that don't exist in incoming data are not touched
 */
function stripMaskedKeys(
  incoming: Record<string, any>,
  existing: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = { ...incoming }
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "string" && value.includes("****")) {
      // Masked value — preserve the original from the database
      if (existing[key] !== undefined) {
        result[key] = existing[key]
      } else {
        // No existing value and the incoming is masked — remove it entirely
        delete result[key]
      }
    }
  }
  return result
}
