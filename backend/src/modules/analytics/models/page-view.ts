import { model } from "@medusajs/framework/utils"

const PageView = model.define("analytics_page_view", {
  id: model.id().primaryKey(),
  project_id: model.text(),
  session_id: model.text(),
  visitor_id: model.text(),
  page_url: model.text(),
  page_path: model.text(),
  referrer: model.text().nullable(),
  // UTM params
  utm_source: model.text().nullable(),
  utm_medium: model.text().nullable(),
  utm_campaign: model.text().nullable(),
  utm_content: model.text().nullable(),
  utm_term: model.text().nullable(),
  // Traffic classification
  traffic_source: model.text().nullable(),
  traffic_medium: model.text().nullable(),
  // Device info
  device_type: model.text().nullable(),
  browser: model.text().nullable(),
  os: model.text().nullable(),
  // Geo
  country: model.text().nullable(),
  ip_address: model.text().nullable(),
  // FB attribution
  fbclid: model.text().nullable(),
  fbc: model.text().nullable(),
  fbp: model.text().nullable(),
  // Engagement (updated via heartbeat)
  time_on_page: model.number().default(0),
  scroll_depth: model.number().default(0),
})

export default PageView
