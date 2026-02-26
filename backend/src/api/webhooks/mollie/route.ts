// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IPaymentModuleService } from "@medusajs/framework/types"
import { MOLLIE_MODULE_NAME } from "../../../modules/payment-mollie"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { id: mollieId } = req.body

    if (!mollieId) {
      return res.status(400).json({ error: "Missing Mollie ID" })
    }

    const logger = req.scope.resolve("logger")
    logger.info(`[Mollie Webhook] Received webhook for ID: ${mollieId}`)

    const paymentModuleService: IPaymentModuleService = req.scope.resolve(
      "paymentModuleService"
    )
    const orderModuleService = req.scope.resolve("orderModuleService")

    // Get the Mollie payment provider
    const mollieProvider = paymentModuleService.getProvider(MOLLIE_MODULE_NAME)

    if (!mollieProvider) {
      logger.error("[Mollie Webhook] Provider not found")
      return res.status(500).json({ error: "Provider not configured" })
    }

    const mollieClient = await mollieProvider.getMollieClient()

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

    // Try to find the Medusa order with this Mollie ID in metadata
    // (Note: the order might not exist yet if the cart hasn't been completed)
    try {
      const metadataKey = isPayment ? "metadata.molliePaymentId" : "metadata.mollieOrderId"
      const orders = await orderModuleService.list({
        filters: {
          [metadataKey]: mollieId,
        },
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
        logger.warn(`[Mollie Webhook] No Medusa order found for Mollie ID: ${mollieId} (cart might not be completed yet)`)
      }
    } catch (orderErr: any) {
      // Order lookup/update failed — that's OK, log and return 200
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
