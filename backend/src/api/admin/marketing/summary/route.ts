// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

/**
 * GET /admin/marketing/summary?brand_id=...
 * Returns a lightweight dashboard summary:
 *   { summary: { total_contacts, campaigns_sent_30d, avg_open_rate, avg_click_rate } }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const brandId = String((req.query as any).brand_id || "")
  if (!brandId) {
    res.json({ summary: null })
    return
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const [contactsRes, campaignsRes, messagesRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS c FROM marketing_contact
         WHERE brand_id = $1 AND deleted_at IS NULL AND status = 'subscribed'`,
        [brandId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS c FROM marketing_campaign
         WHERE brand_id = $1 AND deleted_at IS NULL AND status = 'sent'
           AND sent_at > NOW() - INTERVAL '30 days'`,
        [brandId]
      ),
      pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE first_opened_at IS NOT NULL)::int AS opened,
           COUNT(*) FILTER (WHERE first_clicked_at IS NOT NULL)::int AS clicked
         FROM marketing_message
         WHERE brand_id = $1 AND deleted_at IS NULL
           AND sent_at > NOW() - INTERVAL '30 days'`,
        [brandId]
      ),
    ])
    const total = messagesRes.rows[0]?.total || 0
    const opened = messagesRes.rows[0]?.opened || 0
    const clicked = messagesRes.rows[0]?.clicked || 0
    res.json({
      summary: {
        total_contacts: contactsRes.rows[0]?.c || 0,
        campaigns_sent_30d: campaignsRes.rows[0]?.c || 0,
        avg_open_rate: total ? Math.round((opened / total) * 1000) / 10 : 0,
        avg_click_rate: total ? Math.round((clicked / total) * 1000) / 10 : 0,
      },
    })
  } catch (e: any) {
    res.json({ summary: null, error: e.message })
  } finally {
    await pool.end().catch(() => {})
  }
}
