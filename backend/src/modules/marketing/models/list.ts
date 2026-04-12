import { model } from "@medusajs/framework/utils"

const MarketingList = model.define("marketing_list", {
  id: model.id().primaryKey(),
  brand_id: model.text(),
  name: model.text(),
  description: model.text().nullable(),
  type: model.text().default("static"),   // "static" | "dynamic"
  metadata: model.json().nullable(),
})

export default MarketingList
