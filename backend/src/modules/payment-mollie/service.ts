// @ts-nocheck
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { MollieApiClient } from "./api-client"

type Options = {
  apiKey?: string
  testMode?: boolean
}

type InjectedDependencies = {
  logger: any
  gatewayConfig?: any
}

/**
 * Maps Mollie payment statuses to Medusa payment session statuses
 */
function mapMollieStatusToMedusa(mollieStatus: string): PaymentSessionStatus {
  switch (mollieStatus) {
    case "paid":
      return PaymentSessionStatus.CAPTURED
    case "authorized":
      return PaymentSessionStatus.AUTHORIZED
    case "completed":
      return PaymentSessionStatus.CAPTURED
    case "pending":
      return PaymentSessionStatus.PENDING
    case "open":
      return PaymentSessionStatus.PENDING
    case "processing":
      return PaymentSessionStatus.PENDING
    case "expired":
      return PaymentSessionStatus.CANCELED
    case "canceled":
      return PaymentSessionStatus.CANCELED
    case "failed":
      return PaymentSessionStatus.ERROR
    default:
      return PaymentSessionStatus.PENDING
  }
}

/**
 * Mollie payment provider for Medusa v2.
 * Follows the official AbstractPaymentProvider pattern (like PayPal/Stripe examples).
 *
 * API keys can come from:
 *   1. Gateway config module (admin-configured in DB) — preferred
 *   2. Provider options in medusa-config.js (env vars) — fallback
 */
class MolliePaymentProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "mollie"

  protected logger_: any
  protected options_: Options
  protected client_: MollieApiClient | null = null
  protected gatewayConfigService_: any = null

  constructor(container: InjectedDependencies, options: Options) {
    super(container, options)
    this.logger_ = container.logger || console
    this.options_ = options || {}

    // Try to resolve gateway config module from container (direct property access)
    try {
      this.gatewayConfigService_ = (container as any).gatewayConfig || null
    } catch {
      this.gatewayConfigService_ = null
    }

    this.logger_.info(
      `[Mollie] Provider initialized. Gateway config: ${this.gatewayConfigService_ ? "available" : "not available"}. Options apiKey: ${this.options_?.apiKey ? "set" : "not set"}`
    )
  }

  /**
   * Build or return the Mollie API client.
   * Tries gateway config (admin DB) first, then falls back to provider options (env vars).
   */
  private async getMollieClient(): Promise<MollieApiClient> {
    if (this.client_) return this.client_

    // 1. Try gateway config from database (admin-configured)
    if (this.gatewayConfigService_) {
      try {
        const configs = await this.gatewayConfigService_.listGatewayConfigs(
          { provider: "mollie", is_active: true },
          { take: 1 }
        )
        const config = configs[0]
        if (config) {
          const isLive = config.mode === "live"
          const keys = isLive ? config.live_keys : config.test_keys
          if (keys?.api_key) {
            this.logger_.info(`[Mollie] Using ${isLive ? "live" : "test"} keys from gateway config`)
            this.client_ = new MollieApiClient(keys.api_key, !isLive)
            return this.client_
          }
        }
      } catch (e: any) {
        this.logger_.warn(`[Mollie] Gateway config read failed: ${e.message}`)
      }
    }

    // 2. Fallback to options (env vars via medusa-config.js)
    if (this.options_?.apiKey) {
      this.logger_.info(`[Mollie] Using API key from provider options`)
      this.client_ = new MollieApiClient(
        this.options_.apiKey,
        this.options_.testMode !== false
      )
      return this.client_
    }

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Mollie API key not configured. Set via admin gateway config or MOLLIE_API_KEY env var."
    )
  }

  /**
   * Initiate a payment session — create a Mollie payment.
   *
   * Medusa v2 input: { amount, currency_code, data?, context? }
   * - amount is in MAJOR units (e.g. 49.99 not 4999)
   * - data contains frontend-provided session info (method, return_url)
   * - context contains customer info
   *
   * Must return: { id: string, data: Record<string, unknown> }
   */
  async initiatePayment(input: any): Promise<any> {
    const { amount, currency_code, data, context } = input

    try {
      const client = await this.getMollieClient()

      const paymentMethod = data?.method || null
      const cardToken = data?.cardToken || null
      const returnUrl = data?.return_url
      const customer = context?.customer

      // Build webhook URL
      const backendUrl =
        process.env.BACKEND_PUBLIC_URL ||
        (process.env.RAILWAY_PUBLIC_DOMAIN_VALUE
          ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN_VALUE}`
          : "http://localhost:9000")
      const webhookUrl = `${backendUrl}/webhooks/mollie`

      this.logger_.info(
        `[Mollie] Creating payment: method=${paymentMethod}, amount=${Number(amount).toFixed(2)} ${currency_code}, returnUrl=${returnUrl}`
      )

      // ─── Klarna requires Mollie Orders API with billing address + order lines ───
      const isKlarna = paymentMethod === "klarnapaylater" || paymentMethod === "klarnasliceit" || paymentMethod === "klarna"

      if (isKlarna) {
        // Build Mollie address from frontend-provided data
        const billingAddr = data?.billing_address || data?.shipping_address || {}
        const shippingAddr = data?.shipping_address || billingAddr
        const email = data?.email || customer?.email || ""

        const mollieAddress = (addr: any) => ({
          givenName: addr.first_name || "",
          familyName: addr.last_name || "",
          email: email,
          streetAndNumber: addr.address_1 || "",
          postalCode: addr.postal_code || "",
          city: addr.city || "",
          country: (addr.country_code || "NL").toUpperCase(),
          phone: addr.phone || "",
          ...(addr.company ? { organizationName: addr.company } : {}),
        })

        const amountValue = Number(amount).toFixed(2)
        const curr = currency_code.toUpperCase()

        const orderData: any = {
          amount: { value: amountValue, currency: curr },
          orderNumber: `ORD-${Date.now()}`,
          billingAddress: mollieAddress(billingAddr),
          shippingAddress: mollieAddress(shippingAddr),
          redirectUrl: returnUrl || `${backendUrl}/payment-return`,
          webhookUrl: webhookUrl,
          locale: "nl_NL",
          method: paymentMethod,
          metadata: {
            customer_id: customer?.id,
            customer_email: email,
            session_id: data?.session_id,
          },
          lines: [{
            type: "physical",
            name: "Bestelling",
            quantity: 1,
            unitPrice: { value: amountValue, currency: curr },
            totalAmount: { value: amountValue, currency: curr },
            vatRate: "0.00",
            vatAmount: { value: "0.00", currency: curr },
          }],
        }

        const result = await client.createOrder(orderData)
        if (!result.success) {
          throw new MedusaError(
            MedusaError.Types.UNEXPECTED_STATE,
            result.error || "Failed to create Mollie order for Klarna"
          )
        }

        const mollieOrder = result.data
        const checkoutUrl = mollieOrder._links?.checkout?.href || null

        this.logger_.info(
          `[Mollie] Klarna order created: ${mollieOrder.id}, status: ${mollieOrder.status}, checkout: ${checkoutUrl || "none"}`
        )

        return {
          id: mollieOrder.id,
          data: {
            mollieOrderId: mollieOrder.id,
            status: mollieOrder.status,
            method: paymentMethod,
            checkoutUrl,
            session_id: data?.session_id,
            currency_code,
          },
        }
      }

      // ─── Standard payment methods (iDEAL, Bancontact, credit card, PayPal) ───
      // Build Mollie payment request — amount is already in major units
      const paymentData: any = {
        amount: {
          value: Number(amount).toFixed(2),
          currency: currency_code.toUpperCase(),
        },
        description: `Order ${Date.now()}`,
        redirectUrl: returnUrl || `${backendUrl}/payment-return`,
        webhookUrl: webhookUrl,
        metadata: {
          customer_id: customer?.id,
          customer_email: customer?.email,
          session_id: data?.session_id,
        },
      }

      if (paymentMethod) {
        paymentData.method = paymentMethod
      }
      if (cardToken) {
        paymentData.cardToken = cardToken
      }

      const result = await client.createPayment(paymentData)
      if (!result.success) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to create Mollie payment"
        )
      }

      const molliePayment = result.data
      const checkoutUrl = molliePayment._links?.checkout?.href || null

      this.logger_.info(
        `[Mollie] Payment created: ${molliePayment.id}, status: ${molliePayment.status}, checkout: ${checkoutUrl || "none"}`
      )

      // Return format required by Medusa v2: { id, data }
      return {
        id: molliePayment.id,
        data: {
          molliePaymentId: molliePayment.id,
          status: molliePayment.status,
          method: paymentMethod,
          checkoutUrl,
          session_id: data?.session_id,
          currency_code,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Mollie] Payment initiation failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message || "Failed to initiate Mollie payment"
      )
    }
  }

  /**
   * Authorize payment — check Mollie payment status
   */
  async authorizePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const client = await this.getMollieClient()
      const molliePaymentId = sessionData.molliePaymentId || sessionData.mollieOrderId

      if (!molliePaymentId) {
        return {
          status: PaymentSessionStatus.PENDING,
          data: sessionData,
        }
      }

      // Check if it's a payment (tr_xxx) or order (ord_xxx)
      const isPayment = molliePaymentId.startsWith("tr_")
      const result = isPayment
        ? await client.getPayment(molliePaymentId)
        : await client.getOrder(molliePaymentId)

      if (!result.success) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to fetch Mollie payment"
        )
      }

      const status = mapMollieStatusToMedusa(result.data.status)
      this.logger_.info(`[Mollie] Authorize: ${molliePaymentId} → ${result.data.status} → ${status}`)

      return {
        status,
        data: { ...sessionData, status: result.data.status },
      }
    } catch (error: any) {
      this.logger_.error(`[Mollie] Authorization failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message
      )
    }
  }

  /**
   * Capture payment
   */
  async capturePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const client = await this.getMollieClient()
      const molliePaymentId = sessionData.molliePaymentId || sessionData.mollieOrderId

      if (!molliePaymentId) {
        return { data: sessionData }
      }

      const isPayment = molliePaymentId.startsWith("tr_")
      const result = isPayment
        ? await client.getPayment(molliePaymentId)
        : await client.getOrder(molliePaymentId)

      if (!result.success) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to fetch Mollie payment for capture"
        )
      }

      return {
        data: { ...sessionData, status: result.data.status },
      }
    } catch (error: any) {
      this.logger_.error(`[Mollie] Capture failed: ${error.message}`)
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
      const client = await this.getMollieClient()
      const mollieId = sessionData.molliePaymentId || sessionData.mollieOrderId

      if (!mollieId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "No Mollie payment ID in session data"
        )
      }

      this.logger_.info(`[Mollie] Refund ${mollieId}, amount: ${refundAmount}`)

      return {
        data: sessionData,
      }
    } catch (error: any) {
      this.logger_.error(`[Mollie] Refund failed: ${error.message}`)
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
    this.logger_.info(`[Mollie] Cancel: ${sessionData.molliePaymentId || "no ID"}`)
    return {
      data: sessionData,
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
      const client = await this.getMollieClient()
      const molliePaymentId = data.molliePaymentId || data.mollieOrderId

      if (!molliePaymentId) return PaymentSessionStatus.PENDING

      const isPayment = molliePaymentId.startsWith("tr_")
      const result = isPayment
        ? await client.getPayment(molliePaymentId)
        : await client.getOrder(molliePaymentId)

      if (!result.success) return PaymentSessionStatus.ERROR
      return mapMollieStatusToMedusa(result.data.status)
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
      const client = await this.getMollieClient()
      const molliePaymentId = sessionData.molliePaymentId || sessionData.mollieOrderId

      if (!molliePaymentId) {
        return { data: sessionData }
      }

      const isPayment = molliePaymentId.startsWith("tr_")
      const result = isPayment
        ? await client.getPayment(molliePaymentId)
        : await client.getOrder(molliePaymentId)

      if (!result.success) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to retrieve Mollie payment"
        )
      }

      return {
        data: {
          ...sessionData,
          status: result.data.status,
          method: result.data.method,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Mollie] Retrieve failed: ${error.message}`)
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
   * Process Mollie webhook
   */
  async getWebhookActionAndData(webhookData: any): Promise<any> {
    try {
      const { id } = webhookData

      if (!id) {
        return { action: "not_supported", data: webhookData }
      }

      const client = await this.getMollieClient()
      const isPayment = id.startsWith("tr_")

      const result = isPayment
        ? await client.getPayment(id)
        : await client.getOrder(id)

      if (!result.success) {
        this.logger_.error(`[Mollie] Webhook fetch failed: ${result.error}`)
        return { action: "not_supported", data: webhookData }
      }

      const mollieStatus = result.data.status
      let action = "not_supported"

      if (mollieStatus === "paid" || mollieStatus === "authorized") {
        action = "authorized"
      } else if (mollieStatus === "canceled" || mollieStatus === "expired" || mollieStatus === "failed") {
        action = "failed"
      }

      this.logger_.info(`[Mollie] Webhook: ${id} → ${mollieStatus} → action: ${action}`)

      return {
        action,
        data: {
          session_id: result.data.metadata?.session_id,
          ...(isPayment ? { molliePaymentId: id } : { mollieOrderId: id }),
          status: mollieStatus,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Mollie] Webhook processing failed: ${error.message}`)
      return { action: "not_supported", data: webhookData }
    }
  }
}

export default MolliePaymentProviderService
