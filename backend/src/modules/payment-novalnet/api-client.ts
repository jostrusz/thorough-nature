// @ts-nocheck
import axios, { AxiosInstance } from "axios"

/**
 * Novalnet REST API client.
 *
 * Endpoints, auth and request shape are reverse-engineered from Novalnet's
 * official open-source SDKs (payum-payment-integration-novalnet/Api.php,
 * woocommerce-payment-integration-novalnet, shopware-6-payment-integration-novalnet).
 *
 * AUTH:
 *   Header `X-NN-Access-Key: base64(payment_access_key)`
 *
 * BASE URL:
 *   Production AND Sandbox use the same host:
 *     https://payport.novalnet.de/v2/
 *   Sandbox is selected by setting `transaction.test_mode = "1"` in the body.
 *
 * AMOUNT FORMAT:
 *   Novalnet expects MINOR units (cents). 49.99 EUR → 4999.
 *   We convert at this layer — callers always pass MAJOR units.
 */

const BASE_URL = "https://payport.novalnet.de/v2"

interface NovalnetCredentials {
  /** Numeric merchant ID (= MID, e.g. 14838). Used as `merchant.vendor`. */
  vendorId: string
  /** Used as `merchant.signature` in request body. */
  productActivationKey: string
  /** Sent as `X-NN-Access-Key` header (base64-encoded by the client). */
  paymentAccessKey: string
  /** Per-merchant tariff/profile ID. Used as `merchant.tariff`. */
  tariff?: string
  /** When true → adds `transaction.test_mode = "1"`. */
  testMode: boolean
}

export interface NovalnetCustomer {
  email: string
  first_name?: string
  last_name?: string
  gender?: "m" | "f" | "u"
  customer_no?: string
  customer_ip?: string
  tel?: string
  mobile?: string
  billing?: NovalnetAddress
  shipping?: NovalnetAddress
}

export interface NovalnetAddress {
  street?: string
  house_no?: string
  city?: string
  zip?: string
  country_code?: string
  state?: string
  company?: string
}

export interface NovalnetInitPaymentInput {
  paymentType: string                  // CREDITCARD, IDEAL, BANCONTACT, ...
  amount: number                       // MAJOR units (we convert to cents)
  currency: string                     // ISO-4217 (EUR, CZK, ...)
  orderNo: string                      // our merchant order id
  customer: NovalnetCustomer
  returnUrl: string                    // success redirect
  errorReturnUrl?: string              // failure redirect (defaults to returnUrl)
  hookUrl?: string                     // where Novalnet sends webhooks
  systemIp?: string
  customerIp?: string
  language?: string                    // en, de, nl, ...
  /** When 1, only authorize — capture later via /transaction/capture. */
  onHold?: 0 | 1
  /** Method-specific payment_data block (e.g. card token, IBAN). */
  paymentData?: Record<string, any>
  /** Custom data forwarded back in webhook payloads. */
  customParams?: Record<string, any>
}

export interface NovalnetPaymentResult {
  /** Novalnet transaction ID (17-digit). Persist as the canonical reference. */
  tid: string
  /** Bound to the TID; required for SHA-256 webhook checksum. */
  txnSecret?: string
  /** Customer redirect target for redirect-based methods. */
  redirectUrl?: string
  /** Numeric status (100/200 = success). */
  status: number
  /** Human-readable status text. */
  statusText?: string
  /** Detailed transaction status (PENDING, ON_HOLD, CONFIRMED, ...). */
  txStatus?: string
  /** Raw payload — kept for debugging / data forwarding. */
  raw: any
}

export class NovalnetApiClient {
  private http: AxiosInstance
  private creds: NovalnetCredentials
  private logger: any

