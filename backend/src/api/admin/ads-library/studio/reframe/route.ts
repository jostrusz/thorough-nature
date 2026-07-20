// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { generateImage } from "../../lib/imagegen"
import { uploadBuffer } from "../../lib/media"
import { costUSD, round4 } from "../../lib/pricing"

const P916 = "Reframe to 9:16 portrait. Extend the environment upward and downward using consistent perspective and atmospheric depth. Preserve all original details and the overall aesthetic."

/**
 * POST /admin/ads-library/studio/reframe
 * Body: { image_url, img_model? } — synchronous 9:16 reframe of an uploaded
 * 1:1 (~20-60 s). Returns the MinIO URL of the vertical + its cost.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const b = (req.body || {}) as any
  if (!b.image_url) return res.status(400).json({ error: "image_url je povinné", message: "image_url je povinné" })
  try {
    const { buffer, mime, usage } = await generateImage({
      modelId: b.img_model || "nano-banana-pro", prompt: P916, refs: [b.image_url], aspectRatio: "9:16",
    })
    const ext = mime.includes("png") ? "png" : "jpg"
    const url = await uploadBuffer(buffer, `ads-library/studio/916-${Date.now().toString(36)}.${ext}`, mime)
    const cost = costUSD(usage)
    res.json({ url, cost_usd: cost != null ? round4(cost) : null })
  } catch (e: any) {
    res.status(502).json({ error: e.message, message: e.message })
  }
}
