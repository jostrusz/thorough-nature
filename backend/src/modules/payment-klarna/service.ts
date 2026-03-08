// @ts-nocheck
import {
  AbstractPaymentProvider,
  PaymentSessionStatus,
  MedusaError,
} from "@medusajs/framework/utils"
import { KlarnaApiClient, IKlarnaOrderLine } from "./api-client"
import crypto from "crypto"

type Options = {
  apiKey?: string
  secretKey?: string
  testMode?: boolean
}

type InjectedDependencies = {
  logger: any
  gatewayConfig?: any
}

export interface IKlarnaPaymentSessionData {
  sessionId?: string
  clientToken?: string
  klarnaOrderId?: string
  captureId?: string
  authorizationToken?: string
  status?: string
  amount?: number
  currency?: string
  method?: string
  createdAt?: number
}

/**
 * Maps Klarna order statuses to Medusa payment session statuses
 */
function mapKlarnaStatusToMedusa(klarnaStatus: string): PaymentSessionStatus {
  switch (klarnaStatus) {
    case "AUTHORIZED":
      return PaymentSessionStatus.AUTHORIZED
    case "CAPTURED":
      return PaymentSessionStatus.CAPTURED
    case "REFUNDED":
      return PaymentSessionStatus.REFUNDED
    case "CANCELLED":
      return PaymentSessionStatus.CANCELED
    case "EXPIRED":
      return PaymentSessionStatus.CANCELED
    case "FAILED":
      return PaymentSessionStatus.ERROR
    default:
      return PaymentSessionStatus.PENDING
  }
}

/**
 * Maps billing country code to the correct Klarna locale.
 * Klarna uses IETF BCP 47 format (e.g. "nl-NL", "de-DE").
 * Affects language of the Klarna payment widget shown to the customer.
 */
const KLARNA_LOCALE_MAP: Record<string, string> = {
  NL: "nl-NL",
  BE: "nl-BE",
  DE: "de-DE",
  AT: "de-AT",
  LU: "fr-LU",
  CZ: "cs-CZ",
  PL: "pl-PL",
  SK: "sk-SK",
  SE: "sv-SE",
  FI: "fi-FI",
  DK: "da-DK",
  NO: "nb-NO",
  FR: "fr-FR",
  IT: "it-IT",
  ES: "es-ES",
  GB: "en-GB",
  US: "en-US",
}

function getKlarnaLocale(countryCode: string, fallback = "en-US"): string {
  return KLARNA_LOCALE_MAP[countryCode?.toUpperCase()] || fallback
}

/**
 * Convert amount from Medusa major units (EUR) to Klarna minor units (cents).
 * Medusa stores prices as major units: 35 = €35.00
 * Klarna expects minor units: 3500 = €35.00
 *
 * Zero-decimal currencies (JPY, KRW, etc.) are returned as-is.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "JPY", "KRW", "VND", "CLP", "PYG", "GNF", "BIF", "DJF", "RWF", "UGX",
  "XOF", "XAF", "XPF", "MGA", "KMF",
])

function toMinorUnits(amount: number, currency: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(currency?.toUpperCase())) {
    return Math.round(amount)
  }
  return Math.round(amount * 100)
}

/**
 * Build Klarna order lines from cart items
 * Converts item prices from Medusa major units to Klarna minor units (cents)
 */
function buildOrderLines(
  items: any[],
  currency: string,
  statementDescriptor?: string
): IKlarnaOrderLine[] {
  return items.map((item) => {
    const unitPriceMinor = toMinorUnits(item.unit_price || 0, currency)
    return {
      type: "physical",
      reference: item.id || item.sku,
      name: (statementDescriptor || item.title || "Product").substring(0, 255),
      quantity: item.quantity,
      quantity_unit: "pcs",
      unit_price: unitPriceMinor,
      tax_rate: item.metadata?.tax_rate
        ? parseInt(item.metadata.tax_rate) * 100
        : 0, // default 0% tax — will be set correctly when tax module is configured
      total_amount: unitPriceMinor * item.quantity,
      total_tax_amount: item.metadata?.tax_amount
        ? toMinorUnits(item.metadata.tax_amount * item.quantity, currency)
        : 0,
    }
  })
}

