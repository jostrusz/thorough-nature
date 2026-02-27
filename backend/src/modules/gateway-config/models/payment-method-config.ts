import { model } from "@medusajs/framework/utils"
import GatewayConfig from "./gateway-config"

/**
 * Individual payment method under a gateway.
 * Example: "iDEAL" under Stripe, "Bancontact" under Mollie, "BLIK" under Przelewy24
 *
 * Each method has:
 * - A code (unique identifier like "ideal", "bancontact", "blik")
 * - A display label ("iDEAL", "Bancontact", "BLIK")
 * - An icon key (maps to a frontend SVG icon component)
 * - Countries where it's available
 * - Currencies it supports
 * - Active/inactive toggle
 * - Sort order for checkout display
 */
const PaymentMethodConfig = model.define("payment_method_config", {
  id: model.id().primaryKey(),
  // Method identity
  code: model.text(),
  display_name: model.text(),
  // Icon key — maps to frontend icon library
  icon: model.text().nullable(),
  // Which countries this method is available in (JSON array: ["nl", "be", "de"])
  available_countries: model.json().nullable(),
  // Which currencies this method supports (JSON array: ["EUR", "CZK"])
  supported_currencies: model.json().nullable(),
  // Active on checkout?
  is_active: model.boolean().default(true),
  // Sort order (lower = first)
  sort_order: model.number().default(0),
  // Method-specific configuration (JSON)
  // For embedded methods like creditcard: { type: "embedded", component: "mollie-components" }
  config: model.json().nullable(),
  // Parent gateway
  gateway: model.belongsTo(() => GatewayConfig, {
    mappedBy: "payment_methods",
  }),
})

export default PaymentMethodConfig
