// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../../modules/marketing/service"

/**
 * GET /admin/marketing/forms/:id/stats?days=30
 *
 * Funnel analytics for a single marketing form. Aggregates marketing_event
 * rows whose payload.form_slug or payload.form_id matches this form, over
 * the requested window.
 *
 * Response shape:
 *   {
 *     form: { id, name, slug, type },
 *     window: { days: 30, since: "2026-04-06", until: "2026-05-06" },
 *     totals: {
 *       views, step_1, step_2, step_3, step_4, submitted,
 *       conversion_rate
 *     },
 *     biggest_drop: { from, to, dropoff_rate, dropped },
 *     top_custom_answers: [{ text, count }, ...],   // K1 ✍️ inputs
 *     daily: [{ date, views, submitted }, ...]      // sparkline
 *   }
 *
 * Uniqueness: we count distinct session_id (sent by the popup beacon) per
 * funnel step so a single visitor doesn't inflate impressions if they reload.
 * form_submitted falls back to email if session_id is missing on legacy rows.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = String((req.params as any).id || "")
    const [form] = await service.listMarketingForms({ id })
    if (!form) {
      res.status(404).json({ error: "not_found" })
      return
    }

    const daysRaw = Number((req.query as any).days || 30)
    const days = Number.isFinite(daysRaw) ? Math.min(Math.max(Math.floor(daysRaw), 1), 365) : 30

    if (!process.env.DATABASE_URL) {
      res.status(500).json({ error: "database_not_configured" })
      return
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    try {
      // Match rows by either form_slug or form_id in payload — old code paths
      // and new ones use different keys. Brand match is enforced for safety.
      const matchPredicate = `
        e.brand_id = $1
        AND e.deleted_at IS NULL
        AND e.occurred_at >= NOW() - ($2::int || ' days')::interval
        AND (
          e.payload->>'form_slug' = $3
          OR e.payload->>'form_id' = $4
          OR e.payload->>'form_slug' = $4
        )
      `
      const params = [form.brand_id, days, form.slug, form.id]

      // ─── Counts per funnel step (distinct session_id) ─────────────
      const { rows: counts } = await pool.query(
        `SELECT
           e.type,
           COUNT(DISTINCT COALESCE(e.payload->>'session_id', e.email, e.id)) AS distinct_count,
           COUNT(*) AS raw_count
         FROM marketing_event e
         WHERE ${matchPredicate}
           AND e.type IN (
             'popup_viewed',
             'popup_step_1_completed',
             'popup_step_2_completed',
             'popup_step_3_completed',
             'popup_step_4_completed',
             'form_submitted'
           )
         GROUP BY e.type`,
        params
      )

      const byType: Record<string, { distinct: number; raw: number }> = {}
      for (const r of counts as any[]) {
        byType[r.type] = { distinct: Number(r.distinct_count), raw: Number(r.raw_count) }
      }
      const get = (k: string) => byType[k]?.distinct || 0

      const views = get("popup_viewed")
      const step1 = get("popup_step_1_completed")
      const step2 = get("popup_step_2_completed")
      const step3 = get("popup_step_3_completed")
      const step4 = get("popup_step_4_completed")
      const submitted = get("form_submitted")
      const conversionRate = views > 0 ? submitted / views : 0

      // ─── Biggest drop-off (between adjacent funnel stages) ───────
      const stages: Array<{ key: string; count: number }> = [
        { key: "Viewed", count: views },
        { key: "K1 done", count: step1 },
        { key: "K2 done", count: step2 },
        { key: "K3 done", count: step3 },
        { key: "K4 done", count: step4 },
        { key: "Submitted", count: submitted },
      ]
      let biggestDrop: any = null
      for (let i = 1; i < stages.length; i++) {
        const prev = stages[i - 1]
        const cur = stages[i]
        if (prev.count <= 0) continue
        const dropped = Math.max(prev.count - cur.count, 0)
        const rate = dropped / prev.count
        if (!biggestDrop || rate > biggestDrop.dropoff_rate) {
          biggestDrop = {
            from: prev.key,
            to: cur.key,
            dropoff_rate: rate,
            dropped,
          }
        }
      }

      // ─── Top custom K1 answers (✍️ — what people actually wrote) ──
      // Source: popup_step_1_completed events with is_custom=true and a
      // text field. Aggregate by lowercased text to dedupe near-duplicates.
      const { rows: customRows } = await pool.query(
        `SELECT
           lower(trim(e.payload->>'text')) AS norm_text,
           MIN(e.payload->>'text') AS sample_text,
           COUNT(*) AS cnt
         FROM marketing_event e
         WHERE ${matchPredicate}
           AND e.type = 'popup_step_1_completed'
           AND (e.payload->>'is_custom')::boolean = true
           AND length(trim(e.payload->>'text')) > 0
         GROUP BY lower(trim(e.payload->>'text'))
         ORDER BY cnt DESC, MIN(e.occurred_at) DESC
         LIMIT 10`,
        params
      )
      const topCustom = (customRows as any[]).map((r) => ({
        text: r.sample_text,
        count: Number(r.cnt),
      }))

      // ─── Daily breakdown (views + submitted) ─────────────────────
      const { rows: daily } = await pool.query(
        `SELECT
           date_trunc('day', e.occurred_at) AS day,
           COUNT(DISTINCT e.payload->>'session_id') FILTER (WHERE e.type = 'popup_viewed') AS views,
           COUNT(*) FILTER (WHERE e.type = 'form_submitted') AS submitted
         FROM marketing_event e
         WHERE ${matchPredicate}
           AND e.type IN ('popup_viewed', 'form_submitted')
         GROUP BY date_trunc('day', e.occurred_at)
         ORDER BY day ASC`,
        params
      )
      const dailySeries = (daily as any[]).map((r) => ({
        date: new Date(r.day).toISOString().slice(0, 10),
        views: Number(r.views || 0),
        submitted: Number(r.submitted || 0),
      }))

      const now = new Date()
      const since = new Date(now.getTime() - days * 86400000)

      res.json({
        form: { id: form.id, name: form.name, slug: form.slug, type: form.type },
        window: {
          days,
          since: since.toISOString().slice(0, 10),
          until: now.toISOString().slice(0, 10),
        },
        totals: {
          views,
          step_1: step1,
          step_2: step2,
          step_3: step3,
          step_4: step4,
          submitted,
          conversion_rate: conversionRate,
        },
        biggest_drop: biggestDrop,
        top_custom_answers: topCustom,
        daily: dailySeries,
      })
    } finally {
      await pool.end().catch(() => {})
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
