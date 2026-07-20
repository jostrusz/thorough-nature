// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADS_LIBRARY_MODULE } from "../../../../modules/ads-library"

/** GET /admin/ads-library/jobs — recent localization jobs for the Fronta tab. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const jobs = await svc.listAdLocalizationJobs({}, { take: 40, order: { created_at: "DESC" } })
  const srcIds = [...new Set(jobs.map((j: any) => j.source_creative_id))]
  const srcs = srcIds.length ? await svc.listAdCreatives({ id: srcIds }) : []
  const srcMap = Object.fromEntries(srcs.map((s: any) => [s.id, s]))
  // result thumb wins once generated — it shows the localized image, not the source
  const resIds = jobs.map((j: any) => j.result_creative_id).filter(Boolean)
  const results = resIds.length ? await svc.listAdCreatives({ id: [...new Set(resIds)] }) : []
  const resMap = Object.fromEntries(results.map((r: any) => [r.id, r]))
  res.json({
    jobs: jobs.map((j: any) => {
      const src = srcMap[j.source_creative_id]
      const out = j.result_creative_id ? resMap[j.result_creative_id] : null
      return {
        ...j,
        source_name: src?.name || j.source_creative_id,
        thumb: out?.image_1x1_url || src?.image_1x1_url || src?.video_thumb_url || null,
      }
    }),
  })
}
