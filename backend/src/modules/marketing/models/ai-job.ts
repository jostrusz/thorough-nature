import { model } from "@medusajs/framework/utils"

const MarketingAiJob = model.define("marketing_ai_job", {
  id: model.id().primaryKey(),
  brand_id: model.text(),
  type: model.text(),                            // subject_generation | body_generation | segment_from_prompt | brand_voice_training
  input: model.json().nullable(),
  output: model.json().nullable(),
  model: model.text().nullable(),                // resolved from env at call time — never hardcoded
  tokens_in: model.number().nullable(),
  tokens_out: model.number().nullable(),
  status: model.text().default("queued"),        // queued | running | completed | failed
  error: model.text().nullable(),
})

export default MarketingAiJob
