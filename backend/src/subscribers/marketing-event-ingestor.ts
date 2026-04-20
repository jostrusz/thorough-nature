import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { Pool } from "pg"
import { MARKETING_MODULE } from "../modules/marketing"
import type MarketingModuleService from "../modules/marketing/service"
import { getRateToEur, toEur } from "../modules/marketing/utils/fx"

/**
 * marketing-event-ingestor
 * ------------------------
 * Read-only mirror of the `order.placed` event into the marketing module.
 *
 * Three responsibilities (all best-effort; never throws):
 *   1. Upsert contact (status stays 'unconfirmed' unless marketing_opt_in=true)
 *   2. Populate acquisition_* fields on first creation (from cart.metadata UTM)
 *   3. Attribute the order to a prior email click within a 30-day window
 *      → creates marketing_attribution row (UNIQUE order_id, idempotent)
 *   4. Append event 'order_placed' to the stream
 *
 * Attribution model: last_click, 30-day window. Finds the most recent
 * event of type='email_clicked' for (brand_id, contact_id) where
 * occurred_at >= order_placed_at - 30 days. If present, attribution row is
 * created with FX-converted EUR value.
 */

const ATTRIBUTION_WINDOW_HOURS = 30 * 24

export default async function marketingEventIngestor({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  let pool: Pool | null = null
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
    const marketing = container.resolve(MARKETING_MODULE) as unknown as MarketingModuleService

    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "total",
        "metadata",
        "customer_id",
        "shipping_address.*",
        "items.*",
      ],
      filters: { id: data.id },
    })
    const order = orders?.[0]
    if (!order) return

    const projectId = (order.metadata as any)?.project_id as string | undefined
    if (!projectId) return

    const [brand] = await marketing.listMarketingBrands({ project_id: projectId } as any)
    if (!brand) return

    const rawEmail: string | null = order.email || null
    if (!rawEmail) return
    const email = rawEmail.trim().toLowerCase()

    const meta = (order.metadata as any) || {}
    const optInFlag = meta.marketing_opt_in === true

    // Acquisition signals from cart → order metadata. Storefront writes these
    // onto cart.metadata when the user lands with UTM params.
    const acqFromCheckout = {
      source: pickStr(meta.utm_source) ? "paid_ad" : "checkout",
      medium: pickStr(meta.utm_medium),
      campaign: pickStr(meta.utm_campaign),
      content: pickStr(meta.utm_content),
      term: pickStr(meta.utm_term),
      landing_url: pickStr(meta.landing_url),
      referrer: pickStr(meta.referrer),
      device: pickStr(meta.device),
      fbc: pickStr(meta.fbc),
      fbp: pickStr(meta.fbp),
    }

    // ── 1. Contact upsert ────────────────────────────────────────────────
    const existing = (await marketing.listMarketingContacts({
      brand_id: brand.id,
      email,
    } as any)) as any[]

    let contactId: string | undefined = existing?.[0]?.id
    const now = new Date()

    // Order total in EUR for real-time rollup (FX snapshot).
    const orderTotal = Number(order.total) || 0
    const orderCurrency = order.currency_code || "EUR"

    if (!contactId) {
      const created = await marketing.createMarketingContacts({
        brand_id: brand.id,
        email,
        first_name: order.shipping_address?.first_name || null,
        last_name: order.shipping_address?.last_name || null,
        country_code: order.shipping_address?.country_code || null,
        status: optInFlag ? "subscribed" : "unconfirmed",
        source: "checkout",
        external_id: (order as any).customer_id || null,
        consent_at: optInFlag ? now : null,
        acquisition_source: acqFromCheckout.source,
        acquisition_medium: acqFromCheckout.medium,
        acquisition_campaign: acqFromCheckout.campaign,
        acquisition_content: acqFromCheckout.content,
        acquisition_term: acqFromCheckout.term,
        acquisition_landing_url: acqFromCheckout.landing_url,
        acquisition_referrer: acqFromCheckout.referrer,
        acquisition_device: acqFromCheckout.device,
        acquisition_fbc: acqFromCheckout.fbc,
        acquisition_fbp: acqFromCheckout.fbp,
        acquisition_at: now,
        // Real-time purchase rollup — nightly cron reconciles if drift.
        total_orders: 1,
        first_order_at: now,
        last_order_at: now,
        lifecycle_stage: "new_customer",
        lifecycle_entered_at: now,
      } as any)
      contactId = (created as any).id
    } else {
      const patch: any = { id: contactId }
      if (optInFlag && existing[0].status !== "subscribed") {
        patch.status = "subscribed"
        patch.consent_at = now
        patch.source = existing[0].source || "checkout"
      }
      // Always bump order counter + last_order_at. first_order_at only if null.
      patch.total_orders = (Number(existing[0].total_orders) || 0) + 1
      patch.last_order_at = now
      if (!existing[0].first_order_at) patch.first_order_at = now
      // Advance lifecycle if lead → new_customer on first purchase.
      if (!existing[0].lifecycle_stage || existing[0].lifecycle_stage === "lead") {
        patch.lifecycle_stage = "new_customer"
        patch.lifecycle_entered_at = now
      }
      await marketing.updateMarketingContacts(patch)
    }

    // ── 2. Event row ─────────────────────────────────────────────────────
    await marketing.createMarketingEvents({
      brand_id: brand.id,
      contact_id: contactId,
      email,
      type: "order_placed",
      payload: {
        order_id: order.id,
        display_id: order.display_id,
        total: order.total,
        currency_code: order.currency_code,
        item_count: (order.items || []).length,
      },
      occurred_at: now,
      source: "subscriber:order.placed",
    } as any)

    // ── 3. Attribution — 30-day last-click ───────────────────────────────
    if (contactId && process.env.DATABASE_URL) {
      pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
      await attributeOrderToLastClick({
        pool,
        marketing,
        brandId: brand.id,
        contactId,
        order: {
          id: order.id,
          display_id: order.display_id,
          total: Number(order.total) || 0,
          currency_code: order.currency_code || "EUR",
          placed_at: now,
        },
      })
    }
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn("[Marketing Tracking] event-ingestor skipped:", err?.message || err)
  } finally {
    if (pool) await pool.end().catch(() => {})
  }
}

