import { model } from "@medusajs/framework/utils"

const CustomerJourney = model.define("analytics_customer_journey", {
  id: model.id().primaryKey(),
  project_id: model.text(),
  visitor_id: model.text(),
  order_id: model.text().nullable(),
  touchpoints: model.json(),
  first_touch_source: model.text().nullable(),
  first_touch_medium: model.text().nullable(),
  last_touch_source: model.text().nullable(),
  last_touch_medium: model.text().nullable(),
  total_touchpoints: model.number().default(0),
  total_sessions: model.number().default(0),
  days_to_conversion: model.number().default(0),
})

export default CustomerJourney