/**
 * Klarna payment provider service for Medusa v2
 * Extends AbstractPaymentProvider following the Mollie/Stripe pattern.
 *
 * Flow: initiatePayment → frontend widget authorize → authorizePayment → capturePayment
 * Authorization valid for 28 days, capture after shipment.
 * Frontend uses Klarna Payments SDK with client_token.
 *
 * API keys come from:
 *   1. Gateway config module (admin-configured in DB) — preferred
 *   2. Provider options in medusa-config.js (env vars) — fallback
 */
class KlarnaPaymentProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "klarna"

  protected logger_: any
  protected options_: Options
  protected client_: KlarnaApiClient | null = null
  protected container_: any = null

  constructor(container: InjectedDependencies, options: Options) {
    super(container, options)
    this.logger_ = container.logger || console
    this.options_ = options || {}
    this.container_ = container

    this.logger_.info(
      `[Klarna] Provider initialized. Options apiKey: ${this.options_?.apiKey ? "set" : "not set"}`
    )
  }

  /**
   * Lazily resolve the gateway config service from the container.
   * Avoids issues where the gateway config module isn't available at constructor time.
   */
  private getGatewayConfigService(): any {
    try {
      return this.container_.resolve("gatewayConfig")
    } catch {
      return null
    }
  }

  /**
   * Initialize the Klarna API client with credentials from gateway_config or options
   */
  private async getKlarnaClient(): Promise<KlarnaApiClient> {
    if (!this.client_) {
      let apiKey: string | undefined
      let secretKey: string | undefined
      let isTestMode = true
      let source = "none"

      // Try gateway config first (admin-configured)
      const gatewayConfigService = this.getGatewayConfigService()
      if (gatewayConfigService) {
        try {
          const configs = await gatewayConfigService.listGatewayConfigs(
            { provider: "klarna", is_active: true },
            { take: 1 }
          )
          const config = configs[0]
          if (config) {
            const isLive = config.mode === "live"
            const keys = isLive ? config.live_keys : config.test_keys
            apiKey = keys?.api_key
            secretKey = keys?.secret_key
            isTestMode = !isLive
            source = `gateway_config (mode=${config.mode}, hasApiKey=${!!apiKey}, hasSecret=${!!secretKey})`
            this.logger_.info(`[Klarna] Using gateway config: mode=${config.mode}, apiKey=${apiKey ? apiKey.substring(0, 8) + '...' : 'EMPTY'}, secretKey=${secretKey ? secretKey.substring(0, 16) + '...' : 'EMPTY'}`)
          } else {
            this.logger_.info(`[Klarna] No gateway config found for klarna`)
          }
        } catch (err) {
          this.logger_.warn(`[Klarna] Failed to load gateway config: ${err.message}`)
        }
      } else {
        this.logger_.info(`[Klarna] Gateway config service not available`)
      }

      // Fallback to provider options / env vars
      if (!apiKey || !secretKey) {
        apiKey = this.options_?.apiKey || process.env.KLARNA_API_KEY
        secretKey = this.options_?.secretKey || process.env.KLARNA_SECRET_KEY
        isTestMode = this.options_?.testMode !== false
        source = `env/options (hasApiKey=${!!apiKey}, hasSecret=${!!secretKey}, testMode=${isTestMode})`
        this.logger_.info(`[Klarna] Using env/options: apiKey=${apiKey ? apiKey.substring(0, 8) + '...' : 'EMPTY'}, secretKey=${secretKey ? secretKey.substring(0, 16) + '...' : 'EMPTY'}, testMode=${isTestMode}`)
      }

      if (!apiKey || !secretKey) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Klarna API credentials not configured. Set up in admin Payment Gateways or provide apiKey/secretKey in options."
        )
      }

      const endpoint = isTestMode ? "api.playground.klarna.com" : "api.klarna.com"
      this.logger_.info(`[Klarna] Creating client: endpoint=${endpoint}, source=${source}`)

      this.client_ = new KlarnaApiClient(apiKey, secretKey, isTestMode)
    }
    return this.client_
  }

  /**
   * Initiate a payment session — create Klarna session and return client_token.
   * Frontend will use this token with Klarna Payments widget.
   *
   * Must return: { id: string, data: Record<string, unknown> }
   */
  async initiatePayment(input: any): Promise<any> {
    const { amount, currency_code, data, context } = input

    try {
      const client = await this.getKlarnaClient()
      const currencyUpper = (currency_code || "EUR").toUpperCase()

      // Convert Medusa amount (major units: 99 = €99.00) to Klarna minor units (9900 = €99.00)
      const amountMinor = toMinorUnits(amount, currencyUpper)

      this.logger_.info(
        `[Klarna] initiatePayment: medusa amount=${amount}, converted to minor units=${amountMinor}, currency=${currencyUpper}`
      )

      const customer = context?.customer
      const billingAddress = context?.billing_address || data?.billing_address || customer?.billing_address || {}
      const shippingAddress = context?.shipping_address || data?.shipping_address || billingAddress

      // Build order lines from context items if available (buildOrderLines converts to minor units)
      const items = context?.extra?.items || context?.items || []
      const orderLines = buildOrderLines(
        items,
        currencyUpper,
        data?.statement_descriptor
      )

      // Add shipping as line item if applicable (convert to minor units)
      const shippingTotal = context?.extra?.shipping_total || 0
      if (shippingTotal > 0) {
        const shippingMinor = toMinorUnits(shippingTotal, currencyUpper)
        orderLines.push({
          type: "shipping_fee",
          name: "Shipping",
          quantity: 1,
          unit_price: shippingMinor,
          tax_rate: 0,
          total_amount: shippingMinor,
          total_tax_amount: 0,
        })
      }

      // Build backend URL for webhooks
      const backendUrl =
        process.env.BACKEND_PUBLIC_URL ||
        (process.env.RAILWAY_PUBLIC_DOMAIN_VALUE
          ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN_VALUE}`
          : "http://localhost:9000")

      const returnUrl = data?.return_url || context?.extra?.return_url || backendUrl

      // Tax amount in minor units
      const taxTotalMinor = toMinorUnits(context?.extra?.tax_total || 0, currencyUpper)

      // Derive country from billing address, or guess from currency as last resort
      const currencyCountryFallback: Record<string, string> = { SEK: "SE", NOK: "NO", DKK: "DK", EUR: "NL", GBP: "GB", USD: "US", PLN: "PL", CZK: "CZ" }
      const purchaseCountry = billingAddress.country_code?.toUpperCase()
        || shippingAddress.country_code?.toUpperCase()
        || currencyCountryFallback[currencyUpper]
        || "NL"
      const sessionData = {
        purchase_country: purchaseCountry,
        purchase_currency: currencyUpper,
        // Locale derived from billing country → correct language in Klarna widget
        locale: data?.locale || getKlarnaLocale(purchaseCountry),
        order_amount: amountMinor,
        order_tax_amount: taxTotalMinor,
        order_lines: orderLines.length > 0
          ? orderLines
          : [
              {
                type: "physical",
                name: "Order",
                quantity: 1,
                unit_price: amountMinor,
                tax_rate: 0,
                total_amount: amountMinor,
                total_tax_amount: 0,
              },
            ],
        merchant_urls: {
          terms: `${returnUrl}/terms`,
          checkout: `${returnUrl}/checkout`,
          confirmation: `${returnUrl}/order/confirmed`,
          push: `${backendUrl}/webhooks/klarna`,
        },
        billing_address: billingAddress.given_name ? billingAddress : {
          given_name: customer?.first_name || billingAddress.first_name || "Customer",
          family_name: customer?.last_name || billingAddress.last_name || "",
          email: customer?.email || context?.email || "customer@example.com",
          phone: customer?.phone || billingAddress.phone || "",
          street_address: billingAddress.address_1 || "Street 1",
          street_address2: billingAddress.address_2 || "",
          postal_code: billingAddress.postal_code || "00000",
          city: billingAddress.city || "City",
          region: billingAddress.province || "",
          country: billingAddress.country_code?.toUpperCase() || "NL",
        },
        shipping_address: shippingAddress.given_name ? shippingAddress : {
          given_name: customer?.first_name || shippingAddress.first_name || "Customer",
          family_name: customer?.last_name || shippingAddress.last_name || "",
          email: customer?.email || context?.email || "customer@example.com",
          phone: customer?.phone || shippingAddress.phone || "",
          street_address: shippingAddress.address_1 || "Street 1",
          street_address2: shippingAddress.address_2 || "",
          postal_code: shippingAddress.postal_code || "00000",
          city: shippingAddress.city || "City",
          region: shippingAddress.province || "",
          country: shippingAddress.country_code?.toUpperCase() || "NL",
        },
      }

      const result = await client.createSession(sessionData)
      if (!result.success) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to create Klarna session"
        )
      }

      if (!result.data?.client_token) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "No client_token returned from Klarna"
        )
      }

      this.logger_.info(
        `[Klarna] Session created: sessionId=${result.data.session_id}, client_token available`
      )

      // Return format required by Medusa v2: { id, data }
      // IMPORTANT: Store ALL session creation data so authorizePayment can send
      // matching data to createOrder (Klarna validates fields match between session and order)
      return {
        id: result.data.session_id,
        data: {
          sessionId: result.data.session_id,
          clientToken: result.data.client_token,
          paymentMethodCategories: result.data.payment_method_categories,
          amount,
          currency: currency_code,
          createdAt: Date.now(),
          // Store session creation data for createOrder matching
          klarnaSessionData: {
            purchase_country: sessionData.purchase_country,
            purchase_currency: sessionData.purchase_currency,
            locale: sessionData.locale,
            order_amount: sessionData.order_amount,
            order_tax_amount: sessionData.order_tax_amount,
            order_lines: sessionData.order_lines,
            billing_address: sessionData.billing_address,
            shipping_address: sessionData.shipping_address,
          },
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Klarna] Payment initiation failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message || "Failed to initiate Klarna payment"
      )
    }
  }

  /**
   * Authorize payment — after frontend authorization, create order with auth token.
   * This is called when cart.complete() triggers payment authorization.
   * The authorizationToken must be in the session data (set by POST /store/klarna/authorize).
   *
   * Returns: { status, data }
   */
  async authorizePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const client = await this.getKlarnaClient()
      const { sessionId, clientToken, authorizationToken, amount, currency, klarnaSessionData } =
        sessionData

      if (!authorizationToken) {
        // If no auth token yet, customer needs to authorize via Klarna widget
        this.logger_.info("[Klarna] No authorizationToken yet, returning REQUIRES_MORE")
        return {
          status: PaymentSessionStatus.REQUIRES_MORE,
          data: sessionData,
        }
      }

      // Use stored klarnaSessionData from initiatePayment — this ensures createOrder
      // data matches EXACTLY what was sent during session creation (Klarna validates this)
      const storedSession = klarnaSessionData || {}

      const purchaseCountry = storedSession.purchase_country || currency?.toUpperCase() === "SEK" ? "SE" : "NL"
      const purchaseCurrency = storedSession.purchase_currency || currency?.toUpperCase() || "EUR"
      const locale = storedSession.locale || getKlarnaLocale(purchaseCountry)

      // Fallback amount in minor units (storedSession already has minor units from initiatePayment)
      const fallbackAmountMinor = toMinorUnits(amount, purchaseCurrency)

      this.logger_.info(
        `[Klarna] authorizePayment: medusaAmount=${amount}, fallbackMinor=${fallbackAmountMinor}, currency=${purchaseCurrency}, country=${purchaseCountry}, locale=${locale}, hasStoredSession=${!!klarnaSessionData}, authToken=${authorizationToken?.substring(0, 16)}...`
      )

      // Use stored order_lines from session creation (already in minor units), or build a fallback
      const orderLines = storedSession.order_lines || [
        {
          type: "physical",
          name: "Order",
          quantity: 1,
          unit_price: fallbackAmountMinor,
          tax_rate: 0,
          total_amount: fallbackAmountMinor,
          total_tax_amount: 0,
        },
      ]

      const orderData: any = {
        authorization_token: authorizationToken,
        purchase_country: purchaseCountry,
        purchase_currency: purchaseCurrency,
        locale: locale,
        order_amount: storedSession.order_amount || fallbackAmountMinor,
        order_tax_amount: storedSession.order_tax_amount || 0,
        description: "Order",
        merchant_reference: `medusa-${Date.now()}`,
        merchant_reference1: sessionId,
        order_lines: orderLines,
      }

      // Include addresses from stored session — MUST match what was sent during createSession
      if (storedSession.billing_address) {
        orderData.billing_address = storedSession.billing_address
      }
      if (storedSession.shipping_address) {
        orderData.shipping_address = storedSession.shipping_address
      }

      this.logger_.info(
        `[Klarna] createOrder payload: country=${orderData.purchase_country}, currency=${orderData.purchase_currency}, locale=${orderData.locale}, hasBilling=${!!orderData.billing_address}, hasShipping=${!!orderData.shipping_address}, lines=${orderData.order_lines?.length}`
      )

      const result = await client.createOrder(orderData)
      if (!result.success) {
        this.logger_.error(`[Klarna] createOrder failed: ${result.error}`)
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to create Klarna order"
        )
      }

      const status = mapKlarnaStatusToMedusa(result.data?.status || "AUTHORIZED")

      this.logger_.info(
        `[Klarna] Order created: klarnaOrderId=${result.data.order_id}, status=${result.data.status}`
      )

      return {
        status,
        data: {
          ...sessionData,
          klarnaOrderId: result.data.order_id,
          klarnaFraudStatus: result.data.fraud_status,
          status: result.data.status,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Klarna] Authorization failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message
      )
    }
  }

  /**
   * Capture payment — called AFTER shipment when tracking info is available.
   * Klarna authorization is valid for 28 days.
   * Uses idempotency key to prevent duplicate captures.
   */
  async capturePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const client = await this.getKlarnaClient()
      const { klarnaOrderId, amount, currency } = sessionData
      const currencyUpper = (currency || "EUR").toUpperCase()

      if (!klarnaOrderId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "No Klarna order ID in session data"
        )
      }

      // Convert Medusa amount (major units) to Klarna minor units (cents)
      const amountMinor = toMinorUnits(amount, currencyUpper)

      this.logger_.info(
        `[Klarna] capturePayment: medusa amount=${amount}, minor units=${amountMinor}, currency=${currencyUpper}`
      )

      const captureData = {
        captured_amount: amountMinor,
        description: "Capture",
        order_lines: [
          {
            type: "physical",
            name: "Order",
            quantity: 1,
            unit_price: amountMinor,
            tax_rate: 0,
            total_amount: amountMinor,
            total_tax_amount: 0,
          },
        ],
      }

      const idempotencyKey = crypto.randomUUID()

      const result = await client.captureOrder(
        klarnaOrderId,
        captureData,
        idempotencyKey
      )

      if (!result.success) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to capture order"
        )
      }

      this.logger_.info(
        `[Klarna] Order captured: klarnaOrderId=${klarnaOrderId}, captureId=${result.data?.capture_id}`
      )

      return {
        data: {
          ...sessionData,
          captureId: result.data?.capture_id,
          status: "CAPTURED",
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Klarna] Capture failed: ${error.message}`)
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
    const refundAmount = input.amount || sessionData.amount
    const currencyUpper = (sessionData.currency || "EUR").toUpperCase()
    try {
      const client = await this.getKlarnaClient()
      const { klarnaOrderId } = sessionData

      if (!klarnaOrderId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "No Klarna order ID in session data"
        )
      }

      // Convert Medusa amount (major units) to Klarna minor units (cents)
      const refundAmountMinor = toMinorUnits(refundAmount, currencyUpper)

      this.logger_.info(
        `[Klarna] refundPayment: medusa amount=${refundAmount}, minor units=${refundAmountMinor}, currency=${currencyUpper}`
      )

      const refundData = {
        refunded_amount: refundAmountMinor,
        reason: "customer_request",
        description: `Refund €${refundAmount.toFixed ? refundAmount.toFixed(2) : refundAmount}`,
      }

      const idempotencyKey = crypto.randomUUID()

      const result = await client.refundOrder(
        klarnaOrderId,
        refundData,
        idempotencyKey
      )

      if (!result.success) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to create refund"
        )
      }

      this.logger_.info(
        `[Klarna] Refund created for order ${klarnaOrderId}: ${result.data?.refund_id}`
      )

      return {
        data: {
          ...sessionData,
          refundId: result.data?.refund_id,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Klarna] Refund failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message
      )
    }
  }

  /**
   * Cancel payment — release remaining authorization
   */
  async cancelPayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const client = await this.getKlarnaClient()
      const { klarnaOrderId } = sessionData

      if (klarnaOrderId) {
        await client.releaseAuthorization(klarnaOrderId)
        this.logger_.info(`[Klarna] Authorization released for order ${klarnaOrderId}`)
      }

      return {
        data: {
          ...sessionData,
          status: "CANCELLED",
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Klarna] Cancel failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message
      )
    }
  }

  /**
   * Delete payment session — no-op for Klarna
   */
  async deletePayment(input: any): Promise<any> {
    return { data: input.data || input }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(input: any): Promise<PaymentSessionStatus> {
    const sessionData = input.data || input
    try {
      const client = await this.getKlarnaClient()
      const { klarnaOrderId } = sessionData

      if (!klarnaOrderId) {
        return PaymentSessionStatus.PENDING
      }

      const result = await client.getOrder(klarnaOrderId)
      if (!result.success) {
        return PaymentSessionStatus.ERROR
      }

      return mapKlarnaStatusToMedusa(result.data?.status || "AUTHORIZED")
    } catch (error: any) {
      this.logger_.error(`[Klarna] Status check failed: ${error.message}`)
      return PaymentSessionStatus.ERROR
    }
  }

  /**
   * Retrieve payment data
   */
  async retrievePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const client = await this.getKlarnaClient()
      const { klarnaOrderId } = sessionData

      if (!klarnaOrderId) {
        return { data: sessionData }
      }

      const result = await client.getOrder(klarnaOrderId)
      if (!result.success) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to retrieve order"
        )
      }

      return {
        data: {
          ...sessionData,
          klarnaOrderId: result.data.order_id,
          status: result.data.status,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Klarna] Retrieve failed: ${error.message}`)
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
    return await this.retrievePayment(input)
  }

  /**
   * Process Klarna webhook
   */
  async getWebhookActionAndData(webhookData: any): Promise<{
    action: string
    data: Record<string, unknown>
  }> {
    try {
      const { order_id, event_type } = webhookData

      if (!order_id) {
        return {
          action: "neutral",
          data: webhookData,
        }
      }

      const client = await this.getKlarnaClient()
      const result = await client.getOrder(order_id)

      if (!result.success) {
        throw new Error(result.error)
      }

      const klarnaOrder = result.data
      const status = klarnaOrder.status || "AUTHORIZED"

      // Map event type to action
      let action = "neutral"
      if (event_type === "order.authorized") {
        action = "succeed"
      } else if (event_type === "order.captured") {
        action = "succeed"
      } else if (event_type === "order.refunded") {
        action = "succeed"
      } else if (event_type === "order.cancelled") {
        action = "fail"
      } else if (event_type === "order.expired") {
        action = "fail"
      }

      return {
        action,
        data: {
          klarnaOrderId: order_id,
          status,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Klarna] Webhook processing failed: ${error.message}`)
      return {
        action: "fail",
        data: webhookData,
      }
    }
  }
}

export default KlarnaPaymentProviderService
