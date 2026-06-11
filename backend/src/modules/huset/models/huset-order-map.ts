import { model } from "@medusajs/framework/utils"

const HusetOrderMap = model.define("huset_order_map", {
  id: model.id().primaryKey(),

  // Medusa side
  medusa_order_id: model.text(),
  display_id: model.text(),
  project_code: model.text().nullable(),

  // Huset side
  // OutgoingDeliveryOrderRef we send (e.g. NO2026-123)
  order_ref: model.text(),
  // OutgoingDeliveryOrderId returned by UpdateOutgoingDeliveryOrder
  outgoing_delivery_order_id: model.text().nullable(),
  // OutgoingDeliveryId from GetOutgoingDeliveryNotTrans (per shipment, used for ack)
  outgoing_delivery_id: model.text().nullable(),

  // Delivery status (same scale as dextrum_order_map for dashboard consistency)
  delivery_status: model.text().default("NEW"),
  delivery_status_updated_at: model.text().nullable(),

  // Tracking (Bring)
  tracking_number: model.text().nullable(),
  tracking_url: model.text().nullable(),
  carrier_name: model.text().nullable(),

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

export default HusetOrderMap
