import { model } from "@medusajs/framework/utils"

const ProjectSettings = model.define("project_settings", {
  id: model.id().primaryKey(),
  project_id: model.text(),
  // Order bump toggle — show/hide upsell product in checkout sidebar
  order_bump_enabled: model.boolean().default(true),
  // Post-purchase upsell toggle — show upsell page after payment or go straight to thank-you
  upsell_enabled: model.boolean().default(true),
})

export default ProjectSettings
