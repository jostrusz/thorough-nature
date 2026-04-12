import { model } from "@medusajs/framework/utils"

const MarketingSegment = model.define("marketing_segment", {
  id: model.id().primaryKey(),
  brand_id: model.text(),
  name: model.text(),
  description: model.text().nullable(),
  query: model.json(),                         // segment DSL
  is_suppression: model.boolean().default(false),
  cached_count: model.number().nullable(),
  cached_at: model.dateTime().nullable(),
  metadata: model.json().nullable(),
})

export default MarketingSegment
