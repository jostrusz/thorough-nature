// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADS_LIBRARY_MODULE } from "../../../../../modules/ads-library"
import { runStudioTextsJob } from "../../lib/studio-runner"

/**
 * POST /admin/ads-library/studio/generate
 * Body: { image_url, project_id, txt_model, file_name }
 * Creates an async Studio job (describe image → 5 primaries from templates +
 * 5 viral headlines). Result lands in job.params.result; UI polls /jobs.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const b = (req.body || {}) as any
  if (!b.image_url || !b.project_id) {
    return res.status(400).json({ error: "image_url a project_id jsou povinné", message: "image_url a project_id jsou povinné" })
  }
  const job = await svc.createAdLocalizationJobs({
    source_creative_id: "studio",
    target_project: b.project_id,
    status: "queued",
    steps: [
      { key: "describe", label: "Popis obrázku", status: "queued" },
      { key: "texts", label: "Texty ze vzorů", status: "queued" },
    ],
    params: {
      studio: true,
      image_url: b.image_url,
      file_name: b.file_name || "studio obrázek",
      txt_model: b.txt_model || "claude-opus-4-8",
    },
  })
  const container = req.scope
  setImmediate(() => runStudioTextsJob(container, job.id))
  res.json({ job_id: job.id })
}
