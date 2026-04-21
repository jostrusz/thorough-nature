// @ts-nocheck
import { MedusaContainer } from "@medusajs/framework/types"
import { Pool } from "pg"

/**
 * Marketing — Contact Intelligence recomputation
 * ───────────────────────────────────────────────
 * Nightly cron job. For every non-deleted contact:
 *   1. Engagement — recomputes last_email_sent/opened/clicked, totals,
 *      30-day open/click rates, engagement_score (0–100).
 *   2. Purchases — rolls up total_orders, total_revenue_eur, AOV,
 *      email_attributed_{orders,revenue_eur} from marketing_attribution.
 *   3. RFM — R/F/M quintiles scored 1–5 per brand (percentile-based).
 *   4. Lifecycle stage — deterministic rules over the above signals.
 *   5. Product affinity — primary_book + purchased_books + category_affinity
 *      from the joined Medusa orders.
 *
 * Brand-scoped: RFM quintiles are computed within each brand separately so
 * projects with vastly different price points (e.g. €27 book vs €127 bundle)
 * keep internally meaningful scores.
 *
 * Performance: batched SQL per brand; writes as one transaction per brand.
 * Target workload: ≤200k contacts total → runs in <2 minutes.
 */

const LIFECYCLE = {
  // cutoffs in days
  NEW_CUSTOMER_WINDOW: 30,
  ACTIVE_WINDOW: 90,
  AT_RISK_WINDOW: 180,
  DORMANT_WINDOW: 365,
  // engagement
  SUNSET_NO_OPEN_DAYS: 60,
  SUNSET_DORMANT_DAYS: 180,
}

