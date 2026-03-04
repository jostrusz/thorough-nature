import { model } from "@medusajs/framework/utils"
import DailyProjectStats from "./daily-project-stats"

const ProjectConfig = model.define("project_config", {
  id: model.id().primaryKey(),
  project_name: model.text(),
  project_slug: model.text().unique(),
  flag_emoji: model.text(),
  country_tag: model.text(),
  sales_channel_id: model.text().nullable(),
  book_cost_eur: model.bigNumber().default(1.80),
  shipping_cost_eur: model.bigNumber().default(5.00),
  pick_pack_cost_eur: model.bigNumber().default(1.50),
  payment_fee_rate: model.bigNumber().default(0.03),
  meta_ad_account_id: model.text().nullable(),
  is_active: model.boolean().default(true),
  display_order: model.number().default(0),
  daily_stats: model.hasMany(() => DailyProjectStats, {
    mappedBy: "project",
  }),
})

export default ProjectConfig
