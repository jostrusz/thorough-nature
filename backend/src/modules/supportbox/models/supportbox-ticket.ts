import { model } from "@medusajs/framework/utils"

const SupportboxTicket = model.define("supportbox_ticket", {
  id: model.id().primaryKey(),
  config_id: model.text(),
  from_email: model.text(),
  from_name: model.text().nullable(),
  subject: model.text(),
  status: model.text().default("new"), // "new", "solved", "old"
  solved_at: model.text().nullable(), // ISO timestamp when solved
  order_id: model.text().nullable(),
  customer_id: model.text().nullable(),
  thread_key: model.text().nullable(), // for grouping by subject/from
  metadata: model.json().nullable(),
})

export default SupportboxTicket
