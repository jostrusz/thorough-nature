import { model } from "@medusajs/framework/utils"

const SupportboxConfig = model.define("supportbox_config", {
  id: model.id().primaryKey(),
  email_address: model.text(),
  display_name: model.text(),
  resend_api_key: model.text(),
  imap_host: model.text().nullable(),
  imap_port: model.number().nullable(),
  imap_user: model.text().nullable(),
  imap_password: model.text().nullable(),
  imap_tls: model.boolean().default(true),
  is_active: model.boolean().default(true),
  metadata: model.json().nullable(),
})

export default SupportboxConfig
