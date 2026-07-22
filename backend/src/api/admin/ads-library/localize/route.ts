// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADS_LIBRARY_MODULE } from "../../../../modules/ads-library"
import { runLocalizationJob } from "../lib/localize-runner"
import { imageModels } from "../lib/imagegen"
import { textModels } from "../lib/textgen"

/**
 * POST /admin/ads-library/localize
 * Body: { source_creative_id | source_creative_ids: [], target_projects: [],
 *         img_model, img_mode, img_prompt, p916, img_count,
 *         formats: ['1:1','9:16'], txt_model, txt_count,
 *         primary_indexes?, headline_indexes? }
 * Creates one background job per (card × target project). Bulk callers pass
 * source_creative_ids; a target equal to the card's own project is skipped
 * (no self-localization), empty text indexes mean "all texts".
 *
 * GET — available models (for the wizard selects).
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.json({ image_models: imageModels(), text_models: textModels() })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const b = (req.body || {}) as any
  const targets: string[] = b.target_projects || []
  const sourceIds: string[] = b.source_creative_ids?.length
    ? b.source_creative_ids
    : (b.source_creative_id ? [b.source_creative_id] : [])
  if (!sourceIds.length || !targets.length) {
    return res.status(400).json({ error: "source_creative_id(s) a target_projects jsou povinné" })
  }
  if (sourceIds.length > 25) {
    return res.status(400).json({ error: "max 25 karet na jednu dávku" })
  }
  const sources = await svc.listAdCreatives({ id: sourceIds })
  if (sources.length !== sourceIds.length) {
    return res.status(404).json({ error: "některá kreativa nenalezena" })
  }

  const formats = b.formats?.length ? b.formats : ["1:1", "9:16"]
  const steps = [
    ...(formats.includes("1:1") ? [{ key: "img11", label: "Obrázky 1:1", status: "queued" }] : []),
    ...(formats.includes("9:16") ? [{ key: "img916", label: "Obrázky 9:16 (reframe)", status: "queued" }] : []),
    { key: "texts", label: "Texty", status: "queued" },
  ]

  const jobs = []
  const skipped = []
  for (const src of sources) {
    for (const target of targets) {
      if (target === src.project_id) { skipped.push({ card: src.name, target }); continue }
      const job = await svc.createAdLocalizationJobs({
        source_creative_id: src.id,
        target_project: target,
        status: "queued",
        steps,
        params: {
          img_model: b.img_model || "nano-banana-pro",
          img_mode: b.img_mode || "swap",
          img_prompt: b.img_prompt || "",
          p916: b.p916 || "",
          img_count: b.img_count || 2,
          formats,
          txt_model: b.txt_model || "claude-opus-4-8",
          txt_count: b.txt_count || 1,
          primary_indexes: b.primary_indexes || [],
          headline_indexes: b.headline_indexes || [],
        },
      })
      jobs.push(job)
      // fire-and-forget — progress is polled via GET /admin/ads-library/jobs
      runLocalizationJob(req.scope, job.id).catch((e) =>
        console.error(`[Ads Library] runner crash: ${e.message}`))
    }
  }
  res.json({ jobs, skipped })
}
