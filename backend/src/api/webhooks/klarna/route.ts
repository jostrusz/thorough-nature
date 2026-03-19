// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

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
      const activityEntry = {
        timestamp: new Date().toISOString(),
        event: activityEvent,
        gateway: "klarna",
        payment_method: "klarna",
        status: activityStatus,
        amount: order.total || 0,
        currency: order.currency_code,
        transaction_id: klarnaOrderId,
        error_message: isFailEvent
          ? `Klarna event: ${event_type}`
          : undefined,
        detail: `Klarna event: ${event_type}`,
      }

      const existingLog = order.metadata?.payment_activity_log || []
      const updatedMetadata: any = {
        ...order.metadata,
        payment_activity_log: [...existingLog, activityEntry],
        klarnaOrderId,
        klarnaStatus: event_type,
      }

      // Mark as captured when Klarna confirms capture
      if (event_type === "order.captured") {
        updatedMetadata.payment_captured = true
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
    } else {
      logger.warn(
        `[Klarna Webhook] No Medusa order found for Klarna ID: ${klarnaOrderId}`
      )
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
