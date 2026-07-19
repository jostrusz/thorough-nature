import { model } from "@medusajs/framework/utils"

/**
 * Background localization job: source creative → target project.
 * `steps` is a chronological array [{ key, label, status, detail }] the UI polls.
 */
const AdLocalizationJob = model.define("ad_localization_job", {
  id: model.id().primaryKey(),
  source_creative_id: model.text(),
  target_project: model.text(),
  status: model.text().default("queued"), // queued | running | done | failed
  steps: model.json().nullable(),
  params: model.json().nullable(), // { img_model, img_mode, img_prompt, p916, img_count, formats, txt_model, txt_count, primary_indexes, headline_indexes }
  result_creative_id: model.text().nullable(),
  error: model.text().nullable(),
  metadata: model.json().nullable(),
})

export default AdLocalizationJob
