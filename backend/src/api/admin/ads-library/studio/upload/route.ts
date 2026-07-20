// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { uploadBuffer } from "../../lib/media"

/**
 * POST /admin/ads-library/studio/upload
 * Body: { file_name, content_type, data_b64 } — stores the uploaded 1:1 in
 * MinIO and returns its public URL. Body size limit raised in middlewares.ts.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const b = (req.body || {}) as any
  if (!b.data_b64) return res.status(400).json({ error: "data_b64 je povinné", message: "data_b64 je povinné" })
  const buf = Buffer.from(String(b.data_b64), "base64")
  if (!buf.length) return res.status(400).json({ error: "prázdný soubor", message: "prázdný soubor" })
  if (buf.length > 15 * 1024 * 1024) return res.status(400).json({ error: "soubor je větší než 15 MB", message: "soubor je větší než 15 MB" })
  const type = b.content_type || "image/jpeg"
  const ext = type.includes("png") ? "png" : "jpg"
  const safe = String(b.file_name || "obrazek").replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9-]+/gi, "-").slice(0, 60)
  try {
    const url = await uploadBuffer(buf, `ads-library/studio/${safe}.${ext}`, type)
    res.json({ url, file_name: b.file_name || `${safe}.${ext}` })
  } catch (e: any) {
    res.status(502).json({ error: e.message, message: e.message })
  }
}
