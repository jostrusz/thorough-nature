// @ts-nocheck
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { PayUApiClient, toMinorString, fromMinor } from "./api-client"
import { Pool } from "pg"
import { logPaymentEvent } from "../payment-debug/utils/log"

type Options = {}

type InjectedDependencies = {
  logger: any
}

/**
 * Map PayU order status → Medusa payment session status.
 *
 * PayU statuses:
 *  - PENDING                  : waiting for funds (customer hasn't paid yet)
 *  - WAITING_FOR_CONFIRMATION : funds reserved, awaiting merchant capture (only when POS auto-receive OFF)
 *  - COMPLETED                : paid ✓
 *  - CANCELED                 : user abandoned / failed
 *  - NEW                      : order just created
 */
function mapPayUStatusToMedusa(payuStatus: string): PaymentSessionStatus {
  switch ((payuStatus || "").toUpperCase()) {
    case "COMPLETED":
      return PaymentSessionStatus.CAPTURED
    case "WAITING_FOR_CONFIRMATION":
      return PaymentSessionStatus.AUTHORIZED
    case "PENDING":
    case "NEW":
      return PaymentSessionStatus.PENDING
    case "CANCELED":
    case "CANCELLED":
      return PaymentSessionStatus.CANCELED
    default:
      return PaymentSessionStatus.PENDING
  }
}

/**
 * PayU GPO Europe Payment Provider for Medusa v2.
 *
 * Multi-tenant via gateway_config table (provider='payu').
 * Per-currency POS support via metadata.pos_by_currency = { PLN: {...}, EUR: {...} }.
 *
 * Selected methods (BLIK / Card / GPay / ApplePay / PBL banks / Raty / BNPL) are
 * stored in metadata.selected_methods and surfaced in the storefront.
 *
 * Amounts in/out of this service are MAJOR units; conversion to PayU's MINOR-units-as-string
 * happens inside the api-client.
 */
class PayUPaymentProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "payu"

  protected logger_: any
  protected options_: Options
  protected container_: any = null
  private pgPool_: Pool | null = null

  constructor(container: InjectedDependencies, options: Options) {
    super(container, options)
    this.logger_ = container.logger || console
    this.options_ = options || {}
    this.container_ = container
    this.logger_.info(`[PayU] Provider initialized`)
  }

  private getPool(): Pool {
    if (!this.pgPool_) {
      const dbUrl = process.env.DATABASE_URL
      if (!dbUrl) throw new Error("DATABASE_URL not set")
      this.pgPool_ = new Pool({ connectionString: dbUrl, max: 3 })
    }
    return this.pgPool_
  }

  /**
   * Load active PayU gateway_config row matching projectSlug (with sensible fallbacks).
   * Returns the row or null.
   */
  private async loadGatewayConfig(projectSlug?: string): Promise<any> {
    try {
      const pool = this.getPool()
      const { rows } = await pool.query(
        `SELECT id, display_name, mode, live_keys, test_keys, project_slugs, metadata, priority
         FROM gateway_config
         WHERE provider = 'payu' AND is_active = true AND deleted_at IS NULL
         ORDER BY priority ASC`
      )
      if (!rows.length) return null

      let config: any = null
      if (projectSlug) {
        config = rows.find((r: any) => {
          const slugs = Array.isArray(r.project_slugs) ? r.project_slugs : []
          return slugs.includes(projectSlug)
        })
        if (config) {
          this.logger_.info(`[PayU] ✓ Matched gateway "${config.display_name}" for project "${projectSlug}"`)
        }
      }
      if (!config) {
        config = rows.find((r: any) => !r.project_slugs || r.project_slugs.length === 0) || rows[0]
        if (projectSlug) {
          this.logger_.info(`[PayU] Using default gateway "${config.display_name}" (no project match)`)
        }
      }
      return config
    } catch (e: any) {
      this.logger_.error(`[PayU] DB query for gateway_config failed: ${e.message}`)
      return null
    }
  }

  /**
   * Resolve the credentials/POS to use for a given (projectSlug, currency) pair.
   * Returns { posId, clientSecret, secondKey, isLive, currency } or throws.
   *
   * metadata.pos_by_currency = {
   *   "PLN": { "pos_id": "300...", "client_secret": "...", "second_key": "..." },
   *   "EUR": { "pos_id": "301...", "client_secret": "...", "second_key": "..." }
   * }
   * Fallback to live_keys/test_keys top-level when currency-specific POS missing.
   */
  private async resolveCredentials(
    projectSlug: string | undefined,
    currency: string | undefined
  ): Promise<{ posId: string; clientSecret: string; secondKey: string; isLive: boolean; configId: string; displayName: string }> {
    const config = await this.loadGatewayConfig(projectSlug)
    if (!config) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "PayU gateway not configured. Create an active gateway_config row (provider='payu') in admin."
      )
    }
    const isLive = config.mode === "live"
    const keys = isLive ? (config.live_keys || {}) : (config.test_keys || {})
    let meta = config.metadata || {}
    if (typeof meta === "string") {
      try { meta = JSON.parse(meta) } catch { meta = {} }
    }

    // Try per-currency POS first
    const currencyKey = (currency || "").toUpperCase()
    const posByCurrency = meta.pos_by_currency || {}
    const currencyPos = currencyKey ? posByCurrency[currencyKey] : null

    let posId: string | undefined = currencyPos?.pos_id
    let clientSecret: string | undefined = currencyPos?.client_secret
    let secondKey: string | undefined = currencyPos?.second_key

    // Fallback to default top-level keys
    if (!posId) posId = keys.api_key
    if (!clientSecret) clientSecret = keys.secret_key
    if (!secondKey) secondKey = keys.webhook_secret

    if (!posId || !clientSecret) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `PayU credentials missing for currency=${currencyKey || "?"}. ` +
        `Set live_keys.api_key (POS ID), live_keys.secret_key (Client Secret), live_keys.webhook_secret (Second/MD5 key), ` +
        `or metadata.pos_by_currency.${currencyKey || "PLN"}.{pos_id,client_secret,second_key}.`
      )
    }

    return {
      posId,
      clientSecret,
      secondKey: secondKey || "",
      isLive,
      configId: config.id,
      displayName: config.display_name,
    }
  }

  /**
   * Build an authenticated PayU API client for the request's project+currency.
   * Always creates a fresh client (no cross-tenant caching).
   */
  private async getPayUClient(projectSlug?: string, currency?: string): Promise<{ client: PayUApiClient; posId: string; secondKey: string; isLive: boolean }> {
    const creds = await this.resolveCredentials(projectSlug, currency)
    const client = new PayUApiClient(creds.posId, creds.clientSecret, !creds.isLive, this.logger_)
    await client.login()
    return { client, posId: creds.posId, secondKey: creds.secondKey, isLive: creds.isLive }
  }

  /**
   * Initiate a payment session → create PayU order, return redirectUri to frontend.
   *
   * Medusa v2 input shape: { amount, currency_code, data, context }
   * - amount: MAJOR units (e.g. 49.99)
   * - data: frontend-provided session info (method, return_url, project_slug, cart_id, ...)
   * - context: customer/cart info
   *
   * Must return { id, data } where id is a unique session identifier.
   */
  async initiatePayment(input: any): Promise<any> {
    const { amount, currency_code, data, context } = input
    const projectSlug = data?.project_slug || context?.project_slug || null
    const cartId = data?.cart_id || data?.session_id || context?.cart?.id || `sess_${Date.now()}`
    const method = data?.method || null
    const customer = context?.customer

    try {
      const { client, posId } = await this.getPayUClient(projectSlug, currency_code)

      // Build URLs (continueUrl = customer return after PayU hosted page)
      const backendUrl =
        process.env.BACKEND_PUBLIC_URL ||
        (process.env.RAILWAY_PUBLIC_DOMAIN_VALUE
          ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN_VALUE}`
          : "http://localhost:9000")
      const returnUrl = data?.return_url || `${backendUrl}/checkout?payment_return=1&cart_id=${cartId}`
      const notifyUrl = data?.notify_url || `${backendUrl}/webhooks/payu`
      const customerIp = data?.customer_ip || context?.ip || "127.0.0.1"

      // Customer info
      const customerEmail = customer?.email || data?.email || "customer@example.com"
      const customerFirstName = customer?.first_name || data?.billing_address?.first_name || data?.shipping_address?.first_name || ""
      const customerLastName = customer?.last_name || data?.billing_address?.last_name || data?.shipping_address?.last_name || ""
      const customerPhone = customer?.phone || data?.billing_address?.phone || data?.shipping_address?.phone || ""

      const productName = data?.product_name || data?.description || "Order"
      const quantity = Number(data?.quantity || 1)
      const totalMinor = toMinorString(amount)
      const unitPriceMinor = toMinorString(Number(amount) / Math.max(1, quantity))

      // extOrderId = cart_id (idempotency key; PayU rejects duplicates)
      const extOrderId = `${cartId}-${Date.now().toString(36)}`

      const orderPayload: any = {
        merchantPosId: posId,
        customerIp,
        description: productName,
        currencyCode: currency_code.toUpperCase(),
        totalAmount: totalMinor,
        extOrderId,
        continueUrl: returnUrl,
        notifyUrl,
        buyer: {
          email: customerEmail,
          ...(customerFirstName && { firstName: customerFirstName }),
          ...(customerLastName && { lastName: customerLastName }),
          ...(customerPhone && { phone: customerPhone }),
          language: data?.language || (currency_code.toUpperCase() === "PLN" ? "pl" : "en"),
        },
        products: [
          {
            name: productName,
            unitPrice: unitPriceMinor,
            quantity,
          },
        ],
      }

      // Pin specific payment method if provided (e.g. "blik", "c", "jp", "m"...)
      // Without payMethods, PayU shows hosted method picker on redirectUri.
      if (method) {
        const PAYU_TYPE_MAP: Record<string, string> = {
          // Card
          c: "CARD_TOKEN",
          card: "CARD_TOKEN",
          // Wallets
          jp: "PBL",
          gp: "PBL",
          googlepay: "PBL",
          ap: "PBL",
          applepay: "PBL",
          // BLIK
          blik: "PBL",
          // Pay-by-link (PBL) bank methods
          m: "PBL", i: "PBL", o: "PBL", s: "PBL", pkb: "PBL",
          mtb: "PBL", inteligo: "PBL", bos: "PBL", pekao24: "PBL",
          // Installments / BNPL
          ai: "PBL", twi: "PBL", payu_payments_pl: "PBL", wt: "PBL", dpt: "PBL",
        }
        const PAYU_VALUE_MAP: Record<string, string> = {
          card: "c",
          googlepay: "jp",
          applepay: "ap",
        }
        const value = PAYU_VALUE_MAP[method] || method
        const type = PAYU_TYPE_MAP[method] || "PBL"
        orderPayload.payMethods = { payMethod: { type, value } }
      }

      this.logger_.info(
        `[PayU] Creating order: pos=${posId}, amount=${amount} ${currency_code.toUpperCase()}, method=${method || "AUTO"}, extOrderId=${extOrderId}`
      )

      // Journey log — intent created (observability; never throws)
      logPaymentEvent({
        intent_id: extOrderId,
        cart_id: cartId,
        email: customerEmail,
        project_slug: projectSlug,
        event_type: "payu_intent_created",
        event_data: {
          amount,
          currency: currency_code.toUpperCase(),
          method: method || null,
          pos_id: posId,
          return_url: returnUrl,
          notify_url: notifyUrl,
        },
      }).catch(() => {})

      const created = await client.createOrder(orderPayload)
      const statusCode = created?.status?.statusCode

      logPaymentEvent({
        intent_id: created.orderId || extOrderId,
        cart_id: cartId,
        email: customerEmail,
        project_slug: projectSlug,
        event_type: "payu_order_response",
        event_data: {
          status_code: statusCode,
          payu_order_id: created.orderId,
          ext_order_id: created.extOrderId,
          redirect_uri: created.redirectUri || null,
        },
        error_code: statusCode && !statusCode.startsWith("SUCCESS") && !statusCode.startsWith("WARNING") ? statusCode : null,
      }).catch(() => {})

      if (!created.orderId) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `PayU order create did not return orderId. status=${statusCode || "?"}`
        )
      }

      return {
        id: created.orderId,
        data: {
          payuOrderId: created.orderId,
          extOrderId: created.extOrderId || extOrderId,
          redirectUri: created.redirectUri || null,
          checkoutUrl: created.redirectUri || null, // alias for storefront convention
          statusCode: statusCode || null,
          status: "PENDING",
          amount: Number(amount),
          currency: currency_code.toUpperCase(),
          method,
          project_slug: projectSlug,
          cart_id: cartId,
          pos_id: posId,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[PayU] initiatePayment failed: ${error.message}`)
      logPaymentEvent({
        cart_id: cartId,
        email: data?.email || null,
        project_slug: projectSlug,
        event_type: "payu_intent_create_failed",
        event_data: { error: String(error.message || error) },
        error_code: "create_failed",
      }).catch(() => {})
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message || "Failed to initiate PayU payment"
      )
    }
  }

  async authorizePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const { client } = await this.getPayUClient(sessionData.project_slug, sessionData.currency)
      const orderId = sessionData.payuOrderId
      if (!orderId) {
        return { status: PaymentSessionStatus.PENDING, data: sessionData }
      }
      const orderResp = await client.getOrder(orderId)
      const ord = orderResp?.orders?.[0] || {}
      const status = mapPayUStatusToMedusa(ord.status)
      this.logger_.info(`[PayU] Authorize: ${orderId} → ${ord.status} → ${status}`)
      return {
        status,
        data: { ...sessionData, status: ord.status },
      }
    } catch (error: any) {
      this.logger_.error(`[PayU] authorizePayment failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  async capturePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const { client } = await this.getPayUClient(sessionData.project_slug, sessionData.currency)
      const orderId = sessionData.payuOrderId
      if (!orderId) return { data: sessionData }
      // For auto-receive ON POSes this is a no-op (already COMPLETED).
      // For auto-receive OFF POSes, transition WAITING_FOR_CONFIRMATION → COMPLETED.
      const orderResp = await client.getOrder(orderId)
      const ord = orderResp?.orders?.[0] || {}
      if ((ord.status || "").toUpperCase() === "WAITING_FOR_CONFIRMATION") {
        await client.captureOrder(orderId)
      }
      return { data: { ...sessionData, status: "COMPLETED" } }
    } catch (error: any) {
      this.logger_.error(`[PayU] capturePayment failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  async refundPayment(input: any): Promise<any> {
    const sessionData = input.data || input
    const refundAmount = input.amount // MAJOR units
    try {
      const { client } = await this.getPayUClient(sessionData.project_slug, sessionData.currency)
      const orderId = sessionData.payuOrderId
      if (!orderId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "No PayU orderId in session data; cannot refund"
        )
      }
      const refund = await client.createRefund({
        orderId,
        amount: refundAmount > 0 ? toMinorString(refundAmount) : undefined,
        currencyCode: sessionData.currency,
        description: "Customer requested refund",
        extRefundId: `refund_${Date.now()}`,
      })
      this.logger_.info(`[PayU] Refund created for order ${orderId}, amount=${refundAmount || "FULL"}`)
      return {
        data: {
          ...sessionData,
          refundId: refund?.refund?.refundId || refund?.refundId || null,
          refundStatus: refund?.refund?.status || "PENDING",
        },
      }
    } catch (error: any) {
      this.logger_.error(`[PayU] refundPayment failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  async cancelPayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const { client } = await this.getPayUClient(sessionData.project_slug, sessionData.currency)
      const orderId = sessionData.payuOrderId
      if (orderId) {
        try {
          await client.cancelOrder(orderId)
        } catch (e: any) {
          // Already in terminal state → not fatal
          this.logger_.info(`[PayU] Cancel no-op or failed gracefully: ${e.message}`)
        }
      }
      return { data: { ...sessionData, status: "CANCELED" } }
    } catch (error: any) {
      this.logger_.error(`[PayU] cancelPayment failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  async deletePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    return { data: sessionData }
  }

  async getPaymentStatus(data: any): Promise<PaymentSessionStatus> {
    try {
      const { client } = await this.getPayUClient(data.project_slug, data.currency)
      const orderId = data.payuOrderId
      if (!orderId) return PaymentSessionStatus.PENDING
      const resp = await client.getOrder(orderId)
      const ord = resp?.orders?.[0] || {}
      return mapPayUStatusToMedusa(ord.status)
    } catch {
      return PaymentSessionStatus.ERROR
    }
  }

  async retrievePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const { client } = await this.getPayUClient(sessionData.project_slug, sessionData.currency)
      const orderId = sessionData.payuOrderId
      if (!orderId) return { data: sessionData }
      const resp = await client.getOrder(orderId)
      const ord = resp?.orders?.[0] || {}
      return {
        data: {
          ...sessionData,
          status: ord.status,
          amount: ord.totalAmount ? fromMinor(ord.totalAmount) : sessionData.amount,
          currency: ord.currencyCode || sessionData.currency,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[PayU] retrievePayment failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  async updatePayment(input: any): Promise<any> {
    const sessionData = input.data || {}
    return { data: sessionData }
  }

  /**
   * Process PayU IPN webhook.
   * Signature verification happens in the webhook route handler (it has rawBody).
   * Here we receive the already-parsed body and just map status.
   */
  async getWebhookActionAndData(webhookData: any): Promise<any> {
    try {
      const order = webhookData?.order || webhookData
      const orderId = order?.orderId
      const extOrderId = order?.extOrderId
      const status = (order?.status || "").toUpperCase()

      if (!orderId) {
        return { action: "not_supported", data: webhookData }
      }

      let action: string = "not_supported"
      if (status === "COMPLETED") action = "captured"
      else if (status === "WAITING_FOR_CONFIRMATION") action = "authorized"
      else if (status === "CANCELED" || status === "CANCELLED") action = "failed"
      else if (status === "PENDING" || status === "NEW") action = "pending"

      this.logger_.info(`[PayU] Webhook: ${orderId} → ${status} → action: ${action}`)

      return {
        action,
        data: {
          payuOrderId: orderId,
          extOrderId,
          status,
          amount: order?.totalAmount ? fromMinor(order.totalAmount) : null,
          currency: order?.currencyCode || null,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[PayU] getWebhookActionAndData failed: ${error.message}`)
      return { action: "not_supported", data: webhookData }
    }
  }
}

export default PayUPaymentProviderService
