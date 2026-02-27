// @ts-nocheck
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { PayPalApiClient } from "./api-client"

type Options = {
  clientId?: string
  clientSecret?: string
  mode?: "live" | "test"
}

type InjectedDependencies = {
  logger: any
  gatewayConfig?: any
}

/**
 * Maps PayPal order/payment statuses to Medusa payment session statuses
 */
function mapPayPalStatusToMedusa(status: string): PaymentSessionStatus {
  switch (status) {
    case "COMPLETED":
      return PaymentSessionStatus.CAPTURED
    case "APPROVED":
      return PaymentSessionStatus.AUTHORIZED
    case "CREATED":
      return PaymentSessionStatus.PENDING
    case "SAVED":
      return PaymentSessionStatus.PENDING
    case "VOIDED":
      return PaymentSessionStatus.CANCELED
    case "PAYER_ACTION_REQUIRED":
      return PaymentSessionStatus.REQUIRES_MORE
    default:
      return PaymentSessionStatus.PENDING
  }
}

/**
 * Format amount to PayPal string format.
 * PayPal expects "29.99" (string), NOT 2999 (integer minor units).
 * Medusa v2 sends amounts in MAJOR units (e.g., 29.99).
 */
function formatPayPalAmount(amount: number): string {
  return Number(amount).toFixed(2)
}

/**
 * PayPal payment provider service for Medusa v2
 * Extends AbstractPaymentProvider following the Mollie/Klarna pattern.
 *
 * Flow:
 *   initiatePayment → creates PayPal order → frontend shows PayPal buttons
 *   → customer approves → onApprove sends authorization
 *   → authorizePayment → verifies authorization
 *   → capturePayment → captures authorization (after shipment)
 *
 * Authorization valid for 29 days, capture after shipment.
 *
 * API credentials come from:
 *   1. Gateway config module (admin-configured in DB) — preferred
 *   2. Provider options / env vars — fallback
 */
class PayPalPaymentProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "paypal"

  protected logger_: any
  protected options_: Options
  protected client_: PayPalApiClient | null = null
  protected gatewayConfigService_: any = null

  constructor(container: InjectedDependencies, options: Options) {
    super(container, options)
    this.logger_ = container.logger || console
    this.options_ = options || {}

    // Try to resolve gateway config module from container (property injection)
    try {
      this.gatewayConfigService_ = (container as any).gatewayConfig || null
    } catch {
      this.gatewayConfigService_ = null
    }

    this.logger_.info(
      `[PayPal] Provider initialized. Gateway config: ${this.gatewayConfigService_ ? "available" : "not available"}`
    )
  }

  /**
   * Build or return the PayPal API client.
   * Tries gateway config (admin DB) first, then falls back to options/env vars.
   */
  private async getPayPalClient(): Promise<PayPalApiClient> {
    if (this.client_) return this.client_

    // 1. Try gateway config from database (admin-configured)
    if (this.gatewayConfigService_) {
      try {
        const configs = await this.gatewayConfigService_.listGatewayConfigs(
          { provider: "paypal", is_active: true },
          { take: 1 }
        )
        const config = configs[0]
        if (config) {
          const isLive = config.mode === "live"
          const keys = isLive ? config.live_keys : config.test_keys
          if (keys?.client_id && keys?.client_secret) {
            this.logger_.info(
              `[PayPal] Using ${isLive ? "live" : "sandbox"} keys from gateway config`
            )
            this.client_ = new PayPalApiClient({
              client_id: keys.client_id,
              client_secret: keys.client_secret,
              mode: isLive ? "live" : "test",
            })
            return this.client_
          }
        }
      } catch (e: any) {
        this.logger_.warn(`[PayPal] Gateway config read failed: ${e.message}`)
      }
    }

    // 2. Fallback to options (env vars via medusa-config.js)
    const clientId =
      this.options_?.clientId || process.env.PAYPAL_CLIENT_ID
    const clientSecret =
      this.options_?.clientSecret || process.env.PAYPAL_CLIENT_SECRET
    const mode =
      this.options_?.mode ||
      (process.env.PAYPAL_MODE === "live" ? "live" : "test")

    if (clientId && clientSecret) {
      this.logger_.info(`[PayPal] Using credentials from provider options/env vars`)
      this.client_ = new PayPalApiClient({
        client_id: clientId,
        client_secret: clientSecret,
        mode,
      })
      return this.client_
    }

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "PayPal credentials not configured. Set via admin Payment Gateways or PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET env vars."
    )
  }

  /**
   * Get PayPal client_id for frontend (safe to expose).
   * Returns from gateway config or env var.
   */
  private async getClientIdForFrontend(): Promise<string | null> {
    if (this.gatewayConfigService_) {
      try {
        const configs = await this.gatewayConfigService_.listGatewayConfigs(
          { provider: "paypal", is_active: true },
          { take: 1 }
        )
        const config = configs[0]
        if (config) {
          const isLive = config.mode === "live"
          const keys = isLive ? config.live_keys : config.test_keys
          return keys?.client_id || null
        }
      } catch {
        // fall through
      }
    }
    return this.options_?.clientId || process.env.PAYPAL_CLIENT_ID || null
  }

  /**
   * Initiate a payment session — create a PayPal order.
   * Returns the PayPal order ID for the frontend PayPalButtons component.
   *
   * Medusa v2 input: { amount, currency_code, data?, context? }
   * Must return: { id: string, data: Record<string, unknown> }
   */
  async initiatePayment(input: any): Promise<any> {
    const { amount, currency_code, data, context } = input

    try {
      const client = await this.getPayPalClient()
      const clientIdForFrontend = await this.getClientIdForFrontend()

      const currency = currency_code?.toUpperCase() || "EUR"
      const totalValue = formatPayPalAmount(amount)

      // Build backend URL for return/cancel
      const backendUrl =
        process.env.BACKEND_PUBLIC_URL ||
        (process.env.RAILWAY_PUBLIC_DOMAIN_VALUE
          ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN_VALUE}`
          : "http://localhost:9000")

      const returnUrl = data?.return_url || `${backendUrl}/payment-return`
      const cancelUrl = data?.cancel_url || returnUrl

      this.logger_.info(
        `[PayPal] Creating order: amount=${totalValue} ${currency}`
      )

      const orderData: any = {
        intent: "AUTHORIZE",
        purchase_units: [
          {
            reference_id: context?.cart_id || `medusa-${Date.now()}`,
            amount: {
              currency_code: currency,
              value: totalValue,
            },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
              brand_name: process.env.STORE_NAME || "EverChapter",
              user_action: "PAY_NOW",
              return_url: returnUrl,
              cancel_url: cancelUrl,
            },
          },
        },
      }

      const result = await client.createOrder(orderData)

      this.logger_.info(
        `[PayPal] Order created: ${result.id}, status: ${result.status}`
      )

      // Return format required by Medusa v2: { id, data }
      return {
        id: result.id,
        data: {
          paypalOrderId: result.id,
          status: result.status,
          client_id: clientIdForFrontend,
          currency_code: currency,
          amount: totalValue,
        },
      }
    } catch (error: any) {
      this.logger_.error(
        `[PayPal] Payment initiation failed: ${error.response?.data?.message || error.message}`
      )
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.response?.data?.message || error.message || "Failed to create PayPal order"
      )
    }
  }

  /**
   * Authorize payment — called after customer approves on PayPal.
   * The frontend's onApprove callback triggers placeOrder(), which calls this.
   *
   * The PayPal order should already be authorized by the frontend via
   * actions.order.authorize() in the onApprove callback.
   *
   * Returns: { status, data }
   */
  async authorizePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const client = await this.getPayPalClient()
      const { paypalOrderId } = sessionData

      if (!paypalOrderId) {
        return {
          status: PaymentSessionStatus.PENDING,
          data: sessionData,
        }
      }

      // Get the current order status from PayPal
      const order = await client.getOrder(paypalOrderId)
      const status = order.status

      this.logger_.info(
        `[PayPal] Authorize check: order=${paypalOrderId}, status=${status}`
      )

      // If already completed (authorized or captured), extract IDs
      const authorizations =
        order.purchase_units?.[0]?.payments?.authorizations || []
      const captures = order.purchase_units?.[0]?.payments?.captures || []
      const authorizationId = authorizations[0]?.id || sessionData.authorizationId
      const captureId = captures[0]?.id || sessionData.captureId

      if (status === "COMPLETED" || authorizations.length > 0) {
        return {
          status: PaymentSessionStatus.AUTHORIZED,
          data: {
            ...sessionData,
            paypalOrderId,
            authorizationId,
            captureId,
            status: "AUTHORIZED",
            payer: order.payer,
          },
        }
      }

      // If captures exist, it was intent=CAPTURE
      if (captures.length > 0 && captures[0].status === "COMPLETED") {
        return {
          status: PaymentSessionStatus.CAPTURED,
          data: {
            ...sessionData,
            paypalOrderId,
            captureId: captures[0].id,
            status: "CAPTURED",
            payer: order.payer,
          },
        }
      }

      return {
        status: mapPayPalStatusToMedusa(status),
        data: {
          ...sessionData,
          paypalOrderId,
          status,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[PayPal] Authorization check failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message
      )
    }
  }

  /**
   * Capture payment — capture an authorized PayPal payment
   */
  async capturePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const client = await this.getPayPalClient()
      const { paypalOrderId, authorizationId, currency_code, amount } =
        sessionData

      if (authorizationId) {
        // Capture the authorization
        const captureAmount = amount
          ? {
              currency_code: (currency_code || "EUR").toUpperCase(),
              value: formatPayPalAmount(amount),
            }
          : undefined

        const result = await client.captureAuthorization(
          authorizationId,
          captureAmount
        )

        this.logger_.info(
          `[PayPal] Authorization captured: authId=${authorizationId}, captureId=${result.id}`
        )

        return {
          data: {
            ...sessionData,
            captureId: result.id,
            captureStatus: result.status,
            status: "CAPTURED",
          },
        }
      }

      if (paypalOrderId) {
        // Capture the order directly (intent=CAPTURE)
        const result = await client.captureOrder(paypalOrderId)
        const captureId =
          result.purchase_units?.[0]?.payments?.captures?.[0]?.id

        this.logger_.info(
          `[PayPal] Order captured: orderId=${paypalOrderId}, captureId=${captureId}`
        )

        return {
          data: {
            ...sessionData,
            captureId,
            status: "CAPTURED",
          },
        }
      }

      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No PayPal order ID or authorization ID in session data"
      )
    } catch (error: any) {
      this.logger_.error(`[PayPal] Capture failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message
      )
    }
  }

  /**
   * Refund payment — refund a captured PayPal payment
   */
  async refundPayment(input: any): Promise<any> {
    const sessionData = input.data || input
    const refundAmount = input.amount
    try {
      const client = await this.getPayPalClient()
      const { captureId, currency_code } = sessionData

      if (!captureId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "No PayPal capture ID in session data — payment must be captured before refund"
        )
      }

      const refundData: any = {}
      if (refundAmount) {
        refundData.amount = {
          currency_code: (currency_code || "EUR").toUpperCase(),
          value: formatPayPalAmount(refundAmount),
        }
      }

      const result = await client.refundCapture(captureId, refundData)

      this.logger_.info(
        `[PayPal] Refund created: captureId=${captureId}, refundId=${result.id}, status=${result.status}`
      )

      return {
        data: {
          ...sessionData,
          refundId: result.id,
          refundStatus: result.status,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[PayPal] Refund failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message
      )
    }
  }

  /**
   * Cancel payment — void the authorization
   */
  async cancelPayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const client = await this.getPayPalClient()
      const { authorizationId } = sessionData

      if (authorizationId) {
        await client.voidAuthorization(authorizationId)
        this.logger_.info(
          `[PayPal] Authorization voided: ${authorizationId}`
        )
      }

      return {
        data: {
          ...sessionData,
          status: "VOIDED",
        },
      }
    } catch (error: any) {
      this.logger_.error(`[PayPal] Cancel failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message
      )
    }
  }

  /**
   * Delete payment session — no-op for PayPal
   */
  async deletePayment(input: any): Promise<any> {
    return { data: input.data || input }
  }

  /**
   * Get payment status from PayPal
   */
  async getPaymentStatus(data: any): Promise<PaymentSessionStatus> {
    try {
      const client = await this.getPayPalClient()
      const { paypalOrderId } = data

      if (!paypalOrderId) return PaymentSessionStatus.PENDING

      const order = await client.getOrder(paypalOrderId)
      return mapPayPalStatusToMedusa(order.status)
    } catch {
      return PaymentSessionStatus.ERROR
    }
  }

  /**
   * Retrieve payment data
   */
  async retrievePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const client = await this.getPayPalClient()
      const { paypalOrderId } = sessionData

      if (!paypalOrderId) {
        return { data: sessionData }
      }

      const order = await client.getOrder(paypalOrderId)

      return {
        data: {
          ...sessionData,
          status: order.status,
          payer: order.payer,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[PayPal] Retrieve failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message
      )
    }
  }

  /**
   * Update payment session
   */
  async updatePayment(input: any): Promise<any> {
    const sessionData = input.data || {}
    return { data: sessionData }
  }

  /**
   * Process PayPal webhook
   */
  async getWebhookActionAndData(webhookData: any): Promise<{
    action: string
    data: Record<string, unknown>
  }> {
    try {
      const eventType = webhookData.event_type
      const resource = webhookData.resource || {}

      let action = "not_supported"

      if (
        eventType === "CHECKOUT.ORDER.APPROVED" ||
        eventType === "PAYMENT.AUTHORIZATION.CREATED"
      ) {
        action = "authorized"
      } else if (
        eventType === "PAYMENT.CAPTURE.COMPLETED" ||
        eventType === "CHECKOUT.ORDER.COMPLETED"
      ) {
        action = "authorized" // Medusa will complete the order
      } else if (
        eventType === "PAYMENT.CAPTURE.DENIED" ||
        eventType === "PAYMENT.AUTHORIZATION.VOIDED" ||
        eventType === "PAYMENT.CAPTURE.REVERSED"
      ) {
        action = "failed"
      }

      return {
        action,
        data: {
          paypalOrderId: resource.id,
          status: resource.status,
          event_type: eventType,
        },
      }
    } catch (error: any) {
      this.logger_.error(
        `[PayPal] Webhook processing failed: ${error.message}`
      )
      return { action: "not_supported", data: webhookData }
    }
  }
}

export default PayPalPaymentProviderService
