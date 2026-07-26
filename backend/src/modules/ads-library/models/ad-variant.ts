import { model } from "@medusajs/framework/utils"

/**
 * One generated image variant of a creative. Every generation run is kept —
 * `is_official` marks the one currently used as the creative's image.
 */
const AdVariant = model.define("ad_variant", {
  id: model.id().primaryKey(),
  creative_id: model.text(),
  format: model.text(), // '4:5' (feed, nové) | '1:1' (feed, starší) | '9:16' (Stories/Reels)
  variant_no: model.number(),
  url: model.text(), // MinIO public URL
  model_id: model.text().nullable(), // nano-banana-pro, ...
  mode: model.text().nullable(), // swap | texts | reframe
  prompt: model.text().nullable(), // exact prompt used
  is_official: model.boolean().default(false),
  metadata: model.json().nullable(),
})

export default AdVariant
