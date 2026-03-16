import { model } from "@medusajs/framework/utils"

const DextrumConfig = model.define("dextrum_config", {
  id: model.id().primaryKey(),

  // API Connection
  api_url: model.text(),
  api_username: model.text(),
  api_password: model.text(),
  default_warehouse_code: model.text().default("MAIN"),

  // Partner
  partner_id: model.text().nullable(),
  partner_code: model.text().nullable(),

  // Delivery & Payment defaults for mySTOCK
  default_delivery_method_id: model.text().nullable(),
  default_pickup_delivery_method_id: model.text().nullable(),
  default_payment_method_cod: model.text().nullable(),
  default_payment_method_paid: model.text().nullable(),

  // Webhook
  webhook_secret: model.text().nullable(),

  // Order Settings
  order_hold_minutes: model.number().default(15),
  payment_timeout_minutes: model.number().default(30),
  retry_max_attempts: model.number().default(10),
  retry_interval_minutes: model.number().default(5),

  // Inventory Sync
  inventory_sync_enabled: model.boolean().default(true),
  inventory_sync_interval_minutes: model.number().default(15),
  low_stock_threshold: model.number().default(10),
  critical_stock_threshold: model.number().default(3),
  out_of_stock_action: model.text().default("disable_variant"),
  last_inventory_sync: model.text().nullable(),
  last_inventory_sync_products: model.number().default(0),
  last_inventory_sync_updated: model.number().default(0),

  // Connection Status
  connection_status: model.text().default("unknown"),
  last_connection_test: model.text().nullable(),

  // Meta
  enabled: model.boolean().default(true),
  metadata: model.json().nullable(),
})

export default DextrumConfig
