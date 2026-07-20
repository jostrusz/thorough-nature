import { model } from "@medusajs/framework/utils"

/**
 * Ads Library — one row = one ad creative (image/video + up to 5 primaries
 * and 5 headlines). Rows come from manual entry, Meta import, or AI translation.
 * `family_id` groups an original with its language adaptations.
 */
const AdCreative = model.define("ad_creative", {
  id: model.id().primaryKey(),
  name: model.text(),
  project_id: model.text(), // loslatenboek, lache-livre, ...
  language: model.text(), // NL, DE, PL, SE, NO, CZ, SK, HU, FR
  tag: model.text().default("test"), // winner | test | paused | evergreen
  notes: model.text().nullable(),

  primary_texts: model.json().nullable(), // string[] (max 5)
  headlines: model.json().nullable(), // string[] (max 5)
  description_text: model.text().nullable(),
  cta_type: model.text().nullable(), // LEARN_MORE, SHOP_NOW, ...
  link_url: model.text().nullable(),

  media_type: model.text().default("image"), // image | video
  image_1x1_url: model.text().nullable(), // MinIO mirror
  image_9x16_url: model.text().nullable(), // MinIO mirror
  video_thumb_url: model.text().nullable(),

  source: model.text().default("manual"), // manual | meta_import | translation
  meta_ad_id: model.text().nullable(),
  meta_creative_id: model.text().nullable(),
  meta_account_id: model.text().nullable(),

  family_id: model.text().nullable(), // groups original + translations
  translated_from_id: model.text().nullable(),

  // last synced performance snapshot { spend, sales, cpa, roas, ctr, range, synced_at }
  perf: model.json().nullable(),

  // archive — nothing is ever deleted, archived cards just move out of sight
  archived: model.boolean().default(false),
  archived_at: model.dateTime().nullable(),

  metadata: model.json().nullable(),
})

export default AdCreative
