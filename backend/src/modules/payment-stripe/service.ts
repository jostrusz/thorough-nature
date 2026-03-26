// @ts-nocheck
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import Stripe from "stripe"
import { Pool } from "pg"

type Options = {
  secretKey?: string
  publishableKey?: string
  webhookSecret?: string
  testMode?: boolean
}

type InjectedDependencies = {
  logger: any
  gatewayConfig?: any
}

/**
 * Maps checkout method codes to Stripe payment_method_types
 */
const METHOD_MAP: Record<string, string> = {
  creditcard: "card",
  ideal: "ideal",
  bancontact: "bancontact",
  klarna: "klarna",
  eps: "eps",
  przelewy24: "p24",
  applepay: "card",
  googlepay: "card",
  revolut_pay: "revolut_pay",
  sepa_debit: "sepa_debit",
}

/**
 * Redirect-based methods that require server-side confirm
 */
const REDIRECT_METHODS = ["ideal", "bancontact", "klarna", "eps", "p24", "revolut_pay"]

/**
 * Maps Stripe PaymentIntent statuses to Medusa payment session statuses
 */
function mapStripeStatusToMedusa(stripeStatus: string): PaymentSessionStatus {
  switch (stripeStatus) {
    case "succeeded":
      return PaymentSessionStatus.CAPTURED
    case "requires_capture":
      return PaymentSessionStatus.AUTHORIZED
    case "requires_action":
    case "requires_confirmation":
      return PaymentSessionStatus.REQUIRES_MORE
    case "requires_payment_method":
      return PaymentSessionStatus.PENDING
    case "processing":
      return PaymentSessionStatus.PENDING
    case "canceled":
      return PaymentSessionStatus.CANCELED
    default:
      return PaymentSessionStatus.PENDING
  }
}

/**
 * Stripe Payment Provider for Medusa v2.
 * Follows the AbstractPaymentProvider pattern (same as Mollie/Airwallex/Klarna/PayPal).
 *
 * Supports: Card, iDEAL, Bancontact, Klarna, Google Pay, Apple Pay, Revolut Pay, EPS, Przelewy24
 * via Stripe Payment Intents API + Stripe.js Elements on frontend.
 *
 * Auto-capture is always on (capture_method: 'automatic').
 *
 * Credentials can come from:
 *   1. Gateway config module (admin-configured in DB) — preferred
 *   2. Provider options in medusa-config.js (env vars) — fallback
 *
 * Amounts: Medusa major units (49.99) → Stripe minor units (4999 cents)
 */
class StripePaymentProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "stripe"

  protected logger_: any
  protected options_: Options
  protected container_: any = null
  private pgPool_: Pool | null = null

  constructor(container: InjectedDependencies, options: Options) {
    super(container, options)
    this.container_ = container
    this.logger_ = container.logger || console
    this.options_ = options || {}

    this.logger_.info(
      `[Stripe] Provider initialized. Options secretKey: ${this.options_?.secretKey ? "set" : "not set"}`
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
   * Resolve Stripe credentials directly from gateway_config DB table.
   * Bypasses DI container (not available in payment provider scope).
   * Supports per-project Stripe accounts by matching project_slug in project_slugs JSONB.
   */
  private async resolveCredentials(projectSlug?: string): Promise<{
    secretKey: string
    publishableKey: string | null
    webhookSecret: string | null
    testMode: boolean
  }> {
    // 1. Query gateway_config table directly
    try {
      const pool = this.getPool()

      // Get all active Stripe gateways, ordered by priority
      const { rows } = await pool.query(
        `SELECT id, display_name, mode, live_keys, test_keys, project_slugs, priority
         FROM gateway_config
         WHERE provider = 'stripe' AND is_active = true AND deleted_at IS NULL
         ORDER BY priority ASC`
      )

      if (rows.length > 0) {
        let config = null

        // Match by project_slug if provided
        if (projectSlug) {
          config = rows.find((r: any) => {
            const slugs = Array.isArray(r.project_slugs) ? r.project_slugs : []
            return slugs.includes(projectSlug)
          })
          if (config) {
            this.logger_.info(`[Stripe] ✓ Matched gateway "${config.display_name}" for project "${projectSlug}"`)
          }
        }

        // Fallback: first active gateway (lowest priority)
        if (!config) {
          config = rows[0]
          this.logger_.info(`[Stripe] Using default gateway "${config.display_name}" (no project match)`)
        }

        const isLive = config.mode === "live"
        const keys = isLive ? config.live_keys : config.test_keys
        if (keys?.api_key) {
          this.logger_.info(`[Stripe] ✓ Using ${isLive ? "LIVE" : "TEST"} keys from admin gateway "${config.display_name}" (id: ${config.id})`)
          return {
            secretKey: keys.api_key,
            publishableKey: keys.publishable_key || null,
            webhookSecret: keys.secret_key || null,
            testMode: !isLive,
          }
        }
      }
    } catch (e: any) {
      this.logger_.error(`[Stripe] Direct DB query failed: ${e.message}`)
    }

    // 2. Fallback to env vars — only if DB query fails
    if (this.options_?.secretKey) {
      this.logger_.warn(`[Stripe] ⚠️ FALLBACK: Using credentials from ENV VARS (DB query failed)`)
      return {
        secretKey: this.options_.secretKey,
        publishableKey: this.options_.publishableKey || null,
        webhookSecret: this.options_.webhookSecret || null,
        testMode: this.options_.testMode !== false,
      }
    }

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Stripe credentials not configured. Set via admin gateway config."
    )
  }

  /**
   * Create a fresh Stripe SDK instance from resolved credentials.
   */
  private async getStripeClient(projectSlug?: string): Promise<Stripe> {
    const creds = await this.resolveCredentials(projectSlug)
    return new Stripe(creds.secretKey, {
      apiVersion: "2025-03-31.basil" as any,
    })
  }

  /**
   * Convert Medusa major unit amount to Stripe minor units (cents).
   * e.g. 49.99 → 4999
   */
  private toMinorUnits(amount: number | string): number {
    return Math.round(Number(amount) * 100)
  }

  /**
   * Initiate a payment session — create a Stripe PaymentIntent.
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
      const stripe = await this.getStripeClient(projectSlug)
      const creds = await this.resolveCredentials(projectSlug)

      const method = data?.method || "creditcard"
      const returnUrl = data?.return_url
      const customer = context?.customer

      // Map checkout method to Stripe payment_method_types
      const stripeMethodType = METHOD_MAP[method] || "card"
      const paymentMethodTypes = [stripeMethodType]

      const minorAmount = this.toMinorUnits(amount)
      const customerEmail = customer?.email || data?.email || ""

      // ─── CARD PAYMENTS: Use Stripe Checkout Session (hosted page) ───
      // Customer is redirected to Stripe's hosted checkout page instead of inline card fields
      if (stripeMethodType === "card" && returnUrl) {
        this.logger_.info(
          `[Stripe] Creating Checkout Session: method=${method}, amount=${minorAmount} ${currency_code}`
        )

        const sessionParams: Stripe.Checkout.SessionCreateParams = {
          mode: "payment",
          payment_method_types: paymentMethodTypes,
          line_items: [{
            price_data: {
              currency: currency_code.toLowerCase(),
              unit_amount: minorAmount,
              product_data: {
                name: data?.product_name || "Order Payment",
              },
            },
            quantity: 1,
          }],
          success_url: returnUrl,
          cancel_url: returnUrl.split("?")[0] || returnUrl,
          metadata: {
            customer_id: customer?.id || "",
            customer_email: customerEmail,
            session_id: data?.session_id || "",
            method: method,
          },
        }

        if (customerEmail) {
          sessionParams.customer_email = customerEmail
        }

        const session = await stripe.checkout.sessions.create(sessionParams)

        this.logger_.info(
          `[Stripe] Checkout Session created: ${session.id}, payment_intent: ${session.payment_intent}, url: ${session.url ? "yes" : "no"}`
        )

        // Structured initiation log
        this.logger_.info(JSON.stringify({
          _tag: "PAYMENT_INITIATED",
          provider: "stripe",
          method: method,
          stripe_method: "checkout_session",
          amount: amount,
          currency: currency_code,
          customer_email: customerEmail || undefined,
          session_id: session.id,
          payment_intent_id: session.payment_intent || undefined,
          redirect: true,
          status: session.status,
          timestamp: new Date().toISOString(),
        }))

        return {
          id: session.id,
          data: {
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: session.payment_intent as string || null,
            checkoutUrl: session.url,
            status: session.status,
            method: method,
            session_id: data?.session_id,
            currency_code,
          },
        }
      }

      // ─── REDIRECT METHODS: Use PaymentIntent with server-side confirm ───
      this.logger_.info(
        `[Stripe] Creating PaymentIntent: method=${method} (${stripeMethodType}), amount=${minorAmount} ${currency_code}`
      )

      const piParams: Stripe.PaymentIntentCreateParams = {
        amount: minorAmount,
        currency: currency_code.toLowerCase(),
        payment_method_types: paymentMethodTypes,
        capture_method: "automatic",
        metadata: {
          customer_id: customer?.id || "",
          customer_email: customerEmail,
          session_id: data?.session_id || "",
          method: method,
        },
      }

      // For redirect methods, add return_url and confirm server-side
      const isRedirectMethod = REDIRECT_METHODS.includes(stripeMethodType)

      if (isRedirectMethod && returnUrl) {
        piParams.confirm = true
        piParams.return_url = returnUrl

        // Stripe requires billing_details.name for redirect methods (Bancontact, iDEAL, etc.)
        const billingAddress = data?.billing_address || context?.billing_address || {}
        const shippingAddress = data?.shipping_address || context?.shipping_address || {}
        const billingName = [
          billingAddress.first_name || shippingAddress.first_name || "",
          billingAddress.last_name || shippingAddress.last_name || "",
        ].filter(Boolean).join(" ") || customerEmail || "Customer"

        piParams.payment_method_data = {
          type: stripeMethodType as any,
          billing_details: {
            name: billingName,
            email: customerEmail || undefined,
          },
        }

        // Set locale for redirect payment pages (iDEAL, Bancontact, etc.)
        // Use project locale from checkout data, default to 'nl' for NL/BE projects
        const projectLocale = (data?.locale || data?.language || "nl").toString().substring(0, 2).toLowerCase()
        if (!piParams.payment_method_options) piParams.payment_method_options = {}
        if (stripeMethodType === "ideal") {
          (piParams as any).payment_method_options.ideal = { preferred_locale: projectLocale }
        }
      }

      const paymentIntent = await stripe.paymentIntents.create(piParams)

      // Extract redirect URL for redirect-based methods
      let checkoutUrl: string | null = null
      if (isRedirectMethod && paymentIntent.next_action?.redirect_to_url?.url) {
        checkoutUrl = paymentIntent.next_action.redirect_to_url.url
      }

      this.logger_.info(
        `[Stripe] PaymentIntent created: ${paymentIntent.id}, status: ${paymentIntent.status}, redirect: ${checkoutUrl ? "yes" : "no"}`
      )

      // Structured initiation log
      this.logger_.info(JSON.stringify({
        _tag: "PAYMENT_INITIATED",
        provider: "stripe",
        method: method,
        stripe_method: stripeMethodType,
        amount: amount,
        currency: currency_code,
        customer_email: customerEmail || undefined,
        payment_intent_id: paymentIntent.id,
        redirect: !!checkoutUrl,
        status: paymentIntent.status,
        timestamp: new Date().toISOString(),
      }))

      return {
        id: paymentIntent.id,
        data: {
          stripePaymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          publishableKey: creds.publishableKey,
          status: paymentIntent.status,
          method: method,
          checkoutUrl: checkoutUrl,
          session_id: data?.session_id,
          currency_code,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Stripe] Payment initiation failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message || "Failed to initiate Stripe payment"
      )
    }
  }

  /**
   * Authorize payment — check Stripe PaymentIntent status
   */
  async authorizePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const stripe = await this.getStripeClient()

      // If we used Checkout Session, resolve the PaymentIntent from it
      if (sessionData.stripeCheckoutSessionId && !sessionData.stripePaymentIntentId) {
        const session = await stripe.checkout.sessions.retrieve(sessionData.stripeCheckoutSessionId)
        if (session.payment_intent) {
          sessionData.stripePaymentIntentId = session.payment_intent as string
        }
        this.logger_.info(`[Stripe] Authorize: Resolved PI ${sessionData.stripePaymentIntentId} from Checkout Session ${sessionData.stripeCheckoutSessionId}`)
      }

      const piId = sessionData.stripePaymentIntentId

      if (!piId) {
        return {
          status: PaymentSessionStatus.PENDING,
          data: sessionData,
        }
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(piId)
      const status = mapStripeStatusToMedusa(paymentIntent.status)

      this.logger_.info(`[Stripe] Authorize: ${piId} → ${paymentIntent.status} → ${status}`)

      return {
        status,
        data: {
          ...sessionData,
          stripePaymentIntentId: piId,
          status: paymentIntent.status,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Stripe] Authorization failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message
      )
    }
  }

  /**
   * Capture payment — auto-capture is always on, so just retrieve status.
   */
  async capturePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const stripe = await this.getStripeClient()
      const piId = sessionData.stripePaymentIntentId

      if (!piId) {
        return { data: sessionData }
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(piId)

      this.logger_.info(`[Stripe] Capture check: ${piId}, status: ${paymentIntent.status}`)

      return {
        data: { ...sessionData, status: paymentIntent.status },
      }
    } catch (error: any) {
      this.logger_.error(`[Stripe] Capture failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message
      )
    }
  }

  /**
   * Refund payment — amount is in major units, convert to minor for Stripe
   */
  async refundPayment(input: any): Promise<any> {
    const sessionData = input.data || input
    const refundAmount = input.amount
    try {
      const stripe = await this.getStripeClient()
      const piId = sessionData.stripePaymentIntentId

      if (!piId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "No Stripe payment intent ID in session data"
        )
      }

      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: piId,
      }

      // Only set amount if partial refund
      if (refundAmount && refundAmount > 0) {
        refundParams.amount = this.toMinorUnits(refundAmount)
      }

      const refund = await stripe.refunds.create(refundParams)

      this.logger_.info(`[Stripe] Refund created: ${refund.id}, amount: ${refund.amount}, status: ${refund.status}`)

      return {
        data: {
          ...sessionData,
          refundId: refund.id,
          refundStatus: refund.status,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Stripe] Refund failed: ${error.message}`)
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
      const stripe = await this.getStripeClient()
      const piId = sessionData.stripePaymentIntentId

      if (piId) {
        await stripe.paymentIntents.cancel(piId)
        this.logger_.info(`[Stripe] Canceled: ${piId}`)
      }

      return {
        data: { ...sessionData, status: "canceled" },
      }
    } catch (error: any) {
      this.logger_.error(`[Stripe] Cancel failed: ${error.message}`)
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
      const stripe = await this.getStripeClient()
      const piId = data.stripePaymentIntentId

      if (!piId) return PaymentSessionStatus.PENDING

      const paymentIntent = await stripe.paymentIntents.retrieve(piId)
      return mapStripeStatusToMedusa(paymentIntent.status)
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
      const stripe = await this.getStripeClient()
      const piId = sessionData.stripePaymentIntentId

      if (!piId) {
        return { data: sessionData }
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(piId)

      return {
        data: {
          ...sessionData,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Stripe] Retrieve failed: ${error.message}`)
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
   * Process Stripe webhook events
   */
  async getWebhookActionAndData(webhookData: any): Promise<any> {
    try {
      const { type: eventType, data: eventData } = webhookData
      const paymentIntent = eventData?.object

      if (!paymentIntent?.id) {
        return { action: "not_supported", data: webhookData }
      }

      let action = "not_supported"

      if (eventType === "payment_intent.succeeded") {
        action = "authorized"
      } else if (eventType === "payment_intent.payment_failed") {
        action = "failed"
      } else if (eventType === "charge.refunded") {
        action = "not_supported" // Refunds handled via admin
      }

      this.logger_.info(`[Stripe] Webhook: ${paymentIntent.id} → ${eventType} → action: ${action}`)

      return {
        action,
        data: {
          stripePaymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          session_id: paymentIntent.metadata?.session_id,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Stripe] Webhook processing failed: ${error.message}`)
      return { action: "not_supported", data: webhookData }
    }
  }
}

export default StripePaymentProviderService
