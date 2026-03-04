import { model } from "@medusajs/framework/utils"
import ProjectConfig from "./project-config"

const DailyProjectStats = model.define("daily_project_stats", {
  id: model.id().primaryKey(),
  project: model.belongsTo(() => ProjectConfig, {
    mappedBy: "daily_stats",
  }),
  date: model.text(), // "YYYY-MM-DD" format
  revenue: model.bigNumber().default(0),
  tax_amount: model.bigNumber().default(0),
  order_count: model.number().default(0),
  item_count: model.number().default(0),
  refund_amount: model.bigNumber().default(0),
  ad_spend: model.bigNumber().default(0),
  book_cost_total: model.bigNumber().default(0),
  shipping_cost_total: model.bigNumber().default(0),
  pick_pack_total: model.bigNumber().default(0),
  payment_fee_total: model.bigNumber().default(0),
  net_profit: model.bigNumber().default(0),
  last_synced_at: model.dateTime().nullable(),
})

export default DailyProjectStats
