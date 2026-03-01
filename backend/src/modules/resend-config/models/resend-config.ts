import { model } from "@medusajs/framework/utils"

const ResendConfig = model.define("resend_config", {
  id: model.id().primaryKey(),
  project_id: model.text(),
  label: model.text(),
  api_key: model.text(),
  from_email: model.text(),
  from_name: model.text().nullable(),
  reply_to: model.text().nullable(),
  use_for: model.json().default(["all"]),
  enabled: model.boolean().default(true),
  metadata: model.json().nullable(),
})

export default ResendConfig
