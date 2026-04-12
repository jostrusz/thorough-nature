import { model } from "@medusajs/framework/utils"

const MarketingFlow = model.define("marketing_flow", {
  id: model.id().primaryKey(),
  brand_id: model.text(),
  name: model.text(),
  description: model.text().nullable(),
  trigger: model.json(),                         // { type, config }
  definition: model.json(),                      // nodes + edges
  status: model.text().default("draft"),         // draft | live | paused | archived
  version: model.number().default(1),
  stats: model.json().nullable(),
  metadata: model.json().nullable(),
})

export default MarketingFlow
