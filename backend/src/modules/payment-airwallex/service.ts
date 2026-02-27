// @ts-nocheck
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { AirwallexApiClient } from "./api-client"

type Options = {
  clientId?: string
  apiKey?: string
  testMode?: boolean
}

type InjectedDependencies = {
  logger: any
  gatewayConfig?: any
}

/**
 * Maps Airwallex payment intent statuses to Medusa payment session statuses
 */
function mapAirwallexStatusToMedusa(airwallexStatus: string): PaymentSessionStatus {
  switch (airwallexStatus) {
    case "REQUIRES_PAYMENT_METHOD":
      return PaymentSessionStatus.PENDING
    case "REQUIRES_CUSTOMER_ACTION":
      return PaymentSessionStatus.REQUIRES_MORE
    case "REQUIRES_CAPTURE":
      return PaymentSessionStatus.AUTHORIZED
    case "SUCCEEDED":
      return PaymentSessionStatus.AUTHORIZED
    case "CAPTURED":
      return PaymentSessionStatus.CAPTURED
    case "CANCELLED":
      return PaymentSessionStatus.CANCELED
    case "FAILED":
      return PaymentSessionStatus.ERROR
    default:
      return PaymentSessionStatus.PENDING
  }
}

/**
 * Airwallex Payment Provider for Medusa v2.
 * Follows the AbstractPaymentProvider pattern (same as Mollie/Klarna/PayPal).
 *
 * Supports: iDEAL, Bancontact, BLIK, Credit/Debit Card, Apple Pay, Google Pay, EPS
 * via Airwallex Drop-in Element on frontend.
 *
 * Credentials can come from:
 *   1. Gateway config module (admin-configured in DB) — preferred
 *   2. Provider options in medusa-config.js (env vars) — fallback
 *
 * Amounts are in MAJOR units (100 = €100.00) — same as Medusa order.total.
 */
class AirwallexPaymentProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "airwallex"

  protected logger_: any
  protected options_: Options
  protected client_: AirwallexApiClient | null = null
  protected container_: any = null

  constructor(container: InjectedDependencies, options: Options) {
    super(container, options)
    this.logger_ = container.logger || console
    this.options_ = options || {}
    this.container_ = container

    this.logger_.info(
      `[Airwallex] Provider initialized. Options clientId: ${this.options_?.clientId ? "set" : "not set"}`
    )
  }

  /**
   * Lazily resolve the gateway config service from the container.
   */
  private getGatewayConfigService(): any {
    try {
      return this.container_.resolve("gatewayConfig")
    } catch {
      return null
    }
  }

  /**
   * Build or return the Airwallex API client.
   * Tries gateway config (admin DB) first, then falls back to provider options (env vars).
   */
  private async getAirwallexClient(): Promise<AirwallexApiClient> {
    if (this.client_) return this.client_

    // 1. Try gateway config from database (admin-configured)
    const gatewayConfigService = this.getGatewayConfigService()
    if (gatewayConfigService) {
      try {
        const configs = await gatewayConfigService.listGatewayConfigs(
          { provider: "airwallex", is_active: true },
          { take: 1 }
        )
        const config = configs[0]
        if (config) {
          const isLive = config.mode === "live"
          const keys = isLive ? config.live_keys : config.test_keys
          if (keys?.api_key && keys?.secret_key) {
            this.logger_.info(`[Airwallex] Using ${isLive ? "live" : "test"} keys from gateway config`)
            this.client_ = new AirwallexApiClient(
              keys.api_key,      // Client ID
              keys.secret_key,   // API Key
              !isLive,           // isTest
              this.logger_
            )
            await this.client_.login()
            return this.client_
          }
        }
      } catch (e: any) {
        this.logger_.warn(`[Airwallex] Gateway config read failed: ${e.message}`)
      }
    }

    // 2. Fallback to options (env vars via medusa-config.js)
    if (this.options_?.clientId && this.options_?.apiKey) {
      this.logger_.info(`[Airwallex] Using credentials from provider options`)
      this.client_ = new AirwallexApiClient(
        this.options_.clientId,
        this.options_.apiKey,
        this.options_.testMode !== false,
        this.logger_
      )
      await this.client_.login()
      return this.client_
    }

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Airwallex credentials not configured. Set via admin gateway config or AIRWALLEX_CLIENT_ID + AIRWALLEX_API_KEY env vars."
    )
  }

  /**
   * Initiate a payment session — create an Airwallex Payment Intent.
   *
   * Medusa v2 input: { amount, currency_code, data?, context? }
   * - amount is in MAJOR units (e.g. 49.99 = €49.99)
   * - data contains frontend-provided session info (method, return_url, etc.)
   * - context contains customer info
   *
   * Must return: { id: string, data: Record<string, unknown> }
   */
  async initiatePayment(input: any): Promise<any> {
    const { amount, currency_code, data, context } = input

    try {
      const client = await this.getAirwallexClient()

      const returnUrl = data?.return_url
      const method = data?.method || null
      const customer = context?.customer

      // Build webhook URL
      const backendUrl =
        process.env.BACKEND_PUBLIC_URL ||
        (process.env.RAILWAY_PUBLIC_DOMAIN_VALUE
          ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN_VALUE}`
          : "http://localhost:9000")

      const merchantOrderId = `medusa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

      this.logger_.info(
        `[Airwallex] Creating payment intent: method=${method}, amount=${Number(amount).toFixed(2)} ${currency_code}, returnUrl=${returnUrl}`
      )

      const paymentIntent = await client.createPaymentIntent({
        amount: Number(amount),
        currency: currency_code.toUpperCase(),
        merchant_order_id: merchantOrderId,
        descriptor: "Medusa Order",
        return_url: returnUrl,
        metadata: {
          customer_id: customer?.id,
          customer_email: customer?.email || data?.email,
          session_id: data?.session_id,
          method: method,
        },
      })

      this.logger_.info(
        `[Airwallex] Payment intent created: ${paymentIntent.id}, status: ${paymentIntent.status}`
      )

      // Determine environment for frontend SDK
      const gatewayConfigService = this.getGatewayConfigService()
      let environment = "demo"
      if (gatewayConfigService) {
        try {
          const configs = await gatewayConfigService.listGatewayConfigs(
            { provider: "airwallex", is_active: true },
            { take: 1 }
          )
          if (configs[0]?.mode === "live") environment = "prod"
        } catch {}
      } else if (this.options_?.testMode === false) {
        environment = "prod"
      }

      return {
        id: paymentIntent.id,
        data: {
          intentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          method: method,
          environment: environment,
          return_url: returnUrl,
          session_id: data?.session_id,
          currency_code,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Airwallex] Payment initiation failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message || "Failed to initiate Airwallex payment"
      )
    }
  }

  /**
   * Authorize payment — check Airwallex payment intent status
   */
  async authorizePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const client = await this.getAirwallexClient()
      const intentId = sessionData.intentId

      if (!intentId) {
        return {
          status: PaymentSessionStatus.PENDING,
          data: sessionData,
        }
      }

      const paymentIntent = await client.getPaymentIntent(intentId)
      const status = mapAirwallexStatusToMedusa(paymentIntent.status)

      this.logger_.info(`[Airwallex] Authorize: ${intentId} → ${paymentIntent.status} → ${status}`)

      return {
        status,
        data: {
          ...sessionData,
          status: paymentIntent.status,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Airwallex] Authorization failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message
      )
    }
  }

  /**
   * Capture payment — capture the Airwallex payment intent
   * Amount is in major units (same as order.total)
   */
  async capturePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const client = await this.getAirwallexClient()
      const intentId = sessionData.intentId

      if (!intentId) {
        return { data: sessionData }
      }

      const result = await client.capturePaymentIntent(intentId, {
        amount: sessionData.amount,
      })

      this.logger_.info(`[Airwallex] Captured: ${intentId}, status: ${result.status}`)

      return {
        data: { ...sessionData, status: result.status },
      }
    } catch (error: any) {
      this.logger_.error(`[Airwallex] Capture failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message
      )
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(input: any): Promise<any> {
    const sessionData = input.data || input
    const refundAmount = input.amount
    try {
      const client = await this.getAirwallexClient()
      const intentId = sessionData.intentId

      if (!intentId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "No Airwallex payment intent ID in session data"
        )
      }

      const refund = await client.createRefund({
        payment_intent_id: intentId,
        amount: refundAmount > 0 ? refundAmount : undefined,
        reason: "Customer requested refund",
      })

      this.logger_.info(`[Airwallex] Refund created: ${refund.id}, amount: ${refund.amount}`)

      return {
        data: {
          ...sessionData,
          refundId: refund.id,
          refundStatus: refund.status,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Airwallex] Refund failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message
      )
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const client = await this.getAirwallexClient()
      const intentId = sessionData.intentId

      if (intentId) {
        await client.cancelPaymentIntent(intentId)
      }

      this.logger_.info(`[Airwallex] Cancel: ${intentId || "no ID"}`)
      return {
        data: { ...sessionData, status: "CANCELLED" },
      }
    } catch (error: any) {
      this.logger_.error(`[Airwallex] Cancel failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message
      )
    }
  }

  /**
   * Delete payment session
   */
  async deletePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    return {
      data: sessionData,
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(data: any): Promise<PaymentSessionStatus> {
    try {
      const client = await this.getAirwallexClient()
      const intentId = data.intentId

      if (!intentId) return PaymentSessionStatus.PENDING

      const paymentIntent = await client.getPaymentIntent(intentId)
      return mapAirwallexStatusToMedusa(paymentIntent.status)
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
      const client = await this.getAirwallexClient()
      const intentId = sessionData.intentId

      if (!intentId) {
        return { data: sessionData }
      }

      const paymentIntent = await client.getPaymentIntent(intentId)

      return {
        data: {
          ...sessionData,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Airwallex] Retrieve failed: ${error.message}`)
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
    return {
      data: sessionData,
    }
  }

  /**
   * Process Airwallex webhook
   */
  async getWebhookActionAndData(webhookData: any): Promise<any> {
    try {
      const { id, event_type, data: eventData } = webhookData

      if (!id) {
        return { action: "not_supported", data: webhookData }
      }

      const client = await this.getAirwallexClient()
      const paymentIntent = await client.getPaymentIntent(id)

      let action = "not_supported"

      if (event_type === "payment_intent.succeeded" || paymentIntent.status === "SUCCEEDED") {
        action = "authorized"
      } else if (event_type === "payment_intent.requires_capture" || paymentIntent.status === "REQUIRES_CAPTURE") {
        action = "authorized"
      } else if (event_type === "payment_intent.failed" || paymentIntent.status === "FAILED") {
        action = "failed"
      } else if (event_type === "payment_intent.cancelled" || paymentIntent.status === "CANCELLED") {
        action = "failed"
      }

      this.logger_.info(`[Airwallex] Webhook: ${id} → ${paymentIntent.status} → action: ${action}`)

      return {
        action,
        data: {
          intentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Airwallex] Webhook processing failed: ${error.message}`)
      return { action: "not_supported", data: webhookData }
    }
  }
}

export default AirwallexPaymentProviderService
