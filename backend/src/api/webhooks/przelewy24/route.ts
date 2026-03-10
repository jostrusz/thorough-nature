// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IPaymentModuleService } from "@medusajs/framework/types"
import { PRZELEWY24_PROVIDER_ID } from "../../../modules/payment-przelewy24"
import crypto from "crypto"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { orderId, sessionId, amount, currency, sign } = req.body

    if (!orderId || !sign) {
      return res.status(400).json({ error: "Missing required P24 webhook fields" })
    }

    const paymentModuleService: IPaymentModuleService = req.scope.resolve(
      "paymentModuleService"
    )
    const orderModuleService = req.scope.resolve("orderModuleService")
    const configService = req.scope.resolve("configService")
    const logger = req.scope.resolve("logger")

    // Get the Przelewy24 payment provider
    const p24Provider = paymentModuleService.getProvider(PRZELEWY24_PROVIDER_ID)

    if (!p24Provider) {
      logger.error("[P24 Webhook] Provider not found")
      return res.status(500).json({ error: "Provider not configured" })
    }

    // Verify signature using SHA-384
    const p24Secret = configService.get("PRZELEWY24_SECRET_KEY")
    const signString = `${orderId}|${sessionId}|${amount}|${currency}|${p24Secret}`
    const computedSign = crypto.createHash("sha384").update(signString).digest("hex")

    if (sign.toLowerCase() !== computedSign.toLowerCase()) {
      logger.warn("[P24 Webhook] Invalid signature")
      return res.status(400).json({ error: "Invalid signature" })
    }

    // Verify transaction with P24
    const verifyResult = await p24Provider.verifyTransaction({
      orderId,
      sessionId,
      amount,
      currency,
    })

    if (!verifyResult.success) {
      logger.error(`[P24 Webhook] Failed to verify transaction: ${verifyResult.error}`)
      return res.status(400).json({ error: "Transaction verification failed" })
    }

    const transactionData = verifyResult.data
    const medusaStatus = mapP24StatusToMedusa(transactionData.status)

    // Find the order with this P24 session ID
    const orders = await orderModuleService.list({
      filters: {
        "metadata.p24SessionId": sessionId,
      },
    })

    if (!orders.length) {
      logger.warn(`[P24 Webhook] No order found for session: ${sessionId}`)
      return res.status(200).json({ received: true })
    }

    const order = orders[0]
    const activityEntry = {
      timestamp: new Date().toISOString(),
      event: "status_update",
      gateway: "przelewy24",
      payment_method: transactionData.method || "bank_transfer",
      status: medusaStatus === "captured" ? "success" : "pending",
      amount: transactionData.amount || amount,
      currency: transactionData.currency || currency,
      transaction_id: orderId,
      detail: `P24 transaction verified: ${transactionData.status}`,
    }

    // Update order metadata with activity log
    const existingLog = order.metadata?.payment_activity_log || []
    await orderModuleService.updateOrders(
      {
        id: order.id,
        metadata: {
          ...order.metadata,
          payment_activity_log: [...existingLog, activityEntry],
          p24OrderId: orderId,
          p24SessionId: sessionId,
          p24Status: transactionData.status,
        },
      },
      { transactionManager: req.scope.resolve("manager") }
    )

    logger.info(
      `[P24 Webhook] Order ${order.id} verified with status: ${medusaStatus}`
    )

    return res.status(200).json({ received: true })
  } catch (error: any) {
    const logger = req.scope.resolve("logger")
    logger.error(`[P24 Webhook] Error: ${error.message}`)
    return res.status(200).json({ error: error.message })
  }
}

function mapP24StatusToMedusa(p24Status: string): string {
  const statusMap: Record<string, string> = {
    COMPLETED: "captured",
    AUTHORIZED: "authorized",
    PENDING: "pending",
    CANCELLED: "canceled",
    FAILED: "canceled",
    REFUNDED: "refunded",
  }
  return statusMap[p24Status] || "pending"
}
