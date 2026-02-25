import { defineLink } from "@medusajs/framework/utils"
import GatewayConfigModule from "../modules/gateway-config"
import BillingEntityModule from "../modules/billing-entity"

/**
 * Link: GatewayConfig → BillingEntity
 * Each gateway is linked to one billing entity (company that processes payments).
 * A billing entity can have many gateways (isList on gateway side).
 */
export default defineLink(
  {
    linkable: GatewayConfigModule.linkable.gatewayConfig,
    isList: true,
  },
  BillingEntityModule.linkable.billingEntity
)
