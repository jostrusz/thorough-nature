// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADS_LIBRARY_MODULE } from "../../../../modules/ads-library"
import { runLocalizationJob } from "../lib/localize-runner"
import { imageModels } from "../lib/imagegen"
import { textModels } from "../lib/textgen"

/**
 * POST /admin/ads-library/localize
 * Body: { source_creative_id, target_projects: [], img_model, img_mode, img_prompt,
 *         p916, img_count, formats: ['1:1','9:16'], txt_model, txt_count,
 *         primary_indexes?, headline_indexes? }
 * Creates one background job per target project.
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
  if (!b.source_creative_id || !targets.length) {
    return res.status(400).json({ error: "source_creative_id a target_projects jsou povinné" })
  }
  const [src] = await svc.listAdCreatives({ id: b.source_creative_id })
  if (!src) return res.status(404).json({ error: "kreativa nenalezena" })

  const formats = b.formats?.length ? b.formats : ["1:1", "9:16"]
  const steps = [
    ...(formats.includes("1:1") ? [{ key: "img11", label: "Obrázky 1:1", status: "queued" }] : []),
    ...(formats.includes("9:16") ? [{ key: "img916", label: "Obrázky 9:16 (reframe)", status: "queued" }] : []),
    { key: "texts", label: "Texty", status: "queued" },
  ]

  const jobs = []
  for (const target of targets) {
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
  res.json({ jobs })
}
