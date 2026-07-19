// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADS_LIBRARY_MODULE } from "../../../../modules/ads-library"

/**
 * GET  /admin/ads-library/creatives — list with filters
 *   ?project=&language=&tag=&source=&q=&sort=(roas|sales|cpa|date)&limit=&offset=
 * POST /admin/ads-library/creatives — create manual entry
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const { project, language, tag, source, q, sort = "date", limit = "100", offset = "0" } = req.query as any

  const filters: any = {}
  if (project) filters.project_id = project
  if (language) filters.language = language
  if (tag) filters.tag = tag
  if (source) filters.source = source

  let rows = await svc.listAdCreatives(filters, { take: 1000 })

  if (q) {
    const needle = String(q).toLowerCase()
    rows = rows.filter((r: any) => {
      const hay = [r.name, ...(r.primary_texts || []), ...(r.headlines || []), r.description_text]
        .filter(Boolean).join(" ").toLowerCase()
      return hay.includes(needle)
    })
  }

  const perfNum = (r: any, k: string) => Number(r.perf?.[k]) || 0
  rows.sort((a: any, b: any) => {
    if (sort === "roas") return perfNum(b, "roas") - perfNum(a, "roas")
    if (sort === "sales") return perfNum(b, "sales") - perfNum(a, "sales")
    if (sort === "cpa") return (perfNum(a, "cpa") || 9e9) - (perfNum(b, "cpa") || 9e9)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const off = Number(offset), lim = Number(limit)
  const page = rows.slice(off, off + lim)

  // attach image variants so the UI can render variant strips in one call
  const ids = page.map((r: any) => r.id)
  const variants = ids.length
    ? await svc.listAdVariants({ creative_id: ids }, { take: 1000, order: { variant_no: "ASC" } })
    : []
  const byCreative: Record<string, any[]> = {}
  for (const v of variants) (byCreative[v.creative_id] = byCreative[v.creative_id] || []).push(v)

  res.json({
    creatives: page.map((r: any) => ({ ...r, variants: byCreative[r.id] || [] })),
    count: rows.length,
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const b = req.body as any
  if (!b?.name || !b?.project_id || !b?.language) {
    return res.status(400).json({ error: "name, project_id and language are required" })
  }
  const created = await svc.createAdCreatives({
    name: b.name,
    project_id: b.project_id,
    language: String(b.language).toUpperCase(),
    tag: b.tag || "test",
    notes: b.notes || null,
    primary_texts: (b.primary_texts || []).slice(0, 5),
    headlines: (b.headlines || []).slice(0, 5),
    description_text: b.description_text || null,
    cta_type: b.cta_type || null,
    link_url: b.link_url || null,
    media_type: b.media_type || "image",
    image_1x1_url: b.image_1x1_url || null,
    image_9x16_url: b.image_9x16_url || null,
    source: "manual",
  })
  res.json({ creative: created })
}
