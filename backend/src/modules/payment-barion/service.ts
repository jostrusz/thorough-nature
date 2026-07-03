// @ts-nocheck
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { Pool } from "pg"
import { BarionApiClient } from "./api-client"
import { logPaymentEvent } from "../payment-debug/utils/log"

type Options = {
  testMode?: boolean
}

type InjectedDependencies = {
  logger: any
}

/** Barion Locale enum accepts a fixed set; fall back to en-US for others (e.g. PL). */
const COUNTRY_TO_LOCALE: Record<string, string> = {
  HU: "hu-HU", CZ: "cs-CZ", SK: "sk-SK", DE: "de-DE", AT: "de-DE",
  ES: "es-ES", FR: "fr-FR", SI: "sl-SI", US: "en-US", GB: "en-US",
}
function resolveLocale(countryCode?: string): string {
  return COUNTRY_TO_LOCALE[(countryCode || "").toUpperCase()] || "en-US"
}

/**
 * Map a Barion PaymentStatus to a Medusa payment session status.
 * Only "Succeeded" means fully paid for an Immediate payment.
 */
function mapBarionStatusToMedusa(barionStatus: string): PaymentSessionStatus {
  switch (barionStatus) {
    case "Prepared":
    case "Started":
    case "InProgress":
    case "Waiting":
      return PaymentSessionStatus.PENDING
    case "Reserved":
    case "Authorized":
      return PaymentSessionStatus.AUTHORIZED
    case "Succeeded":
    case "PartiallySucceeded":
      return PaymentSessionStatus.CAPTURED
    case "Canceled":
      return PaymentSessionStatus.CANCELED
    case "Failed":
    case "Expired":
      return PaymentSessionStatus.ERROR
    default:
      return PaymentSessionStatus.PENDING
  }
}

/**
 * Barion payment provider for Medusa v2 (redirect-based Smart Gateway).
 *
 * Supports: bank card (3DS), Apple Pay, Google Pay, Barion wallet balance and
 * bank transfer (CZK/EUR) — all selected on Barion's hosted gateway page.
 * Currencies: HUF, EUR, USD, CZK, PLN, RON (no SEK).
 *
 * Credentials load from the `gateway_config` table (provider='barion'), keyed
 * per project via project_slugs — same multi-tenant pattern as Airwallex.
 * gateway_config.live_keys / test_keys = { pos_key: "<GUID>", payee: "<email>" }.
 *
 * Amounts are MAJOR units (HUF whole, EUR/CZK decimal) — no ×100.
 */
class BarionPaymentProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "barion"

  protected logger_: any
  protected options_: Options
  private pgPool_: Pool | null = null

  constructor(container: InjectedDependencies, options: Options) {
    super(container, options)
    this.logger_ = container.logger || console
    this.options_ = options || {}
    this.logger_.info(`[Barion] Provider initialized (testMode default: ${this.options_?.testMode !== false})`)
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
   * Build a Barion client from gateway_config, matched by project_slug.
   * NEVER cache the client on `this` — the service is shared across concurrent
   * requests and would leak one project's POSKey into another's call.
   */
  private async getBarionClient(projectSlug?: string): Promise<BarionApiClient> {
    try {
      const pool = this.getPool()
      const { rows } = await pool.query(
        `SELECT id, display_name, mode, live_keys, test_keys, project_slugs, priority
         FROM gateway_config
         WHERE provider = 'barion' AND is_active = true AND deleted_at IS NULL
         ORDER BY priority ASC`
      )

      let config: any = null
      if (rows.length > 0) {
        if (projectSlug) {
          config = rows.find((r: any) => {
            const slugs = Array.isArray(r.project_slugs) ? r.project_slugs : []
            return slugs.includes(projectSlug)
          })
          if (config) this.logger_.info(`[Barion] ✓ Matched gateway "${config.display_name}" for project "${projectSlug}"`)
        }
        if (!config) {
          config = rows.find((r: any) => !r.project_slugs || r.project_slugs.length === 0) || rows[0]
        }
      }

      if (config) {
        const isLive = config.mode === "live"
        const keys = isLive ? config.live_keys : config.test_keys
        // Admin form stores generic api_key/secret_key; accept both naming schemes.
        const posKey = keys?.pos_key || keys?.api_key
        const payee = keys?.payee || keys?.secret_key
        if (posKey && payee) {
          this.logger_.info(`[Barion] ✓ Using ${isLive ? "LIVE" : "TEST"} keys from gateway "${config.display_name}" (id: ${config.id})`)
          return new BarionApiClient(posKey, payee, !isLive, this.logger_)
        }
        this.logger_.error(`[Barion] Gateway "${config.display_name}" is missing POSKey/payee in ${isLive ? "live_keys" : "test_keys"}`)
      }
    } catch (e: any) {
      this.logger_.error(`[Barion] gateway_config query failed: ${e.message}`)
    }

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Barion credentials not configured. Add a gateway_config row (provider='barion') with { pos_key, payee }."
    )
  }

  /**
   * Create a Barion payment and return the hosted-gateway redirect URL.
   * Medusa input: { amount, currency_code, data?, context? } — amount MAJOR units.
   */
  async initiatePayment(input: any): Promise<any> {
    const { amount, currency_code, data, context } = input
    try {
      const projectSlug = data?.project_slug || context?.project_slug || null
      const client = await this.getBarionClient(projectSlug)

      const currency = String(currency_code || "").toUpperCase()
      // HUF is a zero-decimal currency — Barion expects a whole number.
      const total = currency === "HUF" ? Math.round(Number(amount)) : Number(amount)
      const method = data?.method || null
      const returnUrl = data?.return_url
      const customer = context?.customer
      const addr = data?.shipping_address || data?.billing_address || {}
      const email = customer?.email || data?.email || ""
      const productName = data?.product_name || "Order"

      const backendUrl =
        process.env.BACKEND_PUBLIC_URL ||
        (process.env.RAILWAY_PUBLIC_DOMAIN_VALUE
          ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN_VALUE}`
          : "http://localhost:9000")
      const callbackUrl = `${backendUrl}/webhooks/barion`

      const posTransactionId = `medusa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

      // Map the checkout method to Barion FundingSources. Default: let the
      // customer choose everything on the hosted gateway.
      // NOTE: Barion discontinued bank transfer (via kevin.) on 2026-01-09, so it
      // is deliberately NOT offered here. Supported: card, Apple/Google Pay, wallet.
      const FUNDING_MAP: Record<string, string[]> = {
        card: ["BankCard"], bankcard: ["BankCard"], creditcard: ["BankCard"],
        apple_pay: ["ApplePay"], applepay: ["ApplePay"],
        google_pay: ["GooglePay"], googlepay: ["GooglePay"],
        wallet: ["Balance"], balance: ["Balance"],
      }
      const fundingSources = FUNDING_MAP[method] || ["All"]

      const req = {
        PaymentType: "Immediate" as const,
        GuestCheckOut: true,
        FundingSources: fundingSources,
        PaymentRequestId: posTransactionId,
        PaymentWindow: "00:30:00",
        OrderNumber: posTransactionId,
        RedirectUrl: returnUrl,
        CallbackUrl: callbackUrl,
        Locale: resolveLocale(addr.country_code),
        Currency: currency,
        ...(email ? { PayerHint: email } : {}),
        Transactions: [
          {
            POSTransactionId: posTransactionId,
            Payee: client.payee,
            Total: total,
            Comment: productName,
            Items: [
              {
                Name: productName,
                Description: productName,
                Quantity: Number(data?.quantity || 1),
                Unit: "piece",
                UnitPrice: total / Number(data?.quantity || 1),
                ItemTotal: total,
              },
            ],
          },
        ],
      }

      const result = await client.startPayment(req)
      const paymentId = result?.PaymentId
      if (!paymentId) {
        throw new Error(`Barion Start returned no PaymentId: ${JSON.stringify(result).slice(0, 300)}`)
      }
      const checkoutUrl = client.gatewayUrl(paymentId)

      this.logger_.info(`[Barion] Payment created: ${paymentId}, status ${result.Status}, redirect ${checkoutUrl}`)

      logPaymentEvent({
        intent_id: paymentId,
        email: email || null,
        project_slug: projectSlug,
        event_type: "barion_payment_started",
        event_data: { status: result.Status, amount: total, currency, method, funding_sources: fundingSources, return_url: returnUrl || null },
      }).catch(() => {})

      return {
        id: paymentId,
        data: {
          intentId: paymentId,
          barionPaymentId: paymentId,
          posTransactionId,
          status: result.Status,
          amount: total,
          currency,
          method,
          checkoutUrl,
          return_url: returnUrl,
          session_id: data?.session_id,
          currency_code,
          project_slug: projectSlug,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Barion] Payment initiation failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message || "Failed to initiate Barion payment")
    }
  }

  async authorizePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const intentId = sessionData.intentId
      if (!intentId) return { status: PaymentSessionStatus.PENDING, data: sessionData }

      const client = await this.getBarionClient(sessionData.project_slug)
      const state = await client.getPaymentState(intentId)
      const status = mapBarionStatusToMedusa(state.Status)
      this.logger_.info(`[Barion] Authorize: ${intentId} → ${state.Status} → ${status}`)
      return { status, data: { ...sessionData, status: state.Status } }
    } catch (error: any) {
      this.logger_.error(`[Barion] Authorization failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /**
   * Immediate payments are already captured once Succeeded, so this is a no-op
   * status read. (Reservation/DelayedCapture would call FinishReservation here.)
   */
  async capturePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const intentId = sessionData.intentId
      if (!intentId) return { data: sessionData }
      const client = await this.getBarionClient(sessionData.project_slug)
      const state = await client.getPaymentState(intentId)
      this.logger_.info(`[Barion] Capture (immediate no-op): ${intentId} status ${state.Status}`)
      return { data: { ...sessionData, status: state.Status } }
    } catch (error: any) {
      this.logger_.error(`[Barion] Capture failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /**
   * Refund — Barion refunds are per-transaction, so we read the payment state
   * to find the payment TransactionId, then refund the requested amount.
   */
  async refundPayment(input: any): Promise<any> {
    const sessionData = input.data || input
    const refundAmount = Number(input.amount) || 0
    try {
      const intentId = sessionData.intentId
      if (!intentId) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, "No Barion PaymentId in session data")
      }
      const client = await this.getBarionClient(sessionData.project_slug)
      const state = await client.getPaymentState(intentId)

      // The primary (non-refund) payment transaction to the payee.
      const txns = Array.isArray(state.Transactions) ? state.Transactions : []
      const payTxn =
        txns.find((t: any) => t.TransactionType === "Payment" || t.Status === "Succeeded") || txns[0]
      if (!payTxn?.TransactionId) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, "No refundable Barion transaction found")
      }

      const currency = String(sessionData.currency || state.Currency || "").toUpperCase()
      const amountToRefund =
        refundAmount > 0
          ? (currency === "HUF" ? Math.round(refundAmount) : refundAmount)
          : Number(payTxn.Total)

      const refund = await client.refund(intentId, [
        {
          TransactionId: payTxn.TransactionId,
          POSTransactionId: payTxn.POSTransactionId || sessionData.posTransactionId || intentId,
          AmountToRefund: amountToRefund,
          Comment: "Customer requested refund",
        },
      ])
      this.logger_.info(`[Barion] Refund done: ${intentId}, amount ${amountToRefund} ${currency}`)
      return { data: { ...sessionData, refund: refund?.RefundedTransactions || true } }
    } catch (error: any) {
      this.logger_.error(`[Barion] Refund failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /**
   * Cancel — an unpaid Immediate payment simply expires after PaymentWindow;
   * Barion has no cancel for it. No-op (Reservation would CancelAuthorization).
   */
  async cancelPayment(input: any): Promise<any> {
    const sessionData = input.data || input
    return { data: { ...sessionData, status: "Canceled" } }
  }

  async deletePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    return { data: sessionData }
  }

  async getPaymentStatus(data: any): Promise<PaymentSessionStatus> {
    try {
      const intentId = data.intentId
      if (!intentId) return PaymentSessionStatus.PENDING
      const client = await this.getBarionClient(data.project_slug)
      const state = await client.getPaymentState(intentId)
      return mapBarionStatusToMedusa(state.Status)
    } catch {
      return PaymentSessionStatus.ERROR
    }
  }

  async retrievePayment(input: any): Promise<any> {
    const sessionData = input.data || input
    try {
      const intentId = sessionData.intentId
      if (!intentId) return { data: sessionData }
      const client = await this.getBarionClient(sessionData.project_slug)
      const state = await client.getPaymentState(intentId)
      return { data: { ...sessionData, status: state.Status, amount: state.Total, currency: state.Currency } }
    } catch (error: any) {
      this.logger_.error(`[Barion] Retrieve failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  async updatePayment(input: any): Promise<any> {
    const sessionData = input.data || {}
    return { data: sessionData }
  }

  /**
   * Process a Barion callback. The IPN body carries only a PaymentId, so we
   * verify by reading the real state (pull). Returns a Medusa payment action.
   */
  async getWebhookActionAndData(webhookData: any): Promise<any> {
    try {
      const raw = webhookData?.data || webhookData
      const paymentId = raw?.PaymentId || raw?.paymentId || webhookData?.PaymentId
      if (!paymentId) return { action: "not_supported", data: webhookData }

      const client = await this.getBarionClient()
      const state = await client.getPaymentState(paymentId)

      let action = "not_supported"
      if (state.Status === "Succeeded" || state.Status === "PartiallySucceeded") action = "captured"
      else if (state.Status === "Reserved" || state.Status === "Authorized") action = "authorized"
      else if (state.Status === "Failed" || state.Status === "Expired" || state.Status === "Canceled") action = "failed"

      this.logger_.info(`[Barion] Webhook: ${paymentId} → ${state.Status} → ${action}`)
      return {
        action,
        data: {
          intentId: paymentId,
          barionPaymentId: paymentId,
          status: state.Status,
          amount: state.Total,
          currency: state.Currency,
        },
      }
    } catch (error: any) {
      this.logger_.error(`[Barion] Webhook processing failed: ${error.message}`)
      return { action: "not_supported", data: webhookData }
    }
  }
}

export default BarionPaymentProviderService