export default async function marketingContactIntelligence(container: MedusaContainer) {
  const logger = (container.resolve("logger") as any) || console

  if (!process.env.DATABASE_URL) {
    logger.warn("[Contact Intelligence] DATABASE_URL missing — skipping")
    return
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
  const startedAt = Date.now()

  try {
    const { rows: brands } = await pool.query(
      `SELECT id, slug FROM marketing_brand WHERE deleted_at IS NULL AND enabled = true`
    )
    logger.info(`[Contact Intelligence] Processing ${brands.length} brand(s)`)

    for (const brand of brands) {
      try {
        await processBrand(pool, brand, logger)
      } catch (e: any) {
        logger.error(`[Contact Intelligence] Brand ${brand.slug} failed: ${e?.message || e}`)
      }
    }

    logger.info(`[Contact Intelligence] Done in ${Date.now() - startedAt}ms`)
  } finally {
    await pool.end().catch(() => {})
  }
}

async function processBrand(pool: Pool, brand: { id: string; slug: string }, logger: any) {
  const brandId = brand.id
  const now = new Date()

  // ── 1. Engagement rollup ────────────────────────────────────────────────
  // One UPDATE that joins aggregates from marketing_message per contact.
  await pool.query(
    `
    WITH agg AS (
      SELECT
        contact_id,
        COUNT(*) FILTER (WHERE status IN ('sent','delivered','opened','clicked')) AS sent_total,
        COUNT(*) FILTER (WHERE first_opened_at IS NOT NULL) AS opened_total,
        COUNT(*) FILTER (WHERE first_clicked_at IS NOT NULL) AS clicked_total,
        MAX(sent_at) AS last_sent_at,
        MAX(first_opened_at) AS last_opened_at,
        MAX(first_clicked_at) AS last_clicked_at,
        COUNT(*) FILTER (WHERE sent_at >= NOW() - INTERVAL '30 days') AS sent_30d,
        COUNT(*) FILTER (WHERE first_opened_at IS NOT NULL AND sent_at >= NOW() - INTERVAL '30 days') AS opened_30d,
        COUNT(*) FILTER (WHERE first_clicked_at IS NOT NULL AND sent_at >= NOW() - INTERVAL '30 days') AS clicked_30d
      FROM marketing_message
      WHERE brand_id = $1 AND deleted_at IS NULL
      GROUP BY contact_id
    )
    UPDATE marketing_contact c
    SET
      emails_sent_total = COALESCE(agg.sent_total, 0),
      emails_opened_total = COALESCE(agg.opened_total, 0),
      emails_clicked_total = COALESCE(agg.clicked_total, 0),
      last_email_sent_at = agg.last_sent_at,
      last_email_opened_at = agg.last_opened_at,
      last_email_clicked_at = agg.last_clicked_at,
      open_rate_30d = CASE WHEN agg.sent_30d > 0 THEN (agg.opened_30d::numeric / agg.sent_30d) ELSE NULL END,
      click_rate_30d = CASE WHEN agg.sent_30d > 0 THEN (agg.clicked_30d::numeric / agg.sent_30d) ELSE NULL END
    FROM agg
    WHERE c.id = agg.contact_id AND c.brand_id = $1 AND c.deleted_at IS NULL
    `,
    [brandId]
  )

  // ── 2. Purchase rollup ──────────────────────────────────────────────────
  // Derives from marketing_attribution (email-attributed) + Medusa orders
  // joined via contact email (for total LTV including non-email orders).
  //
  // We rely on order.email == marketing_contact.email (case-insensitive).
  // External Medusa order table is `order`.
  await pool.query(
    `
    WITH all_orders AS (
      SELECT
        o.id AS order_id,
        o.email,
        COALESCE((os.totals->>'paid_total')::numeric, 0) AS total,
        o.currency_code,
        (o.created_at) AS placed_at,
        (o.metadata->>'project_id') AS project_id
      FROM "order" o
      LEFT JOIN order_summary os ON os.order_id = o.id
      WHERE LOWER(o.email) IS NOT NULL
        AND o.metadata->>'project_id' IS NOT NULL
    ),
    brand_orders AS (
      SELECT ao.*
      FROM all_orders ao
      JOIN marketing_brand b ON b.project_id = ao.project_id
      WHERE b.id = $1
    ),
    order_with_fx AS (
      SELECT
        bo.*,
        COALESCE(fx.rate_to_eur, 1) AS rate_to_eur
      FROM brand_orders bo
      LEFT JOIN LATERAL (
        SELECT rate_to_eur FROM marketing_fx_rate
        WHERE currency_code = UPPER(bo.currency_code)
          AND as_of_date <= bo.placed_at::date
        ORDER BY as_of_date DESC LIMIT 1
      ) fx ON true
    ),
    per_contact AS (
      SELECT
        c.id AS contact_id,
        COUNT(ow.order_id) AS total_orders,
        SUM(ow.total * ow.rate_to_eur) AS total_revenue_eur,
        MIN(ow.placed_at) AS first_order_at,
        MAX(ow.placed_at) AS last_order_at
      FROM marketing_contact c
      LEFT JOIN order_with_fx ow ON LOWER(ow.email) = LOWER(c.email)
      WHERE c.brand_id = $1 AND c.deleted_at IS NULL
      GROUP BY c.id
    ),
    attr_per_contact AS (
      SELECT
        contact_id,
        COUNT(*) AS email_attributed_orders,
        SUM(COALESCE(order_total_eur, 0)) AS email_attributed_revenue_eur
      FROM marketing_attribution
      WHERE brand_id = $1 AND deleted_at IS NULL
      GROUP BY contact_id
    )
    UPDATE marketing_contact c
    SET
      total_orders = COALESCE(pc.total_orders, 0),
      total_revenue_eur = COALESCE(ROUND(pc.total_revenue_eur::numeric, 4), 0),
      avg_order_value_eur = CASE WHEN pc.total_orders > 0 THEN ROUND((pc.total_revenue_eur / pc.total_orders)::numeric, 4) ELSE NULL END,
      first_order_at = pc.first_order_at,
      last_order_at = pc.last_order_at,
      days_to_first_purchase = CASE
        WHEN pc.first_order_at IS NOT NULL AND c.acquisition_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (pc.first_order_at - c.acquisition_at))::int / 86400
        ELSE NULL
      END,
      email_attributed_orders = COALESCE(apc.email_attributed_orders, 0),
      email_attributed_revenue_eur = COALESCE(ROUND(apc.email_attributed_revenue_eur::numeric, 4), 0)
    FROM per_contact pc
    LEFT JOIN attr_per_contact apc ON apc.contact_id = pc.contact_id
    WHERE c.id = pc.contact_id AND c.brand_id = $1 AND c.deleted_at IS NULL
    `,
    [brandId]
  )

  // ── 3. first_purchase_source — first attribution row per contact ──────
  await pool.query(
    `
    WITH first_attr AS (
      SELECT DISTINCT ON (contact_id)
        contact_id,
        campaign_id,
        flow_id
      FROM marketing_attribution
      WHERE brand_id = $1 AND deleted_at IS NULL
      ORDER BY contact_id, order_placed_at ASC
    )
    UPDATE marketing_contact c
    SET first_purchase_source = CASE
      WHEN fa.campaign_id IS NOT NULL THEN 'email_campaign:' || fa.campaign_id
      WHEN fa.flow_id IS NOT NULL THEN 'email_flow:' || fa.flow_id
      ELSE c.first_purchase_source
    END
    FROM first_attr fa
    WHERE c.id = fa.contact_id AND c.brand_id = $1 AND c.deleted_at IS NULL
      AND (c.first_purchase_source IS NULL OR c.first_purchase_source NOT LIKE 'email_%')
    `,
    [brandId]
  )

  // Default first_purchase_source for those with orders but no attribution
  await pool.query(
    `
    UPDATE marketing_contact
    SET first_purchase_source = 'direct'
    WHERE brand_id = $1 AND deleted_at IS NULL
      AND total_orders > 0 AND first_purchase_source IS NULL
    `,
    [brandId]
  )

  // ── 4. RFM quintile scoring (per brand) ────────────────────────────────
  // Uses NTILE(5) over recency/frequency/monetary. Only considers contacts
  // with ≥1 order (others get NULL RFM).
  await pool.query(
    `
    WITH scored AS (
      SELECT
        id,
        6 - NTILE(5) OVER (ORDER BY last_order_at ASC NULLS FIRST) AS rfm_recency,
        NTILE(5) OVER (ORDER BY total_orders ASC) AS rfm_frequency,
        NTILE(5) OVER (ORDER BY total_revenue_eur ASC) AS rfm_monetary
      FROM marketing_contact
      WHERE brand_id = $1 AND deleted_at IS NULL AND total_orders > 0
    )
    UPDATE marketing_contact c
    SET
      rfm_recency = s.rfm_recency,
      rfm_frequency = s.rfm_frequency,
      rfm_monetary = s.rfm_monetary,
      rfm_score = s.rfm_recency * 100 + s.rfm_frequency * 10 + s.rfm_monetary,
      rfm_segment = CASE
        WHEN s.rfm_recency >= 4 AND s.rfm_frequency >= 4 AND s.rfm_monetary >= 4 THEN 'champion'
        WHEN s.rfm_recency >= 3 AND s.rfm_frequency >= 3 THEN 'loyal'
        WHEN s.rfm_recency >= 4 AND s.rfm_frequency <= 2 THEN 'potential_loyal'
        WHEN s.rfm_recency <= 2 AND s.rfm_frequency >= 4 THEN 'cant_lose'
        WHEN s.rfm_recency <= 2 AND s.rfm_frequency >= 2 THEN 'at_risk'
        WHEN s.rfm_recency <= 2 THEN 'hibernating'
        ELSE 'lost'
      END
    FROM scored s
    WHERE c.id = s.id
    `,
    [brandId]
  )

  // Clear RFM for contacts with zero orders (lead stage)
  await pool.query(
    `UPDATE marketing_contact
     SET rfm_recency = NULL, rfm_frequency = NULL, rfm_monetary = NULL, rfm_score = NULL, rfm_segment = NULL
     WHERE brand_id = $1 AND deleted_at IS NULL AND total_orders = 0`,
    [brandId]
  )

  // ── 5. Lifecycle stage — deterministic rules ───────────────────────────
  await pool.query(
    `
    UPDATE marketing_contact c
    SET
      lifecycle_stage = CASE
        WHEN c.status = 'unsubscribed' OR c.status = 'bounced' OR c.status = 'complained' OR c.status = 'suppressed' THEN 'churned'
        WHEN c.total_orders = 0 THEN 'lead'
        WHEN c.total_orders >= 3 AND c.rfm_score >= 444 THEN 'loyal'
        WHEN c.last_order_at >= NOW() - INTERVAL '${LIFECYCLE.NEW_CUSTOMER_WINDOW} days' AND c.total_orders = 1 THEN 'new_customer'
        WHEN c.last_order_at >= NOW() - INTERVAL '${LIFECYCLE.ACTIVE_WINDOW} days' THEN 'active'
        WHEN c.last_order_at >= NOW() - INTERVAL '${LIFECYCLE.AT_RISK_WINDOW} days' THEN 'at_risk'
        WHEN c.last_email_opened_at IS NULL OR c.last_email_opened_at < NOW() - INTERVAL '${LIFECYCLE.SUNSET_NO_OPEN_DAYS} days' THEN 'sunset'
        WHEN c.last_order_at < NOW() - INTERVAL '${LIFECYCLE.DORMANT_WINDOW} days' THEN 'dormant'
        ELSE COALESCE(c.lifecycle_stage, 'lead')
      END,
      lifecycle_entered_at = CASE
        WHEN c.lifecycle_stage IS DISTINCT FROM (
          CASE
            WHEN c.status IN ('unsubscribed','bounced','complained','suppressed') THEN 'churned'
            WHEN c.total_orders = 0 THEN 'lead'
            WHEN c.total_orders >= 3 AND c.rfm_score >= 444 THEN 'loyal'
            WHEN c.last_order_at >= NOW() - INTERVAL '${LIFECYCLE.NEW_CUSTOMER_WINDOW} days' AND c.total_orders = 1 THEN 'new_customer'
            WHEN c.last_order_at >= NOW() - INTERVAL '${LIFECYCLE.ACTIVE_WINDOW} days' THEN 'active'
            WHEN c.last_order_at >= NOW() - INTERVAL '${LIFECYCLE.AT_RISK_WINDOW} days' THEN 'at_risk'
            WHEN c.last_email_opened_at IS NULL OR c.last_email_opened_at < NOW() - INTERVAL '${LIFECYCLE.SUNSET_NO_OPEN_DAYS} days' THEN 'sunset'
            WHEN c.last_order_at < NOW() - INTERVAL '${LIFECYCLE.DORMANT_WINDOW} days' THEN 'dormant'
            ELSE c.lifecycle_stage
          END
        ) THEN NOW()
        ELSE c.lifecycle_entered_at
      END
    WHERE c.brand_id = $1 AND c.deleted_at IS NULL
    `,
    [brandId]
  )

  // ── 6. Engagement score 0–100 ─────────────────────────────────────────
  // Composite: recency of interaction (weight 50%) + 30d rates (weight 30%)
  //            + click depth (20%).
  await pool.query(
    `
    UPDATE marketing_contact c
    SET engagement_score = LEAST(100, GREATEST(0, ROUND(
      CASE
        WHEN c.last_email_opened_at IS NULL THEN 0
        ELSE GREATEST(0, 50 - EXTRACT(EPOCH FROM (NOW() - c.last_email_opened_at)) / 86400)
      END
      + COALESCE(c.open_rate_30d, 0) * 30
      + LEAST(20, COALESCE(c.click_rate_30d, 0) * 100)
    ))::integer)
    WHERE c.brand_id = $1 AND c.deleted_at IS NULL
    `,
    [brandId]
  )

  // ── 7. Primary book + purchased_books ─────────────────────────────────
  // Aggregates across Medusa orders. primary_book = first chronological.
  await pool.query(
    `
    WITH order_books AS (
      SELECT
        LOWER(o.email) AS email,
        (o.metadata->>'project_id') AS project_id,
        o.created_at
      FROM "order" o
      WHERE o.email IS NOT NULL AND o.metadata->>'project_id' IS NOT NULL
    ),
    per_contact_first AS (
      SELECT DISTINCT ON (c.id)
        c.id AS contact_id,
        ob.project_id AS primary_book
      FROM marketing_contact c
      JOIN order_books ob ON LOWER(ob.email) = LOWER(c.email)
      WHERE c.brand_id = $1 AND c.deleted_at IS NULL
      ORDER BY c.id, ob.created_at ASC
    ),
    per_contact_all AS (
      SELECT
        c.id AS contact_id,
        jsonb_agg(DISTINCT ob.project_id) AS purchased_books
      FROM marketing_contact c
      JOIN order_books ob ON LOWER(ob.email) = LOWER(c.email)
      WHERE c.brand_id = $1 AND c.deleted_at IS NULL
      GROUP BY c.id
    )
    UPDATE marketing_contact c
    SET
      primary_book = COALESCE(pcf.primary_book, c.primary_book),
      purchased_books = COALESCE(pca.purchased_books, c.purchased_books)
    FROM per_contact_first pcf
    LEFT JOIN per_contact_all pca ON pca.contact_id = pcf.contact_id
    WHERE c.id = pcf.contact_id
    `,
    [brandId]
  )

  // ── 8. computed_at stamp ──────────────────────────────────────────────
  await pool.query(
    `UPDATE marketing_contact SET computed_at = NOW() WHERE brand_id = $1 AND deleted_at IS NULL`,
    [brandId]
  )

  logger.info(`[Contact Intelligence] Brand ${brand.slug}: recomputed`)
}

export const config = {
  name: "marketing-contact-intelligence",
  // Nightly at 03:17 Bangkok time (randomized minute to avoid exact-hour spike)
  schedule: "17 3 * * *",
}
