// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IPaymentModuleService } from "@medusajs/framework/types"
import { PRZELEWY24_PROVIDER_ID } from "../../../modules/payment-przelewy24"
import crypto from "crypto"
import { emitPaymentLog } from "../../../utils/payment-logger"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { orderId, sessionId, amount, currency, sign } = req.body

    if (!orderId || !sign) {
      return res.status(400).json({ error: "Missing required P24 webhook fields" })
    }

    const paymentModuleService: IPaymentModuleService = req.scope.resolve(
      "paymentModuleService"
    )
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

    // Find the order with this P24 session ID via direct DB query
    const { Pool } = require("pg")
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    const { rows: orders } = await pool.query(
      `SELECT id, metadata FROM "order" WHERE metadata->>'p24SessionId' = $1 LIMIT 1`,
      [sessionId]
    )

    if (!orders.length) {
      logger.warn(`[P24 Webhook] No order found for session: ${sessionId}`)
      await pool.end()
      return res.status(200).json({ received: true })
    }

    const order = orders[0]
    const meta = typeof order.metadata === "string"
      ? JSON.parse(order.metadata)
      : order.metadata || {}

    const isFailed = ["CANCELLED", "FAILED"].includes(transactionData.status)
    const activityEntry: any = {
      timestamp: new Date().toISOString(),
      event: "status_update",
      gateway: "przelewy24",
      payment_method: transactionData.method || "bank_transfer",
      status: medusaStatus === "captured" ? "success" : isFailed ? "failed" : "pending",
      amount: transactionData.amount || amount,
      currency: transactionData.currency || currency,
      transaction_id: orderId,
      webhook_event_type: `p24.${transactionData.status}`,
      provider_raw_status: transactionData.status,
      customer_email: transactionData.email || meta.customer_email || null,
      detail: `P24 transaction verified: ${transactionData.status}`,
    }

    if (isFailed) {
      activityEntry.error_code = transactionData.status
      activityEntry.decline_reason = transactionData.error || `P24 ${transactionData.status.toLowerCase()}`
    }

    // Update order metadata with activity log via direct DB query
    const existingLog = meta.payment_activity_log || []
    const updatedMetadata = {
      ...meta,
      payment_activity_log: [...existingLog, activityEntry],
      p24OrderId: orderId,
      p24SessionId: sessionId,
      p24Status: transactionData.status,
    }
    await pool.query(
      `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(updatedMetadata), order.id]
    )
    await pool.end()

    logger.info(
      `[P24 Webhook] Order ${order.id} verified with status: ${medusaStatus}`
    )

    emitPaymentLog(logger, {
      provider: "przelewy24",
      event: `p24.${transactionData.status}`,
      order_id: order.id,
      transaction_id: orderId,
      status: activityEntry.status,
      amount: transactionData.amount || amount,
      currency: transactionData.currency || currency,
      customer_email: activityEntry.customer_email,
      payment_method: activityEntry.payment_method,
      error_code: activityEntry.error_code,
      decline_reason: activityEntry.decline_reason,
      provider_raw_status: transactionData.status,
    })

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
