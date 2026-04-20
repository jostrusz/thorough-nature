// @ts-nocheck
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { AirwallexApiClient } from "./api-client"
import { Pool } from "pg"
import { logPaymentEvent } from "../payment-debug/utils/log"

type Options = {
  clientId?: string
  apiKey?: string
  testMode?: boolean
  accountId?: string
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
      return PaymentSessionStatus.CAPTURED
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
  private pgPool_: Pool | null = null

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
   * Get a shared PostgreSQL connection pool for direct DB queries.
   * Used because gatewayConfig module is not available in payment provider's DI scope.
   */
  private getPool(): Pool {
    if (!this.pgPool_) {
      const dbUrl = process.env.DATABASE_URL
      if (!dbUrl) throw new Error("DATABASE_URL not set")
      this.pgPool_ = new Pool({ connectionString: dbUrl, max: 3 })
    }
    return this.pgPool_
  }

  /**
   * Build the Airwallex API client with per-project gateway matching.
   * Reads gateway config via direct DB query (bypasses DI container).
   * Supports per-project Airwallex accounts by matching project_slug in project_slugs JSONB.
   * Falls back to provider options (env vars) if DB query fails.
   */
  private async getAirwallexClient(projectSlug?: string): Promise<AirwallexApiClient> {
    // Don't cache client — always re-read gateway config from DB
    // to support per-project credentials
    this.client_ = null

    // 1. Try gateway config from database (admin-configured) via direct DB query
    try {
      const pool = this.getPool()
      const { rows } = await pool.query(
        `SELECT id, display_name, mode, live_keys, test_keys, project_slugs, priority
         FROM gateway_config
         WHERE provider = 'airwallex' AND is_active = true AND deleted_at IS NULL
         ORDER BY priority ASC`
      )

      let config = null
      if (rows.length > 0) {
        // Match by project_slug if provided
        if (projectSlug) {
          config = rows.find((r: any) => {
            const slugs = Array.isArray(r.project_slugs) ? r.project_slugs : []
            return slugs.includes(projectSlug)
          })
          if (config) {
            this.logger_.info(`[Airwallex] ✓ Matched gateway "${config.display_name}" for project "${projectSlug}"`)
          }
        }
        // Fallback: first gateway with empty project_slugs, or first overall
        if (!config) {
          config = rows.find((r: any) => !r.project_slugs || r.project_slugs.length === 0) || rows[0]
          if (projectSlug) {
            this.logger_.info(`[Airwallex] Using default gateway "${config.display_name}" (no project match)`)
          }
        }
      }

      if (config) {
        const isLive = config.mode === "live"
        const keys = isLive ? config.live_keys : config.test_keys
        if (keys?.api_key && keys?.secret_key) {
          this.logger_.info(`[Airwallex] ✓ Using ${isLive ? "LIVE" : "TEST"} keys from admin gateway "${config.display_name}" (id: ${config.id})`)
          this.client_ = new AirwallexApiClient(
            keys.api_key,      // DB field "api_key" = Airwallex "Client ID"
            keys.secret_key,   // DB field "secret_key" = Airwallex "API Key"
            !isLive,           // isTest
            this.logger_,
            keys.account_id    // Account ID for org-level keys (x-on-behalf-of)
          )
          await this.client_.login()
          return this.client_
        }
      }
    } catch (e: any) {
      this.logger_.error(`[Airwallex] Direct DB query failed: ${e.message}`)
    }

    // 2. Fallback to options (env vars via medusa-config.js)
    if (this.options_?.clientId && this.options_?.apiKey) {
      this.logger_.warn(`[Airwallex] ⚠️ FALLBACK: Using credentials from ENV VARS (DB query failed)`)
      this.client_ = new AirwallexApiClient(
        this.options_.clientId,
        this.options_.apiKey,
        this.options_.testMode !== false,
        this.logger_,
        this.options_.accountId
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
      // Extract project slug from payment data or context for per-project gateway matching
      const projectSlug = data?.project_slug || context?.project_slug || null
      const client = await this.getAirwallexClient(projectSlug)

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

      const productName = data?.product_name || "Order"

      const customerEmail = customer?.email || data?.email || ""
      const customerFirstName = customer?.first_name || data?.billing_address?.first_name || data?.shipping_address?.first_name || ""
      const customerLastName = customer?.last_name || data?.billing_address?.last_name || data?.shipping_address?.last_name || ""
      const customerPhone = customer?.phone || data?.billing_address?.phone || data?.shipping_address?.phone || ""

      const createPayload: any = {
        amount: Number(amount),
        currency: currency_code.toUpperCase(),
        merchant_order_id: merchantOrderId,
        descriptor: productName,
        return_url: returnUrl,
        metadata: {
          customer_id: customer?.id,
          customer_email: customerEmail,
          session_id: data?.session_id,
          method: method,
          product_name: productName,
          quantity: String(data?.quantity || 1),
          customer_name: [customerFirstName, customerLastName].filter(Boolean).join(" ") || "",
        },
        customer: {
          ...(customerEmail && { email: customerEmail }),
          ...(customerFirstName && { first_name: customerFirstName }),
          ...(customerLastName && { last_name: customerLastName }),
          ...(customerPhone && { phone_number: customerPhone }),
        },
      }

      // Add shipping address to order object for Airwallex dashboard
      const shippingAddr = data?.shipping_address || data?.billing_address || {}
      if (shippingAddr.first_name || shippingAddr.address_1) {
        createPayload.order = {
          type: "physical",
          products: [
            {
              type: "physical",
              name: productName,
              quantity: Number(data?.quantity || 1),
              unit_price: Number(amount),
              desc: productName,
              sku: "book-order",
            }
          ],
          shipping: {
            first_name: shippingAddr.first_name || "",
            last_name: shippingAddr.last_name || "",
            phone_number: shippingAddr.phone || customerPhone || "",
            address: {
              city: shippingAddr.city || "",
              country_code: (shippingAddr.country_code || "NL").toUpperCase(),
              postcode: shippingAddr.postal_code || "",
              street: shippingAddr.address_1 || "",
            },
          },
        }
      }

      // Klarna requires order object on payment intent creation — override with Klarna-specific format
      if (method && method.startsWith("klarna")) {
        const billingAddr = data?.billing_address || data?.shipping_address || {}
        const orderAmount = Number(amount)
        createPayload.order = {
          type: "physical",
          products: [
            {
              type: "physical",
              name: productName,
              quantity: 1,
              unit_price: orderAmount,
              desc: productName,
              sku: "book-order",
            }
          ],
          shipping: {
            first_name: shippingAddr.first_name || "",
            last_name: shippingAddr.last_name || "",
            address: {
              city: shippingAddr.city || "",
              country_code: (shippingAddr.country_code || "DE").toUpperCase(),
              postcode: shippingAddr.postal_code || "",
              street: shippingAddr.address_1 || "",
            },
          },
        }
      }

      const paymentIntent = await client.createPaymentIntent(createPayload)

      this.logger_.info(
        `[Airwallex] Payment intent created: ${paymentIntent.id}, status: ${paymentIntent.status}`
      )

      // Journey log — intent creation (observability, never throws)
      logPaymentEvent({
        intent_id: paymentIntent.id,
        email: data?.email || null,
        project_slug: projectSlug,
        event_type: "airwallex_intent_created",
        event_data: {
          status: paymentIntent.status,
          amount: createPayload.amount,
          currency: createPayload.currency,
          method,
          request_id: createPayload.request_id,
          return_url: returnUrl || null,
        },
      }).catch(() => {})

      // Determine environment for frontend SDK via direct DB query
      let environment = "demo"
      try {
        const pool = this.getPool()
        const { rows } = await pool.query(
          `SELECT mode, project_slugs FROM gateway_config
           WHERE provider = 'airwallex' AND is_active = true AND deleted_at IS NULL
           ORDER BY priority ASC`
        )
        let envConfig = null
        if (rows.length > 0) {
          if (projectSlug) {
            envConfig = rows.find((r: any) => {
              const slugs = Array.isArray(r.project_slugs) ? r.project_slugs : []
              return slugs.includes(projectSlug)
            })
          }
          if (!envConfig) {
            envConfig = rows.find((r: any) => !r.project_slugs || r.project_slugs.length === 0) || rows[0]
          }
        }
        if (envConfig?.mode === "live") environment = "prod"
        else if (this.options_?.testMode === false) environment = "prod"
      } catch {}

      // Redirect-based methods: confirm intent server-side → get redirect URL
      // Credit cards use Drop-in element (inline form) — Airwallex hosted page doesn't work (CSP blocks)
      const REDIRECT_METHODS = ["ideal", "bancontact", "eps", "blik", "przelewy24", "p24", "payu", "paypal", "klarna", "klarna_later", "klarna_slice"]
      let checkoutUrl: string | null = null

      if (method && REDIRECT_METHODS.includes(method) && returnUrl) {
        try {
          // Map frontend method codes to Airwallex API type codes
          const METHOD_TYPE_MAP: Record<string, string> = {
            przelewy24: "p24",  // Airwallex API uses "p24" not "przelewy24"
          }
          const apiMethodType = METHOD_TYPE_MAP[method] || method
          const paymentMethodPayload: Record<string, any> = { type: apiMethodType }

          // Airwallex requires method-specific sub-object (e.g. bancontact: {}, ideal: {})
          const METHODS_WITH_SUB_OBJECT = ["bancontact", "ideal", "eps", "blik", "p24", "przelewy24", "payu", "paypal", "klarna", "klarna_later", "klarna_slice"]
          if (METHODS_WITH_SUB_OBJECT.includes(method)) {
            const subObjectKey = method.startsWith("klarna") ? "klarna" : apiMethodType
            paymentMethodPayload[subObjectKey] = {}
            // Klarna requires country_code in the payment method sub-object
            if (method.startsWith("klarna")) {
              const countryCode = data?.billing_address?.country_code?.toUpperCase()
                || data?.shipping_address?.country_code?.toUpperCase()
                || "DE"
              paymentMethodPayload.klarna.country_code = countryCode
            }
            // P24 requires shopper_name and shopper_email
            if (method === "przelewy24" || method === "p24") {
              const firstName = data?.shipping_address?.first_name || data?.billing_address?.first_name || ""
              const lastName = data?.shipping_address?.last_name || data?.billing_address?.last_name || ""
              paymentMethodPayload.p24.shopper_name = `${firstName} ${lastName}`.trim() || "Customer"
              paymentMethodPayload.p24.shopper_email = data?.email || ""
            }
            // PayU requires shopper_name
            if (method === "payu") {
              const firstName = data?.shipping_address?.first_name || data?.billing_address?.first_name || ""
              const lastName = data?.shipping_address?.last_name || data?.billing_address?.last_name || ""
              paymentMethodPayload.payu.shopper_name = `${firstName} ${lastName}`.trim() || "Customer"
            }
            // Bancontact requires shopper_name
            if (method === "bancontact") {
              const firstName = data?.shipping_address?.first_name || data?.billing_address?.first_name || ""
              const lastName = data?.shipping_address?.last_name || data?.billing_address?.last_name || ""
              paymentMethodPayload.bancontact.shopper_name = `${firstName} ${lastName}`.trim() || "Customer"
            }
            // BLIK requires shopper_name and shopper_email
            if (method === "blik") {
              const firstName = data?.shipping_address?.first_name || data?.billing_address?.first_name || ""
              const lastName = data?.shipping_address?.last_name || data?.billing_address?.last_name || ""
              paymentMethodPayload.blik.shopper_name = `${firstName} ${lastName}`.trim() || "Customer"
              paymentMethodPayload.blik.shopper_email = data?.email || ""
            }
          }
          // Server-side confirm for redirect payment methods (BLIK, P24, PayU, etc.)
          // Credit cards are NOT in REDIRECT_METHODS — they use Drop-in element on frontend
          {
            // Journey log — confirm request (strip sensitive blik_code before logging)
            const safePayload = JSON.parse(JSON.stringify(paymentMethodPayload))
            if (safePayload?.blik?.blik_code) safePayload.blik.blik_code = "[REDACTED]"
            logPaymentEvent({
              intent_id: paymentIntent.id,
              email: data?.email || null,
              project_slug: projectSlug,
              event_type: "airwallex_confirm_request",
              event_data: { method, payload: safePayload, return_url: returnUrl },
            }).catch(() => {})

            const confirmed = await client.confirmPaymentIntent(paymentIntent.id, {
              payment_method: paymentMethodPayload,
              return_url: returnUrl,
            })
            checkoutUrl = confirmed.next_action?.url || null
            this.logger_.info(
              `[Airwallex] Redirect method ${method} confirmed: ${paymentIntent.id}, redirect: ${checkoutUrl ? "yes" : "no"}`
            )

            logPaymentEvent({
              intent_id: paymentIntent.id,
              email: data?.email || null,
              project_slug: projectSlug,
              event_type: "airwallex_confirm_response",
              event_data: {
                method,
                status: confirmed.status,
                next_action_type: confirmed.next_action?.type || null,
                next_action_url: checkoutUrl,
                latest_payment_attempt_id: confirmed.latest_payment_attempt?.id || null,
              },
            }).catch(() => {})
          }
        } catch (confirmErr: any) {
          // Non-fatal: fall back to Drop-in on frontend
          this.logger_.warn(
            `[Airwallex] Server-side confirm for ${method} failed (will use Drop-in): ${confirmErr.message}`
          )
          logPaymentEvent({
            intent_id: paymentIntent.id,
            email: data?.email || null,
            project_slug: projectSlug,
            event_type: "airwallex_confirm_response",
            error_code: confirmErr?.code || "confirm_failed",
            event_data: {
              method,
              error_message: String(confirmErr?.message || confirmErr),
              error_detail: confirmErr?.response?.data || null,
            },
          }).catch(() => {})
        }
      }

      return {
        id: paymentIntent.id,
        data: {
          intentId: paymentIntent.id,
          airwallexPaymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          method: method,
          environment: environment,
          return_url: returnUrl,
          checkoutUrl: checkoutUrl,
          session_id: data?.session_id,
          currency_code,
          project_slug: projectSlug,
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
      const client = await this.getAirwallexClient(sessionData.project_slug)
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
      const client = await this.getAirwallexClient(sessionData.project_slug)
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
      const client = await this.getAirwallexClient(sessionData.project_slug)
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
      const client = await this.getAirwallexClient(sessionData.project_slug)
      const intentId = sessionData.intentId

      if (intentId) {
        const intent = await client.getPaymentIntent(intentId).catch(() => null)
        const status = intent?.status
        const terminal = ["CANCELLED", "SUCCEEDED", "EXPIRED", "FAILED"]
        if (intent && terminal.includes(status)) {
          this.logger_.info(`[Airwallex] Cancel no-op: ${intentId} already in terminal state ${status}`)
        } else {
          await client.cancelPaymentIntent(intentId)
          this.logger_.info(`[Airwallex] Cancel: ${intentId}`)
        }
      } else {
        this.logger_.info(`[Airwallex] Cancel: no ID`)
      }

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
      const client = await this.getAirwallexClient(data.project_slug)
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
      const client = await this.getAirwallexClient(sessionData.project_slug)
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
      const { name: event_type, data: eventData } = webhookData
      // Airwallex webhook: data contains the object directly (or nested in data.object)
      const intentId = eventData?.object?.id || eventData?.id

      if (!intentId) {
        return { action: "not_supported", data: webhookData }
      }

      const client = await this.getAirwallexClient()
      const paymentIntent = await client.getPaymentIntent(intentId)

      let action: string = "not_supported"

      if (event_type === "payment_intent.succeeded" || paymentIntent.status === "SUCCEEDED") {
        action = "authorized"
      } else if (event_type === "payment_intent.requires_capture" || paymentIntent.status === "REQUIRES_CAPTURE") {
        action = "authorized"
      } else if (event_type === "payment_intent.failed" || paymentIntent.status === "FAILED") {
        action = "failed"
      } else if (event_type === "payment_intent.cancelled" || paymentIntent.status === "CANCELLED") {
        action = "failed"
      }

      this.logger_.info(`[Airwallex] Webhook: ${intentId} → ${paymentIntent.status} → action: ${action}`)

      return {
        action,
        data: {
          intentId: paymentIntent.id,
          airwallexPaymentIntentId: paymentIntent.id,
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
