import { model } from "@medusajs/framework/utils"

const DigitalDownload = model.define("digital_download", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  token: model.text(),
  email: model.text(),
  files: model.json().nullable(),
  expires_at: model.dateTime(),
  download_count: model.number().default(0),
  metadata: model.json().nullable(),
})

export default DigitalDownload
