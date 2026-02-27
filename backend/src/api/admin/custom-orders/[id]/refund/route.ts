// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const GATEWAY_CONFIG_MODULE = "gatewayConfig"

/**
 * POST /admin/custom-orders/:id/refund
 *
 * Refunds a payment for the given order.
 * Works for all payment providers: Mollie, Klarna, PayPal, Comgate, P24, Airwallex.
 *
 * Body: { amount: number (in cents), reason?: string }
 */
export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> => {
  try {
    const { id: orderId } = req.params
    const { amount, reason } = req.body as { amount: number; reason?: string }

    if (!amount || amount <= 0) {
      res.status(400).json({ error: "Valid amount is required" })
      return
    }

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
    const currency = order.currency_code?.toUpperCase() || "EUR"

    logger.info(
      `[Refund] Attempting refund for order ${orderId}, amount: ${amount}, provider: ${providerId}`
    )

    let refundResult: { success: boolean; refundId?: string; error?: string } = {
      success: false,
      error: "Refund not supported for this provider",
    }

    // Mollie refund
    if (providerId.includes("mollie")) {
      const mollieId = paymentData.molliePaymentId || paymentData.mollieOrderId
      if (!mollieId) {
        res.status(400).json({ error: "No Mollie payment ID found" })
        return
      }

      const { MollieApiClient } = await import(
        "../../../../modules/payment-mollie/api-client"
      )
      const gcService = req.scope.resolve(GATEWAY_CONFIG_MODULE)
      const configs = await gcService.listGatewayConfigs(
        { provider: "mollie", is_active: true },
        { take: 1 }
      )
      const config = configs[0]
      if (!config) {
        res.status(400).json({ error: "Mollie gateway not configured" })
        return
      }

      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      const client = new MollieApiClient(keys.api_key, !isLive)

      const isPayment = mollieId.startsWith("tr_")
      if (isPayment) {
        const result = await client.refundPayment(mollieId, {
          amount: { value: (amount / 100).toFixed(2), currency },
          description: reason || "Refund",
        })
        refundResult = {
          success: result.success,
          refundId: result.data?.id,
          error: result.error,
        }
      } else {
        const result = await client.refundOrder(mollieId, {
          amount: { value: (amount / 100).toFixed(2), currency },
          description: reason || "Refund",
        })
        refundResult = {
          success: result.success,
          refundId: result.data?.id,
          error: result.error,
        }
      }
    }
    // PayPal refund
    else if (providerId.includes("paypal")) {
      const captureId =
        paymentData.captureId ||
        order.metadata?.payment_paypal_capture_id ||
        paymentData.capture_id
      if (!captureId) {
        res.status(400).json({ error: "No PayPal capture ID found. Payment must be captured before refunding." })
        return
      }

      const { PayPalApiClient } = await import(
        "../../../../modules/payment-paypal/api-client"
      )
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
        // Support both generic key names (api_key/secret_key from admin form)
        // and PayPal-specific names (client_id/client_secret)
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

      const client = new PayPalApiClient({ client_id: clientId, client_secret: clientSecret, mode })

      try {
        // PayPal amounts are strings like "29.99", input amount is in cents
        const amountValue = (amount / 100).toFixed(2)
        const result = await client.refundCapture(captureId, {
          amount: { currency_code: currency, value: amountValue },
          note_to_payer: reason || "Refund",
        })
        refundResult = {
          success: true,
          refundId: result.id,
        }
      } catch (e: any) {
        refundResult = { success: false, error: e.message }
      }
    }
    // Klarna refund
    else if (providerId.includes("klarna")) {
      const klarnaOrderId = paymentData.klarnaOrderId
      if (!klarnaOrderId) {
        res.status(400).json({ error: "No Klarna order ID found" })
        return
      }

      const { KlarnaApiClient } = await import(
        "../../../../modules/payment-klarna/api-client"
      )
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
      const client = new KlarnaApiClient(keys.api_key, keys.secret_key, !isLive)

      const result = await client.refundOrder(klarnaOrderId, {
        refunded_amount: amount,
        description: reason || "Refund",
      })
      refundResult = {
        success: result.success,
        refundId: result.data?.refund_id,
        error: result.error,
      }
    }
    // Comgate refund
    else if (providerId.includes("comgate")) {
      const transId = paymentData.comgateTransId
      if (!transId) {
        res.status(400).json({ error: "No Comgate transaction ID found" })
        return
      }

      const { ComgateApiClient } = await import(
        "../../../../modules/payment-comgate/api-client"
      )
      const gcService = req.scope.resolve(GATEWAY_CONFIG_MODULE)
      const configs = await gcService.listGatewayConfigs(
        { provider: "comgate", is_active: true },
        { take: 1 }
      )
      const config = configs[0]
      if (!config) {
        res.status(400).json({ error: "Comgate gateway not configured" })
        return
      }

      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      const client = new ComgateApiClient(
        keys.merchant_id,
        keys.secret_key,
        !isLive
      )

      try {
        const result = await client.refund(transId, amount / 100, currency)
        refundResult = {
          success: result.success !== false,
          refundId: result.data?.refund_id || transId,
          error: result.error,
        }
      } catch (e: any) {
        refundResult = { success: false, error: e.message }
      }
    }
    // Przelewy24 refund
    else if (providerId.includes("przelewy24") || providerId.includes("p24")) {
      const p24SessionId = paymentData.p24SessionId || paymentData.p24Token
      if (!p24SessionId) {
        res.status(400).json({ error: "No Przelewy24 session ID found" })
        return
      }

      // P24 refund - basic implementation
      refundResult = {
        success: false,
        error:
          "Przelewy24 refunds must be initiated from the Przelewy24 dashboard",
      }
    }
    // Airwallex refund
    else if (providerId.includes("airwallex")) {
      const intentId = paymentData.airwallexPaymentIntentId || paymentData.intentId
      if (!intentId) {
        res.status(400).json({ error: "No Airwallex payment intent ID found" })
        return
      }

      const { AirwallexApiClient } = await import(
        "../../../../modules/payment-airwallex/api-client"
      )
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
      try {
        const client = new AirwallexApiClient(
          keys.api_key,      // Client ID
          keys.secret_key,   // API Key
          !isLive,
          logger,
          keys.account_id    // Account ID for org-level keys
        )
        await client.login()
        // Airwallex uses major units (same as Medusa) — no conversion needed
        const result = await client.createRefund({
          payment_intent_id: intentId,
          amount: amount > 0 ? amount : undefined,
          reason: reason || "Customer requested refund",
        })
        refundResult = {
          success: true,
          refundId: result.id,
        }
      } catch (e: any) {
        refundResult = { success: false, error: e.message }
      }
    }

    if (!refundResult.success) {
      res.status(400).json({ error: refundResult.error || "Refund failed" })
      return
    }

    // Update order metadata with refund info
    const existingRefundLog = order.metadata?.payment_refund_log || []
    const existingActivityLog = order.metadata?.payment_activity_log || []

    await orderModuleService.updateOrders(orderId, {
      metadata: {
        ...order.metadata,
        payment_refund_log: [
          ...existingRefundLog,
          {
            refund_id: refundResult.refundId,
            amount,
            reason: reason || null,
            provider: providerId,
            timestamp: new Date().toISOString(),
          },
        ],
        payment_activity_log: [
          ...existingActivityLog,
          {
            timestamp: new Date().toISOString(),
            event: "refund",
            gateway: providerId.replace("pp_", "").split("_")[0],
            status: "success",
            amount: (amount / 100).toFixed(2),
            currency,
            refund_id: refundResult.refundId,
            detail: reason || "Refund processed",
          },
        ],
      },
    })

    logger.info(
      `[Refund] Order ${orderId} refunded: ${refundResult.refundId}, amount: ${amount}`
    )

    res.json({
      success: true,
      refund_id: refundResult.refundId,
    })
  } catch (error: any) {
    const logger = req.scope.resolve("logger")
    logger.error(`[Refund] Error: ${error.message}`)
    res.status(500).json({ error: error.message })
  }
}
