import { model } from "@medusajs/framework/utils"

const MarketingForm = model.define("marketing_form", {
  id: model.id().primaryKey(),
  brand_id: model.text(),
  slug: model.text(),
  name: model.text(),
  type: model.text().default("popup"),           // popup | embedded | flyout | banner | landing
  config: model.json().nullable(),               // trigger, timing, position, ...
  styling: model.json().nullable(),              // colors, fonts, spacing
  custom_html: model.text().nullable(),          // raw HTML injection (sanitized at render)
  custom_css: model.text().nullable(),
  fields: model.json().nullable(),               // [{name, label, type, required}]
  preheader: model.text().nullable(),            // SEPARATE field, never affected by custom_html
  success_action: model.json().nullable(),       // { type: 'message'|'redirect', value }
  target_list_ids: model.json().nullable(),
  target_segment_id: model.text().nullable(),
  double_opt_in: model.boolean().nullable(),     // null = inherit from brand
  consent_text: model.text().nullable(),
  status: model.text().default("draft"),         // draft | live | paused
  metrics: model.json().nullable(),
})

export default MarketingForm
