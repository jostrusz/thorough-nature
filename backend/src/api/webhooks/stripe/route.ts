// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import Stripe from "stripe"

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

    // Resolve webhook secret from gateway_config DB table (direct query)
    let webhookSecret: string | null = null
    let secretKey: string | null = null

    try {
      // Try DI container first (works in request scope)
      const gatewayConfigService = req.scope.resolve("gatewayConfig")
      const configs = await gatewayConfigService.listGatewayConfigs(
        { provider: "stripe", is_active: true },
        { take: 1, order: { priority: "ASC" } }
      )
      const config = configs[0]
      if (config) {
        const isLive = config.mode === "live"
        const keys = isLive ? config.live_keys : config.test_keys
        webhookSecret = keys?.secret_key || null
        secretKey = keys?.api_key || null
        logger.info(`[Stripe Webhook] ✓ Using ${isLive ? "LIVE" : "TEST"} keys from admin gateway "${config.display_name}"`)
      }
    } catch (e: any) {
      logger.warn(`[Stripe Webhook] DI resolve failed: ${e.message}, trying direct DB`)
      // Fallback: direct DB query
      try {
        const { Pool } = require("pg")
        const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
        const { rows } = await pool.query(
          `SELECT mode, live_keys, test_keys, display_name FROM gateway_config
           WHERE provider = 'stripe' AND is_active = true AND deleted_at IS NULL
           ORDER BY priority ASC LIMIT 1`
        )
        if (rows[0]) {
          const config = rows[0]
          const isLive = config.mode === "live"
          const keys = isLive ? config.live_keys : config.test_keys
          webhookSecret = keys?.secret_key || null
          secretKey = keys?.api_key || null
          logger.info(`[Stripe Webhook] ✓ Using ${isLive ? "LIVE" : "TEST"} keys from DB gateway "${config.display_name}"`)
        }
        await pool.end()
      } catch (dbErr: any) {
        logger.error(`[Stripe Webhook] Direct DB query failed: ${dbErr.message}`)
      }
    }

    // Env var fallback (last resort)
    if (!webhookSecret) {
      webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || null
      if (webhookSecret) logger.warn("[Stripe Webhook] ⚠️ Using STRIPE_WEBHOOK_SECRET from env vars")
    }
    if (!secretKey) {
      secretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || null
      if (secretKey) logger.warn("[Stripe Webhook] ⚠️ Using STRIPE_SECRET_KEY from env vars")
    }

    if (!webhookSecret || !secretKey) {
      logger.error("[Stripe Webhook] No webhook secret or secret key configured")
      return res.status(500).json({ error: "Stripe webhook not configured" })
    }

    // Verify signature using raw body
    const stripe = new Stripe(secretKey, { apiVersion: "2025-03-31.basil" as any })
    let event: Stripe.Event

    try {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body)
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
    } catch (err: any) {
      logger.error(`[Stripe Webhook] Signature verification failed: ${err.message}`)
      return res.status(400).json({ error: `Webhook signature verification failed` })
    }

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
      return res.status(200).json({ received: true })
    }

    // Build activity log entry
    const paymentIntent = event.data.object as any
    const activityEntry = {
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
      detail: `Stripe event: ${event.type}`,
    }

    // Update order metadata via direct DB query (orderModuleService not available in webhook context)
    const existingLog = (order as any).metadata?.payment_activity_log || []
    const updatedMetadata = {
      ...(order as any).metadata,
      payment_activity_log: [...existingLog, activityEntry],
      stripePaymentIntentId: paymentIntentId,
      stripeStatus: event.type,
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
