// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MollieApiClient } from "../../../modules/payment-mollie/api-client"
import { emitPaymentLog } from "../../../utils/payment-logger"

const GATEWAY_CONFIG_MODULE = "gatewayConfig"

/**
 * Build a Mollie API client from gateway_config settings.
 * This avoids calling private methods on the payment provider.
 */
async function buildMollieClient(req: MedusaRequest): Promise<MollieApiClient> {
  // 1. Try gateway config from database (admin-configured)
  try {
    const gcService = req.scope.resolve(GATEWAY_CONFIG_MODULE)
    const configs = await gcService.listGatewayConfigs(
      { provider: "mollie", is_active: true },
      { take: 1 }
    )
    const config = configs[0]
    if (config) {
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      if (keys?.api_key) {
        return new MollieApiClient(keys.api_key, !isLive)
      }
    }
  } catch {
    // Gateway config not available — try env var fallback
  }

  // 2. Fallback to env var
  if (process.env.MOLLIE_API_KEY) {
    return new MollieApiClient(
      process.env.MOLLIE_API_KEY,
      process.env.MOLLIE_TEST_MODE !== "false"
    )
  }

  throw new Error("Mollie API key not configured (no gateway config or MOLLIE_API_KEY env)")
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { id: mollieId } = req.body

    if (!mollieId) {
      return res.status(400).json({ error: "Missing Mollie ID" })
    }

    const logger = req.scope.resolve("logger")
    logger.info(`[Mollie Webhook] Received webhook for ID: ${mollieId}`)

    // Build Mollie client from gateway config
    const mollieClient = await buildMollieClient(req)

    // Detect if this is a payment (tr_xxx) or order (ord_xxx) ID
    const isPayment = mollieId.startsWith("tr_")
    let mollieStatus: string
    let mollieMethod: string
    let mollieAmount: any
    let mollieFailureReason: string | null = null
    let mollieCustomerEmail: string | null = null
    let mollieRawData: any = null

    if (isPayment) {
      const result = await mollieClient.getPayment(mollieId)
      if (!result.success) {
        logger.error(`[Mollie Webhook] Failed to fetch payment: ${result.error}`)
        return res.status(400).json({ error: "Failed to fetch Mollie payment status" })
      }
      mollieRawData = result.data
      mollieStatus = result.data.status
      mollieMethod = result.data.method || "unknown"
      mollieAmount = result.data.amount
      mollieFailureReason = result.data.failureReason || result.data.details?.failureReason || null
      mollieCustomerEmail = result.data.metadata?.customer_email || null
    } else {
      const result = await mollieClient.getOrder(mollieId)
      if (!result.success) {
        logger.error(`[Mollie Webhook] Failed to fetch order: ${result.error}`)
        return res.status(400).json({ error: "Failed to fetch Mollie order status" })
      }
      mollieRawData = result.data
      mollieStatus = result.data.status
      mollieMethod = result.data.method || "unknown"
      mollieAmount = result.data.amount
      mollieFailureReason = result.data.failureReason || null
      mollieCustomerEmail = result.data.metadata?.customer_email || null
    }

    const medusaStatus = mapMollieStatusToMedusa(mollieStatus)
    logger.info(
      `[Mollie Webhook] ${isPayment ? "Payment" : "Order"} ${mollieId}: ${mollieStatus} → ${medusaStatus}`
    )

    // Try to find and update the Medusa order
    try {
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      let order = null

      // Strategy 1: Find order by metadata via query.graph
      try {
        const { data: orders } = await query.graph({
          entity: "order",
          fields: ["id", "metadata"],
          filters: {},
          pagination: { order: { created_at: "DESC" }, skip: 0, take: 100 },
        })
        const metadataKey = isPayment ? "molliePaymentId" : "mollieOrderId"
        for (const o of orders || []) {
          if ((o as any).metadata?.[metadataKey] === mollieId) {
            order = o
            logger.info(`[Mollie Webhook] Found order ${(o as any).id} via metadata`)
            break
          }
        }
      } catch (e: any) {
        logger.warn(`[Mollie Webhook] Metadata search failed: ${e.message}`)
      }

      // Strategy 2: Find order via payment session data (fallback)
      if (!order) {
        try {
          const { data: allOrders } = await query.graph({
            entity: "order",
            fields: [
              "id", "metadata",
              "payment_collections.*",
              "payment_collections.payments.*",
            ],
            filters: {},
            pagination: { order: { created_at: "DESC" }, skip: 0, take: 50 },
          })

          for (const o of allOrders || []) {
            const payments = (o as any).payment_collections?.flatMap((pc: any) => pc.payments || []) || []
            for (const p of payments) {
              if (p.data?.molliePaymentId === mollieId || p.data?.mollieOrderId === mollieId) {
                order = o
                logger.info(`[Mollie Webhook] Found order ${(o as any).id} via payment session data (fallback)`)
                break
              }
            }
            if (order) break
          }
        } catch (e: any) {
          logger.warn(`[Mollie Webhook] Payment session fallback search failed: ${e.message}`)
        }
      }

      if (order) {
        const isFailed = ["failed", "canceled", "expired"].includes(mollieStatus)
        const activityEntry: any = {
          timestamp: new Date().toISOString(),
          event: "status_update",
          gateway: "mollie",
          payment_method: mollieMethod,
          status: medusaStatus === "captured" ? "success" : isFailed ? "failed" : "pending",
          amount: mollieAmount?.value,
          currency: mollieAmount?.currency,
          transaction_id: mollieId,
          webhook_event_type: `mollie.${mollieStatus}`,
          provider_raw_status: mollieStatus,
          customer_email: mollieCustomerEmail,
          detail: `Mollie ${isPayment ? "payment" : "order"} status: ${mollieStatus}`,
        }

        if (isFailed && mollieFailureReason) {
          activityEntry.error_code = mollieStatus
          activityEntry.decline_reason = mollieFailureReason
        }

        const existingLog = (order as any).metadata?.payment_activity_log || []
        const updatedMetadata: any = {
          ...(order as any).metadata,
          payment_activity_log: [...existingLog, activityEntry],
          mollieStatus,
          ...(isPayment ? { molliePaymentId: mollieId } : { mollieOrderId: mollieId }),
        }

        // Mark as captured when Mollie confirms payment
        if (mollieStatus === "paid" || mollieStatus === "completed") {
          updatedMetadata.payment_captured = true
          updatedMetadata.payment_captured_at = new Date().toISOString()
        }
        try {
          const { Pool } = require("pg")
          const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
          await pool.query(
            `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(updatedMetadata), (order as any).id]
          )
          await pool.end()
        } catch (dbErr: any) {
          logger.warn(`[Mollie Webhook] DB update failed: ${dbErr.message}`)
        }
        logger.info(`[Mollie Webhook] Order ${(order as any).id} updated with status: ${medusaStatus}`)

        if (mollieStatus === "paid" || mollieStatus === "completed") {
          try {
            const { ContainerRegistrationKeys: CRK } = await import("@medusajs/framework/utils")
            const eventBus = req.scope.resolve(CRK.EVENT_BUS)
            await eventBus.emit("payment.captured", { id: (order as any).id })
            logger.info(`[Mollie Webhook] Emitted payment.captured event for order ${(order as any).id}`)
          } catch (e: any) {
            logger.warn(`[Mollie Webhook] Failed to emit payment.captured: ${e.message}`)
          }
        }

        emitPaymentLog(logger, {
          provider: "mollie",
          event: `mollie.${mollieStatus}`,
          order_id: (order as any).id,
          transaction_id: mollieId,
          status: activityEntry.status,
          amount: parseFloat(mollieAmount?.value) || undefined,
          currency: mollieAmount?.currency,
          customer_email: mollieCustomerEmail || undefined,
          payment_method: mollieMethod,
          error_code: activityEntry.error_code,
          decline_reason: activityEntry.decline_reason,
          provider_raw_status: mollieStatus,
        })
      } else {
        logger.warn(`[Mollie Webhook] No Medusa order found for Mollie ID: ${mollieId}`)
        emitPaymentLog(logger, {
          provider: "mollie",
          event: `mollie.${mollieStatus}`,
          transaction_id: mollieId,
          status: "pending",
          payment_method: mollieMethod,
          provider_raw_status: mollieStatus,
          metadata: { order_not_found: true },
        })
      }
    } catch (orderErr: any) {
      logger.warn(`[Mollie Webhook] Order update failed: ${orderErr.message}`)
    }

    return res.status(200).json({ received: true })
  } catch (error: any) {
    const logger = req.scope.resolve("logger")
    logger.error(`[Mollie Webhook] Error: ${error.message}`)
    return res.status(500).json({ error: error.message })
  }
}

function mapMollieStatusToMedusa(mollieStatus: string): string {
  const statusMap: Record<string, string> = {
    created: "pending",
    authorized: "authorized",
    completed: "captured",
    paid: "captured",
    failed: "canceled",
    canceled: "canceled",
    expired: "canceled",
    refunded: "refunded",
  }
  return statusMap[mollieStatus] || "pending"
}
