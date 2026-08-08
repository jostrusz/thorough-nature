import { model } from "@medusajs/framework/utils"

// One row per AI-managed conversation. kind "ticket" mirrors a supportbox_ticket
// (ticket_id set); kind "dm" is a direct owner<->agent chat with no customer.
const AgentConversation = model.define("agent_conversation", {
  id: model.id().primaryKey(),
  kind: model.text().default("ticket"), // "ticket" | "dm"
  ticket_id: model.text().nullable(),
  title: model.text().nullable(), // used for dm; tickets take subject from supportbox
  project: model.text().nullable(),
  status: model.text().default("idle"), // idle | agent_working | waiting_owner | closed
  session_id: model.text().nullable(), // claude --resume session on the VPS
  last_owner_read_at: model.text().nullable(),
  last_activity_at: model.text().nullable(),
  metadata: model.json().nullable(),
})

export default AgentConversation
