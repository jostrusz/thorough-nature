import { model } from "@medusajs/framework/utils"

const EmailCampaign = model.define("analytics_email_campaign", {
  id: model.id().primaryKey(),
  project_id: model.text(),
  email_name: model.text(),
  email_subject: model.text().nullable(),
  email_type: model.text().nullable(),
  sent_count: model.number().default(0),
  delivered_count: model.number().default(0),
  bounced_count: model.number().default(0),
  opened_count: model.number().default(0),
  clicked_count: model.number().default(0),
  unsubscribed_count: model.number().default(0),
  conversion_count: model.number().default(0),
  revenue: model.number().default(0),
})

export default EmailCampaign
