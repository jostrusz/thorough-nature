// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADS_LIBRARY_MODULE } from "../../../../modules/ads-library"
import { sweepStaleJobs } from "../lib/stale-jobs"

/**
 * GET /admin/ads-library/studio — persistent Studio items (newest first).
 * Each item is a job row (source_creative_id "studio") carrying the uploaded
 * image, generation state, latest result, 9:16 result and past generations.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  await sweepStaleJobs(svc)
  const rows = await svc.listAdLocalizationJobs(
    { source_creative_id: "studio" },
    { take: 30, order: { created_at: "DESC" } }
  )
  res.json({
    items: rows.map((j: any) => ({
      id: j.id,
      status: j.status, // uploaded | queued | running | done | failed
      error: j.error,
      project: j.target_project || "",
      name: j.params?.file_name || "obrázek",
      url: j.params?.image_url,
      txt_model: j.params?.txt_model,
      result: j.params?.result || null,
      cost: j.params?.cost_usd ?? null,
      result916: j.params?.result916 || null,
      history: j.params?.history || [],
      saved_name: j.params?.saved_name || null,
      created_at: j.created_at,
    })),
  })
}
