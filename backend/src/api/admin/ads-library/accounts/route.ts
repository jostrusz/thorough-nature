// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { graphGet } from "../lib/meta"

/** GET /admin/ads-library/accounts — ad accounts reachable by the token. */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  try {
    const json = await graphGet("me/adaccounts", {
      fields: "id,name,account_status,currency",
      limit: 50,
    })
    const accounts = (json.data || []).map((a: any) => ({
      id: a.id, name: a.name, currency: a.currency, active: a.account_status === 1,
    }))
    res.json({ accounts })
  } catch (e: any) {
    res.status(502).json({ error: e.message })
  }
}
