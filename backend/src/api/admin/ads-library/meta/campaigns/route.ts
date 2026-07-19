// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { graphGet } from "../../lib/meta"

/**
 * GET /admin/ads-library/meta/campaigns?account=act_X
 * Campaigns + their ad sets of one ad account (for the send-to-Meta modal).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const account = String(req.query.account || "")
  if (!account.startsWith("act_")) return res.status(400).json({ error: "account (act_…) je povinný" })
  try {
    const [camps, adsets] = await Promise.all([
      graphGet(`${account}/campaigns`, {
        fields: "id,name,status,daily_budget,lifetime_budget,objective", limit: 50,
        effective_status: JSON.stringify(["ACTIVE", "PAUSED"]),
      }),
      graphGet(`${account}/adsets`, {
        fields: "id,name,status,campaign_id,daily_budget,promoted_object", limit: 200,
        effective_status: JSON.stringify(["ACTIVE", "PAUSED"]),
      }),
    ])
    const byCamp: Record<string, any[]> = {}
    for (const a of adsets.data || []) {
      (byCamp[a.campaign_id] = byCamp[a.campaign_id] || []).push({
        id: a.id, name: a.name, status: a.status,
        daily_budget: a.daily_budget ? Number(a.daily_budget) / 100 : null,
        pixel_id: a.promoted_object?.pixel_id || null,
      })
    }
    res.json({
      campaigns: (camps.data || []).map((c: any) => ({
        id: c.id, name: c.name, status: c.status,
        daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
        adsets: byCamp[c.id] || [],
      })),
    })
  } catch (e: any) {
    res.status(502).json({ error: e.message })
  }
}