  constructor(creds: NovalnetCredentials, logger?: any) {
    if (!creds?.vendorId || !creds?.productActivationKey || !creds?.paymentAccessKey) {
      throw new Error("Novalnet client requires vendorId, productActivationKey and paymentAccessKey")
    }

    this.creds = creds
    this.logger = logger || console

    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: 25_000,
      headers: {
        "Content-Type": "application/json",
        "Charset": "utf-8",
        "Accept": "application/json",
        // Per Payum reference: payment_access_key base64-encoded.
        "X-NN-Access-Key": Buffer.from(creds.paymentAccessKey, "utf8").toString("base64"),
      },
    })
  }

  /** Build the merchant block included in EVERY request body. */
  private merchantBlock() {
    const block: Record<string, any> = {
      signature: this.creds.productActivationKey,
    }
    if (this.creds.tariff) block.tariff = this.creds.tariff
    return block
  }

  /** Common transaction defaults injected into every request. */
  private defaultTxn(): Record<string, any> {
    return {
      test_mode: this.creds.testMode ? "1" : "0",
    }
  }

  /**
   * POST /v2/payment — initiate a new payment.
   * For inline methods (CREDITCARD, SEPA) the response includes the final TID
   * synchronously. For redirect methods the response includes `result.redirect_url`.
   */
  async initiatePayment(input: NovalnetInitPaymentInput): Promise<NovalnetPaymentResult> {
    const body: Record<string, any> = {
      merchant: { ...this.merchantBlock(), tariff: this.creds.tariff || undefined },
      customer: this.buildCustomerBlock(input.customer),
      transaction: {
        ...this.defaultTxn(),
        payment_type: input.paymentType,
        amount: this.toMinor(input.amount),
        currency: input.currency.toUpperCase(),
        order_no: input.orderNo,
        return_url: input.returnUrl,
        error_return_url: input.errorReturnUrl || input.returnUrl,
        ...(input.hookUrl ? { hook_url: input.hookUrl } : {}),
        ...(input.systemIp ? { system_ip: input.systemIp } : {}),
        ...(input.onHold ? { on_hold: input.onHold } : {}),
        ...(input.paymentData ? { payment_data: input.paymentData } : {}),
      },
    }

    if (input.language) {
      body.custom = { lang: input.language.toUpperCase() }
    }
    if (input.customParams && Object.keys(input.customParams).length > 0) {
      body.custom = { ...(body.custom || {}), ...input.customParams }
    }

    const result = await this.post("/payment", body, "initiatePayment")
    return this.parsePaymentResult(result)
  }

  /**
   * POST /v2/transaction/details — fetch the current state of a transaction by TID.
   */
  async getTransactionDetails(tid: string | number): Promise<NovalnetPaymentResult> {
    const body = {
      merchant: this.merchantBlock(),
      transaction: { tid: String(tid) },
      custom: { lang: "EN" },
    }
    const result = await this.post("/transaction/details", body, "getTransactionDetails")
    return this.parsePaymentResult(result)
  }

  /**
   * POST /v2/transaction/capture — capture a previously authorized (on_hold=1) transaction.
   * Optional `amount` for partial capture (in MAJOR units).
   */
  async capture(tid: string | number, amount?: number): Promise<NovalnetPaymentResult> {
    const body: Record<string, any> = {
      merchant: this.merchantBlock(),
      transaction: { tid: String(tid) },
    }
    if (amount && amount > 0) body.transaction.amount = this.toMinor(amount)
    const result = await this.post("/transaction/capture", body, "capture")
    return this.parsePaymentResult(result)
  }

  /**
   * POST /v2/transaction/cancel — cancel a not-yet-captured transaction.
   */
  async cancel(tid: string | number): Promise<NovalnetPaymentResult> {
    const body = {
      merchant: this.merchantBlock(),
      transaction: { tid: String(tid) },
    }
    const result = await this.post("/transaction/cancel", body, "cancel")
    return this.parsePaymentResult(result)
  }

  /**
   * POST /v2/transaction/refund — refund a captured transaction.
   * `amount` in MAJOR units (defaults to full refund if omitted).
   */
  async refund(tid: string | number, amount?: number, reason?: string): Promise<NovalnetPaymentResult> {
    const body: Record<string, any> = {
      merchant: this.merchantBlock(),
      transaction: { tid: String(tid) },
    }
    if (amount && amount > 0) body.transaction.amount = this.toMinor(amount)
    if (reason) body.transaction.reason = reason
    const result = await this.post("/transaction/refund", body, "refund")
    return this.parsePaymentResult(result)
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  private buildCustomerBlock(c: NovalnetCustomer): Record<string, any> {
    const block: Record<string, any> = {}
    if (c.email) block.email = c.email
    if (c.first_name) block.first_name = c.first_name
    if (c.last_name) block.last_name = c.last_name
    if (c.gender) block.gender = c.gender
    if (c.customer_no) block.customer_no = c.customer_no
    if (c.customer_ip) block.customer_ip = c.customer_ip
    if (c.tel) block.tel = c.tel
    if (c.mobile) block.mobile = c.mobile
    if (c.billing) block.billing = this.cleanAddress(c.billing)
    if (c.shipping) block.shipping = this.cleanAddress(c.shipping)
    return block
  }

  private cleanAddress(a: NovalnetAddress): Record<string, any> {
    const out: Record<string, any> = {}
    if (a.street) out.street = a.street
    if (a.house_no) out.house_no = a.house_no
    if (a.city) out.city = a.city
    if (a.zip) out.zip = a.zip
    if (a.country_code) out.country_code = a.country_code.toUpperCase()
    if (a.state) out.state = a.state
    if (a.company) out.company = a.company
    return out
  }

  /** Convert MAJOR units (49.99) to MINOR units (4999) for Novalnet. */
  private toMinor(majorAmount: number): number {
    return Math.round(Number(majorAmount) * 100)
  }

  /** Convert MINOR units (4999) back to MAJOR (49.99). */
  static fromMinor(minorAmount: number | string): number {
    return Number(minorAmount) / 100
  }

  /** Standardize whatever Novalnet returns into `NovalnetPaymentResult`. */
  private parsePaymentResult(raw: any): NovalnetPaymentResult {
    const tx = raw?.transaction || {}
    const result = raw?.result || {}
    return {
      tid: String(tx.tid || result.tid || ""),
      txnSecret: tx.txn_secret || result.txn_secret || undefined,
      redirectUrl: result.redirect_url || tx.redirect_url || undefined,
      status: Number(result.status || tx.status_code || 0),
      statusText: result.status_text || result.status_message || undefined,
      txStatus: tx.status || tx.tx_status || undefined,
      raw,
    }
  }

  private async post(path: string, body: any, action: string): Promise<any> {
    try {
      const response = await this.http.post(path, body)
      return response.data
    } catch (err: any) {
      const httpStatus = err.response?.status
      const respBody = err.response?.data
      const message = respBody?.result?.status_text || respBody?.result?.status_message || err.message
      this.logger?.warn?.(`[Novalnet] ${action} failed (HTTP ${httpStatus}): ${message}`)
      // Re-throw with structured info — caller may inspect .response.data
      const wrapped: any = new Error(`Novalnet ${action} failed: ${message}`)
      wrapped.httpStatus = httpStatus
      wrapped.response = respBody
      throw wrapped
    }
  }
}
