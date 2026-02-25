import { model } from "@medusajs/framework/utils"

const QuickBooksConfig = model.define("quickbooks_config", {
  id: model.id().primaryKey(),
  project_id: model.text(),
  client_id: model.text(),
  client_secret: model.text(),
  environment: model.text().default("sandbox"),
  access_token: model.text().nullable(),
  refresh_token: model.text().nullable(),
  access_token_expires_at: model.text().nullable(),
  refresh_token_expires_at: model.text().nullable(),
  realm_id: model.text().nullable(),
  default_item_id: model.text().nullable(),
  redirect_uri: model.text().nullable(),
  is_connected: model.boolean().default(false),
  enabled: model.boolean().default(true),
  metadata: model.json().nullable(),
})

export default QuickBooksConfig
