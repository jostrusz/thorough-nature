// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADS_LIBRARY_MODULE } from "../../../../../../modules/ads-library"
import { generateImage } from "../../../lib/imagegen"
import { uploadBuffer } from "../../../lib/media"
import { costUSD, round4 } from "../../../lib/pricing"

/**
 * GET  — list variants of a creative
 * POST — { action: 'official', variant_id }  → switch official variant
 *        { action: 'generate', format }      → +1 variant using stored prompt/model
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const variants = await svc.listAdVariants({ creative_id: req.params.id }, { take: 100, order: { format: "ASC", variant_no: "ASC" } })
  res.json({ variants })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const b = (req.body || {}) as any
  const creativeId = req.params.id

  if (b.action === "official") {
    const [v] = await svc.listAdVariants({ id: b.variant_id })
    if (!v || v.creative_id !== creativeId) return res.status(404).json({ error: "varianta nenalezena" })
    const siblings = await svc.listAdVariants({ creative_id: creativeId, format: v.format })
    for (const s of siblings) {
      if (s.is_official !== (s.id === v.id)) {
        await svc.updateAdVariants({ id: s.id, is_official: s.id === v.id })
      }
    }
    // official variant becomes the creative's image
    const patch: any = {}
    if (v.format === "1:1") patch.image_1x1_url = v.url
    if (v.format === "9:16") patch.image_9x16_url = v.url
    await svc.updateAdCreatives({ id: creativeId, ...patch })
    return res.json({ ok: true })
  }

  if (b.action === "generate") {
    const format = b.format === "9:16" ? "9:16" : "1:1"
    const siblings = await svc.listAdVariants({ creative_id: creativeId, format })
    const template = siblings[siblings.length - 1]
    if (!template) return res.status(400).json({ error: "žádná existující varianta jako vzor (spusť nejdřív lokalizaci)" })
    const [creative] = await svc.listAdCreatives({ id: creativeId })

    const refs = format === "9:16"
      ? [creative.image_1x1_url].filter(Boolean)
      : (template.metadata?.refs || [creative.image_1x1_url]).filter(Boolean)
    try {
      const { buffer, mime, usage } = await generateImage({
        modelId: template.model_id, prompt: template.prompt, refs, aspectRatio: format,
      })
      const cost = costUSD(usage)
      const no = Math.max(...siblings.map((s: any) => s.variant_no)) + 1
      const ext = mime.includes("png") ? "png" : "jpg"
      const url = await uploadBuffer(buffer, `ads-library/${creativeId}/${format.replace(":", "x")}/v${no}.${ext}`, mime)
      const row = await svc.createAdVariants({
        creative_id: creativeId, format, variant_no: no, url,
        model_id: template.model_id, mode: template.mode, prompt: template.prompt, is_official: false,
        metadata: { cost_usd: cost != null ? round4(cost) : null, tokens_in: usage?.input || 0, tokens_out: usage?.output || 0 },
      })
      return res.json({ variant: row })
    } catch (e: any) {
      return res.status(502).json({ error: e.message })
    }
  }

  res.status(400).json({ error: "neznámá action" })
}
