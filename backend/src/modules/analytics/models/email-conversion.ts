import { model } from "@medusajs/framework/utils"

const EmailConversion = model.define("analytics_email_conversion", {
  id: model.id().primaryKey(),
  email_campaign_id: model.text(),
  customer_email: model.text(),
  order_id: model.text().nullable(),
  order_amount: model.number().default(0),
  clicked_link: model.text().nullable(),
  time_to_conversion: model.number().default(0),
})

export default EmailConversion
