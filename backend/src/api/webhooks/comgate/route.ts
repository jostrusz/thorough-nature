// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ComgateApiClient } from "../../../modules/payment-comgate/api-client"
import { Client } from "pg"
import { emitPaymentLog } from "../../../utils/payment-logger"

/**
 * Comgate push notification webhook.
 * Called by Comgate when a payment status changes (PAID, CANCELLED, etc.)
 *
 * Primary payment flow uses redirect (customer returns → cart/complete).
 * This webhook is a backup for cases where the customer's browser doesn't redirect
 * (closed tab, network issue, etc.) — it updates order metadata so admin can see the status.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  let logger: any = console
  try {
    logger = req.scope.resolve("logger") || console
  } catch {
    // fallback to console
  }

  try {
    // Comgate sends form-encoded body: transId=XXX-YYYY-ZZZZ
    const transId = req.body?.transId || req.query?.transId

    if (!transId) {
      logger.warn("[Comgate Webhook] Missing transId in request")
      return res.status(400).json({ error: "Missing transId" })
    }

    logger.info(`[Comgate Webhook] Received notification for transId: ${transId}`)

    // Load Comgate config from DB (same approach as service.ts)
    const config = await loadComgateConfig(logger)
    if (!config) {
      logger.error("[Comgate Webhook] No Comgate config found")
      return res.status(200).send("OK") // Return 200 so Comgate doesn't retry
    }

    const isLive = config.mode === "live"
    let keys = isLive ? config.live_keys : config.test_keys
    if (typeof keys === "string") {
      try { keys = JSON.parse(keys) } catch { keys = null }
    }

    if (!keys?.api_key || !keys?.secret_key) {
      logger.error("[Comgate Webhook] Invalid Comgate credentials")
      return res.status(200).send("OK")
    }

    // Verify transaction status directly with Comgate API
    const client = new ComgateApiClient(keys.api_key, keys.secret_key)
    const statusResult = await client.getStatus({
      merchant: keys.api_key,
      transId: transId,
      secret: keys.secret_key,
    })

    if (!statusResult.success) {
      logger.error(`[Comgate Webhook] Status check failed: ${statusResult.error}`)
      return res.status(200).send("OK")
    }

    const comgateStatus = statusResult.data?.status || "PENDING"
    const medusaStatus = mapComgateStatusToMedusa(comgateStatus)

    logger.info(`[Comgate Webhook] Transaction ${transId}: Comgate status=${comgateStatus}, mapped=${medusaStatus}`)

    // Try to find and update the order with this transaction ID
    try {
      // Search for orders with this transId in metadata via direct DB query
      const { Pool } = require("pg")
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
      const { rows: orders } = await pool.query(
        `SELECT id, metadata FROM "order" WHERE metadata->>'comgateTransId' = $1 LIMIT 1`,
        [transId]
      )
      const matchingOrder = orders[0] || null

      if (matchingOrder) {
        const meta = typeof matchingOrder.metadata === "string"
          ? JSON.parse(matchingOrder.metadata)
          : matchingOrder.metadata || {}

        const isFailed = ["CANCELLED", "FAILED"].includes(comgateStatus)
        const activityEntry: any = {
          timestamp: new Date().toISOString(),
          event: "webhook_status_update",
          gateway: "comgate",
          payment_method: statusResult.data?.method || "unknown",
          status: medusaStatus,
          amount: statusResult.data?.price,
          currency: statusResult.data?.curr,
          transaction_id: transId,
          webhook_event_type: `comgate.${comgateStatus}`,
          provider_raw_status: comgateStatus,
          customer_email: statusResult.data?.email || meta.customer_email || null,
          detail: `Comgate webhook: ${comgateStatus}`,
        }

        if (isFailed) {
          activityEntry.error_code = comgateStatus
          activityEntry.decline_reason = statusResult.data?.message || `Comgate ${comgateStatus.toLowerCase()}`
        }

        const existingLog = meta.payment_activity_log || []
        const updatedMetadata: any = {
          ...meta,
          payment_activity_log: [...existingLog, activityEntry],
          comgateStatus: comgateStatus,
        }

        // Mark as captured when Comgate confirms payment
        if (comgateStatus === "PAID") {
          updatedMetadata.payment_captured = true
          updatedMetadata.payment_captured_at = new Date().toISOString()
        }
        await pool.query(
          `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(updatedMetadata), matchingOrder.id]
        )

        logger.info(`[Comgate Webhook] Order ${matchingOrder.id} updated with status: ${medusaStatus}`)

        if (comgateStatus === "PAID") {
          await captureOrderPayment(matchingOrder.id, pool, req.scope, logger)
        }

        emitPaymentLog(logger, {
          provider: "comgate",
          event: `comgate.${comgateStatus}`,
          order_id: matchingOrder.id,
          transaction_id: transId,
          status: medusaStatus === "captured" ? "success" : isFailed ? "failed" : "pending",
          amount: statusResult.data?.price,
          currency: statusResult.data?.curr,
          customer_email: activityEntry.customer_email,
          payment_method: activityEntry.payment_method,
          error_code: activityEntry.error_code,
          decline_reason: activityEntry.decline_reason,
          provider_raw_status: comgateStatus,
        })
      } else {
        logger.info(`[Comgate Webhook] No order found for transId ${transId} (may not be completed yet)`)
        emitPaymentLog(logger, {
          provider: "comgate",
          event: `comgate.${comgateStatus}`,
          transaction_id: transId,
          status: "pending",
          provider_raw_status: comgateStatus,
          metadata: { order_not_found: true },
        })

        // ── Safety net: auto-complete cart if payment was PAID but no order exists ──
        if (comgateStatus === "PAID") {
          await pool.end()
          safetyNetCompleteCart(transId, statusResult.data, req.scope, logger)
            .catch((e) => logger.warn(`[Comgate Webhook] Safety net error: ${e.message}`))
          // Don't await — return 200 immediately so Comgate doesn't timeout
          return res.status(200).send("OK")
        }
      }
      await pool.end()
    } catch (orderErr: any) {
      // Order update is best-effort — don't fail the webhook
      logger.warn(`[Comgate Webhook] Order update failed (non-critical): ${orderErr.message}`)
    }

    return res.status(200).send("OK")
  } catch (error: any) {
    logger.error(`[Comgate Webhook] Error: ${error.message}`)
    return res.status(200).send("OK") // Always 200 so Comgate doesn't retry
  }
}

/**
 * Load Comgate gateway config from DB.
 * Uses raw pg Client via DATABASE_URL (most reliable in webhook context).
 */
