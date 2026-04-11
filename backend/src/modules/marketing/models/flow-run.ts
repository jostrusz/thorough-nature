import { model } from "@medusajs/framework/utils"

const MarketingFlowRun = model.define("marketing_flow_run", {
  id: model.id().primaryKey(),
  flow_id: model.text(),
  brand_id: model.text(),
  contact_id: model.text(),
  current_node_id: model.text().nullable(),
  state: model.text().default("running"),        // running | waiting | completed | exited | errored
  started_at: model.dateTime(),
  next_run_at: model.dateTime().nullable(),
  context: model.json().nullable(),
  completed_at: model.dateTime().nullable(),
  error: model.text().nullable(),
})

export default MarketingFlowRun
