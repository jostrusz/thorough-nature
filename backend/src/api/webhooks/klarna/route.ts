// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { emitPaymentLog } from "../../../utils/payment-logger"

/**
 * Helper: find order by Klarna order ID via direct DB query
 */
async function findOrderByKlarnaId(klarnaOrderId: string, logger: any): Promise<any> {
  try {
    const { Pool } = require("pg")
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    const { rows } = await pool.query(
      `SELECT id, metadata FROM "order"
       WHERE metadata->>'klarnaOrderId' = $1
          OR metadata->>'payment_klarna_order_id' = $1
       LIMIT 1`,
      [klarnaOrderId]
    )
    await pool.end()
    return rows[0] || null
  } catch (dbErr: any) {
    logger.warn(`[Klarna Webhook] DB query failed: ${dbErr.message}`)
    return null
  }
}

/**
 * Safety net: auto-complete cart when Klarna payment authorized/captured but no order exists.
 * This handles the case where the customer completes Klarna payment but never returns
 * to the checkout page (browser closed, connection lost, etc.).
 *
 * Flow:
 * 1. Wait 30s to give the frontend return handler a chance to complete first
 * 2. Re-check if an order was created during the delay (prevent duplicates)
 * 3. Find uncompleted cart by matching klarnaOrderId in payment session data
 * 4. Complete the cart via Medusa's completeCartWorkflow
 */
