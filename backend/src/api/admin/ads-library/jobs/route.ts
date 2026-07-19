// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADS_LIBRARY_MODULE } from "../../../../modules/ads-library"

/** GET /admin/ads-library/jobs — recent localization jobs for the Fronta tab. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const jobs = await svc.listAdLocalizationJobs({}, { take: 40, order: { created_at: "DESC" } })
  const srcIds = [...new Set(jobs.map((j: any) => j.source_creative_id))]
  const srcs = srcIds.length ? await svc.listAdCreatives({ id: srcIds }) : []
  const nameMap = Object.fromEntries(srcs.map((s: any) => [s.id, s.name]))
  res.json({
    jobs: jobs.map((j: any) => ({ ...j, source_name: nameMap[j.source_creative_id] || j.source_creative_id })),
  })
}
