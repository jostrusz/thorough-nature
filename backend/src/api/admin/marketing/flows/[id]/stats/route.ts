// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

/**
 * GET /admin/marketing/flows/:id/stats
 *
 * Returns real-time aggregate performance for a flow:
 *   - run counts by state (active / completed / exited / errored)
 *   - conversion rate (completed / started)
 *   - avg time to complete
 *   - per-email-node performance (sent / opens / clicks / CTR / CTOR / orders / revenue / RPE)
 *   - per-exit-reason breakdown
 *
 * Real-time query, no cron cache — aggregates are <100ms on reasonable data.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = String((req.params as any).id)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    // ── Run counts ───────────────────────────────────────────────────
    const runsRes = await pool.query(
      `SELECT state, COUNT(*)::int AS c
       FROM marketing_flow_run
       WHERE flow_id = $1
       GROUP BY state`,
      [id]
    )
    const runsByState: Record<string, number> = {}
    for (const r of runsRes.rows) runsByState[r.state] = r.c

    const active = (runsByState.running || 0) + (runsByState.waiting || 0)
    const completed = runsByState.completed || 0
    const exited = runsByState.exited || 0
    const errored = runsByState.errored || 0
    const started = active + completed + exited + errored

    // ── Avg time to complete + exit reasons ──────────────────────────
    const avgRes = await pool.query(
      `SELECT
         AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) AS avg_seconds
       FROM marketing_flow_run
       WHERE flow_id = $1 AND state = 'completed' AND completed_at IS NOT NULL`,
      [id]
    )
    const avgCompleteSeconds = Number(avgRes.rows[0]?.avg_seconds) || null

    const reasonRes = await pool.query(
      `SELECT exit_reason, COUNT(*)::int AS c
       FROM marketing_flow_run
       WHERE flow_id = $1 AND exit_reason IS NOT NULL
       GROUP BY exit_reason
       ORDER BY c DESC`,
      [id]
    )

    // ── Per email-node metrics ───────────────────────────────────────
    //
    // Message rows carry flow_node_id in metadata or a dedicated column;
    // for robustness we fall back to latest sends per-message. Query
    // marketing_message + link-performance via marketing_click + attribution.
    const nodeMetricsRes = await pool.query(
      `WITH node_messages AS (
         SELECT m.id, m.flow_node_id, m.opens_count, m.clicks_count, m.status
         FROM marketing_message m
         WHERE m.flow_id = $1 AND m.deleted_at IS NULL AND m.flow_node_id IS NOT NULL
       )
       SELECT
         flow_node_id,
         COUNT(*)::int AS sent,
         COUNT(*) FILTER (WHERE opens_count > 0)::int AS opened_unique,
         COUNT(*) FILTER (WHERE clicks_count > 0)::int AS clicked_unique,
         COALESCE(SUM(opens_count), 0)::int AS opens_total,
         COALESCE(SUM(clicks_count), 0)::int AS clicks_total
       FROM node_messages
       GROUP BY flow_node_id`,
      [id]
    )

    const nodeRevenueRes = await pool.query(
      `SELECT
         m.flow_node_id,
         COUNT(DISTINCT a.order_id)::int AS orders,
         COALESCE(SUM(a.order_total_eur), 0)::float AS revenue_eur
       FROM marketing_attribution a
       JOIN marketing_message m ON m.id = a.message_id
       WHERE a.flow_id = $1 AND m.flow_node_id IS NOT NULL
       GROUP BY m.flow_node_id`,
      [id]
    )
    const revenueByNode: Record<string, { orders: number; revenue_eur: number }> = {}
    for (const r of nodeRevenueRes.rows) {
      revenueByNode[r.flow_node_id] = { orders: r.orders, revenue_eur: r.revenue_eur }
    }

    const linkPerfRes = await pool.query(
      `SELECT
         m.flow_node_id,
         COALESCE(c.link_label, 'link') AS link_label,
         COUNT(*)::int AS clicks
       FROM marketing_click c
       JOIN marketing_message m ON m.id = c.message_id
       WHERE c.flow_id = $1 AND m.flow_node_id IS NOT NULL
       GROUP BY m.flow_node_id, link_label
       ORDER BY m.flow_node_id, clicks DESC`,
      [id]
    )
    const linksByNode: Record<string, Array<{ label: string; clicks: number }>> = {}
    for (const r of linkPerfRes.rows) {
      const key = r.flow_node_id
      if (!linksByNode[key]) linksByNode[key] = []
      linksByNode[key].push({ label: r.link_label, clicks: r.clicks })
    }

    const nodeMetrics = nodeMetricsRes.rows.map((r: any) => {
      const rev = revenueByNode[r.flow_node_id] || { orders: 0, revenue_eur: 0 }
      const sent = r.sent || 0
      const openRate = sent ? r.opened_unique / sent : 0
      const ctr = sent ? r.clicked_unique / sent : 0
      const ctor = r.opened_unique ? r.clicked_unique / r.opened_unique : 0
      const rpe = sent ? rev.revenue_eur / sent : 0
      return {
        flow_node_id: r.flow_node_id,
        sent,
        opened_unique: r.opened_unique,
        clicked_unique: r.clicked_unique,
        opens_total: r.opens_total,
        clicks_total: r.clicks_total,
        orders: rev.orders,
        revenue_eur: rev.revenue_eur,
        open_rate: openRate,
        ctr,
        ctor,
        rpe,
        links: linksByNode[r.flow_node_id] || [],
      }
    })

    // ── Flow totals ──────────────────────────────────────────────────
    const flowRevenueRes = await pool.query(
      `SELECT COUNT(DISTINCT order_id)::int AS orders,
              COALESCE(SUM(order_total_eur), 0)::float AS revenue_eur
       FROM marketing_attribution
       WHERE flow_id = $1`,
      [id]
    )
    const totalOrders = flowRevenueRes.rows[0]?.orders || 0
    const totalRevenueEur = flowRevenueRes.rows[0]?.revenue_eur || 0

    res.json({
      runs: {
        started,
        active,
        completed,
        exited,
        errored,
        conversion_rate: started ? completed / started : 0,
        avg_complete_seconds: avgCompleteSeconds,
      },
      exit_reasons: reasonRes.rows.map((r: any) => ({ reason: r.exit_reason, count: r.c })),
      revenue: {
        orders: totalOrders,
        revenue_eur: totalRevenueEur,
      },
      nodes: nodeMetrics,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  } finally {
    await pool.end()
  }
}
