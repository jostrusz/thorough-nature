import { model } from "@medusajs/framework/utils"

const ConversionEvent = model.define("analytics_conversion_event", {
  id: model.id().primaryKey(),
  project_id: model.text(),
  session_id: model.text(),
  visitor_id: model.text(),
  event_type: model.text(),
  event_data: model.json().nullable(),
  page_url: model.text().nullable(),
})

export default ConversionEvent
