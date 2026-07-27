// @ts-nocheck
import { Modules } from "@medusajs/framework/utils"
import { MedusaContainer } from "@medusajs/framework/types"
import { PROFITABILITY_MODULE } from "../modules/profitability"
import { HUSET_MODULE } from "../modules/huset"
import { getHusetConfig } from "../modules/huset/config"
import { isHusetOrder } from "../utils/huset-routing"
import { normalizeProjectSlug } from "../utils/project-slug"

/**
 * Backstop for orders that never saw `order.placed`.
 *
 * The safety-net paths (Revolut reconcile, Revolut webhook, bank-transfer
 * reconcile) complete a cart from a cron or a webhook and emit only
 * `payment.captured`. Subscribers that key on `order.placed` — custom order
 * number, project_id, WMS queueing — therefore never run for those orders.
 *
 * Seen live 2026-07: NO2026-29508 and NO2026-30399 were paid, had no order
 * number, no project_id and no invoice; 30399 was never queued to the
 * warehouse at all and sat for three days.
 *
 * This job re-derives the missing bits every 10 minutes. Everything it does is
 * idempotent: fields are only written when absent, and a WMS row is created
 * only when none exists.
 */

const PROJECT_TAG_NAMES: Record<string, string> = {
  "slipp-taket": "Slipp taket",
  "slapp-taget": "Släpp taget",
}

export default async function orderMetadataBackfillJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })

  try {
    // Paid orders from the last 14 days missing either field. Older ones are
    // out of scope — repairing history is a manual, reviewed operation.
    const { rows } = await pool.query(
      `SELECT o.id, o.display_id, o.sales_channel_id, o.metadata,
              coalesce(sa.country_code, ba.country_code, '') AS country_code
       FROM "order" o
       LEFT JOIN order_address sa ON sa.id = o.shipping_address_id
       LEFT JOIN order_address ba ON ba.id = o.billing_address_id
       WHERE o.deleted_at IS NULL
         AND o.created_at > now() - interval '14 days'
         AND (o.metadata->>'project_id' IS NULL OR o.metadata->>'custom_order_number' IS NULL)
         AND EXISTS (
           SELECT 1 FROM order_payment_collection opc
           JOIN payment p ON p.payment_collection_id = opc.payment_collection_id
           WHERE opc.order_id = o.id AND p.captured_at IS NOT NULL
         )
       ORDER BY o.created_at
       LIMIT 50`
    )
    if (!rows.length) return

    const orderModuleService = container.resolve(Modules.ORDER) as any
    const profitService = container.resolve(PROFITABILITY_MODULE) as any
    let repaired = 0, queued = 0

    for (const row of rows) {
      try {
        const meta = row.metadata || {}
        const patch: Record<string, any> = {}

        // project_id — metadata first, then the sales channel mapping
        let projectId = normalizeProjectSlug(meta.project_id)
        if (!projectId && row.sales_channel_id) {
          const configs = await profitService
            .listProjectConfigs({ sales_channel_id: row.sales_channel_id }, { take: 1 })
            .catch(() => [])
          if (configs?.[0]?.project_slug) projectId = normalizeProjectSlug(configs[0].project_slug)
        }
        if (projectId && meta.project_id !== projectId) patch.project_id = projectId
        if (projectId && !meta.tags && PROJECT_TAG_NAMES[projectId]) {
          patch.tags = PROJECT_TAG_NAMES[projectId]
        }

        // custom order number — same scheme the subscriber uses
        if (!meta.custom_order_number) {
          const cc = String(row.country_code || "XX").toUpperCase()
          patch.custom_order_number = `${cc}${new Date().getFullYear()}-${row.display_id}`
        }

        if (Object.keys(patch).length) {
          await orderModuleService.updateOrders(row.id, { metadata: patch })
          repaired++
          logger.info(
            `[Order Backfill] ${row.display_id} doplněno: ${Object.keys(patch).join(", ")}`
          )
        }

        // WMS: queue it if it belongs to Huset and has no row yet
        const husetConfig = getHusetConfig()
        if (husetConfig.enabled) {
          const order = {
            ...row,
            metadata: { ...meta, ...patch },
            shipping_address: { country_code: row.country_code },
          }
          if (await isHusetOrder(order, container)) {
            const husetService = container.resolve(HUSET_MODULE) as any
            const existing = await husetService
              .listHusetOrderMaps({ medusa_order_id: row.id }, { take: 1 })
              .catch(() => [])
            if (!existing?.[0]) {
              const ref =
                patch.custom_order_number ||
                meta.custom_order_number ||
                `${String(row.country_code || "XX").toUpperCase()}${new Date().getFullYear()}-${row.display_id}`
              const now = new Date().toISOString()
              await husetService.createHusetOrderMaps({
                medusa_order_id: row.id,
                display_id: String(row.display_id),
                project_code: meta.project_code || "DEFAULT",
                order_ref: ref,
                delivery_status: "WAITING",
                delivery_status_updated_at: now,
                hold_until: now, // already past the support window
              })
              await orderModuleService.updateOrders(row.id, {
                metadata: {
                  fulfillment_provider: "huset",
                  huset_status: "WAITING",
                  huset_order_ref: ref,
                  dextrum_status: "WAITING",
                },
              })
              queued++
              logger.warn(`[Order Backfill] ${row.display_id} nebyla ve WMS frontě — zařazena jako ${ref}`)
            }
          }
        }
      } catch (e: any) {
        logger.error(`[Order Backfill] objednávka ${row.display_id} selhala: ${e.message}`)
      }
    }

    if (repaired || queued) {
      logger.info(`[Order Backfill] opraveno ${repaired}, zařazeno do WMS ${queued} (z ${rows.length} kandidátů)`)
    }
  } catch (e: any) {
    logger.error(`[Order Backfill] job selhal: ${e.message}`)
  } finally {
    await pool.end().catch(() => {})
  }
}

export const config = {
  name: "order-metadata-backfill",
  schedule: "*/10 * * * *",
}
