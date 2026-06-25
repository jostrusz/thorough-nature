// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

/**
 * GET /admin/marketing/popup-signups?days=30&brand_id=...
 *
 * Subscriber acquisition dashboard data — daily counts of new popup signups
 * (marketing_contact.source = 'form') across all projects (or one brand).
 *
 * Days are bucketed in UTC. Empty days are NOT padded here — the frontend
 * fills gaps with 0 to draw a continuous axis.
 *
 * Response:
 *   daily:        [{ date, brand_slug, brand_name, count }]   (new signups)
 *   unsubs_daily: [{ date, brand_slug, brand_name, count }]   (unsubscribes)
 *   by_project:   [{ brand_slug, brand_name, today, d7, d30, prev_d30, trend_pct }]
 *   totals:       { today, d7, d30, prev_d30, trend_pct, unsubs_d30, net_d30 }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const rawDays = parseInt(String((req.query as any).days || "30"), 10)
  const days = [7, 30, 90].includes(rawDays) ? rawDays : 30
  const brandId = String((req.query as any).brand_id || "").trim()

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  // brand filter snippet ($2 param) — applied uniformly to every query
  const brandFilter = brandId ? "AND c.brand_id = $2" : ""
  const params = brandId ? [days, brandId] : [days]

  try {
    const [dailyRes, unsubsRes, byProjectRes, totalsRes] = await Promise.all([
      // ── Daily new signups, grouped by brand + UTC day ──
      pool.query(
        `SELECT
           to_char((c.created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS date,
           b.slug AS brand_slug,
           b.display_name AS brand_name,
           COUNT(*)::int AS count
         FROM marketing_contact c
         JOIN marketing_brand b ON b.id = c.brand_id
         WHERE c.deleted_at IS NULL
           AND c.source = 'form'
           AND c.created_at >= (NOW() AT TIME ZONE 'UTC')::date - ($1::int - 1) * INTERVAL '1 day'
           ${brandFilter}
         GROUP BY 1, 2, 3
         ORDER BY 1 ASC`,
        params
      ),
      // ── Daily unsubscribes, grouped by brand + UTC day ──
      pool.query(
        `SELECT
           to_char((c.unsubscribed_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS date,
           b.slug AS brand_slug,
           b.display_name AS brand_name,
           COUNT(*)::int AS count
         FROM marketing_contact c
         JOIN marketing_brand b ON b.id = c.brand_id
         WHERE c.deleted_at IS NULL
           AND c.source = 'form'
           AND c.unsubscribed_at IS NOT NULL
           AND c.unsubscribed_at >= (NOW() AT TIME ZONE 'UTC')::date - ($1::int - 1) * INTERVAL '1 day'
           ${brandFilter}
         GROUP BY 1, 2, 3
         ORDER BY 1 ASC`,
        params
      ),
      // ── Per-project rollup: today / 7d / 30d / prev 30d ──
      pool.query(
        `SELECT
           b.slug AS brand_slug,
           b.display_name AS brand_name,
           COUNT(*) FILTER (
             WHERE (c.created_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date
           )::int AS today,
           COUNT(*) FILTER (
             WHERE c.created_at >= (NOW() AT TIME ZONE 'UTC')::date - 6 * INTERVAL '1 day'
           )::int AS d7,
           COUNT(*) FILTER (
             WHERE c.created_at >= (NOW() AT TIME ZONE 'UTC')::date - 29 * INTERVAL '1 day'
           )::int AS d30,
           COUNT(*) FILTER (
             WHERE c.created_at >= (NOW() AT TIME ZONE 'UTC')::date - 59 * INTERVAL '1 day'
               AND c.created_at <  (NOW() AT TIME ZONE 'UTC')::date - 29 * INTERVAL '1 day'
           )::int AS prev_d30
         FROM marketing_contact c
         JOIN marketing_brand b ON b.id = c.brand_id
         WHERE c.deleted_at IS NULL
           AND c.source = 'form'
           ${brandFilter}
         GROUP BY b.slug, b.display_name`,
        brandId ? [brandId] : []
          // params unused here except brand filter; reuse a clean param list
      ),
      // ── Totals (across selection) ──
      pool.query(
        `SELECT
           COUNT(*) FILTER (
             WHERE (c.created_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date
           )::int AS today,
           COUNT(*) FILTER (
             WHERE c.created_at >= (NOW() AT TIME ZONE 'UTC')::date - 6 * INTERVAL '1 day'
           )::int AS d7,
           COUNT(*) FILTER (
             WHERE c.created_at >= (NOW() AT TIME ZONE 'UTC')::date - 29 * INTERVAL '1 day'
           )::int AS d30,
           COUNT(*) FILTER (
             WHERE c.created_at >= (NOW() AT TIME ZONE 'UTC')::date - 59 * INTERVAL '1 day'
               AND c.created_at <  (NOW() AT TIME ZONE 'UTC')::date - 29 * INTERVAL '1 day'
           )::int AS prev_d30,
           COUNT(*) FILTER (
             WHERE c.unsubscribed_at IS NOT NULL
               AND c.unsubscribed_at >= (NOW() AT TIME ZONE 'UTC')::date - 29 * INTERVAL '1 day'
           )::int AS unsubs_d30
         FROM marketing_contact c
         WHERE c.deleted_at IS NULL
           AND c.source = 'form'
           ${brandId ? "AND c.brand_id = $1" : ""}`,
        brandId ? [brandId] : []
      ),
    ])

    const trend = (cur: number, prev: number): number => {
      if (!prev || prev === 0) return cur > 0 ? 100 : 0
      return Math.round(((cur - prev) / prev) * 1000) / 10
    }

    const by_project = byProjectRes.rows
      .map((r: any) => ({
        brand_slug: r.brand_slug,
        brand_name: r.brand_name,
        today: r.today || 0,
        d7: r.d7 || 0,
        d30: r.d30 || 0,
        prev_d30: r.prev_d30 || 0,
        trend_pct: trend(r.d30 || 0, r.prev_d30 || 0),
      }))
      .sort((a: any, b: any) => b.d30 - a.d30)

    const t = totalsRes.rows[0] || {}
    const d30 = t.d30 || 0
    const prev_d30 = t.prev_d30 || 0
    const unsubs_d30 = t.unsubs_d30 || 0

    res.json({
      days,
      daily: dailyRes.rows,
      unsubs_daily: unsubsRes.rows,
      by_project,
      totals: {
        today: t.today || 0,
        d7: t.d7 || 0,
        d30,
        prev_d30,
        trend_pct: trend(d30, prev_d30),
        unsubs_d30,
        net_d30: d30 - unsubs_d30,
      },
    })
  } catch (e: any) {
    res.json({
      days,
      daily: [],
      unsubs_daily: [],
      by_project: [],
      totals: { today: 0, d7: 0, d30: 0, prev_d30: 0, trend_pct: 0, unsubs_d30: 0, net_d30: 0 },
      error: e.message,
    })
  } finally {
    await pool.end().catch(() => {})
  }
}
