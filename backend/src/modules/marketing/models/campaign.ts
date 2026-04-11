import { model } from "@medusajs/framework/utils"

const MarketingCampaign = model.define("marketing_campaign", {
  id: model.id().primaryKey(),
  brand_id: model.text(),
  name: model.text(),
  template_id: model.text(),
  template_version: model.number().nullable(),   // snapshot used for send
  list_id: model.text().nullable(),
  segment_id: model.text().nullable(),
  suppression_segment_ids: model.json().nullable(),
  send_at: model.dateTime().nullable(),
  sent_at: model.dateTime().nullable(),
  status: model.text().default("draft"),         // draft | scheduled | sending | sent | paused | failed
  metrics: model.json().nullable(),              // aggregated counters
  ab_test: model.json().nullable(),
  metadata: model.json().nullable(),
})

export default MarketingCampaign
