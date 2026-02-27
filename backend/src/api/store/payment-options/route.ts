import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GATEWAY_CONFIG_MODULE } from "../../../modules/gateway-config"
import type GatewayConfigModuleService from "../../../modules/gateway-config/service"
import { BILLING_ENTITY_MODULE } from "../../../modules/billing-entity"
import type BillingEntityModuleService from "../../../modules/billing-entity/service"

/**
 * GET /store/payment-options?sales_channel_id=xxx&currency=EUR&project_slug=loslatenboek
 *
 * Returns active payment gateways and their methods for the checkout,
 * filtered by sales channel, currency, and project slug.
 * Also returns the billing entity (company) associated with the primary gateway.
 *
 * This endpoint is called by the storefront at checkout load to dynamically
 * determine which payment methods to display with their icons.
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const salesChannelId = req.query.sales_channel_id as string
    const currency = ((req.query.currency as string) || "EUR").toUpperCase()
    const projectSlug = req.query.project_slug as string

    const gatewayService = req.scope.resolve(
      GATEWAY_CONFIG_MODULE
    ) as GatewayConfigModuleService
    const billingEntityService = req.scope.resolve(
      BILLING_ENTITY_MODULE
    ) as BillingEntityModuleService

    // Get all active gateways with their payment methods
    const allGateways = await gatewayService.listGatewayConfigs(
      { is_active: true },
      {
        relations: ["payment_methods"],
        order: { priority: "ASC" },
      }
    )

    // Filter by sales channel, currency, and project slug
    const filteredGateways = allGateways.filter((gw: any) => {
      // Check sales channel
      if (salesChannelId && gw.sales_channel_ids) {
        const scIds = Array.isArray(gw.sales_channel_ids)
          ? gw.sales_channel_ids
          : []
        if (scIds.length > 0 && !scIds.includes(salesChannelId)) {
          return false
        }
      }

      // Check currency support
      if (gw.supported_currencies) {
        const currencies = Array.isArray(gw.supported_currencies)
          ? gw.supported_currencies.map((c: string) => c.toUpperCase())
          : []
        if (currencies.length > 0 && !currencies.includes(currency)) {
          return false
        }
      }

      // Check project slug: if gateway has project_slugs set, the slug must match
      // Empty/null project_slugs = available for all projects (fallback)
      if (projectSlug && gw.project_slugs) {
        const slugs = Array.isArray(gw.project_slugs) ? gw.project_slugs : []
        if (slugs.length > 0 && !slugs.includes(projectSlug)) {
          return false
        }
      }

      return true
    })

    // Build response with active payment methods only
    const gateways = filteredGateways.map((gw: any) => {
      // Get the active API keys for this gateway
      const keys = gw.mode === "live" ? gw.live_keys : gw.test_keys

      const activeMethods = (gw.payment_methods || [])
        .filter((m: any) => m.is_active)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((m: any) => {
          const method: any = {
            code: m.code,
            display_name: m.display_name,
            icon: m.icon,
            sort_order: m.sort_order || 0,
            available_countries: m.available_countries,
            supported_currencies: m.supported_currencies,
          }

          // For embedded payment methods (creditcard), include rendering config
          if (m.code === "creditcard" || m.config?.type === "embedded") {
            method.type = "embedded"

            // Provider-specific client keys for card components
            if (gw.provider === "mollie") {
              method.component = "mollie-components"
              // Mollie uses profile_id for Components initialization
              method.profile_id = keys?.profile_id || null
              method.testmode = gw.mode === "test"
            } else if (gw.provider === "stripe") {
              method.component = "stripe-elements"
              // Stripe uses publishable key
              method.client_key = keys?.publishable_key || null
              method.testmode = gw.mode === "test"
            } else if (gw.provider === "airwallex") {
              method.component = "airwallex-dropin"
              method.client_key = keys?.client_id || null
              method.environment = gw.mode === "live" ? "prod" : "demo"
            }

            // Include any custom config from the method
            if (m.config) {
              method.config = m.config
            }
          }

          return method
        })

      const gatewayResponse: any = {
        provider: gw.provider,
        display_name: gw.display_name,
        priority: gw.priority,
        methods: activeMethods,
      }

      // Airwallex: include environment for Drop-in SDK initialization
      if (gw.provider === "airwallex") {
        gatewayResponse.component = "airwallex-dropin"
        gatewayResponse.environment = gw.mode === "live" ? "prod" : "demo"
      }

      return gatewayResponse
    })

    // Get billing entity from primary gateway
    let billingEntity = null
    if (filteredGateways.length > 0 && filteredGateways[0].billing_entity_id) {
      try {
        const entity = await billingEntityService.retrieveBillingEntity(
          filteredGateways[0].billing_entity_id
        )
        billingEntity = {
          name: entity.name,
          legal_name: entity.legal_name,
          vat_id: entity.vat_id,
          tax_id: entity.tax_id,
          country_code: entity.country_code,
          address: entity.address,
          email: entity.email,
        }
      } catch {
        // billing entity not found, continue without it
      }
    }

    res.json({
      gateways,
      billing_entity: billingEntity,
      currency,
      sales_channel_id: salesChannelId || null,
      project_slug: projectSlug || null,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
