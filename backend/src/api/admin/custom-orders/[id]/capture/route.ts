// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PayPalApiClient } from "../../../../../modules/payment-paypal/api-client"
import { KlarnaApiClient } from "../../../../../modules/payment-klarna/api-client"
import { AirwallexApiClient } from "../../../../../modules/payment-airwallex/api-client"

/**
 * POST /admin/custom-orders/:id/capture
 *
 * Captures a payment for the given order.
 * Works for all payment providers: Mollie, Klarna, PayPal, Stripe, etc.
 *
 * Optional body params for tracking (used when capturing with shipment info):
 *   tracking_number: string
 *   tracking_carrier: string
 *   tracking_url: string
 *
 * PayPal: captures authorization via PayPal Payments API, then sends tracking
 * Klarna: calls Klarna Order Management API to capture with shipping_info
 * Mollie: Mollie auto-captures most payments, but this endpoint can be used for orders API
 */
export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> => {
  try {
    const { id: orderId } = req.params
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const orderModuleService = req.scope.resolve(Modules.ORDER)
    const logger = req.scope.resolve("logger")

    // Optional tracking info from request body
    const {
      tracking_number: trackingNumber,
      tracking_carrier: trackingCarrier,
      tracking_url: trackingUrl,
    } = (req.body || {}) as any

    // Fetch order with payments
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
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
    if (
      providerId.includes("paypal") &&
      (paymentData.authorizationId || paymentData.paypalOrderId)
    ) {
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
        clientId = keys?.client_id || keys?.api_key
        clientSecret = keys?.client_secret || keys?.secret_key
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

      const client = new PayPalApiClient({
        client_id: clientId,
        client_secret: clientSecret,
        mode,
      })

      const currency = order.currency_code?.toUpperCase() || "EUR"
      const amountValue = Number(order.total).toFixed(2)

      let captureId: string

      if (paymentData.authorizationId) {
        // Capture the authorization
        const result = await client.captureAuthorization(
          paymentData.authorizationId,
          { currency_code: currency, value: amountValue }
        )
        captureId = result.id
      } else if (paymentData.paypalOrderId) {
        // Capture order directly (intent=CAPTURE fallback)
        const result = await client.captureOrder(paymentData.paypalOrderId)
        captureId =
          result.purchase_units?.[0]?.payments?.captures?.[0]?.id || result.id
      }

      captureResult = {
        provider: "paypal",
        capture_id: captureId,
        status: "captured",
      }

      // Send tracking to PayPal if tracking info provided
      if (trackingNumber && captureId && paymentData.paypalOrderId) {
        try {
          await client.addTracking(
            paymentData.paypalOrderId,
            captureId,
            trackingNumber,
            (trackingCarrier || "OTHER").toUpperCase(),
            true
          )
          captureResult.tracking_sent = true
          logger.info(
            `[Capture] PayPal tracking sent: ${trackingNumber} for order ${orderId}`
          )
        } catch (trackErr: any) {
          logger.error(
            `[Capture] PayPal tracking failed: ${trackErr.message}`
          )
          captureResult.tracking_error = trackErr.message
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

      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys

      let apiKey = keys?.api_key
      let secretKey = keys?.secret_key
      if (!apiKey) apiKey = process.env.KLARNA_API_KEY
      if (!secretKey) secretKey = process.env.KLARNA_SECRET_KEY

      const client = new KlarnaApiClient(apiKey, secretKey, !isLive)

      // Build capture data with optional shipping_info
      // order.total is in major units (e.g. 99 = €99.00); Klarna needs minor units (cents)
      const captureData: any = {
        captured_amount: Math.round(Number(order.total) * 100),
        description: `Capture for order ${order.display_id || orderId}`,
      }

      // Include shipping_info in Klarna capture if tracking provided
      if (trackingNumber) {
        captureData.shipping_info = [
          {
            shipping_company: trackingCarrier || undefined,
            tracking_number: trackingNumber,
            tracking_uri: trackingUrl || undefined,
          },
        ]
      }

      const result = await client.captureOrder(
        paymentData.klarnaOrderId,
        captureData
      )

      if (!result.success) {
        res
          .status(400)
          .json({ error: result.error || "Klarna capture failed" })
        return
      }

      captureResult = {
        provider: "klarna",
        capture_id: result.data?.capture_id,
        status: "captured",
        tracking_sent: !!trackingNumber,
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
    // Airwallex capture
    else if (providerId.includes("airwallex") && paymentData.intentId) {
      const GATEWAY_CONFIG_MODULE = "gatewayConfig"
      const gcService = req.scope.resolve(GATEWAY_CONFIG_MODULE)
      const configs = await gcService.listGatewayConfigs(
        { provider: "airwallex", is_active: true },
        { take: 1 }
      )
      const config = configs[0]
      if (!config) {
        res.status(400).json({ error: "Airwallex gateway not configured" })
        return
      }

      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      const client = new AirwallexApiClient(
        keys.api_key,
        keys.secret_key,
        !isLive,
        logger,
        keys.account_id
      )
      await client.login()

      // Airwallex uses major units (same as order.total, no conversion needed)
      const result = await client.capturePaymentIntent(paymentData.intentId, {
        amount: Number(order.total),
      })

      captureResult = {
        provider: "airwallex",
        capture_id: result.id,
        status: "captured",
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
    const captureLogEntry: any = {
      timestamp: new Date().toISOString(),
      event: "capture",
      gateway: captureResult.provider,
      status: "success",
      amount: order.total,
      currency: order.currency_code,
      capture_id: captureResult.capture_id,
      detail: captureResult.detail || `Captured via ${captureResult.provider}`,
    }

    // Add tracking info to log if sent
    if (captureResult.tracking_sent && trackingNumber) {
      captureLogEntry.tracking_number = trackingNumber
      captureLogEntry.tracking_carrier = trackingCarrier
    }

    const updatedMetadata: any = {
      ...order.metadata,
      payment_activity_log: [...existingLog, captureLogEntry],
      payment_captured: true,
      payment_captured_at: new Date().toISOString(),
    }

    // Store capture_id in metadata for later tracking use
    if (captureResult.capture_id) {
      if (captureResult.provider === "paypal") {
        updatedMetadata.paypalCaptureId = captureResult.capture_id
      } else if (captureResult.provider === "klarna") {
        updatedMetadata.klarnaCaptureId = captureResult.capture_id
      } else if (captureResult.provider === "airwallex") {
        updatedMetadata.airwallexCaptureId = captureResult.capture_id
      }
    }

    await orderModuleService.updateOrders(orderId, {
      metadata: updatedMetadata,
    })

    // Also update Medusa's internal payment status so admin shows "Paid"
    try {
      const paymentModuleService = req.scope.resolve(Modules.PAYMENT) as any
      if (payment.id && payment.captured_at == null) {
        await paymentModuleService.capturePayment({
          payment_id: payment.id,
          amount: Number(order.total),
        })
        logger.info(
          `[Capture] Medusa payment ${payment.id} marked as captured for order ${orderId}`
        )
      }
    } catch (paymentErr: any) {
      // Non-fatal: provider capture succeeded, just internal status update failed
      logger.warn(
        `[Capture] Could not update Medusa payment status for order ${orderId}: ${paymentErr.message}`
      )
    }

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
