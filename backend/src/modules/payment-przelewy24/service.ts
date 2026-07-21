// @ts-nocheck
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { Pool } from "pg"
import {
  Przelewy24ApiClient,
  credsFromGatewayConfig,
  pickP24Config,
} from "./api-client"
import { logPaymentEvent } from "../payment-debug/utils/log"

/**
 * Przelewy24 payment provider for Medusa v2 (REST API v1).
 *
 * Flow: POST /transaction/register → redirect to trnRequest/{token}
 *       → P24 posts notification to /webhooks/przelewy24
 *       → webhook calls PUT /transaction/verify (mandatory for settlement)
 *
 * Multi-tenant: credentials come from gateway_config (provider='przelewy24'),
 * matched by project_slug (project_slugs JSON array), loaded via direct pg.Pool
 * because the payment provider DI scope has no access to custom modules.
 *
 * Amounts are MAJOR units in this layer — minor conversion lives in api-client.
 */

/** Map numeric P24 transaction status → Medusa payment session status.
 *  0 = no payment, 1 = advance/pre-payment, 2 = paid & verified, 3 = returned */
function mapP24StatusToMedusa(p24Status: number): PaymentSessionStatus {
  switch (Number(p24Status)) {
    case 2:
      return PaymentSessionStatus.CAPTURED
    case 1:
      return PaymentSessionStatus.AUTHORIZED
    case 3:
      return PaymentSessionStatus.CANCELED // refunded
    default:
      return PaymentSessionStatus.PENDING
  }
}

export class Przelewy24PaymentProvider extends AbstractPaymentProvider {
  static identifier = "przelewy24"

  protected logger_: any
  protected container_: any
  private pgPool_: Pool | null = null

