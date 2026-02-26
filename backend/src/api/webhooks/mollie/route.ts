// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MollieApiClient } from "../../../modules/payment-mollie/api-client"

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

    if (isPayment) {
      const result = await mollieClient.getPayment(mollieId)
      if (!result.success) {
        logger.error(`[Mollie Webhook] Failed to fetch payment: ${result.error}`)
        return res.status(400).json({ error: "Failed to fetch Mollie payment status" })
      }
      mollieStatus = result.data.status
      mollieMethod = result.data.method || "unknown"
      mollieAmount = result.data.amount
    } else {
      const result = await mollieClient.getOrder(mollieId)
      if (!result.success) {
        logger.error(`[Mollie Webhook] Failed to fetch order: ${result.error}`)
        return res.status(400).json({ error: "Failed to fetch Mollie order status" })
      }
      mollieStatus = result.data.status
      mollieMethod = result.data.method || "unknown"
      mollieAmount = result.data.amount
    }

    const medusaStatus = mapMollieStatusToMedusa(mollieStatus)
    logger.info(
      `[Mollie Webhook] ${isPayment ? "Payment" : "Order"} ${mollieId}: ${mollieStatus} → ${medusaStatus}`
    )

    // Try to find and update the Medusa order
    try {
      const orderModuleService = req.scope.resolve("orderModuleService")
      const metadataKey = isPayment ? "metadata.molliePaymentId" : "metadata.mollieOrderId"
      const orders = await orderModuleService.list({
        filters: { [metadataKey]: mollieId },
      })

      if (orders.length > 0) {
        const order = orders[0]
        const activityEntry = {
          timestamp: new Date().toISOString(),
          event: "status_update",
          gateway: "mollie",
          payment_method: mollieMethod,
          status: medusaStatus === "captured" ? "success" : "pending",
          amount: mollieAmount?.value,
          currency: mollieAmount?.currency,
          transaction_id: mollieId,
          detail: `Mollie ${isPayment ? "payment" : "order"} status: ${mollieStatus}`,
        }

        const existingLog = order.metadata?.payment_activity_log || []
        await orderModuleService.updateOrders(
          {
            id: order.id,
            metadata: {
              ...order.metadata,
              payment_activity_log: [...existingLog, activityEntry],
              mollieStatus,
              ...(isPayment ? { molliePaymentId: mollieId } : { mollieOrderId: mollieId }),
            },
          },
          { transactionManager: req.scope.resolve("manager") }
        )
        logger.info(`[Mollie Webhook] Order ${order.id} updated with status: ${medusaStatus}`)
      } else {
        logger.warn(`[Mollie Webhook] No Medusa order found for Mollie ID: ${mollieId}`)
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
