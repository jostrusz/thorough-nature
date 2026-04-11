import { model } from "@medusajs/framework/utils"

/**
 * marketing_template — current/head version of a template.
 * Historical snapshots live in marketing_template_version.
 */
const MarketingTemplate = model.define("marketing_template", {
  id: model.id().primaryKey(),
  brand_id: model.text(),
  name: model.text(),
  subject: model.text(),
  preheader: model.text().default(""),           // separate from HTML body — never overridden by custom HTML
  from_name: model.text().nullable(),
  from_email: model.text().nullable(),
  reply_to: model.text().nullable(),
  block_json: model.json().nullable(),           // block-based editor source of truth
  custom_html: model.text().nullable(),          // raw HTML option (sanitized at render time)
  compiled_html: model.text().nullable(),
  compiled_text: model.text().nullable(),
  editor_type: model.text().default("blocks"),   // "blocks" | "html" | "visual"
  version: model.number().default(1),
  status: model.text().default("draft"),         // "draft" | "ready" | "archived"
  brand_voice_used: model.boolean().default(false),
  metadata: model.json().nullable(),
})

export default MarketingTemplate
