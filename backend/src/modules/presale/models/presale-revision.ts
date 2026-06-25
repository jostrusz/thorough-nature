import { model } from "@medusajs/framework/utils"

/**
 * Presale revision — an immutable snapshot of a presale page taken on every
 * save. `snapshot` is a JSON string of the editable fields, so a rollback can
 * restore the full editable state (title, html, meta, pixel) at once.
 */
const PresaleRevision = model.define("presale_revision", {
  id: model.id().primaryKey(),
  presale_id: model.text(),
  snapshot: model.text(),
  note: model.text().nullable(),
})

export default PresaleRevision
