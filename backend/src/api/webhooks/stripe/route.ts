// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import Stripe from "stripe"
import { emitPaymentLog } from "../../../utils/payment-logger"

/**
 * POST /webhooks/stripe
 *
 * Handles Stripe webhook events with signature verification.
 * Dual credential resolution: DB gateway config → env vars fallback.
 *
 * Required Stripe Dashboard webhook events:
 * - payment_intent.succeeded
 * - payment_intent.payment_failed
 * - charge.refunded
 * - checkout.session.completed
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const logger = req.scope.resolve("logger")
    const sig = req.headers["stripe-signature"] as string

    if (!sig) {
      logger.warn("[Stripe Webhook] Missing stripe-signature header")
      return res.status(400).json({ error: "Missing stripe-signature header" })
    }

    // Get raw body for signature verification
    // Medusa's preserveRawBody may not work due to memoized json parser,
    // so we also accept a stringified body as last resort
    let rawBody: string | Buffer = (req as any).rawBody
    if (!rawBody || (typeof rawBody !== "string" && !Buffer.isBuffer(rawBody))) {
      // Fallback: reconstruct from parsed body (not ideal but better than failing)
      logger.warn("[Stripe Webhook] rawBody not available as Buffer, using JSON.stringify fallback")
      rawBody = JSON.stringify(req.body)
    }

    type GatewayCandidate = { webhookSecret: string; secretKey: string; displayName: string }
    const candidates: GatewayCandidate[] = []

    try {
      const gatewayConfigService = req.scope.resolve("gatewayConfig")
      const configs = await gatewayConfigService.listGatewayConfigs(
        { provider: "stripe", is_active: true },
        { take: 20, order: { priority: "ASC" } }
      )
      for (const config of configs) {
        const isLive = config.mode === "live"
        const keys = isLive ? config.live_keys : config.test_keys
        if (keys?.secret_key && keys?.api_key) {
          candidates.push({
            webhookSecret: keys.secret_key,
            secretKey: keys.api_key,
            displayName: `${config.display_name} (${isLive ? "LIVE" : "TEST"})`,
          })
        }
      }
    } catch (e: any) {
      logger.warn(`[Stripe Webhook] DI resolve failed: ${e.message}, trying direct DB`)
      try {
        const { Pool } = require("pg")
        const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
        const { rows } = await pool.query(
          `SELECT mode, live_keys, test_keys, display_name FROM gateway_config
           WHERE provider = 'stripe' AND is_active = true AND deleted_at IS NULL
           ORDER BY priority ASC LIMIT 20`
        )
        for (const config of rows) {
          const isLive = config.mode === "live"
          const keys = isLive ? config.live_keys : config.test_keys
          if (keys?.secret_key && keys?.api_key) {
            candidates.push({
              webhookSecret: keys.secret_key,
              secretKey: keys.api_key,
              displayName: `${config.display_name} (${isLive ? "LIVE" : "TEST"})`,
            })
          }
        }
        await pool.end()
      } catch (dbErr: any) {
        logger.error(`[Stripe Webhook] Direct DB query failed: ${dbErr.message}`)
      }
    }

    // Env var fallback (last resort)
    if (candidates.length === 0) {
      const whsec = process.env.STRIPE_WEBHOOK_SECRET
      const sk = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY
      if (whsec && sk) {
        logger.warn("[Stripe Webhook] ⚠️ Using env var fallback")
        candidates.push({ webhookSecret: whsec, secretKey: sk, displayName: "env vars" })
      }
    }

    if (candidates.length === 0) {
      logger.error("[Stripe Webhook] No webhook secret or secret key configured")
      return res.status(500).json({ error: "Stripe webhook not configured" })
    }

    // Try each gateway's webhook secret until one verifies successfully
    let event: Stripe.Event | null = null
    let matchedSecretKey: string | null = null

    for (const candidate of candidates) {
      try {
        const s = new Stripe(candidate.secretKey, { apiVersion: "2025-03-31.basil" as any })
        event = s.webhooks.constructEvent(rawBody, sig, candidate.webhookSecret)
        matchedSecretKey = candidate.secretKey
        logger.info(`[Stripe Webhook] ✓ Signature verified via gateway "${candidate.displayName}"`)
        break
      } catch {
        // Signature didn't match this gateway, try next
      }
    }

    if (!event || !matchedSecretKey) {
      const triedNames = candidates.map(c => c.displayName).join(", ")
      logger.error(`[Stripe Webhook] Signature verification failed against all ${candidates.length} gateway(s): ${triedNames}`)
      return res.status(400).json({ error: "Webhook signature verification failed" })
    }

    const stripe = new Stripe(matchedSecretKey, { apiVersion: "2025-03-31.basil" as any })

    logger.info(`[Stripe Webhook] Received event: ${event.type}, id: ${event.id}`)

    // For checkout.session.completed, resolve PaymentIntent from session
    let paymentIntentId: string | null = null

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any
      paymentIntentId = session.payment_intent as string || null
      logger.info(`[Stripe Webhook] Checkout Session completed: ${session.id}, PI: ${paymentIntentId}`)
      if (!paymentIntentId) {
        return res.status(200).json({ received: true })
      }
    } else {
      // Process payment_intent / charge events
      const paymentIntent = event.data.object as any
      paymentIntentId = paymentIntent?.id
    }

    if (!paymentIntentId) {
      return res.status(200).json({ received: true })
    }

    // Find the order with this Stripe payment intent ID via query.graph
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    let order = null

    try {
      const { data: orders } = await query.graph({
        entity: "order",
        fields: ["id", "metadata"],
        filters: {},
        pagination: { order: { created_at: "DESC" }, skip: 0, take: 100 },
      })
      for (const o of orders || []) {
        if ((o as any).metadata?.stripePaymentIntentId === paymentIntentId) {
          order = o
          break
        }
      }
    } catch (e: any) {
      logger.warn(`[Stripe Webhook] Order search failed: ${e.message}`)
    }

    if (!order) {
      logger.warn(
        `[Stripe Webhook] No order found for payment intent: ${paymentIntentId}`
      )
      emitPaymentLog(logger, {
        provider: "stripe",
        event: event.type,
        transaction_id: paymentIntentId,
        status: "pending",
        customer_email: (event.data.object as any).metadata?.customer_email,
        payment_method: (event.data.object as any).payment_method_types?.[0],
        metadata: { order_not_found: true },
      })
      return res.status(200).json({ received: true })
    }

    // Build activity log entry with failure details
    const paymentIntent = event.data.object as any
    const lastError = paymentIntent.last_payment_error
    const activityEntry: any = {
      timestamp: new Date().toISOString(),
      event: mapStripeEventToActivity(event.type),
      gateway: "stripe",
      payment_method: paymentIntent.payment_method_types?.[0] || "card",
      status: event.type === "payment_intent.succeeded" ? "success"
        : event.type === "charge.refunded" ? "refunded"
        : "failed",
      amount: paymentIntent.amount ? paymentIntent.amount / 100 : null,
      currency: paymentIntent.currency?.toUpperCase(),
      transaction_id: paymentIntentId,
      webhook_event_type: event.type,
      provider_raw_status: paymentIntent.status,
      customer_email: paymentIntent.metadata?.customer_email || paymentIntent.receipt_email || null,
      detail: `Stripe event: ${event.type}`,
    }

    // Extract failure details for failed payments
    if (event.type === "payment_intent.payment_failed" && lastError) {
      activityEntry.error_code = lastError.decline_code || lastError.code || "unknown"
      activityEntry.decline_reason = lastError.message || "Payment failed"
      activityEntry.metadata = {
        payment_method_type: lastError.payment_method?.type,
        failure_reason: paymentIntent.cancellation_reason,
        charge_id: lastError.charge,
      }
    }

    // Update order metadata via direct DB query (orderModuleService not available in webhook context)
    const existingLog = (order as any).metadata?.payment_activity_log || []
    const updatedMetadata: any = {
      ...(order as any).metadata,
      payment_activity_log: [...existingLog, activityEntry],
      stripePaymentIntentId: paymentIntentId,
      stripeStatus: event.type,
    }

    // Mark as captured when Stripe confirms payment success
    if (event.type === "payment_intent.succeeded") {
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
      logger.error(`[Stripe Webhook] DB update failed: ${dbErr.message}`)
    }

    logger.info(
      `[Stripe Webhook] Order ${(order as any).id} updated with event: ${event.type}`
    )

    // Emit custom event when payment is captured so subscribers can react (e-book delivery etc.)
    if (event.type === "payment_intent.succeeded") {
      try {
        const { ContainerRegistrationKeys } = await import("@medusajs/framework/utils")
        const eventBus = req.scope.resolve(ContainerRegistrationKeys.EVENT_BUS)
        await eventBus.emit("payment.captured", { id: (order as any).id })
        logger.info(`[Stripe Webhook] Emitted payment.captured event for order ${(order as any).id}`)
      } catch (e: any) {
        logger.warn(`[Stripe Webhook] Failed to emit payment.captured: ${e.message}`)
      }
    }

    // Structured log for Railway filtering
    emitPaymentLog(logger, {
      provider: "stripe",
      event: event.type,
      order_id: (order as any).id,
      transaction_id: paymentIntentId,
      status: activityEntry.status === "refunded" ? "success" : activityEntry.status,
      amount: activityEntry.amount,
      currency: activityEntry.currency,
      customer_email: activityEntry.customer_email,
      payment_method: activityEntry.payment_method,
      error_code: activityEntry.error_code,
      decline_reason: activityEntry.decline_reason,
      provider_raw_status: paymentIntent.status,
    })

    return res.status(200).json({ received: true })
  } catch (error: any) {
    const logger = req.scope.resolve("logger")
    logger.error(`[Stripe Webhook] Error: ${error.message}`)
    return res.status(200).json({ error: error.message })
  }
}

function mapStripeEventToActivity(eventType: string): string {
  const eventMap: Record<string, string> = {
    "payment_intent.succeeded": "capture",
    "payment_intent.payment_failed": "payment_failed",
    "charge.refunded": "refund",
    "checkout.session.completed": "capture",
  }
  return eventMap[eventType] || "status_update"
}
