import { model } from "@medusajs/framework/utils"

const SupportboxMessage = model.define("supportbox_message", {
  id: model.id().primaryKey(),
  ticket_id: model.text(),
  direction: model.text(), // "inbound" or "outbound"
  from_email: model.text(),
  from_name: model.text().nullable(),
  body_html: model.text(),
  body_text: model.text().nullable(),
  resend_message_id: model.text().nullable(),
  metadata: model.json().nullable(),
})

export default SupportboxMessage