async function safetyNetCompleteCart(
  klarnaOrderId: string,
  scope: any,
  logger: any
): Promise<void> {
  const DELAY_MS = 30_000 // 30 seconds — give frontend time to complete

  logger.info(
    `[Klarna Webhook] Safety net: no order found for Klarna order ${klarnaOrderId}. ` +
    `Waiting ${DELAY_MS / 1000}s before attempting cart completion...`
  )

  await new Promise((resolve) => setTimeout(resolve, DELAY_MS))

  // Re-check: did the order get created during the delay?
  const orderAfterDelay = await findOrderByKlarnaId(klarnaOrderId, logger)
  if (orderAfterDelay) {
    logger.info(
      `[Klarna Webhook] Safety net: order ${orderAfterDelay.id} was created during delay — no action needed`
    )
    return
  }

  logger.info(
    `[Klarna Webhook] Safety net: still no order after ${DELAY_MS / 1000}s delay. Searching for cart...`
  )

  try {
    const query = scope.resolve(ContainerRegistrationKeys.QUERY)

    // Search recent uncompleted carts for one with this Klarna order ID
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "completed_at",
        "email",
        "shipping_address.*",
        "payment_collection.*",
        "payment_collection.payment_sessions.*",
      ],
      filters: {},
      pagination: { order: { created_at: "DESC" }, skip: 0, take: 80 },
    })

    let targetCart: any = null
    for (const cart of carts || []) {
      if (cart.completed_at) continue // skip already completed carts
      const sessions = cart.payment_collection?.payment_sessions || []
      for (const session of sessions) {
        if (
          session.data?.klarnaOrderId === klarnaOrderId ||
          session.data?.sessionId === klarnaOrderId
        ) {
          targetCart = cart
          break
        }
      }
      if (targetCart) break
    }

    if (!targetCart) {
      logger.warn(
        `[Klarna Webhook] Safety net: no uncompleted cart found for Klarna order ${klarnaOrderId}`
      )
      return
    }

    logger.info(
      `[Klarna Webhook] Safety net: found uncompleted cart ${targetCart.id} (email: ${targetCart.email}) — attempting to complete`
    )

    // Final duplicate check right before completing
    const orderFinalCheck = await findOrderByKlarnaId(klarnaOrderId, logger)
    if (orderFinalCheck) {
      logger.info(
        `[Klarna Webhook] Safety net: order ${orderFinalCheck.id} appeared just before completion — aborting (no duplicate)`
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
        `[Klarna Webhook] Safety net: ✅ Cart ${targetCart.id} completed → order ${completedOrder.id} (display_id: ${completedOrder.display_id})`
      )

      // Update the new order's metadata with Klarna payment info
      try {
        const { Pool } = require("pg")
        const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
        const { rows: orderRows } = await pool.query(
          `SELECT metadata FROM "order" WHERE id = $1 LIMIT 1`,
          [completedOrder.id]
        )
        const existingMeta = orderRows[0]?.metadata || {}
        const updatedMeta = {
          ...existingMeta,
          klarnaOrderId,
          klarnaStatus: "order.authorized",
          payment_captured: true,
          payment_captured_at: new Date().toISOString(),
          payment_method: "klarna",
          completed_by: "klarna_webhook_safety_net",
          safety_net_completed_at: new Date().toISOString(),
        }
        await pool.query(
          `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(updatedMeta), completedOrder.id]
        )
        await pool.end()
        logger.info(
          `[Klarna Webhook] Safety net: updated order ${completedOrder.id} metadata with Klarna payment data`
        )
      } catch (metaErr: any) {
        logger.warn(
          `[Klarna Webhook] Safety net: failed to update order metadata: ${metaErr.message}`
        )
      }

      // Emit payment.captured event so subscribers (Fakturoid, Dextrum, etc.) can react
      try {
        const eventBus = scope.resolve(ContainerRegistrationKeys.EVENT_BUS)
        await eventBus.emit("payment.captured", { id: completedOrder.id })
        logger.info(
          `[Klarna Webhook] Safety net: emitted payment.captured for order ${completedOrder.id}`
        )
      } catch (e: any) {
        logger.warn(
          `[Klarna Webhook] Safety net: failed to emit payment.captured: ${e.message}`
        )
      }
    } else {
      logger.warn(
        `[Klarna Webhook] Safety net: cart completion returned unexpected result: ${JSON.stringify(result).slice(0, 500)}`
      )
    }
  } catch (safetyErr: any) {
    logger.error(
      `[Klarna Webhook] Safety net failed for Klarna order ${klarnaOrderId}: ${safetyErr.message}`
    )
  }
}

/**
 * Klarna webhook handler
 *
 * Event types from Klarna:
 * - order.created — Klarna order created
 * - order.approved — Order approved by Klarna risk
 * - order.authorization.created — Authorization created (28 days validity)
 * - order.authorized — Payment fully authorized
 * - order.released — Capture initiated
 * - order.captured — Payment captured
 * - order.refund.initiated — Refund started
 * - order.refund.completed — Refund completed
 * - order.payment_authorized — Payment confirmed
 * - order.cancelled — Order cancelled
 * - order.expired — Order expired (auth timeout)
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { event_type, order_id: klarnaOrderId } = req.body

    if (!event_type || !klarnaOrderId) {
      return res.status(400).json({ error: "Missing required Klarna webhook fields" })
    }

    const logger = req.scope.resolve("logger")
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    logger.info(`[Klarna Webhook] Received event: ${event_type} for order: ${klarnaOrderId}`)

    // Map Klarna event type to activity event and status
    const { activityEvent, activityStatus, isSuccessEvent, isFailEvent } =
      mapKlarnaEvent(event_type)

    // Find the Medusa order by klarnaOrderId in metadata
    let order = null

    // Strategy 1: Search via query graph for metadata match
    try {
      const { data: orders } = await query.graph({
        entity: "order",
        fields: [
          "id",
          "metadata",
          "total",
          "currency_code",
        ],
        filters: {},
        pagination: { order: { created_at: "DESC" }, skip: 0, take: 100 },
      })

      for (const o of orders || []) {
        if (
          o.metadata?.klarnaOrderId === klarnaOrderId ||
          o.metadata?.payment_klarna_order_id === klarnaOrderId
        ) {
          order = o
          logger.info(`[Klarna Webhook] Found order ${o.id} via metadata`)
          break
        }
      }
    } catch (e: any) {
      logger.warn(`[Klarna Webhook] Metadata search failed: ${e.message}`)
    }

    // Strategy 2: Search via payment session data
    if (!order) {
      try {
        const { data: orders } = await query.graph({
          entity: "order",
          fields: [
            "id",
            "metadata",
            "total",
            "currency_code",
            "payment_collections.*",
            "payment_collections.payments.*",
          ],
          filters: {},
          pagination: { order: { created_at: "DESC" }, skip: 0, take: 50 },
        })

        for (const o of orders || []) {
          const payments =
            o.payment_collections?.flatMap((pc: any) => pc.payments || []) || []
          for (const p of payments) {
            if (
              p.data?.klarnaOrderId === klarnaOrderId ||
              p.data?.sessionId === klarnaOrderId
            ) {
              order = o
              logger.info(
                `[Klarna Webhook] Found order ${o.id} via payment session data`
              )
              break
            }
          }
          if (order) break
        }
      } catch (e: any) {
        logger.warn(`[Klarna Webhook] Payment session search failed: ${e.message}`)
      }
    }

    if (order) {
      const activityEntry: any = {
        timestamp: new Date().toISOString(),
        event: activityEvent,
        gateway: "klarna",
        payment_method: "klarna",
        status: activityStatus,
        amount: order.total || 0,
        currency: order.currency_code,
        transaction_id: klarnaOrderId,
        webhook_event_type: event_type,
        provider_raw_status: event_type,
        error_message: isFailEvent
          ? `Klarna event: ${event_type}`
          : undefined,
        detail: `Klarna event: ${event_type}`,
      }

      if (isFailEvent) {
        activityEntry.error_code = event_type.split(".").pop()
        activityEntry.decline_reason = `Klarna ${event_type.replace("order.", "")}`
      }

      const existingLog = order.metadata?.payment_activity_log || []
      const updatedMetadata: any = {
        ...order.metadata,
        payment_activity_log: [...existingLog, activityEntry],
        klarnaOrderId,
        klarnaStatus: event_type,
      }

      // Mark as captured when Klarna confirms capture or authorization
      if (event_type === "order.captured" || event_type === "order.authorized" || event_type === "order.payment_authorized") {
        updatedMetadata.payment_captured = true
        updatedMetadata.payment_captured_at = new Date().toISOString()
        updatedMetadata.klarna_captured_at = new Date().toISOString()
      }

      // Mark as expired when authorization expires (28 days)
      if (event_type === "order.expired") {
        updatedMetadata.klarna_expired = true
        updatedMetadata.klarna_expired_at = new Date().toISOString()
      }

      // Mark as cancelled
      if (event_type === "order.cancelled") {
        updatedMetadata.klarna_cancelled = true
        updatedMetadata.klarna_cancelled_at = new Date().toISOString()
      }

      // Mark refund complete
      if (event_type === "order.refund.completed" || event_type === "order.refunded") {
        updatedMetadata.klarna_refunded = true
        updatedMetadata.klarna_refunded_at = new Date().toISOString()
      }

      try {
        const { Pool } = require("pg")
        const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
        await pool.query(
          `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(updatedMetadata), order.id]
        )
        await pool.end()
      } catch (dbErr: any) {
        logger.error(`[Klarna Webhook] DB update failed: ${dbErr.message}`)
      }

      logger.info(
        `[Klarna Webhook] Order ${order.id} updated with event: ${event_type}`
      )

      if (event_type === "order.captured" || event_type === "order.authorized" || event_type === "order.payment_authorized") {
        try {
          const { ContainerRegistrationKeys: CRK } = await import("@medusajs/framework/utils")
          const eventBus = req.scope.resolve(CRK.EVENT_BUS)
          await eventBus.emit("payment.captured", { id: order.id })
          logger.info(`[Klarna Webhook] Emitted payment.captured event for order ${order.id}`)
        } catch (e: any) {
          logger.warn(`[Klarna Webhook] Failed to emit payment.captured: ${e.message}`)
        }
      }

      emitPaymentLog(logger, {
        provider: "klarna",
        event: event_type,
        order_id: order.id,
        transaction_id: klarnaOrderId,
        status: activityStatus as any,
        amount: order.total || undefined,
        currency: order.currency_code,
        payment_method: "klarna",
        error_code: activityEntry.error_code,
        decline_reason: activityEntry.decline_reason,
        provider_raw_status: event_type,
      })
    } else {
      logger.warn(
        `[Klarna Webhook] No Medusa order found for Klarna ID: ${klarnaOrderId}`
      )

      // ─── SAFETY NET: Auto-complete cart when payment authorized/captured but order doesn't exist ───
      // This handles the case where Klarna approved the payment but the customer
      // never returned to the checkout page (browser closed, connection lost, etc.).
      const SAFETY_NET_EVENTS = ["order.authorized", "order.payment_authorized", "order.captured"]
      if (SAFETY_NET_EVENTS.includes(event_type)) {
        // Fire and forget — don't block the webhook response
        safetyNetCompleteCart(klarnaOrderId, req.scope, logger).catch((err) => {
          logger.error(`[Klarna Webhook] Safety net unhandled error: ${err.message}`)
        })
      }

      emitPaymentLog(logger, {
        provider: "klarna",
        event: event_type,
        transaction_id: klarnaOrderId,
        status: "pending",
        payment_method: "klarna",
        metadata: { order_not_found: true },
      })
    }

    return res.status(200).json({ received: true })
  } catch (error: any) {
    const logger = req.scope.resolve("logger")
    logger.error(`[Klarna Webhook] Error: ${error.message}`)
    return res.status(200).json({ error: error.message })
  }
}

