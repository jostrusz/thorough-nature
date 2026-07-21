// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveAdsetInput } from "../../lib/meta-send"

/** GET /admin/ads-library/meta/resolve-adset?q=<id nebo URL> — kontrola cíle
 *  před hromadným odesláním (jméno ad setu, kampaně a účtu). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = String((req.query as any).q || "")
  try {
    res.json(await resolveAdsetInput(q))
  } catch (e: any) {
    res.status(400).json({ error: e.message, message: e.message })
  }
}
