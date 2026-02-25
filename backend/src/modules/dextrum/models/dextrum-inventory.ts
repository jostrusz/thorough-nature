import { model } from "@medusajs/framework/utils"

const DextrumInventory = model.define("dextrum_inventory", {
  id: model.id().primaryKey(),

  // Product identification
  sku: model.text(),
  product_name: model.text().nullable(),

  // Stock levels from mySTOCK Stock Card
  available_stock: model.number().default(0),
  physical_stock: model.number().default(0),
  reserved_stock: model.number().default(0),
  blocked_stock: model.number().default(0),

  // Medusa product reference
  medusa_variant_id: model.text().nullable(),
  medusa_product_id: model.text().nullable(),

  // Sync metadata
  warehouse_code: model.text().default("MAIN"),
  last_synced_at: model.text().nullable(),
  stock_changed: model.boolean().default(false),
  previous_available: model.number().default(0),

  metadata: model.json().nullable(),
})

export default DextrumInventory
