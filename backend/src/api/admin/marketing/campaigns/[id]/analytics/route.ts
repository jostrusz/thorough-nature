// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

/**
 * GET /admin/marketing/campaigns/:id/analytics
 *
 * Per-campaign dashboard:
 *   - send funnel: queued / sent / delivered / opened / clicked / bounced
 *   - attribution: orders + revenue (EUR) + RPE
 *   - link breakdown: clicks + orders + revenue per link_label
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = String((req.params as any).id)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    // ── Funnel counts from marketing_message ────────────────────────
    const funnelRes = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status IN ('sent','delivered','opened','clicked'))::int AS sent,
         COUNT(*) FILTER (WHERE delivered_at IS NOT NULL OR status IN ('delivered','opened','clicked'))::int AS delivered,
         COUNT(*) FILTER (WHERE first_opened_at IS NOT NULL)::int AS opened_unique,
         COUNT(*) FILTER (WHERE first_clicked_at IS NOT NULL)::int AS clicked_unique,
         COUNT(*) FILTER (WHERE status = 'bounced')::int AS bounced,
         COUNT(*) FILTER (WHERE status = 'complained')::int AS complained,
         COALESCE(SUM(opens_count), 0)::int AS opens_total,
         COALESCE(SUM(clicks_count), 0)::int AS clicks_total
       FROM marketing_message
       WHERE campaign_id = $1 AND deleted_at IS NULL`,
      [id]
    )
    const f = funnelRes.rows[0] || {}

    // ── Attribution revenue ─────────────────────────────────────────
    const revRes = await pool.query(
      `SELECT COUNT(DISTINCT order_id)::int AS orders,
              COALESCE(SUM(order_total_eur), 0)::float AS revenue_eur
       FROM marketing_attribution
       WHERE campaign_id = $1`,
      [id]
    )
    const orders = revRes.rows[0]?.orders || 0
    const revenue_eur = revRes.rows[0]?.revenue_eur || 0

    // ── Link breakdown ──────────────────────────────────────────────
    const linkRes = await pool.query(
      `SELECT
         COALESCE(link_label, 'link') AS link_label,
         COUNT(*)::int AS clicks,
         COUNT(DISTINCT contact_id)::int AS unique_clickers
       FROM marketing_click
       WHERE campaign_id = $1
       GROUP BY link_label
       ORDER BY clicks DESC`,
      [id]
    )

    // ── A/B per-variant stats ───────────────────────────────────────
    let ab_variants: Array<{
      index: number
      subject: string | null
      sent: number
      opened: number
      clicked: number
      open_rate: number
      click_rate: number
    }> = []

    const campRes = await pool.query(
      `SELECT ab_test FROM marketing_campaign WHERE id = $1 LIMIT 1`,
      [id]
    )
    const abTest = campRes.rows[0]?.ab_test
    const variants: string[] = Array.isArray(abTest?.variants) ? abTest.variants : []

    if (abTest?.enabled && variants.length >= 2) {
      const abRes = await pool.query(
        `SELECT (metadata->>'ab_variant')::int AS idx,
                count(*) FILTER (WHERE status IN ('sent','delivered','opened','clicked','bounced','complained'))::int AS sent,
                count(*) FILTER (WHERE status IN ('opened','clicked'))::int AS opened,
                count(*) FILTER (WHERE status = 'clicked')::int AS clicked
         FROM marketing_message
         WHERE campaign_id = $1 AND deleted_at IS NULL AND metadata->>'ab_variant' IS NOT NULL
         GROUP BY 1 ORDER BY 1`,
        [id]
      )
      const byIdx = new Map<number, { sent: number; opened: number; clicked: number }>()
      for (const row of abRes.rows) {
        byIdx.set(row.idx, {
          sent: row.sent || 0,
          opened: row.opened || 0,
          clicked: row.clicked || 0,
        })
      }
      ab_variants = variants.map((subject, index) => {
        const s = byIdx.get(index) || { sent: 0, opened: 0, clicked: 0 }
        return {
          index,
          subject,
          sent: s.sent,
          opened: s.opened,
          clicked: s.clicked,
          open_rate: s.sent ? s.opened / s.sent : 0,
          click_rate: s.sent ? s.clicked / s.sent : 0,
        }
      })
    }

    const sent = f.sent || 0
    res.json({
      funnel: {
        total: f.total || 0,
        sent,
        delivered: f.delivered || 0,
        opened_unique: f.opened_unique || 0,
        clicked_unique: f.clicked_unique || 0,
        bounced: f.bounced || 0,
        complained: f.complained || 0,
        opens_total: f.opens_total || 0,
        clicks_total: f.clicks_total || 0,
        open_rate: sent ? (f.opened_unique || 0) / sent : 0,
        ctr: sent ? (f.clicked_unique || 0) / sent : 0,
        ctor: f.opened_unique ? (f.clicked_unique || 0) / f.opened_unique : 0,
      },
      revenue: {
        orders,
        revenue_eur,
        rpe: sent ? revenue_eur / sent : 0,
        conversion_rate: sent ? orders / sent : 0,
      },
      links: linkRes.rows,
      ab_variants,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  } finally {
    await pool.end()
  }
}
