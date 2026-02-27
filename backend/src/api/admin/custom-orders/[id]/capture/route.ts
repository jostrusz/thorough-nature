// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * POST /admin/custom-orders/:id/capture
 *
 * Captures a payment for the given order.
 * Works for all payment providers: Mollie, Klarna, PayPal, Stripe, etc.
 *
 * PayPal: captures authorization via PayPal Payments API
 * Klarna: calls Klarna Order Management API to capture the authorized order
 * Mollie: Mollie auto-captures most payments, but this endpoint can be used for orders API
 */
export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> => {
  try {
    const { id: orderId } = req.params
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const orderModuleService = req.scope.resolve("orderModuleService")
    const logger = req.scope.resolve("logger")

    // Fetch order with payments
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "metadata",
        "total",
        "currency_code",
        "payment_collections.*",
        "payment_collections.payments.*",
      ],
      filters: { id: orderId },
    })

    const order = orders?.[0]
    if (!order) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    const payments =
      order.payment_collections?.flatMap((pc: any) => pc.payments || []) || []

    if (!payments.length) {
      res.status(400).json({ error: "No payment found for this order" })
      return
    }

    const payment = payments[0]
    const paymentData = payment.data || {}
    const providerId = payment.provider_id || ""

    logger.info(
      `[Capture] Attempting capture for order ${orderId}, provider: ${providerId}`
    )

    let captureResult: any = null

    // PayPal capture
    if (providerId.includes("paypal") && (paymentData.authorizationId || paymentData.paypalOrderId)) {
      const GATEWAY_CONFIG_MODULE = "gatewayConfig"
      const gcService = req.scope.resolve(GATEWAY_CONFIG_MODULE)
      const configs = await gcService.listGatewayConfigs(
        { provider: "paypal", is_active: true },
        { take: 1 }
      )
      const config = configs[0]

      let clientId: string | undefined
      let clientSecret: string | undefined
      let mode: "live" | "test" = "test"

      if (config) {
        const isLive = config.mode === "live"
        const keys = isLive ? config.live_keys : config.test_keys
        clientId = keys?.client_id
        clientSecret = keys?.client_secret
        mode = isLive ? "live" : "test"
      } else {
        clientId = process.env.PAYPAL_CLIENT_ID
        clientSecret = process.env.PAYPAL_CLIENT_SECRET
        mode = process.env.PAYPAL_MODE === "live" ? "live" : "test"
      }

      if (!clientId || !clientSecret) {
        res.status(400).json({ error: "PayPal gateway not configured" })
        return
      }

      const { PayPalApiClient } = await import(
        "../../../../modules/payment-paypal/api-client"
      )
      const client = new PayPalApiClient({ client_id: clientId, client_secret: clientSecret, mode })

      const currency = order.currency_code?.toUpperCase() || "EUR"
      const amountValue = Number(order.total).toFixed(2)

      if (paymentData.authorizationId) {
        // Capture the authorization
        const result = await client.captureAuthorization(
          paymentData.authorizationId,
          { currency_code: currency, value: amountValue }
        )
        captureResult = {
          provider: "paypal",
          capture_id: result.id,
          status: "captured",
        }
      } else if (paymentData.paypalOrderId) {
        // Capture order directly (intent=CAPTURE fallback)
        const result = await client.captureOrder(paymentData.paypalOrderId)
        const captureId = result.purchase_units?.[0]?.payments?.captures?.[0]?.id
        captureResult = {
          provider: "paypal",
          capture_id: captureId || result.id,
          status: "captured",
        }
      }
    }
    // Klarna capture
    else if (providerId.includes("klarna") && paymentData.klarnaOrderId) {
      const GATEWAY_CONFIG_MODULE = "gatewayConfig"
      const gcService = req.scope.resolve(GATEWAY_CONFIG_MODULE)
      const configs = await gcService.listGatewayConfigs(
        { provider: "klarna", is_active: true },
        { take: 1 }
      )
      const config = configs[0]
      if (!config) {
        res.status(400).json({ error: "Klarna gateway not configured" })
        return
      }

      const { KlarnaApiClient } = await import(
        "../../../../modules/payment-klarna/api-client"
      )
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      const client = new KlarnaApiClient(keys.api_key, keys.secret_key, !isLive)

      const result = await client.captureOrder(paymentData.klarnaOrderId, {
        captured_amount: order.total,
        description: `Capture for order ${orderId}`,
      })

      if (!result.success) {
        res.status(400).json({ error: result.error || "Klarna capture failed" })
        return
      }

      captureResult = {
        provider: "klarna",
        capture_id: result.data?.capture_id,
        status: "captured",
      }
    }
    // Mollie capture (for Orders API)
    else if (
      providerId.includes("mollie") &&
      (paymentData.molliePaymentId || paymentData.mollieOrderId)
    ) {
      // Mollie auto-captures payments — this is informational
      captureResult = {
        provider: "mollie",
        status: "auto_captured",
        detail: "Mollie payments are auto-captured on paid status",
      }
    }
    // Stripe capture
    else if (providerId.includes("stripe") && paymentData.client_secret) {
      captureResult = {
        provider: "stripe",
        status: "auto_captured",
        detail: "Stripe payments are auto-captured via confirmCardPayment",
      }
    }
    // Generic fallback
    else {
      res.status(400).json({
        error: `Capture not implemented for provider: ${providerId}`,
      })
      return
    }

    // Update order metadata with capture info
    const existingLog = order.metadata?.payment_activity_log || []
    await orderModuleService.updateOrders(orderId, {
      metadata: {
        ...order.metadata,
        payment_activity_log: [
          ...existingLog,
          {
            timestamp: new Date().toISOString(),
            event: "capture",
            gateway: captureResult.provider,
            status: "success",
            amount: order.total,
            currency: order.currency_code,
            capture_id: captureResult.capture_id,
            detail: captureResult.detail || `Captured via ${captureResult.provider}`,
          },
        ],
        payment_captured: true,
        payment_captured_at: new Date().toISOString(),
      },
    })

    logger.info(
      `[Capture] Order ${orderId} captured successfully via ${captureResult.provider}`
    )

    res.json({
      success: true,
      ...captureResult,
    })
  } catch (error: any) {
    const logger = req.scope.resolve("logger")
    logger.error(`[Capture] Error: ${error.message}`)
    res.status(500).json({ error: error.message })
  }
}
