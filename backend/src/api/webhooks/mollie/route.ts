// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IPaymentModuleService } from "@medusajs/framework/types"
import { MOLLIE_MODULE_NAME } from "../../../modules/payment-mollie"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { id: mollieOrderId } = req.body

    if (!mollieOrderId) {
      return res.status(400).json({ error: "Missing Mollie order ID" })
    }

    const paymentModuleService: IPaymentModuleService = req.scope.resolve(
      "paymentModuleService"
    )
    const orderModuleService = req.scope.resolve("orderModuleService")
    const logger = req.scope.resolve("logger")

    // Get the Mollie payment provider
    const mollieProvider = paymentModuleService.getProvider(MOLLIE_MODULE_NAME)

    if (!mollieProvider) {
      logger.error("[Mollie Webhook] Provider not found")
      return res.status(500).json({ error: "Provider not configured" })
    }

    // Query Mollie API to get current order status
    const mollieClient = await mollieProvider.getMollieClient()
    const statusResult = await mollieClient.getOrder(mollieOrderId)

    if (!statusResult.success) {
      logger.error(`[Mollie Webhook] Failed to fetch order: ${statusResult.error}`)
      return res.status(400).json({ error: "Failed to fetch Mollie order status" })
    }

    const mollieOrder = statusResult.data
    const medusaStatus = mapMollieStatusToMedusa(mollieOrder.status)

    // Find the order with this Mollie ID in its session data
    const orders = await orderModuleService.list({
      filters: {
        "metadata.mollieOrderId": mollieOrderId,
      },
    })

    if (!orders.length) {
      logger.warn(`[Mollie Webhook] No order found for Mollie ID: ${mollieOrderId}`)
      return res.status(200).json({ received: true })
    }

    const order = orders[0]
    const activityEntry = {
      timestamp: new Date().toISOString(),
      event: "status_update",
      gateway: "mollie",
      payment_method: mollieOrder.method || "unknown",
      status: medusaStatus === "authorized" ? "success" : "pending",
      amount: mollieOrder.amount?.value,
      currency: mollieOrder.amount?.currency,
      transaction_id: mollieOrderId,
      detail: `Mollie order status: ${mollieOrder.status}`,
    }

    // Update order metadata with activity log
    const existingLog = order.metadata?.payment_activity_log || []
    await orderModuleService.updateOrders(
      {
        id: order.id,
        metadata: {
          ...order.metadata,
          payment_activity_log: [...existingLog, activityEntry],
          mollieOrderId,
          mollieStatus: mollieOrder.status,
        },
      },
      { transactionManager: req.scope.resolve("manager") }
    )

    logger.info(
      `[Mollie Webhook] Order ${order.id} updated with status: ${medusaStatus}`
    )

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
