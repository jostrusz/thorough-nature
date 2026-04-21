import { model } from "@medusajs/framework/utils"

const MarketingMessage = model.define("marketing_message", {
  id: model.id().primaryKey(),
  brand_id: model.text(),
  contact_id: model.text().nullable(),
  campaign_id: model.text().nullable(),
  flow_id: model.text().nullable(),
  flow_run_id: model.text().nullable(),
  flow_node_id: model.text().nullable(),          // which email node inside the flow (for per-node analytics)
  template_id: model.text().nullable(),
  template_version: model.number().nullable(),
  resend_email_id: model.text().nullable(),
  subject_snapshot: model.text().nullable(),
  to_email: model.text(),
  from_email: model.text(),
  status: model.text().default("queued"),        // queued | sent | delivered | opened | clicked | bounced | complained | failed | suppressed
  sent_at: model.dateTime().nullable(),
  delivered_at: model.dateTime().nullable(),
  first_opened_at: model.dateTime().nullable(),
  first_clicked_at: model.dateTime().nullable(),
  bounced_at: model.dateTime().nullable(),
  complained_at: model.dateTime().nullable(),
  bounce_reason: model.text().nullable(),
  opens_count: model.number().default(0),
  clicks_count: model.number().default(0),
  error: model.text().nullable(),
  metadata: model.json().nullable(),
})

export default MarketingMessage
