import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GATEWAY_CONFIG_MODULE } from "../../../modules/gateway-config"
import type GatewayConfigModuleService from "../../../modules/gateway-config/service"

/**
 * GET /admin/gateway-configs — List all payment gateway configurations
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const gatewayService = req.scope.resolve(
    GATEWAY_CONFIG_MODULE
  ) as GatewayConfigModuleService
  const gateways = await gatewayService.listGatewayConfigs(
    {},
    {
      relations: ["payment_methods"],
      order: { priority: "ASC" },
    }
  )

  // Mask sensitive keys in response
  const masked = gateways.map((gw: any) => ({
    ...gw,
    live_keys: gw.live_keys ? maskKeys(gw.live_keys) : null,
    test_keys: gw.test_keys ? maskKeys(gw.test_keys) : null,
  }))

  res.json({ gateway_configs: masked })
}

/**
 * POST /admin/gateway-configs — Create a new gateway configuration
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const gatewayService = req.scope.resolve(
      GATEWAY_CONFIG_MODULE
    ) as GatewayConfigModuleService
    const {
      payment_methods: methodsData,
      ...gatewayData
    } = req.body as Record<string, any>

    // Create gateway
    const gateway = await gatewayService.createGatewayConfigs(gatewayData)

    // Create payment methods if provided
    if (methodsData && Array.isArray(methodsData)) {
      for (const method of methodsData) {
        await gatewayService.createPaymentMethodConfigs({
          ...method,
          gateway_id: gateway.id,
        })
      }
    }

    // Refetch with relations
    const full = await gatewayService.retrieveGatewayConfig(gateway.id, {
      relations: ["payment_methods"],
    })

    res.status(201).json({ gateway_config: full })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

function maskKeys(keys: Record<string, any>): Record<string, string> {
  const masked: Record<string, string> = {}
  for (const [key, value] of Object.entries(keys)) {
    if (typeof value === "string" && value.length > 8) {
      masked[key] = value.slice(0, 4) + "****" + value.slice(-4)
    } else {
      masked[key] = "****"
    }
  }
  return masked
}
