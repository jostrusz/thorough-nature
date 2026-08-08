import { model } from "@medusajs/framework/utils"

// AI-layer messages. Customer/outbound e-mails are NOT mirrored here — the
// thread endpoint merges supportbox_message rows at read time instead.
const AgentMessage = model.define("agent_message", {
  id: model.id().primaryKey(),
  conversation_id: model.text(),
  role: model.text(), // "owner" | "assistant" | "system"
  kind: model.text().default("chat"), // "chat" | "note" | "event"
  body: model.text(),
  consumed_at: model.text().nullable(), // set by the VPS agent when picked up (owner msgs)
  metadata: model.json().nullable(), // { confidence, tool_calls, ... }
})

export default AgentMessage
