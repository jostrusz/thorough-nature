import { model } from "@medusajs/framework/utils"

/**
 * marketing_event — append-only stream of marketing-relevant events.
 * Fed by:
 *   - subscribers mirroring Medusa events (order.placed, cart.updated, ...)
 *   - public tracking pixel (email_opened)
 *   - public click tracker (email_clicked)
 *   - form submissions (form_submitted)
 *   - storefront SDK (page_viewed, product_viewed, ...)
 */
const MarketingEvent = model.define("marketing_event", {
  id: model.id().primaryKey(),
  brand_id: model.text(),
  contact_id: model.text().nullable(),
  email: model.text().nullable(),
  type: model.text(),                            // "order_placed", "email_opened", ...
  payload: model.json().nullable(),
  occurred_at: model.dateTime(),
  processed_at: model.dateTime().nullable(),
  source: model.text().nullable(),               // "subscriber:order.placed", "tracking_pixel", ...
})

export default MarketingEvent
