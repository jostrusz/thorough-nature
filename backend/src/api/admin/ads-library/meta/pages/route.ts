// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { graphGet } from "../../lib/meta"
import { listAccountPages } from "../../lib/meta-send"

/**
 * GET /admin/ads-library/meta/pages[?account=act_123]
 * FB pages for the page pickers in the send-to-Meta modals.
 *  - without `account`: every page the API token has a role on (original
 *    behaviour, used by the single-send modal before an account is known)
 *  - with `account`: pages that account can publish under, enriched with
 *    in_use (the page it already advertises with — what the sender would pick
 *    by itself) and the IG id paired with it. Those come first.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const account = String(req.query.account || "").trim()
  if (account && !/^act_\d+$/.test(account)) {
    const msg = "account musí být ve tvaru act_123"
    return res.status(400).json({ error: msg, message: msg, pages: [] })
  }
  try {
    if (account) return res.json({ pages: await listAccountPages(account) })
    const mine = await graphGet("me/accounts", { fields: "id,name", limit: 100 })
    res.json({ pages: (mine.data || []).map((p: any) => ({ id: String(p.id), name: p.name })) })
  } catch (e: any) {
    res.status(502).json({ error: e.message, message: e.message, pages: [] })
  }
}
