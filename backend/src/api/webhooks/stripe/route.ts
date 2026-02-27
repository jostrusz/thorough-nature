// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
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
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const logger = req.scope.resolve("logger")
    const sig = req.headers["stripe-signature"] as string

    if (!sig) {
      logger.warn("[Stripe Webhook] Missing stripe-signature header")
      return res.status(400).json({ error: "Missing stripe-signature header" })
    }

    // Resolve webhook secret: DB → env fallback
    let webhookSecret: string | null = null
    let secretKey: string | null = null

    try {
      const gatewayConfigService = req.scope.resolve("gatewayConfig")
      const configs = await gatewayConfigService.listGatewayConfigs(
        { provider: "stripe", is_active: true },
        { take: 1 }
      )
      const config = configs[0]
      if (config) {
        const isLive = config.mode === "live"
        const keys = isLive ? config.live_keys : config.test_keys
        webhookSecret = keys?.secret_key || null  // DB "secret_key" = webhook secret
        secretKey = keys?.api_key || null
      }
    } catch {
      // Gateway config not available
    }

    // Env var fallback
    if (!webhookSecret) {
      webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || null
    }
    if (!secretKey) {
      secretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || null
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

    // Process only payment-related events
    const paymentIntent = event.data.object as any
    const paymentIntentId = paymentIntent?.id

    if (!paymentIntentId) {
      return res.status(200).json({ received: true })
    }

    // Find the order with this Stripe payment intent ID
    const orderModuleService = req.scope.resolve("orderModuleService")
    let order = null

    try {
      const orders = await orderModuleService.listOrders({
        filters: {
          "metadata.stripePaymentIntentId": paymentIntentId,
        },
      })
      order = orders[0] || null
    } catch {
      // Metadata filter may not be supported — try fallback
    }

    if (!order) {
      logger.warn(
        `[Stripe Webhook] No order found for payment intent: ${paymentIntentId}`
      )
      return res.status(200).json({ received: true })
    }

    // Build activity log entry
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

    // Update order metadata
    const existingLog = order.metadata?.payment_activity_log || []
    await orderModuleService.updateOrders(order.id, {
      metadata: {
        ...order.metadata,
        payment_activity_log: [...existingLog, activityEntry],
        stripePaymentIntentId: paymentIntentId,
        stripeStatus: event.type,
      },
    })

    logger.info(
      `[Stripe Webhook] Order ${order.id} updated with event: ${event.type}`
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
  }
  return eventMap[eventType] || "status_update"
}