  constructor(container: any, options?: any) {
    super(container, options)
    this.container_ = container
    this.logger_ = container.logger || console
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
   * Build a P24 API client for the given project slug.
   * NEVER cache the client on `this` — the provider instance is shared across
   * concurrent requests for different projects (see Airwallex pattern).
   */
  private async getP24Client(
    projectSlug?: string | null
  ): Promise<{ client: Przelewy24ApiClient; config: any }> {
    let rows: any[] = []
    try {
      const res = await this.getPool().query(
        `SELECT id, display_name, mode, live_keys, test_keys, project_slugs, priority
         FROM gateway_config
         WHERE provider = 'przelewy24' AND is_active = true AND deleted_at IS NULL
         ORDER BY priority ASC`
      )
      rows = res.rows
    } catch (e: any) {
      this.logger_.error(`[Przelewy24] gateway_config query failed: ${e.message}`)
    }

    const config = pickP24Config(rows, projectSlug)
    const creds = credsFromGatewayConfig(config)
    if (!creds) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Przelewy24 credentials not configured. Set gateway_config keys {merchant_id, pos_id, api_key, crc}."
      )
    }
    this.logger_.info(
      `[Przelewy24] Using ${config.mode === "live" ? "LIVE" : "TEST"} gateway "${config.display_name}"` +
        (projectSlug ? ` for project "${projectSlug}"` : "")
    )
    return { client: new Przelewy24ApiClient(creds), config }
  }

  /**
   * Initiate payment — register a P24 transaction and hand the redirect URL
   * back in session data (frontend reads `checkoutUrl` / `redirectUrl`).
   */
  async initiatePayment(input: any): Promise<any> {
    const { amount, currency_code, data, context } = input
    const sessionData = data || {}
    const projectSlug = sessionData?.project_slug || context?.project_slug || null
    const cartId = sessionData?.cart_id || sessionData?.cartId || context?.cart?.id || null
    const email =
      sessionData?.email || context?.email || context?.customer?.email || ""

    try {
      const { client } = await this.getP24Client(projectSlug)

      // sessionId ≤ 100 chars, unique per attempt
      const rawCart = (cartId || "nocart").replace(/^cart_/, "")
      const sessionId = `p24_${rawCart}_${Date.now()}`.slice(0, 100)

      const backendUrl = process.env.BACKEND_PUBLIC_URL || "https://www.marketing-hq.eu"
      const returnUrl =
        sessionData?.return_url ||
        context?.return_url ||
        `${backendUrl}/store/payment-return`

      const addr = sessionData?.billing_address || sessionData?.shipping_address || {}
      const clientName = `${addr.first_name || ""} ${addr.last_name || ""}`.trim()

      logPaymentEvent({
        cart_id: cartId,
        email,
        project_slug: projectSlug,
        event_type: "p24_register_request",
        event_data: { sessionId, amount, currency: currency_code, method: sessionData?.method ?? null },
      })

      // Storefront sends string method codes ('blik', 'przelewy24', 'creditcard');
      // map them to the P24 channel bitmask so the hosted page opens directly on
      // the chosen method (1 = cards+wallets, 2 = przelewy, 64 = pay-by-links,
      // 8192 = BLIK). Unknown/absent code → no channel → P24 shows all methods.
      const METHOD_CHANNELS: Record<string, number> = {
        blik: 8192,
        przelewy24: 2 | 64,
        creditcard: 1,
        card: 1,
      }
      const methodCode = typeof sessionData?.method === "string" ? sessionData.method : null
      const mappedChannel =
        sessionData?.channel != null
          ? Number(sessionData.channel)
          : methodCode && METHOD_CHANNELS[methodCode] != null
            ? METHOD_CHANNELS[methodCode]
            : undefined

      const result = await client.registerTransaction({
        sessionId,
        amount, // MAJOR units — api-client converts to grosze
        currency: (currency_code || "PLN").toUpperCase(),
        description: (sessionData?.description || `Order ${rawCart}`).slice(0, 1024),
        email: email || "unknown@customer.invalid",
        country: (addr.country_code || "PL").toUpperCase(),
        language: "pl",
        urlReturn: returnUrl,
        urlStatus: `${backendUrl}/webhooks/przelewy24`,
        method: sessionData?.method != null && !isNaN(Number(sessionData.method))
          ? Number(sessionData.method)
          : undefined,
        channel: mappedChannel,
        client: clientName || undefined,
      })

      logPaymentEvent({
        intent_id: sessionId,
        cart_id: cartId,
        email,
        project_slug: projectSlug,
        event_type: "p24_register_response",
        event_data: {
          success: result.success,
          token: result.data?.token ?? null,
          error: result.error ?? null,
        },
        error_code: result.success ? null : String(result.errorCode ?? "register_failed"),
      })

      if (!result.success || !result.data?.token) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to register P24 transaction"
        )
      }

      this.logger_.info(
        `[Przelewy24] Transaction registered: sessionId=${sessionId}, redirect=${result.data.redirectUrl}`
      )

      return {
        id: sessionId,
        data: {
          p24SessionId: sessionId,
          sessionId,
          p24Token: result.data.token,
          checkoutUrl: result.data.redirectUrl,
          redirectUrl: result.data.redirectUrl,
          amount,
          currency: (currency_code || "PLN").toUpperCase(),
          project_slug: projectSlug,
          cart_id: cartId,
          email,
          method: sessionData?.method ?? null,
          createdAt: Date.now(),
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Payment initiation failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message || "Failed to initiate Przelewy24 payment"
      )
    }
  }

  /** Fetch live status from P24 and merge into session data. */
  private async fetchStatus(sessionData: any): Promise<{ data: any; status: PaymentSessionStatus }> {
    const sessionId = sessionData?.p24SessionId || sessionData?.sessionId
    if (!sessionId) {
      return { data: sessionData, status: PaymentSessionStatus.PENDING }
    }
    const { client } = await this.getP24Client(sessionData?.project_slug)
    const result = await client.getTransactionBySessionId(sessionId)
    if (!result.success) {
      // No transaction yet (customer never started paying) → still pending
      return { data: sessionData, status: PaymentSessionStatus.PENDING }
    }
    const tx = result.data
    return {
      data: {
        ...sessionData,
        p24OrderId: tx.orderId ?? sessionData?.p24OrderId,
        p24MethodId: tx.paymentMethod ?? tx.methodId ?? sessionData?.p24MethodId,
        p24Status: tx.status,
      },
      status: mapP24StatusToMedusa(tx.status),
    }
  }

  /**
   * Authorize — P24 is redirect-based auto-capture; treat paid/advance as
   * authorized so completeCartWorkflow can proceed.
   */
  async authorizePayment(input: any): Promise<any> {
    try {
      const sessionData = input?.data || input
      const { data, status } = await this.fetchStatus(sessionData)
      // If webhook already verified the payment, trust it even if the API
      // status read lags behind.
      if (status === PaymentSessionStatus.PENDING && sessionData?.p24_verified) {
        return { data, status: PaymentSessionStatus.CAPTURED }
      }
      return { data, status }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Authorization check failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /** Capture — P24 auto-captures after verify; report current status. */
  async capturePayment(input: any): Promise<any> {
    try {
      const sessionData = input?.data || input
      if (sessionData?.p24_verified) {
        return { data: sessionData, status: PaymentSessionStatus.CAPTURED }
      }
      const { data, status } = await this.fetchStatus(sessionData)
      return { data, status }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Capture failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /** Refund via POST /transaction/refund. Amount in MAJOR units. */
  async refundPayment(input: any): Promise<any> {
    try {
      const sessionData = input?.data || input
      const refundAmount = Number(input?.amount || 0)
      const sessionId = sessionData?.p24SessionId || sessionData?.sessionId
      const orderId = Number(sessionData?.p24OrderId || sessionData?.orderId || 0)

      if (!sessionId || !orderId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Missing p24SessionId or p24OrderId for refund"
        )
      }

      const { client } = await this.getP24Client(sessionData?.project_slug)
      const result = await client.refund({
        orderId,
        sessionId,
        amount: refundAmount,
        description: `Refund ${refundAmount.toFixed(2)} ${sessionData?.currency || "PLN"}`,
      })

      if (!result.success) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to create P24 refund"
        )
      }

      this.logger_.info(
        `[Przelewy24] Refund created for orderId ${orderId}: ${refundAmount.toFixed(2)}`
      )
      return { data: sessionData }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Refund failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /** Cancel — no P24 cancel API for registered transactions; no-op. */
  async cancelPayment(input: any): Promise<any> {
    const sessionData = input?.data || input
    return { data: sessionData, status: PaymentSessionStatus.CANCELED }
  }

  /** Delete session — no-op. */
  async deletePayment(input: any): Promise<any> {
    const sessionData = input?.data || input
    return { data: sessionData }
  }

  /** Live status via GET /transaction/by/sessionId. */
  async getPaymentStatus(input: any): Promise<PaymentSessionStatus> {
    try {
      const sessionData = input?.data || input
      if (sessionData?.p24_verified) return PaymentSessionStatus.CAPTURED
      const { status } = await this.fetchStatus(sessionData)
      return status
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Status check failed: ${error.message}`)
      return PaymentSessionStatus.PENDING
    }
  }

  /** Retrieve payment — live status merged into session data. */
  async retrievePayment(input: any): Promise<any> {
    try {
      const sessionData = input?.data || input
      const { data, status } = await this.fetchStatus(sessionData)
      return { data, status }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Retrieve failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /**
   * Update payment. A P24 sessionId is bound to the registered amount —
   * on amount change we re-register a fresh transaction (new sessionId + token).
   */
  async updatePayment(input: any): Promise<any> {
    const sessionData = input?.data || {}
    const newAmount = input?.amount
    if (newAmount != null && sessionData?.amount != null && Number(newAmount) !== Number(sessionData.amount)) {
      this.logger_.info(
        `[Przelewy24] Amount changed ${sessionData.amount} → ${newAmount}; re-registering transaction`
      )
      return await this.initiatePayment({
        amount: newAmount,
        currency_code: input?.currency_code || sessionData?.currency,
        data: sessionData,
        context: input?.context,
      })
    }
    return { data: sessionData }
  }

  /**
   * Webhook notification → verify sign + PUT /transaction/verify, then
   * report captured. (Primary webhook handling lives in
   * /webhooks/przelewy24/route.ts — this covers Medusa's generic hook path.)
   */
  async getWebhookActionAndData(payload: any): Promise<any> {
    try {
      const body = payload?.data || payload
      const sessionId = body?.sessionId
      const orderId = Number(body?.orderId || 0)
      if (!sessionId || !orderId) {
        return { action: "not_supported" }
      }

      // Resolve project slug from the session for correct credentials
      let projectSlug: string | null = null
      try {
        const { rows } = await this.getPool().query(
          `SELECT data FROM payment_session
           WHERE data->>'p24SessionId' = $1 OR data->>'sessionId' = $1
           LIMIT 1`,
          [sessionId]
        )
        projectSlug = rows[0]?.data?.project_slug || null
      } catch { /* best effort */ }

      const { client, config } = await this.getP24Client(projectSlug)
      const creds = credsFromGatewayConfig(config)

      const { verifyNotificationSign } = await import("./api-client")
      if (!verifyNotificationSign(body, creds.crc)) {
        this.logger_.warn(`[Przelewy24] Invalid notification sign for sessionId ${sessionId}`)
        return { action: "failed", data: { session_id: sessionId } }
      }

      const amountMajor = Number(body.amount) / 100
      const verify = await client.verifyTransaction({
        sessionId,
        orderId,
        amount: amountMajor,
        currency: body.currency || "PLN",
      })
      if (!verify.success) {
        this.logger_.warn(`[Przelewy24] Verify failed for sessionId ${sessionId}: ${verify.error}`)
        return { action: "failed", data: { session_id: sessionId } }
      }

      return {
        action: "captured",
        data: { session_id: sessionId, amount: amountMajor },
      }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Webhook processing failed: ${error.message}`)
      return { action: "failed", data: {} }
    }
  }
}

export default Przelewy24PaymentProvider
