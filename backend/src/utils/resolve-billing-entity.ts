import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GATEWAY_CONFIG_MODULE } from "../modules/gateway-config"
import { BILLING_ENTITY_MODULE } from "../modules/billing-entity"

/**
 * Resolve the billing entity (company) for an order.
 *
 * Flow: order → payment_collections → payments → provider_id
 *       → GatewayConfig (by provider name) → BillingEntity
 *
 * Returns the full BillingEntity or null.
 */
export async function resolveBillingEntity(
  container: any,
  orderId: string
): Promise<any | null> {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const gatewayService = container.resolve(GATEWAY_CONFIG_MODULE) as any
    const billingService = container.resolve(BILLING_ENTITY_MODULE) as any

    // 1. Get payment provider_id from order's payment collections
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "payment_collections.payments.provider_id"],
      filters: { id: orderId },
    })

    const order = orders?.[0]
    if (!order) return null

    const payments =
      order.payment_collections?.flatMap(
        (pc: any) => pc.payments || []
      ) || []

    if (!payments.length) return null

    // 2. Extract provider name from provider_id
    const providerId = payments[0].provider_id
    if (!providerId) return null

    const withoutPrefix = providerId.replace(/^pp_/, "")
    const providerName = withoutPrefix.split("_")[0]

    // 3. Look up GatewayConfig by provider name
    let configs = await gatewayService.listGatewayConfigs(
      { provider: providerName, is_active: true },
      { take: 1 }
    )

    if (!configs.length) {
      configs = await gatewayService.listGatewayConfigs(
        { provider: providerName },
        { take: 1 }
      )
    }

    if (!configs.length) return null

    const gatewayConfig = configs[0] as any
    if (!gatewayConfig.billing_entity_id) return null

    // 4. Look up BillingEntity
    return await billingService.retrieveBillingEntity(
      gatewayConfig.billing_entity_id
    )
  } catch (error: any) {
    console.warn(
      `[resolveBillingEntity] Error for order ${orderId}: ${error.message}`
    )
    return null
  }
}