function pickStr(v: any): string | null {
  return typeof v === "string" && v.length ? v.slice(0, 512) : null
}

async function attributeOrderToLastClick(args: {
  pool: Pool
  marketing: MarketingModuleService
  brandId: string
  contactId: string
  order: {
    id: string
    display_id: number | null
    total: number
    currency_code: string
    placed_at: Date
  }
}): Promise<void> {
  const { pool, marketing, brandId, contactId, order } = args

  // Idempotency: skip if attribution already exists for this order
  const { rows: existing } = await pool.query(
    `SELECT id FROM marketing_attribution WHERE order_id = $1 AND deleted_at IS NULL LIMIT 1`,
    [order.id]
  )
  if (existing.length) return

  const windowStart = new Date(
    order.placed_at.getTime() - ATTRIBUTION_WINDOW_HOURS * 60 * 60 * 1000
  )

  // Find last email_clicked event in window
  const { rows: clicks } = await pool.query(
    `SELECT id, contact_id, payload, occurred_at
     FROM marketing_event
     WHERE brand_id = $1
       AND contact_id = $2
       AND type = 'email_clicked'
       AND occurred_at >= $3
       AND occurred_at <= $4
       AND deleted_at IS NULL
     ORDER BY occurred_at DESC
     LIMIT 1`,
    [brandId, contactId, windowStart.toISOString(), order.placed_at.toISOString()]
  )

  if (!clicks.length) return

  const click = clicks[0]
  const clickAt: Date = click.occurred_at instanceof Date ? click.occurred_at : new Date(click.occurred_at)
  const payload = click.payload || {}
  const messageId = payload.message_id || null
  const campaignId = payload.campaign_id || null
  const flowId = payload.flow_id || null
  const flowRunId = payload.flow_run_id || null

  const hoursBetween = Math.round(
    ((order.placed_at.getTime() - clickAt.getTime()) / (60 * 60 * 1000)) * 100
  ) / 100

  // FX conversion
  const fx = await getRateToEur(pool, order.currency_code, order.placed_at)
  const totalEur = toEur(order.total, fx.rate)

  await marketing.createMarketingAttributions({
    brand_id: brandId,
    contact_id: contactId,
    message_id: messageId,
    campaign_id: campaignId,
    flow_id: flowId,
    flow_run_id: flowRunId,
    order_id: order.id,
    order_display_id: order.display_id != null ? String(order.display_id) : null,
    click_at: clickAt,
    order_placed_at: order.placed_at,
    attribution_window_hours: hoursBetween,
    attribution_model: "last_click",
    order_total: order.total,
    currency_code: order.currency_code,
    order_total_eur: totalEur,
    fx_rate_to_eur: fx.rate,
    metadata: { fx_source: fx.source },
  } as any)
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
