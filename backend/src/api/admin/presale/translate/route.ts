// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { translateHeadline } from "../utils"

/**
 * POST /admin/presale/translate
 * Body: { title: string, target_lang?: string (default "cs") }
 * Returns { translation } — used by the admin "Přeložit nadpis (Haiku)" button.
 * Does not persist; the caller saves it into title_cs on Save.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const body = (req.body || {}) as Record<string, any>
    const title = (body.title || "").toString()
    const targetLang = (body.target_lang || "cs").toString()

    if (!title.trim()) {
      res.status(400).json({ error: "title is required" })
      return
    }

    const translation = await translateHeadline(title, targetLang)
    res.json({ translation })
  } catch (error: any) {
    res.status(500).json({ error: error.message || "translation failed" })
  }
}
