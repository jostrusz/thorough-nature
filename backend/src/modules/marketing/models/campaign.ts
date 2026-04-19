import { model } from "@medusajs/framework/utils"

/**
 * marketing_campaign — one broadcast email to a selected audience.
 *
 * Email content lives directly on the campaign (subject, preheader,
 * from_name, from_email, reply_to, custom_html). Templates are no longer
 * part of the authoring flow; template_id remains nullable only for
 * backward compatibility with campaigns authored under the old schema.
 */
const MarketingCampaign = model.define("marketing_campaign", {
  id: model.id().primaryKey(),
  brand_id: model.text(),
  name: model.text(),

  // Email content (authored directly on the campaign)
  subject: model.text().nullable(),
  preheader: model.text().nullable(),
  from_name: model.text().nullable(),
  from_email: model.text().nullable(),
  reply_to: model.text().nullable(),
  custom_html: model.text().nullable(),

  // Legacy — kept for backward compatibility with old campaigns
  template_id: model.text().nullable(),
  template_version: model.number().nullable(),

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
