import { model } from "@medusajs/framework/utils"

const DextrumEventLog = model.define("dextrum_event_log", {
  id: model.id().primaryKey(),

  // Event identification
  event_id: model.text(),
  event_type: model.text(),
  event_subtype: model.text().nullable(),

  // Document reference
  document_id: model.text().nullable(),
  document_code: model.text().nullable(),

  // Processing
  status: model.text().default("received"),
  medusa_order_id: model.text().nullable(),
  delivery_status_before: model.text().nullable(),
  delivery_status_after: model.text().nullable(),
  error_message: model.text().nullable(),

  // Raw data
  raw_payload: model.json().nullable(),

  metadata: model.json().nullable(),
})

export default DextrumEventLog
