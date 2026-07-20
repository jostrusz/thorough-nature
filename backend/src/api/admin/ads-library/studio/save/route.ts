// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADS_LIBRARY_MODULE } from "../../../../../modules/ads-library"
import { PROJECT_CONTEXT } from "../../lib/project-context"
import { PAGE_CONTEXT } from "../../lib/page-context"

/**
 * POST /admin/ads-library/studio/save
 * Body: { name, project_id, image_1x1_url, image_9x16_url?, primaries, headlines, job_id? }
 * Approves a Studio result → creates a normal library card (source "studio")
 * with every downstream capability (variants, send-to-meta, archive…).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const b = (req.body || {}) as any
  const ctx = PROJECT_CONTEXT[b.project_id]
  if (!ctx) return res.status(400).json({ error: `neznámý projekt: ${b.project_id}`, message: `neznámý projekt: ${b.project_id}` })
  if (!b.image_1x1_url || !b.primaries?.length || !b.headlines?.length) {
    return res.status(400).json({ error: "chybí obrázek nebo texty", message: "chybí obrázek nebo texty" })
  }
  const created = await svc.createAdCreatives({
    name: b.name || `studio-${Date.now().toString(36)}`,
    project_id: b.project_id,
    language: ctx.language,
    tag: "test",
    primary_texts: b.primaries.slice(0, 5),
    headlines: b.headlines.slice(0, 5),
    cta_type: "LEARN_MORE",
    link_url: PAGE_CONTEXT[b.project_id]?.url || `https://www.${ctx.domain}/`,
    media_type: "image",
    image_1x1_url: b.image_1x1_url,
    image_9x16_url: b.image_9x16_url || null,
    source: "studio",
    metadata: { studio_job_id: b.job_id || null, generating: false },
  })
  if (b.job_id) {
    try {
      const [item] = await svc.listAdLocalizationJobs({ id: b.job_id })
      await svc.updateAdLocalizationJobs({
        id: b.job_id, result_creative_id: created.id,
        params: { ...(item?.params || {}), saved_name: created.name },
      })
    } catch {}
  }
  res.json({ creative: created })
}
