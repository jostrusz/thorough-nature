import { model } from "@medusajs/framework/utils"

/**
 * Pivot table between lists and contacts. The Medusa model DSL requires a
 * primary key, so we use a synthetic id and add a unique index on
 * (list_id, contact_id) in the migration.
 */
const MarketingListMembership = model.define("marketing_list_membership", {
  id: model.id().primaryKey(),
  list_id: model.text(),
  contact_id: model.text(),
  brand_id: model.text(),
  source: model.text().nullable(),
  added_at: model.dateTime(),
})

export default MarketingListMembership
