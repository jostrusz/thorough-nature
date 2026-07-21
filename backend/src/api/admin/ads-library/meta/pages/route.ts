// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { graphGet } from "../../lib/meta"

/** GET /admin/ads-library/meta/pages — FB pages the API token has a role on
 *  (candidates for the explicit page picker in the send-to-meta modal). */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  try {
    const mine = await graphGet("me/accounts", { fields: "id,name", limit: 100 })
    res.json({ pages: (mine.data || []).map((p: any) => ({ id: String(p.id), name: p.name })) })
  } catch (e: any) {
    res.status(502).json({ error: e.message, message: e.message, pages: [] })
  }
}
