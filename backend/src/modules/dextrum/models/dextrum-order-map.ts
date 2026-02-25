import { model } from "@medusajs/framework/utils"

const DextrumOrderMap = model.define("dextrum_order_map", {
  id: model.id().primaryKey(),

  // Medusa side
  medusa_order_id: model.text(),
  display_id: model.text(),
  project_code: model.text().nullable(),

  // mySTOCK side
  mystock_order_id: model.text().nullable(),
  mystock_order_code: model.text(),

  // Delivery status (THE key field for dashboard)
  delivery_status: model.text().default("NEW"),
  delivery_status_updated_at: model.text().nullable(),

  // Tracking
  tracking_number: model.text().nullable(),
  tracking_url: model.text().nullable(),
  carrier_name: model.text().nullable(),

  // Package info
  package_count: model.number().default(0),
  total_weight_kg: model.text().nullable(),

  // Hold logic
  hold_until: model.text().nullable(),
  retry_count: model.number().default(0),
  last_error: model.text().nullable(),

  // Timestamps
  sent_to_wms_at: model.text().nullable(),
  dispatched_at: model.text().nullable(),
  delivered_at: model.text().nullable(),

  metadata: model.json().nullable(),
})

export default DextrumOrderMap
