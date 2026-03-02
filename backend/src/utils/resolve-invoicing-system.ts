import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GATEWAY_CONFIG_MODULE } from "../modules/gateway-config"
import { BILLING_ENTITY_MODULE } from "../modules/billing-entity"

/**
 * Resolve which invoicing system should handle an order.
 *
 * Flow: order → payment_collections → payments → provider_id
 *       → GatewayConfig (by provider name) → BillingEntity → invoicing_system
 *
 * Returns: "fakturoid" | "quickbooks" | null
 */
export async function resolveInvoicingSystem(
  container: any,
  orderId: string
): Promise<string | null> {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const gatewayService = container.resolve(GATEWAY_CONFIG_MODULE) as any
    const billingService = container.resolve(BILLING_ENTITY_MODULE) as any

    // 1. Get payment provider_id from order's payment collections
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "payment_collections.payments.provider_id",
      ],
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
    // e.g. "pp_mollie_mollie" → "mollie", "pp_paypal_paypal" → "paypal"
    const providerId = payments[0].provider_id
    if (!providerId) return null

    const withoutPrefix = providerId.replace(/^pp_/, "")
    const providerName = withoutPrefix.split("_")[0]

    // 3. Look up GatewayConfig by provider name (prefer active ones)
    let configs = await gatewayService.listGatewayConfigs(
      { provider: providerName, is_active: true },
      { take: 1 }
    )

    // Fallback: any config for this provider (even inactive)
    if (!configs.length) {
      configs = await gatewayService.listGatewayConfigs(
        { provider: providerName },
        { take: 1 }
      )
    }

    if (!configs.length) return null

    const gatewayConfig = configs[0] as any
    if (!gatewayConfig.billing_entity_id) return null

    // 4. Look up BillingEntity to get invoicing_system
    const entity = await billingService.retrieveBillingEntity(
      gatewayConfig.billing_entity_id
    )

    return (entity as any)?.invoicing_system || null
  } catch (error: any) {
    console.warn(
      `[resolveInvoicingSystem] Error for order ${orderId}: ${error.message}`
    )
    return null
  }
}
