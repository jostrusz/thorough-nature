// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { buildPaymentMetadata } from "../utils/build-payment-metadata"

/**
 * Copy gateway payment IDs from payment.data → order.metadata for orders the
 * order.placed subscriber lost.
 *
 * Cause: until c67deb4c (2026-07-31) the subscriber wrote metadata via
 * updateOrders(), which merges against the ORM's stale snapshot. Two concurrent
 * order.placed subscribers therefore clobbered each other and payment_provider
 * survived on only ~40 % of orders. Since the atomic-merge fix went live the
 * daily rate is 97-100 %, so this only has to repair the backlog.
 *
 * Uses buildPaymentMetadata() — the same function the subscriber now calls — so
 * repaired rows are indistinguishable from freshly written ones. Writes through
 * mergeOrderMetadata(), which is an atomic `metadata || patch` in Postgres and
 * therefore cannot overwrite fields another process added meanwhile.
 *
 * DRY RUN unless APPLY=1.
 *   APPLY=1 pnpm medusa exec ./src/scripts/backfill-payment-metadata.ts
 */

const FROM = "2026-01-01 00:00 Europe/Prague"
const TO = "2026-08-01 00:00 Europe/Prague"
const BATCH = 500

export default async function backfillPaymentMetadata({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const APPLY = process.env.APPLY === "1"

  const { rows: targets } = await knex.raw(
    `SELECT o.id, o.metadata->>'project_id' AS project_id,
            o.metadata->>'custom_order_number' AS num
       FROM "order" o
      WHERE o.created_at >= timestamptz '${FROM}'
        AND o.created_at <  timestamptz '${TO}'
        AND o.deleted_at IS NULL
        AND NOT (o.metadata ? 'payment_provider')
      ORDER BY o.created_at`
  )

  logger.info(`[PayMeta] ${targets.length} orders without payment_provider${APPLY ? "" : "  (DRY RUN)"}`)

  const stats: Record<string, number> = {}
  const stamp = new Date().toISOString()
  let done = 0, skipped = 0

  for (let off = 0; off < targets.length; off += BATCH) {
    const chunk = targets.slice(off, off + BATCH)
    const ids = chunk.map((r: any) => r.id)

    // one round-trip per batch instead of per order
    const { rows: pays } = await knex.raw(
      `SELECT opc.order_id, p.provider_id, p.data
         FROM order_payment_collection opc
         JOIN payment p ON p.payment_collection_id = opc.payment_collection_id
        WHERE opc.order_id = ANY(?)
        ORDER BY p.created_at`,
      [ids]
    )
    const byOrder: Record<string, any[]> = {}
    for (const p of pays) (byOrder[p.order_id] ||= []).push(p)
    const patches: [string, string][] = []

    for (const o of chunk) {
      const payments = byOrder[o.id] || []
      if (!payments.length) { skipped++; stats["(bez platby)"] = (stats["(bez platby)"] || 0) + 1; continue }

      const { found, metadata } = await buildPaymentMetadata(payments)
      if (!found) {
        skipped++
        const pid = payments[0]?.provider_id || "?"
        stats[`(nerozpoznáno) ${pid}`] = (stats[`(nerozpoznáno) ${pid}`] || 0) + 1
        continue
      }

      stats[metadata.payment_provider] = (stats[metadata.payment_provider] || 0) + 1
      metadata.payment_metadata_backfilled_at = stamp
      patches.push([o.id, JSON.stringify(metadata)])
      done++
    }

    // One statement per batch instead of one per order — the same atomic
    // `metadata || patch` as mergeOrderMetadata(), just applied set-wise.
    // Per-order round-trips over the proxy ran at ~150/min, which is 2+ hours
    // for the backlog.
    if (APPLY && patches.length) {
      await knex.raw(
        `UPDATE "order" o
            SET metadata = COALESCE(o.metadata, '{}'::jsonb) || v.patch::jsonb,
                updated_at = NOW()
           FROM (SELECT * FROM unnest(?::text[], ?::text[]) AS t(id, patch)) v
          WHERE o.id = v.id`,
        [patches.map((p) => p[0]), patches.map((p) => p[1])]
      )
    }
    if ((off / BATCH) % 4 === 0) logger.info(`[PayMeta] ${Math.min(off + BATCH, targets.length)}/${targets.length}`)
  }

  logger.info("═".repeat(58))
  logger.info(`[PayMeta] ${APPLY ? "ZAPSÁNO" : "DRY RUN"}  doplněno=${done}  přeskočeno=${skipped}`)
  for (const [k, v] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    logger.info(`   ${k}: ${v}`)
  }
  logger.info("═".repeat(58))
}
