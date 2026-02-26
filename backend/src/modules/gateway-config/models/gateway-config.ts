import { model } from "@medusajs/framework/utils"
import PaymentMethodConfig from "./payment-method-config"

const GatewayConfig = model.define("gateway_config", {
  id: model.id().primaryKey(),
  // Provider identity
  provider: model.text(),
  display_name: model.text(),
  // Link to billing entity (stored as ID, linked via module links)
  billing_entity_id: model.text().nullable(),
  // Mode: live or test
  mode: model.enum(["live", "test"]).default("test"),
  // Encrypted API keys (JSON: api_key, secret_key, webhook_secret)
  live_keys: model.json().nullable(),
  test_keys: model.json().nullable(),
  // Supported currencies (JSON array: ["EUR", "CZK", "PLN"])
  supported_currencies: model.json().nullable(),
  // Priority (1 = primary, 2 = fallback, etc.)
  priority: model.number().default(1),
  // Active on checkout?
  is_active: model.boolean().default(false),
  // Which sales channels this gateway applies to (JSON array of IDs)
  sales_channel_ids: model.json().nullable(),
  // Statement descriptor (max 16 chars, A-Z 0-9 space dot hyphen)
  statement_descriptor: model.text().nullable(),
  // Flexible metadata
  metadata: model.json().nullable(),
  // Payment methods (child relation)
  payment_methods: model.hasMany(() => PaymentMethodConfig, {
    mappedBy: "gateway",
  }),
})

export default GatewayConfig
