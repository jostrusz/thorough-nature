// @ts-nocheck
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { BriteApiClient } from "./api-client"
import { Pool } from "pg"
import { logPaymentEvent } from "../payment-debug/utils/log"

type Options = {
  clientId?: string
  clientSecret?: string
  merchantId?: string
  testMode?: boolean
  baseUrl?: string
}

type InjectedDependencies = {
  logger: any
  gatewayConfig?: any
}

/**
 * Maps Brite transaction states → Medusa payment session statuses.
 * Brite uses different vocabularies depending on endpoint; we accept both
 * `state` and `status` payload fields and normalise here.
 */
function mapBriteStateToMedusa(state: string | undefined): PaymentSessionStatus {
  const s = (state || "").toUpperCase()
  switch (s) {
    case "INITIATED":
    case "PENDING":
    case "PENDING_PROCESSING":
    case "PROCESSING":
      return PaymentSessionStatus.PENDING
    case "AUTHORIZED":
      return PaymentSessionStatus.AUTHORIZED
    case "COMPLETED":
    case "SETTLED":
    case "SUCCEEDED":
      return PaymentSessionStatus.CAPTURED
    case "CANCELLED":
    case "CANCELED":
    case "EXPIRED":
      return PaymentSessionStatus.CANCELED
    case "FAILED":
    case "DECLINED":
      return PaymentSessionStatus.ERROR
    default:
      return PaymentSessionStatus.PENDING
  }
}

/**
 * Brite Payments — open-banking ("Pay by Bank") provider for Medusa v2.
 *
 * Flow: redirect-based. We create a session → Brite returns a URL → customer is
 * redirected to bank login → customer confirms in bank app → Brite calls our
 * webhook + redirects back. Money settles instantly (no authorize/capture split).
 *
 * Coverage: 27 EU markets, 3,800+ banks (SE, NO, NL, BE, DE, UK, LU, FI, DK,
 * EE, LT, LV, IE, FR, IT, ES, AT, etc.).
 *
 * Credentials resolution order (same pattern as payment-airwallex):
 *   1. gateway_config row in DB (admin UI) — preferred, multi-tenant by project_slug
 *   2. provider options in medusa-config.js (env vars) — fallback
 *
 * Amounts are MAJOR units (49.99 = €49.99) — Medusa native, no ×100 anywhere.
 */
class BritePaymentProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "brite"

  protected logger_: any
  protected options_: Options
  protected client_: BriteApiClient | null = null
  protected container_: any = null
  private pgPool_: Pool | null = null

  constructor(container: InjectedDependencies, options: Options) {
    super(container, options)
    this.logger_ = container.logger || console
    this.options_ = options || {}
    this.container_ = container

    this.logger_.info(
      `[Brite] Provider initialized. Options clientId: ${this.options_?.clientId ? "set" : "not set"}`
    )
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
   * Build the Brite API client with per-project gateway matching.
   * Reads gateway config via direct DB query (bypasses DI container, which
   * doesn't expose gatewayConfig module to payment providers).
   *
   * Expected DB shape (test_keys / live_keys JSONB):
   *   {
   *     "api_key":        "<Brite Client ID>",          // OAuth client_id
   *     "secret_key":     "<Brite Client Secret>",      // OAuth client_secret
   *     "webhook_secret": "<HMAC secret>",              // webhook signature verify
   *     "account_id":     "<Brite Merchant ID>"         // Service Presentation API merchant_id
   *   }
   * (Same field names as Airwallex so the admin UI form works without changes.)
   */
  private async getBriteClient(projectSlug?: string): Promise<{
    client: BriteApiClient
    config: any
    isLive: boolean
    keys: any
  }> {
    this.client_ = null

    let config: any = null
    try {
      const pool = this.getPool()
      const { rows } = await pool.query(
        `SELECT id, display_name, mode, live_keys, test_keys, project_slugs, priority, metadata
         FROM gateway_config
         WHERE provider = 'brite' AND is_active = true AND deleted_at IS NULL
         ORDER BY priority ASC`
      )

      if (rows.length > 0) {
        if (projectSlug) {
          config = rows.find((r: any) => {
            const slugs = Array.isArray(r.project_slugs) ? r.project_slugs : []
            return slugs.includes(projectSlug)
          })
          if (config) {
            this.logger_.info(
              `[Brite] ✓ Matched gateway "${config.display_name}" for project "${projectSlug}"`
            )
          }
        }
        if (!config) {
          config = rows.find((r: any) => !r.project_slugs || r.project_slugs.length === 0) || rows[0]
          if (projectSlug) {
            this.logger_.info(
              `[Brite] Using default gateway "${config.display_name}" (no project match)`
            )
          }
        }
      }
    } catch (e: any) {
      this.logger_.error(`[Brite] Direct DB query failed: ${e.message}`)
    }

    if (config) {
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      if (keys?.api_key && keys?.secret_key) {
        this.logger_.info(
          `[Brite] ✓ Using ${isLive ? "LIVE" : "TEST"} keys from admin gateway "${config.display_name}" (id: ${config.id})`
        )
        const client = new BriteApiClient(
          keys.api_key,         // OAuth client_id
          keys.secret_key,      // OAuth client_secret
          !isLive,              // isTest
          this.logger_,
          config.metadata?.base_url || undefined
        )
        await client.authenticate()
        this.client_ = client
        return { client, config, isLive, keys }
      }
    }

    // Fallback to env-var options
    if (this.options_?.clientId && this.options_?.clientSecret) {
      this.logger_.warn(`[Brite] ⚠️ FALLBACK: Using credentials from ENV VARS (DB query failed or missing)`)
      const client = new BriteApiClient(
        this.options_.clientId,
        this.options_.clientSecret,
        this.options_.testMode !== false,
        this.logger_,
        this.options_.baseUrl
      )
      await client.authenticate()
      this.client_ = client
      return {
        client,
        config: null,
        isLive: this.options_.testMode === false,
        keys: {
          api_key: this.options_.clientId,
          secret_key: this.options_.clientSecret,
          account_id: this.options_.merchantId,
        },
      }
    }

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Brite credentials not configured. Set via admin gateway config (provider='brite') or BRITE_CLIENT_ID + BRITE_CLIENT_SECRET env vars."
    )
  }

  /**
   * initiatePayment — create a Brite deposit session.
   * Returns { id, data } where id is the session_id and data contains the
   * redirect URL for the storefront to forward the customer to.
   */
  async initiatePayment(input: any): Promise<any> {
    const { amount, currency_code, data, context } = input

    try {
      const projectSlug = data?.project_slug || context?.project_slug || null
      const { client, isLive, keys } = await this.getBriteClient(projectSlug)

      const returnUrl = data?.return_url
      const customer = context?.customer

      const customerEmail = customer?.email || data?.email || ""
      const billing = data?.billing_address || {}
      const shipping = data?.shipping_address || {}
      const firstName = customer?.first_name || billing.first_name || shipping.first_name || ""
      const lastName = customer?.last_name || billing.last_name || shipping.last_name || ""

      const countryRaw = (
        billing.country_code ||
        shipping.country_code ||
        data?.country_code ||
        ""
      ).toUpperCase()

      const merchantReference = `medusa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

      // Pre-selected bank (skip Brite bank picker). Caller passes data.bank_id
      // from our own bank picker; we send all three plausible field names so
      // whichever Brite expects gets matched.
      const preselectedBank = data?.bank_id || data?.bank?.id || null

      const sessionPayload: any = {
        amount: Number(amount),
        currency: currency_code.toUpperCase(),
        country_id: countryRaw || undefined,
        brand_name: data?.product_name || data?.brand_name || "Order",
        merchant_reference: merchantReference,
        locale: data?.locale || undefined,
        redirect_uri: returnUrl,
        ...(preselectedBank && {
          bank_id: preselectedBank,
          aspsp_id: preselectedBank,
          bank: { id: preselectedBank },
        }),
        ...(customerEmail && { customer_email: customerEmail }),
        ...(firstName && { customer_firstname: firstName }),
        ...(lastName && { customer_lastname: lastName }),
        ...(customer?.id && { customer_id: customer.id }),
        ...((billing.address_1 || shipping.address_1) && {
          customer_address: {
            street: billing.address_1 || shipping.address_1 || "",
            city: billing.city || shipping.city || "",
            postal_code: billing.postal_code || shipping.postal_code || "",
            country_id: (billing.country_code || shipping.country_code || countryRaw || "").toUpperCase(),
          },
        }),
        metadata: {
          customer_id: customer?.id,
          session_id: data?.session_id,
          project_slug: projectSlug,
        },
      }

      this.logger_.info(
        `[Brite] Creating session: amount=${Number(amount).toFixed(2)} ${currency_code}, country=${countryRaw}, bank=${preselectedBank || "PICKER"}`
      )

      const session = await client.createSession(sessionPayload)

      this.logger_.info(`[Brite] Session created: ${session.id}, url present: ${!!session.url}`)

      logPaymentEvent({
        intent_id: session.id,
        email: customerEmail || null,
        project_slug: projectSlug,
        event_type: "brite_session_created",
        event_data: {
          merchant_reference: merchantReference,
          amount: sessionPayload.amount,
          currency: sessionPayload.currency,
          country: countryRaw,
          preselected_bank: preselectedBank,
          has_url: !!session.url,
        },
      }).catch(() => {})

      return {
        id: session.id,
        data: {
          intentId: session.id,                      // generic alias used by webhook safety-net
          briteSessionId: session.id,
          briteToken: session.token || null,
          checkoutUrl: session.url,                  // storefront must redirect here
          status: session.status || "INITIATED",
          amount: sessionPayload.amount,
          currency: sessionPayload.currency,
          method: "brite",
          environment: isLive ? "prod" : "sandbox",
          return_url: returnUrl,
          merchant_reference: merchantReference,
          preselected_bank: preselectedBank,
          session_id: data?.session_id,
          currency_code,
          project_slug: projectSlug,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Brite] Payment initiation failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message || "Failed to initiate Brite payment"
      )
    }
  }

  /** Authorize = fetch latest state from Brite */
  async authorizePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const { client } = await this.getBriteClient(sessionData.project_slug)
      const txId = sessionData.briteSessionId || sessionData.intentId

      if (!txId) {
        return { status: PaymentSessionStatus.PENDING, data: sessionData }
      }

      const tx = await client.getTransaction(txId)
      const raw = tx.state || tx.status
      const mapped = mapBriteStateToMedusa(raw)

      this.logger_.info(`[Brite] Authorize: ${txId} → ${raw} → ${mapped}`)

      return {
        status: mapped,
        data: { ...sessionData, status: raw },
      }
    } catch (error: any) {
      this.logger_.error(`[Brite] Authorization failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /**
   * Capture — Brite settles instantly via open banking, so capture is a no-op
   * confirmation: we just re-fetch state and return.
   */
  async capturePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const { client } = await this.getBriteClient(sessionData.project_slug)
      const txId = sessionData.briteSessionId || sessionData.intentId

      if (!txId) return { data: sessionData }

      const tx = await client.getTransaction(txId)
      this.logger_.info(`[Brite] Capture (instant settle): ${txId}, state: ${tx.state || tx.status}`)

      return {
        data: { ...sessionData, status: tx.state || tx.status },
      }
    } catch (error: any) {
      this.logger_.error(`[Brite] Capture failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  async refundPayment(input: any): Promise<any> {
    const sessionData = input.data || input
    const refundAmount = input.amount
    try {
      const { client } = await this.getBriteClient(sessionData.project_slug)
      const txId = sessionData.briteSessionId || sessionData.intentId

      if (!txId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "No Brite transaction ID in session data"
        )
      }

      const refund = await client.createRefund({
        transaction_id: txId,
        amount: Number(refundAmount),
        merchant_reference: `refund_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      })

      this.logger_.info(`[Brite] Refund created: ${refund.id}, amount: ${refund.amount}`)

      return {
        data: {
          ...sessionData,
          refundId: refund.id,
          refundStatus: refund.state || refund.status,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Brite] Refund failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /**
   * Cancel — Brite sessions are short-lived and self-expire when the customer
   * doesn't finish. There's no explicit "cancel session" endpoint in the
   * documented API; we no-op locally so Medusa flow continues.
   */
  async cancelPayment(input: any): Promise<any> {
    const sessionData = input.data || input
    this.logger_.info(`[Brite] Cancel (local no-op): ${sessionData.briteSessionId || sessionData.intentId || "(no id)"}`)
    return { data: { ...sessionData, status: "CANCELLED" } }
  }

  async deletePayment(input: any): Promise<any> {
    return { data: input.data || input }
  }

  async getPaymentStatus(data: any): Promise<PaymentSessionStatus> {
    try {
      const { client } = await this.getBriteClient(data.project_slug)
      const txId = data.briteSessionId || data.intentId
      if (!txId) return PaymentSessionStatus.PENDING
      const tx = await client.getTransaction(txId)
      return mapBriteStateToMedusa(tx.state || tx.status)
    } catch {
      return PaymentSessionStatus.ERROR
    }
  }

  async retrievePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const { client } = await this.getBriteClient(sessionData.project_slug)
      const txId = sessionData.briteSessionId || sessionData.intentId
      if (!txId) return { data: sessionData }

      const tx = await client.getTransaction(txId)
      return {
        data: {
          ...sessionData,
          status: tx.state || tx.status,
          amount: tx.amount,
          currency: tx.currency,
          bank: tx.bank || null,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Brite] Retrieve failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  async updatePayment(input: any): Promise<any> {
    return { data: input.data || {} }
  }

  /**
   * Process a Brite webhook (called by Medusa's payment module after the
   * webhook handler validates the signature).
   *
   * Note: signature verification happens in
   * `backend/src/api/webhooks/brite/route.ts` — by the time this method is
   * called, the payload is trusted.
   */
  async getWebhookActionAndData(webhookData: any): Promise<any> {
    try {
      const event_type = webhookData?.event || webhookData?.type || webhookData?.name || ""
      const txData = webhookData?.data?.transaction || webhookData?.transaction || webhookData?.data || webhookData
      const txId = txData?.id || txData?.transaction_id || txData?.session_id

      if (!txId) {
        return { action: "not_supported", data: webhookData }
      }

      const { client } = await this.getBriteClient()
      const tx = await client.getTransaction(txId)
      const raw = (tx.state || tx.status || "").toUpperCase()

      let action: string = "not_supported"
      if (raw === "COMPLETED" || raw === "SETTLED" || raw === "SUCCEEDED") {
        action = "authorized"
      } else if (raw === "FAILED" || raw === "DECLINED" || raw === "CANCELLED") {
        action = "failed"
      }

      this.logger_.info(`[Brite] Webhook: ${txId} → ${raw} → action: ${action}`)

      return {
        action,
        data: {
          intentId: tx.id,
          briteSessionId: tx.id,
          status: raw,
          amount: tx.amount,
          currency: tx.currency,
          bank: tx.bank || null,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Brite] Webhook processing failed: ${error.message}`)
      return { action: "not_supported", data: webhookData }
    }
  }
}

export default BritePaymentProviderService
