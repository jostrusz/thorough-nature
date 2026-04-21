import { model } from "@medusajs/framework/utils"

/**
 * marketing_flow_run — one contact's journey through a flow.
 *
 * state transitions:
 *   running → waiting (delay node)
 *   running → completed (reached exit node OR matched a goal)
 *   running → exited (auto-unsub, bounce, manual removal, contact deleted)
 *   running → errored (technical failure)
 *
 * exit_reason explains WHY the run ended:
 *   "goal:<goal_id>"   — goal matched (completed path)
 *   "exit_node"        — reached explicit exit node
 *   "flow_end"         — fell off end of node list
 *   "unsubscribed"     — contact status flipped to unsubscribed
 *   "bounced"          — contact status flipped to bounced/complained/suppressed
 *   "manual"           — admin removed the contact
 *
 * visited_node_ids logs which nodes executed (in order) so we can build
 * per-node funnel charts ("how many reached node #3 of 7?").
 */
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
  exit_reason: model.text().nullable(),
  goal_id: model.text().nullable(),
  visited_node_ids: model.json().nullable(),     // string[]
})

export default MarketingFlowRun
