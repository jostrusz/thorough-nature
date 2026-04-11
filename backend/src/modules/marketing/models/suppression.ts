import { model } from "@medusajs/framework/utils"

const MarketingSuppression = model.define("marketing_suppression", {
  id: model.id().primaryKey(),
  brand_id: model.text(),
  email: model.text(),
  reason: model.text(),                          // unsubscribed | bounced_hard | complained | manual | gdpr_erasure
  source_message_id: model.text().nullable(),
  suppressed_at: model.dateTime(),
  metadata: model.json().nullable(),
})

export default MarketingSuppression
