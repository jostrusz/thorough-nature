// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

/**
 * GET /admin/payment-debug?intent_id=…
 * GET /admin/payment-debug?cart_id=…
 * GET /admin/payment-debug?email=…
 * GET /admin/payment-debug?project_slug=…&hours=24     → aggregate funnel
 *
 * Returns a chronological timeline of events for the queried entity, or
 * a funnel breakdown when no id is supplied.
 *
 * Response shapes:
 *   Timeline mode: { mode: "timeline", key: {...}, events: [...] }
 *   Funnel mode:   { mode: "funnel", window_hours, counts: { event_type: N } }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const q = (req.query as any) || {}
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    // Timeline modes — by explicit identifier
    if (q.intent_id) {
      const { rows } = await pool.query(
        `SELECT * FROM payment_journey_log
         WHERE intent_id = $1
         ORDER BY occurred_at ASC`,
        [q.intent_id]
      )
      res.json({ mode: "timeline", key: { intent_id: q.intent_id }, events: rows, count: rows.length })
      return
    }
    if (q.cart_id) {
      const { rows } = await pool.query(
        `SELECT * FROM payment_journey_log
         WHERE cart_id = $1
         ORDER BY occurred_at ASC`,
        [q.cart_id]
      )
      res.json({ mode: "timeline", key: { cart_id: q.cart_id }, events: rows, count: rows.length })
      return
    }
    if (q.email) {
      const { rows } = await pool.query(
        `SELECT * FROM payment_journey_log
         WHERE lower(email) = lower($1)
         ORDER BY occurred_at DESC
         LIMIT 500`,
        [q.email]
      )
      res.json({ mode: "timeline", key: { email: q.email }, events: rows, count: rows.length })
      return
    }

    // Funnel aggregate mode — no specific id
    const hours = Math.min(168, Math.max(1, Number(q.hours ?? 24)))
    const projectFilter = q.project_slug
      ? `AND project_slug = $2`
      : ""
    const params: any[] = [`${hours} hours`]
    if (q.project_slug) params.push(q.project_slug)

    const { rows: counts } = await pool.query(
      `SELECT event_type, COUNT(*)::int AS count
       FROM payment_journey_log
       WHERE occurred_at > NOW() - $1::interval
       ${projectFilter}
       GROUP BY event_type
       ORDER BY count DESC`,
      params
    )

    // Also pull recent errors
    const { rows: errors } = await pool.query(
      `SELECT occurred_at, event_type, error_code, intent_id, email, project_slug, event_data
       FROM payment_journey_log
       WHERE occurred_at > NOW() - $1::interval
         AND error_code IS NOT NULL
         ${projectFilter}
       ORDER BY occurred_at DESC
       LIMIT 50`,
      params
    )

    // Breakdown by project if no project_slug filter
    let byProject: any[] = []
    if (!q.project_slug) {
      const { rows } = await pool.query(
        `SELECT project_slug,
                COUNT(*) FILTER (WHERE event_type = 'checkout_viewed')         AS viewed,
                COUNT(*) FILTER (WHERE event_type = 'payment_methods_loaded')  AS methods_loaded,
                COUNT(*) FILTER (WHERE event_type = 'payment_method_selected') AS method_selected,
                COUNT(*) FILTER (WHERE event_type = 'submit_clicked')          AS submitted,
                COUNT(*) FILTER (WHERE event_type = 'airwallex_intent_created')AS intent_created,
                COUNT(*) FILTER (WHERE event_type = 'payment_return')          AS returned,
                COUNT(*) FILTER (WHERE event_type = 'airwallex_webhook_received'
                                  AND (event_data->>'status') = 'SUCCEEDED')   AS succeeded,
                COUNT(*) FILTER (WHERE event_type = 'airwallex_webhook_received'
                                  AND (event_data->>'status') = 'FAILED')      AS failed
         FROM payment_journey_log
         WHERE occurred_at > NOW() - $1::interval
           AND project_slug IS NOT NULL
         GROUP BY project_slug
         ORDER BY viewed DESC`,
        [`${hours} hours`]
      )
      byProject = rows
    }

    res.json({
      mode: "funnel",
      window_hours: hours,
      project_slug: q.project_slug || null,
      counts,
      by_project: byProject,
      recent_errors: errors,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  } finally {
    await pool.end()
  }
}
