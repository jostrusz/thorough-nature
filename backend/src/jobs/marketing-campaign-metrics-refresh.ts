// @ts-nocheck
import { MedusaContainer } from "@medusajs/framework/types"
import { Pool } from "pg"

/**
 * Marketing campaign metrics refresh
 * ──────────────────────────────────
 * Runs every 10 minutes. Recomputes engagement metrics (delivered / opened /
 * clicked / bounced / complained + open/click/bounce rates) from the source of
 * truth (marketing_message rows) and merges them into campaign.metrics jsonb.
 *
 * Why: the dispatcher's finishCampaign() only writes {sent, failed, suppressed,
 * total} at send-time. Opens, clicks and bounces arrive LATER via Resend
 * webhooks (updating marketing_message), so the campaign list + read-only view
 * (which read campaign.metrics) would otherwise show stale 0s for engagement.
 *
 * This is a non-destructive MERGE: send-time fields (failed, suppressed, total)
 * are preserved; we overlay the live engagement counts on top.
 *
 * Funnel counting is kept consistent with the analytics endpoint
 * (backend/src/api/admin/marketing/campaigns/[id]/analytics/route.ts), which is
 * the source of truth for the per-campaign dashboard.
 */
export default async function marketingCampaignMetricsRefresh(container: MedusaContainer) {
  const logger = (container.resolve("logger") as any) || console

  let pool: Pool | null = null
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

    // Candidate campaigns: recently active sends. We refresh both finished and
    // in-flight ones (engagement keeps trickling in for days after send).
    const { rows: campaigns } = await pool.query(
      `SELECT id, metrics
       FROM marketing_campaign
       WHERE deleted_at IS NULL
         AND status IN ('sent','sending','sent_with_errors')
         AND COALESCE(sent_at, updated_at, created_at) >= NOW() - INTERVAL '30 days'
       ORDER BY COALESCE(sent_at, updated_at, created_at) DESC
       LIMIT 200`
    )

    if (!campaigns.length) return

    let updated = 0
    for (const campaign of campaigns) {
      try {
        // Aggregate engagement from marketing_message. Status is a superset
        // chain: a 'clicked' row was also opened/delivered/sent, so we count
        // with FILTER over the appropriate status sets to match the analytics
        // endpoint semantics.
        const { rows } = await pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE status IN ('sent','delivered','opened','clicked'))::int AS sent,
             COUNT(*) FILTER (WHERE delivered_at IS NOT NULL OR status IN ('delivered','opened','clicked'))::int AS delivered,
             COUNT(*) FILTER (WHERE first_opened_at IS NOT NULL OR status IN ('opened','clicked'))::int AS opened,
             COUNT(*) FILTER (WHERE first_clicked_at IS NOT NULL OR status = 'clicked')::int AS clicked,
             COUNT(*) FILTER (WHERE status = 'bounced')::int AS bounced,
             COUNT(*) FILTER (WHERE status = 'complained')::int AS complained,
             COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
             COUNT(*) FILTER (WHERE status = 'suppressed')::int AS suppressed
           FROM marketing_message
           WHERE campaign_id = $1 AND deleted_at IS NULL`,
          [campaign.id]
        )
        const m = rows[0] || {}
        const sent = m.sent || 0
        const delivered = m.delivered || 0
        const opened = m.opened || 0
        const clicked = m.clicked || 0
        const bounced = m.bounced || 0

        const live = {
          sent,
          delivered,
          opened,
          clicked,
          bounced,
          complained: m.complained || 0,
          failed: m.failed || 0,
          suppressed: m.suppressed || 0,
          open_rate: sent ? opened / sent : 0,
          click_rate: sent ? clicked / sent : 0,
          bounce_rate: sent ? bounced / sent : 0,
          metrics_refreshed_at: new Date().toISOString(),
        }

        // MERGE into existing metrics jsonb (preserve send-time `total` and any
        // other fields the dispatcher wrote). The live counts overlay on top.
        const merged = { ...(campaign.metrics || {}), ...live }

        await pool.query(
          `UPDATE marketing_campaign SET metrics = $2::jsonb WHERE id = $1`,
          [campaign.id, JSON.stringify(merged)]
        )
        updated++
      } catch (e: any) {
        logger.warn(`[Campaign Metrics] Campaign ${campaign.id} refresh failed: ${e.message}`)
      }
    }

    logger.info(`[Campaign Metrics] Refreshed metrics for ${updated}/${campaigns.length} campaign(s)`)
  } catch (err: any) {
    logger.error(`[Campaign Metrics] Fatal: ${err.message}`)
  } finally {
    if (pool) await pool.end().catch(() => {})
  }
}

export const config = {
  name: "marketing-campaign-metrics-refresh",
  schedule: "*/10 * * * *", // every 10 minutes
}
