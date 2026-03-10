// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ComgateApiClient } from "../../../modules/payment-comgate/api-client"
import { Client } from "pg"

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
      const orderModuleService = req.scope.resolve("order")
      if (orderModuleService) {
        // Search for orders with this transId in metadata
        const orders = await orderModuleService.listOrders({}, { take: 100 })
        const matchingOrder = (orders || []).find((o: any) =>
          o.metadata?.comgateTransId === transId
        )

        if (matchingOrder) {
          const activityEntry = {
            timestamp: new Date().toISOString(),
            event: "webhook_status_update",
            gateway: "comgate",
            payment_method: statusResult.data?.method || "unknown",
            status: medusaStatus,
            amount: statusResult.data?.price,
            currency: statusResult.data?.curr,
            transaction_id: transId,
            detail: `Comgate webhook: ${comgateStatus}`,
          }

          const existingLog = matchingOrder.metadata?.payment_activity_log || []
          await orderModuleService.updateOrders([{
            id: matchingOrder.id,
            metadata: {
              ...matchingOrder.metadata,
              payment_activity_log: [...existingLog, activityEntry],
              comgateStatus: comgateStatus,
            },
          }])

          logger.info(`[Comgate Webhook] Order ${matchingOrder.id} updated with status: ${medusaStatus}`)
        } else {
          logger.info(`[Comgate Webhook] No order found for transId ${transId} (may not be completed yet)`)
        }
      }
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