async function loadComgateConfig(logger: any): Promise<any> {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return null

  let pgClient: Client | null = null
  try {
    pgClient = new Client({
      connectionString: dbUrl,
      ssl: dbUrl.includes("railway") ? { rejectUnauthorized: false } : undefined,
    })
    await pgClient.connect()
    const result = await pgClient.query(
      "SELECT * FROM gateway_config WHERE provider = $1 AND is_active = true AND deleted_at IS NULL LIMIT 1",
      ["comgate"]
    )
    return result.rows[0] || null
  } catch (e: any) {
    logger.warn(`[Comgate Webhook] DB query failed: ${e.message}`)
    return null
  } finally {
    if (pgClient) {
      try { await pgClient.end() } catch {}
    }
  }
}

/**
 * Safety net: auto-complete cart when Comgate payment succeeded but no order exists.
 * This handles cases where the customer pays but never returns to the checkout page
 * (browser closed, connection lost, etc.).
 *
 * Flow:
 * 1. Wait 30s to give the frontend return handler a chance to complete first
 * 2. Re-check if an order was created during the delay (prevent duplicates)
 * 3. Find uncompleted cart by matching comgateTransId in payment session data
 * 4. Complete the cart via Medusa's completeCartWorkflow
 */
async function safetyNetCompleteCart(
  transId: string,
  comgateData: any,
  scope: any,
  logger: any
): Promise<void> {
  const DELAY_MS = 30_000 // 30 seconds

  logger.info(
    `[Comgate Webhook] Safety net: no order found for transId ${transId}. ` +
    `Waiting ${DELAY_MS / 1000}s before attempting cart completion...`
  )

  await new Promise((resolve) => setTimeout(resolve, DELAY_MS))

  // Re-check: did the order get created during the delay?
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

  try {
    const { rows: orderCheck } = await pool.query(
      `SELECT id FROM "order" WHERE metadata->>'comgateTransId' = $1 LIMIT 1`,
      [transId]
    )
    if (orderCheck[0]) {
      logger.info(
        `[Comgate Webhook] Safety net: order ${orderCheck[0].id} was created during delay — capturing payment`
      )
      await captureOrderPayment(orderCheck[0].id, pool, scope, logger)
      return
    }

    logger.info(
      `[Comgate Webhook] Safety net: still no order after ${DELAY_MS / 1000}s delay. Searching for cart...`
    )

    // Search for uncompleted cart with this Comgate transaction ID
    // Strategy 1: Direct SQL query on payment_session.data (most reliable)
    let targetCart: any = null

    try {
      // Medusa v2: cart ↔ payment_collection linked via cart_payment_collection table
      const { rows: cartRows } = await pool.query(
        `SELECT c.id, c.completed_at, c.email
         FROM cart c
         JOIN cart_payment_collection cpc ON cpc.cart_id = c.id
         JOIN payment_collection pc ON pc.id = cpc.payment_collection_id
         JOIN payment_session ps ON ps.payment_collection_id = pc.id
         WHERE c.completed_at IS NULL
           AND (ps.data->>'transId' = $1 OR ps.data->>'comgateTransId' = $1)
         ORDER BY c.created_at DESC
         LIMIT 1`,
        [transId]
      )
      if (cartRows[0]) {
        targetCart = cartRows[0]
        logger.info(
          `[Comgate Webhook] Safety net: found cart via SQL: ${targetCart.id} (email: ${targetCart.email})`
        )
      }
    } catch (sqlErr: any) {
      logger.warn(`[Comgate Webhook] Safety net: SQL cart search failed: ${sqlErr.message}`)
    }

    // Strategy 2: Fallback to query.graph if SQL didn't find it
    if (!targetCart) {
      try {
        const { ContainerRegistrationKeys } = await import("@medusajs/framework/utils")
        const queryService = scope.resolve(ContainerRegistrationKeys.QUERY)

        const { data: carts } = await queryService.graph({
          entity: "cart",
          fields: [
            "id",
            "completed_at",
            "email",
            "payment_collection.*",
            "payment_collection.payment_sessions.*",
          ],
          filters: {},
          pagination: { order: { created_at: "DESC" }, skip: 0, take: 80 },
        })

        for (const cart of carts || []) {
          if (cart.completed_at) continue
          const sessions = cart.payment_collection?.payment_sessions || []
          for (const session of sessions) {
            // Check both field names: "transId" (from initiatePayment) and "comgateTransId" (legacy)
            if (session.data?.transId === transId || session.data?.comgateTransId === transId) {
              targetCart = cart
              break
            }
          }
          if (targetCart) break
        }
      } catch (graphErr: any) {
        logger.warn(`[Comgate Webhook] Safety net: query.graph fallback failed: ${graphErr.message}`)
      }
    }

    if (!targetCart) {
      logger.warn(
        `[Comgate Webhook] Safety net: no uncompleted cart found for transId ${transId}`
      )
      return
    }

    logger.info(
      `[Comgate Webhook] Safety net: found uncompleted cart ${targetCart.id} (email: ${targetCart.email}) — attempting to complete`
    )

    // Final duplicate check right before completing
    const { rows: finalCheck } = await pool.query(
      `SELECT id FROM "order" WHERE metadata->>'comgateTransId' = $1 LIMIT 1`,
      [transId]
    )
    if (finalCheck[0]) {
      logger.info(
        `[Comgate Webhook] Safety net: order ${finalCheck[0].id} appeared just before completion — aborting (no duplicate)`
      )
      return
    }

    // Complete the cart via Medusa's cart completion workflow
    const { completeCartWorkflow } = await import("@medusajs/medusa/core-flows")
    const result = await completeCartWorkflow(scope).run({
      input: { id: targetCart.id },
    })

    const completedOrder = (result as any)?.result?.order || (result as any)?.order
    if (completedOrder) {
      logger.info(
        `[Comgate Webhook] Safety net: ✅ Cart ${targetCart.id} completed → order ${completedOrder.id}`
      )

      // Update the new order's metadata with Comgate payment info
      try {
        const { rows: orderRows } = await pool.query(
          `SELECT metadata FROM "order" WHERE id = $1 LIMIT 1`,
          [completedOrder.id]
        )
        const existingMeta = orderRows[0]?.metadata || {}
        const updatedMeta = {
          ...existingMeta,
          comgateTransId: transId,
          comgateStatus: "PAID",
          payment_captured: true,
          payment_captured_at: new Date().toISOString(),
          payment_method: comgateData?.method || "comgate",
          completed_by: "comgate_webhook_safety_net",
          safety_net_completed_at: new Date().toISOString(),
        }
        await pool.query(
          `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(updatedMeta), completedOrder.id]
        )
        logger.info(
          `[Comgate Webhook] Safety net: updated order ${completedOrder.id} metadata with Comgate payment data`
        )
      } catch (metaErr: any) {
        logger.warn(
          `[Comgate Webhook] Safety net: failed to update order metadata: ${metaErr.message}`
        )
      }
    } else {
      logger.warn(`[Comgate Webhook] Safety net: cart completion returned no order`)
    }
  } catch (err: any) {
    logger.error(`[Comgate Webhook] Safety net failed: ${err.message}`)
  } finally {
    await pool.end()
  }
}

/**
 * Capture an order's payment via Medusa (so PC status changes from authorized → captured),
 * and emit the payment.captured event for downstream subscribers.
 * Used when Comgate confirms PAID and we have a matching order.
 */
async function captureOrderPayment(
  orderId: string,
  pool: any,
  scope: any,
  logger: any
): Promise<void> {
  try {
    const { Modules } = await import("@medusajs/framework/utils")
    const paymentModule = scope.resolve(Modules.PAYMENT) as any

    const { rows: pcRows } = await pool.query(
      `SELECT pc.id, pc.status FROM payment_collection pc
       JOIN order_payment_collection opc ON opc.payment_collection_id = pc.id
       WHERE opc.order_id = $1 AND pc.status = 'authorized'
       LIMIT 1`,
      [orderId]
    )

    if (pcRows.length > 0) {
      const pcId = pcRows[0].id

      const { rows: payRows } = await pool.query(
        `SELECT id FROM payment WHERE payment_collection_id = $1 LIMIT 1`,
        [pcId]
      )

      if (payRows.length > 0) {
        await paymentModule.capturePayment({ payment_id: payRows[0].id })
        logger.info(`[Comgate Webhook] Payment ${payRows[0].id} captured via Medusa for order ${orderId}`)
      } else {
        logger.warn(`[Comgate Webhook] No payment found in collection ${pcId} for order ${orderId}`)
      }
    } else {
      logger.info(`[Comgate Webhook] No authorized payment collection found for order ${orderId} (may already be captured)`)
    }
  } catch (captureErr: any) {
    logger.warn(`[Comgate Webhook] Medusa capture failed for order ${orderId}: ${captureErr.message}`)
  }

  try {
    const { ContainerRegistrationKeys: CRK } = await import("@medusajs/framework/utils")
    const eventBus = scope.resolve(CRK.EVENT_BUS)
    await eventBus.emit({ name: "payment.captured", data: { id: orderId } })
    logger.info(`[Comgate Webhook] Emitted payment.captured event for order ${orderId}`)
  } catch (e: any) {
    logger.warn(`[Comgate Webhook] Failed to emit payment.captured: ${e.message}`)
  }
}

function mapComgateStatusToMedusa(comgateStatus: string): string {
  const statusMap: Record<string, string> = {
    PAID: "captured",
    AUTHORIZED: "authorized",
    PENDING: "pending",
    CANCELLED: "canceled",
    FAILED: "canceled",
    REFUNDED: "refunded",
  }
  return statusMap[comgateStatus] || "pending"
}
