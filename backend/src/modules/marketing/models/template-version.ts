import { model } from "@medusajs/framework/utils"

/**
 * Immutable historical snapshot of a template. Written on every save/publish
 * of marketing_template, allowing rollback and campaign reproducibility.
 */
const MarketingTemplateVersion = model.define("marketing_template_version", {
  id: model.id().primaryKey(),
  template_id: model.text(),
  brand_id: model.text(),
  version: model.number(),
  subject: model.text(),
  preheader: model.text().default(""),
  from_name: model.text().nullable(),
  from_email: model.text().nullable(),
  reply_to: model.text().nullable(),
  block_json: model.json().nullable(),
  custom_html: model.text().nullable(),
  compiled_html: model.text().nullable(),
  compiled_text: model.text().nullable(),
  editor_type: model.text().default("blocks"),
  created_by: model.text().nullable(),
  changelog: model.text().nullable(),
})

export default MarketingTemplateVersion
