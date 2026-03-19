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

  /** APM methods that use PayPal's redirect-to-bank flow (intent: CAPTURE, auto-capture) */
  static APM_METHODS: Record<string, { country_code: string }> = {
    ideal:      { country_code: "NL" },
    bancontact: { country_code: "BE" },
    blik:       { country_code: "PL" },
    p24:        { country_code: "PL" },
    eps:        { country_code: "AT" },
    swish:      { country_code: "SE" },
  }

  protected logger_: any
  protected options_: Options
  protected client_: PayPalApiClient | null = null
  protected container_: any = null

  constructor(container: InjectedDependencies, options: Options) {
    super(container, options)
    this.logger_ = container.logger || console
    this.options_ = options || {}
    this.container_ = container

    this.logger_.info(`[PayPal] Provider initialized.`)
  }

  /**
   * Lazily resolve the gateway config service from the container.
   * This avoids issues where the gateway config module isn't yet available
   * at payment provider constructor time.
   */
  private getGatewayConfigService(): any {
    try {
      return this.container_.resolve("gatewayConfig")
    } catch {
      return null
    }
  }

  /**
   * Build the PayPal API client with per-project gateway matching.
   * Tries gateway config (admin DB) first, then falls back to options/env vars.
   * Supports per-project PayPal accounts by matching project_slug in project_slugs JSONB.
   */
  private async getPayPalClient(projectSlug?: string): Promise<PayPalApiClient> {
    // Don't cache client — always re-read gateway config from DB
    // to support per-project credentials
    this.client_ = null

    // 1. Try gateway config from database via direct DB query (bypasses DI container)
    try {
      const { Pool } = require("pg")
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
      const { rows } = await pool.query(
        `SELECT id, display_name, mode, live_keys, test_keys, project_slugs, priority
         FROM gateway_config
         WHERE provider = 'paypal' AND is_active = true AND deleted_at IS NULL
         ORDER BY priority ASC`
      )
      await pool.end()

      let config = null
      if (rows.length > 0) {
        // Match by project_slug if provided
        if (projectSlug) {
          config = rows.find((r: any) => {
            const slugs = Array.isArray(r.project_slugs) ? r.project_slugs : []
            return slugs.includes(projectSlug)
          })
          if (config) {
            this.logger_.info(`[PayPal] ✓ Matched gateway "${config.display_name}" for project "${projectSlug}"`)
          }
        }
        // Fallback: first gateway with empty project_slugs, or first overall
        if (!config) {
          config = rows.find((r: any) => !r.project_slugs || r.project_slugs.length === 0) || rows[0]
          if (projectSlug) {
            this.logger_.info(`[PayPal] Using default gateway "${config.display_name}" (no project match)`)
          }
        }
      }

      if (config) {
        const isLive = config.mode === "live"
        const keys = isLive ? config.live_keys : config.test_keys
        const cfgClientId = keys?.client_id || keys?.api_key
        const cfgClientSecret = keys?.client_secret || keys?.secret_key
        if (cfgClientId && cfgClientSecret) {
          this.logger_.info(
            `[PayPal] ✓ Using ${isLive ? "LIVE" : "SANDBOX"} keys from admin gateway "${config.display_name}" (id: ${config.id})`
          )
          this.client_ = new PayPalApiClient({
            client_id: cfgClientId,
            client_secret: cfgClientSecret,
            mode: isLive ? "live" : "test",
          })
          return this.client_
        }
      }
    } catch (e: any) {
      this.logger_.warn(`[PayPal] ⚠️ DB gateway config query failed: ${e.message}`)
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
      this.logger_.info(`[PayPal] ⚠️ FALLBACK: Using credentials from ENV VARS (DB query failed)`)
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
   * Supports per-project gateway matching via project_slug.
   * Returns from gateway config or env var.
   */
  private async getClientIdForFrontend(projectSlug?: string): Promise<string | null> {
    try {
      const { Pool } = require("pg")
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
      const { rows } = await pool.query(
        `SELECT mode, live_keys, test_keys, project_slugs
         FROM gateway_config
         WHERE provider = 'paypal' AND is_active = true AND deleted_at IS NULL
         ORDER BY priority ASC`
      )
      await pool.end()

      let config = null
      if (rows.length > 0) {
        if (projectSlug) {
          config = rows.find((r: any) => {
            const slugs = Array.isArray(r.project_slugs) ? r.project_slugs : []
            return slugs.includes(projectSlug)
          })
        }
        if (!config) {
          config = rows.find((r: any) => !r.project_slugs || r.project_slugs.length === 0) || rows[0]
        }
      }

      if (config) {
        const isLive = config.mode === "live"
        const keys = isLive ? config.live_keys : config.test_keys
        return keys?.client_id || keys?.api_key || null
      }
    } catch {
      // fall through
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

    let orderData: any
    try {
      // Extract project slug from payment data or context for per-project gateway matching
      const projectSlug = data?.project_slug || context?.project_slug || null
      const client = await this.getPayPalClient(projectSlug)
      const clientIdForFrontend = await this.getClientIdForFrontend(projectSlug)

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

      const method = data?.method || ""
      const apmConfig = PayPalPaymentProviderService.APM_METHODS[method]
      const isAPM = !!apmConfig

      // Shared purchase_units
      const purchaseUnits = [
        {
          reference_id: context?.cart_id || `medusa-${Date.now()}`,
          amount: {
            currency_code: currency,
            value: totalValue,
          },
        },
      ]

      const isCard = method === "creditcard"

      if (isCard) {
        // ── Card Flow: Redirect to PayPal hosted page ──
        // Create order WITH payment_source.paypal + experience_context so PayPal
        // returns an approvalUrl. On the hosted page guests see "Pay with Debit
        // or Credit Card" alongside the PayPal wallet option.
        // Uses CAPTURE intent with ORDER_COMPLETE_ON_PAYMENT_APPROVAL so the
        // payment is captured automatically when the customer approves.
        orderData = {
          intent: "CAPTURE",
          processing_instruction: "ORDER_COMPLETE_ON_PAYMENT_APPROVAL",
          purchase_units: purchaseUnits,
          payment_source: {
            paypal: {
              experience_context: {
                payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
                brand_name: process.env.STORE_NAME || "Performance Marketing Solution",
                user_action: "PAY_NOW",
                return_url: returnUrl,
                cancel_url: cancelUrl,
              },
            },
          },
        }

        this.logger_.info(
          `[PayPal] Creating card redirect order: amount=${totalValue} ${currency}`
        )
      } else if (isAPM) {
        // ── APM Flow: CAPTURE + auto-capture on approval ──
        const customerName = [
          data?.billing_address?.first_name || data?.shipping_address?.first_name || "",
          data?.billing_address?.last_name || data?.shipping_address?.last_name || "",
        ].filter(Boolean).join(" ") || "Customer"

        const countryCode = (
          data?.billing_address?.country_code || apmConfig.country_code
        ).toUpperCase()

        const customerEmail = data?.email || ""

        const apmPaymentSource: any = {
          country_code: countryCode,
          name: customerName,
        }

        // P24 requires email
        if (method === "p24" && customerEmail) {
          apmPaymentSource.email = customerEmail
        }
        // BLIK can optionally include email
        if (method === "blik" && customerEmail) {
          apmPaymentSource.email = customerEmail
        }
        // Swish does not use the name field
        if (method === "swish") {
          delete apmPaymentSource.name
        }

        // APMs require experience_context INSIDE the payment_source (not top-level application_context)
        apmPaymentSource.experience_context = {
          payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
          return_url: returnUrl,
          cancel_url: cancelUrl,
        }

        orderData = {
          intent: "CAPTURE",
          processing_instruction: "ORDER_COMPLETE_ON_PAYMENT_APPROVAL",
          purchase_units: purchaseUnits,
          payment_source: {
            [method]: apmPaymentSource,
          },
        }

        this.logger_.info(
          `[PayPal] Creating APM order: method=${method}, amount=${totalValue} ${currency}, country=${countryCode}`
        )
      } else if (data?.express) {
        // ── Express Checkout (SDK Buttons popup flow) ──
        // Do NOT include payment_source — the JS SDK Buttons handle it.
        // Including payment_source.paypal with return_url forces redirect mode,
        // which causes the popup to immediately close.
        // Use CAPTURE intent for immediate payment.
        orderData = {
          intent: "CAPTURE",
          purchase_units: purchaseUnits,
        }

        this.logger_.info(
          `[PayPal] Creating express order (SDK Buttons): amount=${totalValue} ${currency}`
        )
      } else {
        // ── PayPal Wallet Redirect Flow: CAPTURE (auto-capture on approval) ──
        // Used when redirecting to PayPal hosted page (non-SDK flow)
        orderData = {
          intent: "CAPTURE",
          processing_instruction: "ORDER_COMPLETE_ON_PAYMENT_APPROVAL",
          purchase_units: purchaseUnits,
          payment_source: {
            paypal: {
              experience_context: {
                payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
                brand_name: process.env.STORE_NAME || "Performance Marketing Solution",
                user_action: "PAY_NOW",
                return_url: returnUrl,
                cancel_url: cancelUrl,
              },
            },
          },
        }

        this.logger_.info(
          `[PayPal] Creating wallet redirect order: amount=${totalValue} ${currency}`
        )
      }

      const result = await client.createOrder(orderData)

      // Extract approval URL from PayPal response links
      const approveLink = result.links?.find(
        (l: any) => l.rel === "approve" || l.rel === "payer-action"
      )
      const approvalUrl = approveLink?.href || null

      this.logger_.info(
        `[PayPal] Order created: ${result.id}, status: ${result.status}, approvalUrl: ${approvalUrl ? "yes" : "none"}`
      )

      // Return format required by Medusa v2: { id, data }
      // approvalUrl is used by the checkout to redirect the customer to PayPal/bank
      return {
        id: result.id,
        data: {
          paypalOrderId: result.id,
          status: result.status,
          approvalUrl,
          client_id: clientIdForFrontend,
          currency_code: currency,
          amount: totalValue,
          isAPM,
          isCard,
          method,
          project_slug: projectSlug,
        },
      }
    } catch (error: any) {
      const paypalError = error.response?.data
      const errorMsg = paypalError?.message || error.message
      const errorDetails = paypalError?.details
        ? JSON.stringify(paypalError.details)
        : "no details"
      const debugId = paypalError?.debug_id || "none"

      this.logger_.error(
        `[PayPal] Payment initiation failed: ${errorMsg} | debug_id=${debugId} | details=${errorDetails}`
      )
      // Log the full request payload for debugging
      this.logger_.error(
        `[PayPal] Request payload was: ${JSON.stringify(orderData || {})}`
      )

      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        errorMsg || "Failed to create PayPal order"
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
      const client = await this.getPayPalClient(sessionData.project_slug)
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

      // Auto-capture: if order is APPROVED and intent was CAPTURE, capture now
      if (status === "APPROVED") {
        try {
          const capturedOrder = await client.captureOrder(paypalOrderId)
          const newCaptures = capturedOrder.purchase_units?.[0]?.payments?.captures || []
          if (newCaptures.length > 0 && newCaptures[0].status === "COMPLETED") {
            this.logger_.info(
              `[PayPal] Auto-captured order ${paypalOrderId}, captureId=${newCaptures[0].id}`
            )
            return {
              status: PaymentSessionStatus.AUTHORIZED,
              data: {
                ...sessionData,
                paypalOrderId,
                captureId: newCaptures[0].id,
                status: "CAPTURED",
                payer: capturedOrder.payer,
              },
            }
          }
        } catch (captureErr: any) {
          this.logger_.warn(`[PayPal] Auto-capture failed for ${paypalOrderId}: ${captureErr.message}`)
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
      const client = await this.getPayPalClient(sessionData.project_slug)
      const { paypalOrderId, authorizationId, currency_code, amount } =
        sessionData

      // Check if order is already captured (APM, Card, or Express orders may auto-capture)
      if (paypalOrderId) {
        const order = await client.getOrder(paypalOrderId)
        const captures = order.purchase_units?.[0]?.payments?.captures || []
        if (captures.length > 0 && captures[0].status === "COMPLETED") {
          const flowType = sessionData.isCard ? 'Card' : sessionData.isAPM ? 'APM' : 'Express'
          this.logger_.info(
            `[PayPal] ${flowType} order already captured: orderId=${paypalOrderId}, captureId=${captures[0].id}`
          )
          return {
            data: {
              ...sessionData,
              captureId: captures[0].id,
              captureStatus: "COMPLETED",
              status: "CAPTURED",
            },
          }
        }
      }

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
      const client = await this.getPayPalClient(sessionData.project_slug)
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
      const client = await this.getPayPalClient(sessionData.project_slug)
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
      const client = await this.getPayPalClient(data.project_slug)
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
      const client = await this.getPayPalClient(sessionData.project_slug)
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
