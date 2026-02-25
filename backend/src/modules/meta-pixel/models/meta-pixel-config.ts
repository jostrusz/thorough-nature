import { model } from "@medusajs/framework/utils"

const MetaPixelConfig = model.define("meta_pixel_config", {
  id: model.id().primaryKey(),
  // Project identity
  project_id: model.text(),
  // Facebook Pixel ID (e.g. "123456789012345")
  pixel_id: model.text(),
  // CAPI Access Token from Facebook Business Manager
  access_token: model.text(),
  // Test Event Code for FB Events Manager debugging (e.g. "TEST12345")
  test_event_code: model.text().nullable(),
  // Active flag
  enabled: model.boolean().default(true),
})

export default MetaPixelConfig