function mapKlarnaEvent(event_type: string): {
  activityEvent: string
  activityStatus: string
  isSuccessEvent: boolean
  isFailEvent: boolean
} {
  switch (event_type) {
    case "order.created":
      return {
        activityEvent: "order_created",
        activityStatus: "pending",
        isSuccessEvent: false,
        isFailEvent: false,
      }
    case "order.approved":
      return {
        activityEvent: "order_approved",
        activityStatus: "pending",
        isSuccessEvent: false,
        isFailEvent: false,
      }
    case "order.authorization.created":
      return {
        activityEvent: "authorization_created",
        activityStatus: "pending",
        isSuccessEvent: false,
        isFailEvent: false,
      }
    case "order.authorized":
    case "order.payment_authorized":
      return {
        activityEvent: "authorization",
        activityStatus: "success",
        isSuccessEvent: true,
        isFailEvent: false,
      }
    case "order.released":
      return {
        activityEvent: "capture_initiated",
        activityStatus: "pending",
        isSuccessEvent: false,
        isFailEvent: false,
      }
    case "order.captured":
      return {
        activityEvent: "capture",
        activityStatus: "success",
        isSuccessEvent: true,
        isFailEvent: false,
      }
    case "order.refund.initiated":
      return {
        activityEvent: "refund_initiated",
        activityStatus: "pending",
        isSuccessEvent: false,
        isFailEvent: false,
      }
    case "order.refund.completed":
    case "order.refunded":
      return {
        activityEvent: "refund",
        activityStatus: "success",
        isSuccessEvent: true,
        isFailEvent: false,
      }
    case "order.cancelled":
      return {
        activityEvent: "cancellation",
        activityStatus: "failed",
        isSuccessEvent: false,
        isFailEvent: true,
      }
    case "order.expired":
      return {
        activityEvent: "expiration",
        activityStatus: "failed",
        isSuccessEvent: false,
        isFailEvent: true,
      }
    default:
      return {
        activityEvent: "status_update",
        activityStatus: "pending",
        isSuccessEvent: false,
        isFailEvent: false,
      }
  }
}
