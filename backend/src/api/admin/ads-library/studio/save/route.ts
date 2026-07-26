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

  // The Studio job is the source of truth for the 9:16, not the request body.
  // The client sends whatever its cached item held, so saving right after a
  // reframe (before the list refetches) used to persist null and the vertical
  // never reached the library card — nothing back-fills it later.
  let item: any = null
  if (b.job_id) {
    try {
      ;[item] = await svc.listAdLocalizationJobs({ id: b.job_id })
    } catch {}
  }
  const image9x16 = b.image_9x16_url || item?.params?.result916?.url || null

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
    image_9x16_url: image9x16,
    source: "studio",
    metadata: { studio_job_id: b.job_id || null, generating: false },
  })
  if (b.job_id) {
    try {
      // Re-read: a reframe running concurrently may have written result916
      // between our first read and now, and params is a read-modify-write.
      const [fresh] = await svc.listAdLocalizationJobs({ id: b.job_id })
      await svc.updateAdLocalizationJobs({
        id: b.job_id, result_creative_id: created.id,
        params: { ...(fresh?.params || item?.params || {}), saved_name: created.name },
      })
      // …and if that reframe finished after we built the card, pull its 9:16 in.
      const late = (fresh as any)?.params?.result916?.url
      if (!image9x16 && late) {
        await svc.updateAdCreatives({ id: created.id, image_9x16_url: late })
        ;(created as any).image_9x16_url = late
      }
    } catch (e: any) {
      req.scope.resolve("logger")?.warn?.(`[Ads Library] studio/save: job ${b.job_id} se nepodařilo propojit s kartou ${created.id}: ${e?.message}`)
    }
  }
  res.json({ creative: created })
}
