// @ts-nocheck
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { Pool } from "pg"
import { RevolutApiClient } from "./api-client"
import { logPaymentEvent } from "../payment-debug/utils/log"

type Options = {
  secretKey?: string
  publicKey?: string
  testMode?: boolean
}

type InjectedDependencies = {
  logger: any
}

/**
 * Maps Revolut order states to Medusa payment session statuses.
 * Revolut order states: PENDING, PROCESSING, AUTHORISED, COMPLETED, CANCELLED, FAILED
 */
function mapRevolutStateToMedusa(state: string): PaymentSessionStatus {
  switch (String(state || "").toUpperCase()) {
    case "COMPLETED":
      return PaymentSessionStatus.CAPTURED
    case "AUTHORISED":
      return PaymentSessionStatus.AUTHORIZED
    case "PROCESSING":
      return PaymentSessionStatus.PENDING
    case "PENDING":
      return PaymentSessionStatus.PENDING
    case "CANCELLED":
      return PaymentSessionStatus.CANCELED
    case "FAILED":
      return PaymentSessionStatus.ERROR
    default:
      return PaymentSessionStatus.PENDING
  }
}

/**
 * Revolut payment provider for Medusa v2 — Pay by Bank (open banking A2A).
 * Follows the AbstractPaymentProvider pattern (same as Airwallex/PayPal).
 *
 * Flow (Pay by Bank, web):
 *   initiatePayment → creates a Revolut order → returns public `token`
 *     → storefront mounts the Pay by Bank widget (RevolutCheckout SDK) with the token
 *     → customer selects bank + authorises in their banking app
 *     → onSuccess → completeCart → authorizePayment verifies order state
 *   ORDER_COMPLETED webhook → safety net completes the cart if the customer
 *     never returned to the checkout page.
 *
 * Credentials come from the `gateway_config` table (provider = 'revolut'),
 * matched per-project via the `project_slugs` JSONB array — exactly like
 * Airwallex/PayPal. live_keys / test_keys shape:
 *   { public_key, secret_key, webhook_secret }
 *
 * Amounts are in MAJOR units (49.99 = €49.99) everywhere in this service;
 * conversion to the API's minor units happens inside RevolutApiClient.
 */
class RevolutPaymentProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "revolut"

  protected logger_: any
  protected options_: Options
  private pgPool_: Pool | null = null

  constructor(container: InjectedDependencies, options: Options) {
    super(container, options)
    this.logger_ = container.logger || console
    this.options_ = options || {}
    this.logger_.info(`[Revolut] Provider initialized.`)
  }

  /** Shared PG pool — gatewayConfig module isn't in the payment provider DI scope. */
  private getPool(): Pool {
    if (!this.pgPool_) {
      const dbUrl = process.env.DATABASE_URL
      if (!dbUrl) throw new Error("DATABASE_URL not set")
      this.pgPool_ = new Pool({ connectionString: dbUrl, max: 3 })
    }
    return this.pgPool_
  }

  /**
   * Resolve the Revolut gateway (client + public key + environment) for a project.
   * Reads gateway_config via direct DB query, matching project_slug in the
   * project_slugs JSONB array. Falls back to provider options (env vars).
   */
  private async getRevolutGateway(
    projectSlug?: string
  ): Promise<{ client: RevolutApiClient; publicKey: string | null; environment: "prod" | "sandbox" }> {
    // 1. Gateway config from DB (admin-configured) — preferred
    try {
      const pool = this.getPool()
      const { rows } = await pool.query(
        `SELECT id, display_name, mode, live_keys, test_keys, project_slugs, priority
         FROM gateway_config
         WHERE provider = 'revolut' AND is_active = true AND deleted_at IS NULL
         ORDER BY priority ASC`
      )

      let config: any = null
      if (rows.length > 0) {
        if (projectSlug) {
          config = rows.find((r: any) => {
            const slugs = Array.isArray(r.project_slugs) ? r.project_slugs : []
            return slugs.includes(projectSlug)
          })
          if (config) {
            this.logger_.info(`[Revolut] ✓ Matched gateway "${config.display_name}" for project "${projectSlug}"`)
          }
        }
        if (!config) {
          config = rows.find((r: any) => !r.project_slugs || r.project_slugs.length === 0) || rows[0]
          if (projectSlug) {
            this.logger_.info(`[Revolut] Using default gateway "${config.display_name}" (no project match)`)
          }
        }
      }

      if (config) {
        const isLive = config.mode === "live"
        const keys = isLive ? config.live_keys : config.test_keys
        const secretKey = keys?.secret_key || keys?.api_key
        const publicKey = keys?.public_key || null
        if (secretKey) {
          this.logger_.info(
            `[Revolut] ✓ Using ${isLive ? "LIVE" : "SANDBOX"} keys from admin gateway "${config.display_name}" (id: ${config.id})`
          )
          return {
            client: new RevolutApiClient(secretKey, !isLive),
            publicKey,
            environment: isLive ? "prod" : "sandbox",
          }
        }
      }
    } catch (e: any) {
      this.logger_.error(`[Revolut] Direct DB query failed: ${e.message}`)
    }

    // 2. Fallback to provider options (env vars via medusa-config.js)
    if (this.options_?.secretKey) {
      this.logger_.warn(`[Revolut] ⚠️ FALLBACK: Using credentials from ENV VARS (DB query failed)`)
      const isTest = this.options_.testMode !== false
      return {
        client: new RevolutApiClient(this.options_.secretKey, isTest),
        publicKey: this.options_.publicKey || null,
        environment: isTest ? "sandbox" : "prod",
      }
    }

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Revolut credentials not configured. Set via admin Payment Gateways (provider 'revolut')."
    )
  }

  /**
   * Look up the webhook signing secret(s) for all active Revolut gateways.
   * Used by the webhook route to verify inbound signatures.
   */
  async getWebhookSecrets(): Promise<string[]> {
    try {
      const pool = this.getPool()
      const { rows } = await pool.query(
        `SELECT mode, live_keys, test_keys FROM gateway_config
         WHERE provider = 'revolut' AND is_active = true AND deleted_at IS NULL`
      )
      const secrets: string[] = []
      for (const r of rows) {
        const keys = r.mode === "live" ? r.live_keys : r.test_keys
        if (keys?.webhook_secret) secrets.push(keys.webhook_secret)
      }
      return secrets
    } catch {
      return []
    }
  }

  /**
   * Initiate a payment session — create a Revolut order.
   * Returns the order id + public token used by the storefront Pay by Bank widget.
   *
   * Medusa v2 input: { amount, currency_code, data?, context? }
   * - amount is in MAJOR units (49.99 = €49.99)
   */
  async initiatePayment(input: any): Promise<any> {
    const { amount, currency_code, data, context } = input

    try {
      const projectSlug = data?.project_slug || context?.project_slug || null
      const { client, publicKey, environment } = await this.getRevolutGateway(projectSlug)

      const productName = data?.product_name || "Order"
      const cartId = context?.cart_id || data?.cart_id || null

      this.logger_.info(
        `[Revolut] Creating order: amount=${Number(amount).toFixed(2)} ${currency_code}, project=${projectSlug || "default"}`
      )

      const order = await client.createOrder({
        amount: Number(amount),
        currency: (currency_code || "EUR").toUpperCase(),
        description: productName,
        ...(cartId ? { merchant_order_ext_ref: cartId } : {}),
      })

      this.logger_.info(
        `[Revolut] Order created: ${order.id}, state: ${order.state}, token: ${order.token ? "yes" : "none"}`
      )

      // Journey log — order creation (observability, never throws)
      logPaymentEvent({
        intent_id: order.id,
        cart_id: cartId,
        email: data?.email || null,
        project_slug: projectSlug,
        event_type: "revolut_order_created",
        event_data: {
          state: order.state,
          amount: Number(amount),
          currency: (currency_code || "EUR").toUpperCase(),
          method: "pay_by_bank",
          environment,
        },
      }).catch(() => {})

      return {
        id: order.id,
        data: {
          revolutOrderId: order.id,
          revolutPublicToken: order.token,
          revolutPublicKey: publicKey,
          environment,
          method: data?.method || "pay_by_bank",
          state: order.state,
          amount: Number(amount),
          currency: (currency_code || "EUR").toUpperCase(),
          currency_code,
          checkoutUrl: order.checkout_url || null,
          session_id: data?.session_id || null,
          project_slug: projectSlug,
        },
      }
    } catch (error: any) {
      const respData = error.response?.data
      const errorMsg = respData?.message || respData?.error || error.message
      this.logger_.error(
        `[Revolut] Order creation failed: ${errorMsg} | details=${respData ? JSON.stringify(respData) : "none"}`
      )

      logPaymentEvent({
        intent_id: `revolut-failed-${Date.now()}`,
        email: data?.email || null,
        project_slug: data?.project_slug || context?.project_slug || null,
        event_type: "revolut_initiation_failed",
        error_code: respData?.code || "UNKNOWN",
        event_data: { message: errorMsg, details: respData || null },
      }).catch(() => {})

      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        errorMsg || "Failed to create Revolut order"
      )
    }
  }

  /**
   * Authorize payment — check the Revolut order state after the customer
   * has gone through the Pay by Bank flow.
   */
  async authorizePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const { client } = await this.getRevolutGateway(sessionData.project_slug)
      const orderId = sessionData.revolutOrderId

      if (!orderId) {
        return { status: PaymentSessionStatus.PENDING, data: sessionData }
      }

      const order = await client.getOrder(orderId)
      const status = mapRevolutStateToMedusa(order.state)

      this.logger_.info(`[Revolut] Authorize: order=${orderId} → ${order.state} → ${status}`)

      return {
        status,
        data: { ...sessionData, state: order.state },
      }
    } catch (error: any) {
      this.logger_.error(`[Revolut] Authorization check failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /**
   * Capture payment. Pay by Bank orders are normally captured automatically
   * (state COMPLETED). If the order is only AUTHORISED, capture it explicitly.
   */
  async capturePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const { client } = await this.getRevolutGateway(sessionData.project_slug)
      const orderId = sessionData.revolutOrderId

      if (!orderId) return { data: sessionData }

      let order = await client.getOrder(orderId)

      if (order.state === "AUTHORISED") {
        try {
          order = await client.captureOrder(orderId)
          this.logger_.info(`[Revolut] Order captured: ${orderId}, state: ${order.state}`)
        } catch (capErr: any) {
          this.logger_.warn(`[Revolut] Explicit capture failed for ${orderId}: ${capErr.message}`)
        }
      }

      return { data: { ...sessionData, state: order.state } }
    } catch (error: any) {
      this.logger_.error(`[Revolut] Capture failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /**
   * Refund payment — refund a completed Revolut order.
   */
  async refundPayment(input: any): Promise<any> {
    const sessionData = input.data || input
    const refundAmount = input.amount
    try {
      const { client } = await this.getRevolutGateway(sessionData.project_slug)
      const orderId = sessionData.revolutOrderId

      if (!orderId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "No Revolut order ID in session data"
        )
      }

      const amount = refundAmount > 0 ? Number(refundAmount) : Number(sessionData.amount)
      const currency = (sessionData.currency || sessionData.currency_code || "EUR").toUpperCase()

      const refund = await client.refundOrder(orderId, amount, currency, "Customer requested refund")

      this.logger_.info(`[Revolut] Refund created for order ${orderId}: ${refund?.id || "ok"}`)

      return {
        data: { ...sessionData, refundId: refund?.id || null, refundState: refund?.state || null },
      }
    } catch (error: any) {
      const respData = error.response?.data
      this.logger_.error(`[Revolut] Refund failed: ${respData?.message || error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        respData?.message || error.message
      )
    }
  }

  /**
   * Cancel payment — cancel an unpaid Revolut order.
   */
  async cancelPayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const { client } = await this.getRevolutGateway(sessionData.project_slug)
      const orderId = sessionData.revolutOrderId

      if (orderId) {
        const order = await client.getOrder(orderId).catch(() => null)
        const terminal = ["COMPLETED", "CANCELLED", "FAILED"]
        if (order && terminal.includes(order.state)) {
          this.logger_.info(`[Revolut] Cancel no-op: ${orderId} already in terminal state ${order.state}`)
        } else {
          await client.cancelOrder(orderId)
          this.logger_.info(`[Revolut] Order cancelled: ${orderId}`)
        }
      }

      return { data: { ...sessionData, state: "CANCELLED" } }
    } catch (error: any) {
      this.logger_.error(`[Revolut] Cancel failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /** Delete payment session — no-op for Revolut. */
  async deletePayment(input: any): Promise<any> {
    return { data: input.data || input }
  }

  /** Get payment status from Revolut. */
  async getPaymentStatus(data: any): Promise<PaymentSessionStatus> {
    try {
      const sessionData = data?.data || data
      const { client } = await this.getRevolutGateway(sessionData.project_slug)
      const orderId = sessionData.revolutOrderId

      if (!orderId) return PaymentSessionStatus.PENDING

      const order = await client.getOrder(orderId)
      return mapRevolutStateToMedusa(order.state)
    } catch {
      return PaymentSessionStatus.ERROR
    }
  }

  /** Retrieve payment data from Revolut. */
  async retrievePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const { client } = await this.getRevolutGateway(sessionData.project_slug)
      const orderId = sessionData.revolutOrderId

      if (!orderId) return { data: sessionData }

      const order = await client.getOrder(orderId)
      return {
        data: { ...sessionData, state: order.state, amount: order.amount, currency: order.currency },
      }
    } catch (error: any) {
      this.logger_.error(`[Revolut] Retrieve failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /** Update payment session — no-op (Revolut orders are immutable after creation). */
  async updatePayment(input: any): Promise<any> {
    return { data: input.data || {} }
  }

  /**
   * Process a Revolut webhook event.
   * Revolut webhook payload: { event, order_id, merchant_order_ext_ref? }
   * Events: ORDER_COMPLETED, ORDER_AUTHORISED, ORDER_CANCELLED, ORDER_PAYMENT_FAILED
   */
  async getWebhookActionAndData(webhookData: any): Promise<{
    action: string
    data: Record<string, unknown>
  }> {
    try {
      const event = webhookData?.event || webhookData?.data?.event
      const orderId = webhookData?.order_id || webhookData?.data?.order_id

      let action = "not_supported"
      if (event === "ORDER_COMPLETED" || event === "ORDER_AUTHORISED") {
        action = "authorized"
      } else if (event === "ORDER_CANCELLED" || event === "ORDER_PAYMENT_FAILED") {
        action = "failed"
      }

      return {
        action,
        data: {
          revolutOrderId: orderId,
          event,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Revolut] Webhook processing failed: ${error.message}`)
      return { action: "not_supported", data: webhookData }
    }
  }
}

export default RevolutPaymentProviderService
