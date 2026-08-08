import { model } from "@medusajs/framework/utils"

// Approval cards. The agent proposes; the owner decides; the agent executes.
const AgentTask = model.define("agent_task", {
  id: model.id().primaryKey(),
  conversation_id: model.text().nullable(),
  ticket_id: model.text().nullable(),
  title: model.text(),
  description: model.text().nullable(),
  action_type: model.text(), // reply | refund | resend_ebooks | send_to_wms | address_fix | invoice | other
  payload: model.json().nullable(),
  draft_reply: model.text().nullable(),
  confidence: model.number().nullable(), // 0-100, agent's own certainty
  status: model.text().default("pending"), // pending | approved | rejected | executed | failed | cancelled
  decision_note: model.text().nullable(),
  edited_draft: model.text().nullable(), // owner's edited version wins over draft_reply
  decided_at: model.text().nullable(),
  executed_at: model.text().nullable(),
  result: model.json().nullable(),
})

export default AgentTask
