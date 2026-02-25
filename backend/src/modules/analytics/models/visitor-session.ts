import { model } from "@medusajs/framework/utils"

const VisitorSession = model.define("analytics_visitor_session", {
  id: model.id().primaryKey(),
  project_id: model.text(),
  visitor_id: model.text(),
  session_id: model.text(),
  // Pages
  first_page_url: model.text().nullable(),
  last_page_url: model.text().nullable(),
  // UTM (from first page of session)
  utm_source: model.text().nullable(),
  utm_medium: model.text().nullable(),
  utm_campaign: model.text().nullable(),
  utm_content: model.text().nullable(),
  utm_term: model.text().nullable(),
  // Traffic
  traffic_source: model.text().nullable(),
  traffic_medium: model.text().nullable(),
  // Device
  device_type: model.text().nullable(),
  browser: model.text().nullable(),
  os: model.text().nullable(),
  country: model.text().nullable(),
  // Engagement
  pages_viewed: model.number().default(1),
  duration_seconds: model.number().default(0),
  is_bounce: model.boolean().default(true),
  // Conversion
  has_conversion: model.boolean().default(false),
  conversion_type: model.text().nullable(),
  order_id: model.text().nullable(),
})

export default VisitorSession
