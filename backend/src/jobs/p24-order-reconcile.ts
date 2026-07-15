// @ts-nocheck
import { MedusaContainer } from "@medusajs/framework/types"
import {
  Przelewy24ApiClient,
  credsFromGatewayConfig,
  pickP24Config,
} from "../modules/payment-przelewy24/api-client"
import { logPaymentEvent } from "../modules/payment-debug/utils/log"

/**
 * Przelewy24 order reconcile — paid-but-no-order safety net (layer 2).
 *
 * Runs every 15 minutes. Covers cases the webhook safety net missed
 * (backend restart during the 30s delay, notification lost, verify race):
 *   1) find pending P24 payment sessions on uncompleted carts (last 48h),
 *   2) skip if an order already exists for the sessionId (idempotent),
 *   3) GET /transaction/by/sessionId — status 1 (advance) / 2 (verified)
 *      means the customer paid,
 *   4) verify (mandatory settlement step, idempotent on P24 side),
 *   5) complete the cart via completeCartWorkflow, mark
 *      completed_by='p24_reconcile'.
 */

const LOOKBACK_HOURS = 48

export default async function p24OrderReconcile(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

  try {
    // Active P24 gateway configs — none → nothing to do
    const { rows: configs } = await pool.query(
      `SELECT * FROM gateway_config
       WHERE provider = 'przelewy24' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC`
    )
    if (!configs.length) return

    // Pending P24 sessions on uncompleted carts in the window
    const { rows: sessions } = await pool.query(
      `SELECT DISTINCT ON (ps.data->>'p24SessionId')
              ps.id AS session_id_pk, ps.data, c.id AS cart_id, c.email
       FROM payment_session ps
       JOIN payment_collection pc ON pc.id = ps.payment_collection_id
       JOIN cart_payment_collection cpc ON cpc.payment_collection_id = pc.id
       JOIN cart c ON c.id = cpc.cart_id
       WHERE ps.provider_id LIKE '%przelewy24%'
         AND c.completed_at IS NULL
         AND ps.created_at > NOW() - INTERVAL '${LOOKBACK_HOURS} hours'
         AND ps.data->>'p24SessionId' IS NOT NULL
       ORDER BY ps.data->>'p24SessionId', ps.created_at DESC`
    )
    if (!sessions.length) {
      logger.info(`[P24 Reconcile] No pending P24 sessions in the last ${LOOKBACK_HOURS}h.`)
      return
    }

    let completed = 0
    let skipped = 0
    let unpaid = 0
    const failures: string[] = []

    for (const row of sessions) {
      const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data || {}
      const sessionId = data.p24SessionId || data.sessionId
      if (!sessionId) continue

      try {
        // Idempotence: order already exists?
        const { rows: orderRows } = await pool.query(
          `SELECT id FROM "order" WHERE metadata->>'p24SessionId' = $1 LIMIT 1`,
          [sessionId]
        )
        if (orderRows[0]) { skipped++; continue }

        const config = pickP24Config(configs, data.project_slug)
        const creds = credsFromGatewayConfig(config)
        if (!creds) { failures.push(`${sessionId} (no credentials)`); continue }
        const client = new Przelewy24ApiClient(creds)

        const tx = await client.getTransactionBySessionId(sessionId)
        if (!tx.success) { unpaid++; continue } // no transaction = never paid

        // P24 status: 0 = no payment, 1 = advance received, 2 = paid & verified,
        // 3 = returned. >=1 means money moved — reconcile it.
        const status = Number(tx.data?.status ?? 0)
        if (status < 1 || status === 3) { unpaid++; continue }

        const orderId = Number(tx.data?.orderId || 0)
        const amountMajor = tx.data?.amountMajor ?? Number(data.amount || 0)
        logger.info(
          `[P24 Reconcile] Paid session without order: ${sessionId} (status=${status}, orderId=${orderId}, cart=${row.cart_id})`
        )

        // Mandatory verify (idempotent — P24 accepts repeated verify)
        if (orderId && status !== 2) {
          const verify = await client.verifyTransaction({
            sessionId,
            orderId,
            amount: amountMajor,
            currency: tx.data?.currency || data.currency || "PLN",
          })
          if (!verify.success) {
            failures.push(`${sessionId} (verify failed: ${verify.error})`)
            continue
          }
        }

        // Flag the session so authorizePayment passes inside completeCart
        await pool.query(
          `UPDATE payment_session
           SET data = data || jsonb_build_object('p24_verified', true, 'p24OrderId', $2::int)
           WHERE id = $1`,
          [row.session_id_pk, orderId || null]
        )

        const { completeCartWorkflow } = await import("@medusajs/medusa/core-flows")
        const result = await completeCartWorkflow(container).run({ input: { id: row.cart_id } })
        const order = (result as any)?.result?.order || (result as any)?.order || (result as any)?.result

        if (order?.id) {
          const { rows: metaRows } = await pool.query(
            `SELECT metadata FROM "order" WHERE id = $1 LIMIT 1`,
            [order.id]
          )
          const updatedMeta = {
            ...(metaRows[0]?.metadata || {}),
            p24SessionId: sessionId,
            p24OrderId: orderId,
            payment_provider: "przelewy24",
            payment_captured: true,
            payment_captured_at: new Date().toISOString(),
            completed_by: "p24_reconcile",
          }
          await pool.query(
            `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(updatedMeta), order.id]
          )
          logger.info(`[P24 Reconcile] ✅ Cart ${row.cart_id} completed → order ${order.id}`)
          logPaymentEvent({
            intent_id: sessionId,
            cart_id: row.cart_id,
            email: row.email,
            project_slug: data.project_slug || null,
            event_type: "p24_reconcile_completed",
            event_data: { order_id: order.id, p24_order_id: orderId, amount: amountMajor },
          })
          completed++
        } else {
          failures.push(`${sessionId} (cart completion returned no order)`)
        }
      } catch (e: any) {
        failures.push(`${sessionId} (${e.message})`)
      }
    }

    logger.info(
      `[P24 Reconcile] Done: ${completed} completed, ${skipped} already had orders, ` +
        `${unpaid} unpaid, ${failures.length} failed (of ${sessions.length} sessions).`
    )
    if (failures.length) {
      logger.warn(`[P24 Reconcile] Failures: ${failures.slice(0, 10).join("; ")}`)
    }
  } catch (e: any) {
    logger.error(`[P24 Reconcile] Job failed: ${e.message}`)
  } finally {
    await pool.end().catch(() => {})
  }
}

export const config = {
  name: "p24-order-reconcile",
  schedule: "*/15 * * * *",
}
