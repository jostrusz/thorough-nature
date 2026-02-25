import { model } from "@medusajs/framework/utils"

const FakturoidConfig = model.define("fakturoid_config", {
  id: model.id().primaryKey(),
  project_id: model.text(),
  slug: model.text(),
  client_id: model.text(),
  client_secret: model.text(),
  user_agent_email: model.text(),
  access_token: model.text().nullable(),
  token_expires_at: model.text().nullable(),
  enabled: model.boolean().default(true),
  default_language: model.text().default("en"),
  metadata: model.json().nullable(),
})

export default FakturoidConfig
