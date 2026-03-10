// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IPaymentModuleService } from "@medusajs/framework/types"
import { COMGATE_PROVIDER_ID } from "../../../modules/payment-comgate"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { transId: comgateTransactionId } = req.body

    if (!comgateTransactionId) {
      return res.status(400).json({ error: "Missing Comgate transaction ID" })
    }

    const paymentModuleService: IPaymentModuleService = req.scope.resolve(
      "paymentModuleService"
    )
    const orderModuleService = req.scope.resolve("orderModuleService")
    const logger = req.scope.resolve("logger")

    // Get the Comgate payment provider
    const comgateProvider = paymentModuleService.getProvider(COMGATE_PROVIDER_ID)

    if (!comgateProvider) {
      logger.error("[Comgate Webhook] Provider not found")
      return res.status(500).json({ error: "Provider not configured" })
    }

    // Verify transaction status with Comgate
    const verifyResult = await comgateProvider.getStatus(comgateTransactionId)

    if (!verifyResult.success) {
      logger.error(`[Comgate Webhook] Failed to verify transaction: ${verifyResult.error}`)
      return res.status(400).json({ error: "Failed to verify transaction" })
    }

    const transactionStatus = verifyResult.data
    const medusaStatus = mapComgateStatusToMedusa(transactionStatus.status)

    // Find the order with this Comgate transaction ID
    const orders = await orderModuleService.list({
      filters: {
        "metadata.comgateTransId": comgateTransactionId,
      },
    })

    if (!orders.length) {
      logger.warn(`[Comgate Webhook] No order found for transaction: ${comgateTransactionId}`)
      return res.status(200).send("OK")
    }

    const order = orders[0]
    const activityEntry = {
      timestamp: new Date().toISOString(),
      event: "status_update",
      gateway: "comgate",
      payment_method: transactionStatus.method || "card",
      status: medusaStatus === "authorized" ? "success" : "pending",
      amount: transactionStatus.amount,
      currency: transactionStatus.currency,
      transaction_id: comgateTransactionId,
      detail: `Comgate transaction status: ${transactionStatus.status}`,
    }

    // Update order metadata with activity log
    const existingLog = order.metadata?.payment_activity_log || []
    await orderModuleService.updateOrders(
      {
        id: order.id,
        metadata: {
          ...order.metadata,
          payment_activity_log: [...existingLog, activityEntry],
          comgateTransId: comgateTransactionId,
          comgateStatus: transactionStatus.status,
        },
      },
      { transactionManager: req.scope.resolve("manager") }
    )

    logger.info(
      `[Comgate Webhook] Order ${order.id} updated with status: ${medusaStatus}`
    )

    return res.status(200).send("OK")
  } catch (error: any) {
    const logger = req.scope.resolve("logger")
    logger.error(`[Comgate Webhook] Error: ${error.message}`)
    return res.status(200).send("OK")
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
