import { model } from "@medusajs/framework/utils"

// Tiny key/value store: agent_enabled (kill switch), poll hints, etc.
const AgentSetting = model.define("agent_setting", {
  id: model.id().primaryKey(),
  key: model.text(),
  value: model.json().nullable(),
})

export default AgentSetting
