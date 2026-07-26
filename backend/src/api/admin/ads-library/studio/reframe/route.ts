// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADS_LIBRARY_MODULE } from "../../../../../modules/ads-library"
import { generateImage } from "../../lib/imagegen"
import { uploadBuffer } from "../../lib/media"
import { costUSD, round4 } from "../../lib/pricing"

const P916 = "Reframe to 9:16 portrait. Extend the environment upward and downward using consistent perspective and atmospheric depth. Preserve all original details and the overall aesthetic."

/**
 * POST /admin/ads-library/studio/reframe
 * Body: { item_id, img_model? } — synchronous 9:16 reframe of a Studio item's
 * feed image (~20-60 s). The result is persisted on the item (params.result916), so
 * it survives reloads.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const b = (req.body || {}) as any
  if (!b.item_id) return res.status(400).json({ error: "item_id je povinné", message: "item_id je povinné" })
  const [item] = await svc.listAdLocalizationJobs({ id: b.item_id })
  if (!item?.params?.image_url) return res.status(404).json({ error: "studio položka nenalezena", message: "studio položka nenalezena" })
  try {
    const { buffer, mime, usage } = await generateImage({
      modelId: b.img_model || "nano-banana-pro", prompt: P916, refs: [item.params.image_url], aspectRatio: "9:16",
    })
    const ext = mime.includes("png") ? "png" : "jpg"
    const url = await uploadBuffer(buffer, `ads-library/studio/916-${Date.now().toString(36)}.${ext}`, mime)
    const cost = costUSD(usage)
    const result916 = { url, cost_usd: cost != null ? round4(cost) : null }
    const [fresh] = await svc.listAdLocalizationJobs({ id: item.id })
    await svc.updateAdLocalizationJobs({ id: item.id, params: { ...(fresh.params || {}), result916 } })
    // Mirror onto the library card when one already exists. When it doesn't
    // (the usual case — reframe is normally run before approving to the
    // library), studio/save picks result916 up from the job instead, so the
    // vertical reaches the card either way round.
    if (fresh.result_creative_id) {
      try {
        await svc.updateAdCreatives({ id: fresh.result_creative_id, image_9x16_url: url })
      } catch (e: any) {
        // Never swallow this silently — a failed mirror used to leave the card
        // permanently without its 9:16 and nothing in the logs to say why.
        req.scope.resolve("logger")?.warn?.(`[Ads Library] studio/reframe: kartu ${fresh.result_creative_id} se nepodařilo doplnit o 9:16: ${e?.message}`)
      }
    }
    res.json(result916)
  } catch (e: any) {
    res.status(502).json({ error: e.message, message: e.message })
  }
}
