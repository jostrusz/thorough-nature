// @ts-nocheck
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { Pool } from "pg"
import { NovalnetApiClient } from "./api-client"
import {
  toNovalnetType,
  fromNovalnetType,
  REDIRECT_METHODS,
  POST_PAYMENT_METHODS,
  INLINE_METHODS,
} from "./helpers/method-map"
import { mapNovalnetStatus, mapWebhookEventToAction } from "./helpers/status-map"

type Options = {
  /** Optional fallback credentials from env vars (used only if DB lookup fails). */
  vendorId?: string
  productActivationKey?: string
  paymentAccessKey?: string
  tariff?: string
  testMode?: boolean
}

type InjectedDependencies = {
  logger: any
}

/**
 * Novalnet Payment Provider for Medusa v2.
 *
 * Multi-tenant: credentials are looked up per request from the `gateway_config`
 * table (admin-configured), matched by the `project_slug` the request carries.
 *
 * Mirrors the Airwallex provider pattern (proven in production for ~6 months
 * across 7 storefront projects).
 */
class NovalnetPaymentProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "novalnet"

  protected logger_: any
  protected options_: Options
  private pgPool_: Pool | null = null

  constructor(container: InjectedDependencies, options: Options) {
    super(container, options)
    this.logger_ = container.logger || console
    this.options_ = options || {}
    this.logger_.info(
      `[Novalnet] Provider initialized. Env fallback: ${this.options_?.vendorId ? "set" : "not set (DB-only mode)"}`
    )
  }

  // ─── credential resolution ──────────────────────────────────────────────

  /**
   * Direct PG pool — payment provider DI scope cannot resolve modules,
   * so we read gateway_config via raw SQL (same pattern as Airwallex).
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
   * Build an API client using the right credentials for this request.
   * Priority:
   *   1. gateway_config row matching `project_slug` (admin-configured)
   *   2. gateway_config row with empty project_slugs (catch-all)
   *   3. provider options from medusa-config (env vars) — only if both above missed
   */
  private async getClient(projectSlug?: string | null): Promise<NovalnetApiClient> {
    // 1. Try DB-configured gateway
    try {
      const pool = this.getPool()
      const { rows } = await pool.query(
        `SELECT id, display_name, mode, live_keys, test_keys, project_slugs, priority
         FROM gateway_config
         WHERE provider = 'novalnet' AND is_active = true AND deleted_at IS NULL
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
            this.logger_.info(`[Novalnet] ✓ Matched gateway "${config.display_name}" for project "${projectSlug}"`)
          }
        }
        if (!config) {
          config = rows.find((r: any) => !r.project_slugs || r.project_slugs.length === 0) || rows[0]
        }
      }

      if (config) {
        const isLive = config.mode === "live"
        const keys = isLive ? config.live_keys : config.test_keys
        // Accept BOTH Novalnet-native key names AND the generic admin-form names.
        // Generic form maps:  api_key → vendor_id, secret_key → product_activation_key,
        // webhook_secret → payment_access_key. (See settings-billing/page.tsx labels.)
        const vendorId = keys?.vendor_id || keys?.api_key
        const productActivationKey = keys?.product_activation_key || keys?.secret_key
        const paymentAccessKey = keys?.payment_access_key || keys?.webhook_secret
        const tariff = keys?.tariff || keys?.account_id
        if (vendorId && productActivationKey && paymentAccessKey) {
          this.logger_.info(`[Novalnet] Using ${isLive ? "LIVE" : "TEST"} keys from gateway "${config.display_name}" (id: ${config.id})`)
          return new NovalnetApiClient(
            {
              vendorId: String(vendorId),
              productActivationKey: String(productActivationKey),
              paymentAccessKey: String(paymentAccessKey),
              tariff: tariff ? String(tariff) : undefined,
              testMode: !isLive,
            },
            this.logger_
          )
        }
      }
    } catch (e: any) {
      this.logger_.error(`[Novalnet] DB credential lookup failed: ${e.message}`)
    }

    // 2. Fallback to env-vars
    if (this.options_?.vendorId && this.options_?.productActivationKey && this.options_?.paymentAccessKey) {
      this.logger_.warn(`[Novalnet] ⚠️ FALLBACK: Using credentials from env vars (no DB gateway found)`)
      return new NovalnetApiClient(
        {
          vendorId: this.options_.vendorId,
          productActivationKey: this.options_.productActivationKey,
          paymentAccessKey: this.options_.paymentAccessKey,
          tariff: this.options_.tariff,
          testMode: this.options_.testMode !== false,
        },
        this.logger_
      )
    }

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Novalnet credentials not configured. Add a gateway via Settings → Billing → Payment Gateways."
    )
  }

  /**
   * Get the access key for the matched gateway — needed at the webhook layer
   * to verify the SHA-256 checksum.
   */
  async getAccessKeyForProject(projectSlug?: string | null): Promise<string | null> {
    try {
      const pool = this.getPool()
      const { rows } = await pool.query(
        `SELECT mode, live_keys, test_keys, project_slugs
         FROM gateway_config
         WHERE provider = 'novalnet' AND is_active = true AND deleted_at IS NULL
         ORDER BY priority ASC`
      )
      let config: any = null
      if (projectSlug) {
        config = rows.find((r: any) => {
          const slugs = Array.isArray(r.project_slugs) ? r.project_slugs : []
          return slugs.includes(projectSlug)
        })
      }
      if (!config) {
        config = rows.find((r: any) => !r.project_slugs || r.project_slugs.length === 0) || rows[0]
      }
      if (!config) return this.options_?.paymentAccessKey || null
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      return keys?.payment_access_key || keys?.webhook_secret || this.options_?.paymentAccessKey || null
    } catch {
      return this.options_?.paymentAccessKey || null
    }
  }

  // ─── Medusa AbstractPaymentProvider methods ─────────────────────────────

  /**
   * Initiate a Novalnet payment. The frontend must include `data.method`
   * with one of the codes from method-map.ts (creditcard, ideal, paypal, ...).
   */
  async initiatePayment(input: any): Promise<any> {
    const { amount, currency_code, data, context } = input
    const projectSlug = data?.project_slug || context?.project_slug || null

    try {
      const client = await this.getClient(projectSlug)

      const methodCode = String(data?.method || "creditcard").toLowerCase()
      const novalnetType = toNovalnetType(methodCode)
      if (!novalnetType) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Unsupported Novalnet payment method: ${methodCode}`
        )
      }

      const customer = context?.customer || {}
      const billingAddr = data?.billing_address || data?.shipping_address || {}
      const shippingAddr = data?.shipping_address || data?.billing_address || {}

      const customerEmail = customer.email || data?.email || ""
      const firstName = customer.first_name || billingAddr.first_name || ""
      const lastName = customer.last_name || billingAddr.last_name || ""
      const phone = customer.phone || billingAddr.phone || ""

      const orderNo = `medusa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const returnUrl = data?.return_url
      if (!returnUrl) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Novalnet requires a return_url in payment session data"
        )
      }

      // Build webhook URL from the same pattern Airwallex uses
      const backendUrl =
        process.env.BACKEND_PUBLIC_URL ||
        (process.env.RAILWAY_PUBLIC_DOMAIN_VALUE
          ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN_VALUE}`
          : "http://localhost:9000")
      const hookUrl = `${backendUrl}/webhooks/novalnet`

      this.logger_.info(
        `[Novalnet] Initiate ${novalnetType}: amount=${Number(amount).toFixed(2)} ${currency_code}, orderNo=${orderNo}, return=${returnUrl}`
      )

      const result = await client.initiatePayment({
        paymentType: novalnetType,
        amount: Number(amount),
        currency: currency_code,
        orderNo,
        returnUrl,
        errorReturnUrl: returnUrl,
        hookUrl,
        language: data?.language || data?.locale,
        customer: {
          email: customerEmail,
          first_name: firstName,
          last_name: lastName,
          tel: phone,
          customer_no: customer.id ? String(customer.id) : undefined,
          billing: {
            street: billingAddr.address_1,
            city: billingAddr.city,
            zip: billingAddr.postal_code,
            country_code: billingAddr.country_code,
          },
          shipping: {
            street: shippingAddr.address_1,
            city: shippingAddr.city,
            zip: shippingAddr.postal_code,
            country_code: shippingAddr.country_code,
          },
        },
        paymentData: data?.payment_data, // e.g. card token, IBAN
        customParams: {
          medusa_session_id: data?.session_id,
          project_slug: projectSlug,
        },
      })

      this.logger_.info(
        `[Novalnet] Initiated: tid=${result.tid}, status=${result.status}, redirect=${result.redirectUrl ? "yes" : "no"}`
      )

      return {
        // Medusa stores `id` as the public payment session id
        id: result.tid || orderNo,
        data: {
          // Canonical reference — used by webhook handler to find this session
          tid: result.tid,
          novalnetTid: result.tid,
          txnSecret: result.txnSecret,
          status: result.status,
          txStatus: result.txStatus,
          statusText: result.statusText,
          // For redirect methods, frontend uses this to redirect the customer
          redirectUrl: result.redirectUrl || null,
          checkoutUrl: result.redirectUrl || null,    // alias used by funnel checkouts
          method: methodCode,
          payment_type: novalnetType,
          // Pass-through for storefront / matcher
          amount: Number(amount),
          currency: currency_code.toUpperCase(),
          currency_code,
          return_url: returnUrl,
          project_slug: projectSlug,
          session_id: data?.session_id,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Novalnet] initiatePayment failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message || "Failed to initiate Novalnet payment"
      )
    }
  }

  async authorizePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const tid = sessionData.tid || sessionData.novalnetTid
      if (!tid) {
        return {
          status: PaymentSessionStatus.PENDING,
          data: sessionData,
        }
      }
      const client = await this.getClient(sessionData.project_slug)
      const result = await client.getTransactionDetails(tid)
      const status = mapNovalnetStatus(result.txStatus, result.status)
      this.logger_.info(`[Novalnet] Authorize: tid=${tid} → ${result.txStatus || result.status} → ${status}`)
      return {
        status,
        data: {
          ...sessionData,
          status: result.status,
          txStatus: result.txStatus,
          statusText: result.statusText,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Novalnet] authorizePayment failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message
      )
    }
  }

  async capturePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const tid = sessionData.tid || sessionData.novalnetTid
      if (!tid) return { data: sessionData }
      const client = await this.getClient(sessionData.project_slug)
      // For inline / auto-capture methods this is a no-op on Novalnet's side
      // unless the payment was initiated with on_hold=1.
      const result = await client.capture(tid, sessionData.amount)
      this.logger_.info(`[Novalnet] Captured: tid=${tid}, status=${result.status}`)
      return {
        data: { ...sessionData, status: result.status, txStatus: result.txStatus },
      }
    } catch (error: any) {
      // Don't fail the whole flow if capture is a no-op (already captured)
      if (/already captured|status.*confirmed/i.test(error.message || "")) {
        this.logger_.info(`[Novalnet] Capture skipped (already captured): ${error.message}`)
        return { data: sessionData }
      }
      this.logger_.error(`[Novalnet] capturePayment failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  async refundPayment(input: any): Promise<any> {
    const sessionData = input.data || input
    const refundAmount = input.amount
    try {
      const tid = sessionData.tid || sessionData.novalnetTid
      if (!tid) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, "No Novalnet TID in session data")
      }
      const client = await this.getClient(sessionData.project_slug)
      const result = await client.refund(tid, refundAmount > 0 ? refundAmount : undefined, "Customer requested refund")
      this.logger_.info(`[Novalnet] Refund created: tid=${tid}, status=${result.status}`)
      return {
        data: {
          ...sessionData,
          refundTid: result.tid,
          refundStatus: result.status,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Novalnet] refundPayment failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  async cancelPayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const tid = sessionData.tid || sessionData.novalnetTid
      if (tid) {
        const client = await this.getClient(sessionData.project_slug)
        await client.cancel(tid)
      }
      this.logger_.info(`[Novalnet] Cancel: tid=${tid || "(none)"}`)
      return { data: { ...sessionData, status: "CANCELED" } }
    } catch (error: any) {
      this.logger_.error(`[Novalnet] cancelPayment failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  async deletePayment(input: any): Promise<any> {
    return { data: input.data || input }
  }

  async getPaymentStatus(data: any): Promise<PaymentSessionStatus> {
    try {
      const tid = data.tid || data.novalnetTid
      if (!tid) return PaymentSessionStatus.PENDING
      const client = await this.getClient(data.project_slug)
      const result = await client.getTransactionDetails(tid)
      return mapNovalnetStatus(result.txStatus, result.status)
    } catch {
      return PaymentSessionStatus.ERROR
    }
  }

  async retrievePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const tid = sessionData.tid || sessionData.novalnetTid
      if (!tid) return { data: sessionData }
      const client = await this.getClient(sessionData.project_slug)
      const result = await client.getTransactionDetails(tid)
      return {
        data: {
          ...sessionData,
          status: result.status,
          txStatus: result.txStatus,
          statusText: result.statusText,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Novalnet] retrievePayment failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  async updatePayment(input: any): Promise<any> {
    return { data: input.data || {} }
  }

  /**
   * Process a Novalnet webhook payload — called by the webhook route.
   * Returns the action Medusa should apply to the payment session.
   */
  async getWebhookActionAndData(webhookData: any): Promise<any> {
    try {
      const evt = webhookData?.event || {}
      const tx = webhookData?.transaction || {}
      const eventType = String(evt.type || "").toUpperCase()
      const tid = String(tx.tid || evt.tid || "")
      if (!tid) {
        return { action: "not_supported", data: webhookData }
      }

      // Fetch fresh state from Novalnet to avoid trusting webhook payload alone
      let txStatus: string | undefined
      let statusCode: number | undefined
      try {
        // Project slug is unknown at webhook arrival — pass null, will use catch-all gateway
        const client = await this.getClient(null)
        const fresh = await client.getTransactionDetails(tid)
        txStatus = fresh.txStatus
        statusCode = fresh.status
      } catch (e: any) {
        this.logger_.warn(`[Novalnet] Webhook: failed to refresh tid=${tid}: ${e.message}`)
        txStatus = tx.status
        statusCode = Number(tx.status_code || 0)
      }

      const action = mapWebhookEventToAction(eventType, txStatus)
      this.logger_.info(`[Novalnet] Webhook: tid=${tid} event=${eventType} status=${txStatus}/${statusCode} → action=${action}`)

      return {
        action,
        data: {
          tid,
          novalnetTid: tid,
          status: statusCode,
          txStatus,
          eventType,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Novalnet] webhook processing failed: ${error.message}`)
      return { action: "not_supported", data: webhookData }
    }
  }
}

export default NovalnetPaymentProviderService
