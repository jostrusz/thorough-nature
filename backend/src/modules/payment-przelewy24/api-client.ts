// @ts-nocheck
import axios, { AxiosInstance } from "axios"
import crypto from "crypto"

/**
 * Przelewy24 REST API client (v1).
 *
 * Docs: https://developers.przelewy24.pl (REST API v1.0.16)
 *
 * - Base URL: prod https://secure.przelewy24.pl/api/v1
 *             sandbox https://sandbox.przelewy24.pl/api/v1
 * - Auth: HTTP Basic — username = posId, password = apiKey ("klucz do raportów" / secretId)
 * - Amounts: P24 expects MINOR units (grosze). The rest of the codebase works in
 *   MAJOR units — conversion happens ONLY in this file (toMinor/toMajor).
 * - Sign: SHA-384 hex of a JSON STRING with exact key order and correct types
 *   (integers must be JSON numbers, not strings — otherwise a different string
 *   → different hash). Node's JSON.stringify does not escape unicode/slashes,
 *   which matches P24's expectation.
 */

const toMinor = (major: number): number => Math.round(Number(major) * 100)
const toMajor = (minor: number): number => Math.round(Number(minor)) / 100

function sha384Hex(input: string): string {
  return crypto.createHash("sha384").update(input, "utf8").digest("hex")
}

/** Sign for POST /transaction/register */
export function registerSign(params: {
  sessionId: string
  merchantId: number
  amountMinor: number
  currency: string
  crc: string
}): string {
  return sha384Hex(
    JSON.stringify({
      sessionId: String(params.sessionId),
      merchantId: Number(params.merchantId),
      amount: Number(params.amountMinor),
      currency: String(params.currency),
      crc: String(params.crc),
    })
  )
}

/** Sign for PUT /transaction/verify */
export function verifySign(params: {
  sessionId: string
  orderId: number
  amountMinor: number
  currency: string
  crc: string
}): string {
  return sha384Hex(
    JSON.stringify({
      sessionId: String(params.sessionId),
      orderId: Number(params.orderId),
      amount: Number(params.amountMinor),
      currency: String(params.currency),
      crc: String(params.crc),
    })
  )
}

/**
 * Verify the `sign` of an incoming P24 webhook notification.
 * Notification JSON: { merchantId, posId, sessionId, amount, originAmount,
 * currency, orderId, methodId, statement, sign }
 */
export function verifyNotificationSign(notification: any, crc: string): boolean {
  if (!notification?.sign) return false
  const expected = sha384Hex(
    JSON.stringify({
      merchantId: Number(notification.merchantId),
      posId: Number(notification.posId),
      sessionId: String(notification.sessionId),
      amount: Number(notification.amount),
      originAmount: Number(notification.originAmount),
      currency: String(notification.currency),
      orderId: Number(notification.orderId),
      methodId: Number(notification.methodId),
      statement: String(notification.statement),
      crc: String(crc),
    })
  )
  return expected === String(notification.sign).toLowerCase()
}

export interface IP24Credentials {
  merchantId: number
  posId: number
  apiKey: string
  crc: string
  sandbox?: boolean
}

export interface IP24RegisterInput {
  sessionId: string // ≤100 chars, unique per transaction attempt
  amount: number // MAJOR units (89.00 = 89.00 zł)
  currency: string // "PLN"
  description: string
  email: string
  country?: string // default "PL"
  language?: string // default "pl"
  urlReturn: string
  urlStatus?: string
  method?: number // specific P24 method id
  channel?: number // bitmask: 1 card+wallets, 2 przelew, 64 PBL, 8192 BLIK, ...
  client?: string // customer name
  phone?: string
  timeLimit?: number // minutes, 0-99
  waitForResult?: boolean
  regulationAccept?: boolean
}

export interface IP24Result<T = any> {
  success: boolean
  data?: T
  error?: string
  errorCode?: string | number
}

export class Przelewy24ApiClient {
  private http: AxiosInstance
  private creds: IP24Credentials
  private hostBase: string

  constructor(creds: IP24Credentials) {
    this.creds = {
      ...creds,
      merchantId: Number(creds.merchantId),
      posId: Number(creds.posId),
    }
    this.hostBase = creds.sandbox
      ? "https://sandbox.przelewy24.pl"
      : "https://secure.przelewy24.pl"

    this.http = axios.create({
      baseURL: `${this.hostBase}/api/v1`,
      timeout: 15000,
      auth: {
        // HTTP Basic: username = posId, password = apiKey (secretId)
        username: String(this.creds.posId),
        password: this.creds.apiKey,
      },
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })
  }

  /** Redirect URL for a register token */
  paymentUrl(token: string): string {
    return `${this.hostBase}/trnRequest/${token}`
  }

  private err(error: any): IP24Result {
    const body = error?.response?.data
    return {
      success: false,
      error:
        body?.error ||
        body?.message ||
        (typeof body === "string" ? body : null) ||
        error?.message ||
        "P24 request failed",
      errorCode: body?.code ?? error?.response?.status,
    }
  }

  /** GET /testAccess — credential sanity check */
  async testAccess(): Promise<IP24Result> {
    try {
      const r = await this.http.get("/testAccess")
      return { success: r.data?.data === true, data: r.data?.data }
    } catch (e: any) {
      return this.err(e)
    }
  }

  /**
   * POST /transaction/register — returns { token, redirectUrl }.
   * amount is in MAJOR units; converted to grosze here.
   */
  async registerTransaction(
    input: IP24RegisterInput
  ): Promise<IP24Result<{ token: string; redirectUrl: string }>> {
    try {
      const amountMinor = toMinor(input.amount)
      const currency = input.currency.toUpperCase()
      const sessionId = String(input.sessionId).slice(0, 100)

      const payload: any = {
        merchantId: this.creds.merchantId,
        posId: this.creds.posId,
        sessionId,
        amount: amountMinor,
        currency,
        description: String(input.description || "").slice(0, 1024),
        email: input.email,
        country: (input.country || "PL").toUpperCase(),
        language: input.language || "pl",
        urlReturn: input.urlReturn,
        sign: registerSign({
          sessionId,
          merchantId: this.creds.merchantId,
          amountMinor,
          currency,
          crc: this.creds.crc,
        }),
      }
      if (input.urlStatus) payload.urlStatus = input.urlStatus
      if (input.method != null) payload.method = Number(input.method)
      if (input.channel != null) payload.channel = Number(input.channel)
      if (input.client) payload.client = String(input.client).slice(0, 50)
      if (input.phone) payload.phone = String(input.phone).slice(0, 12)
      if (input.timeLimit != null) payload.timeLimit = Number(input.timeLimit)
      if (input.waitForResult != null) payload.waitForResult = !!input.waitForResult
      if (input.regulationAccept != null) payload.regulationAccept = !!input.regulationAccept

      const r = await this.http.post("/transaction/register", payload)
      const token = r.data?.data?.token
      if (!token) {
        return { success: false, error: r.data?.error || "No token returned from P24" }
      }
      return { success: true, data: { token, redirectUrl: this.paymentUrl(token) } }
    } catch (e: any) {
      return this.err(e)
    }
  }

  /**
   * PUT /transaction/verify — MANDATORY after the status notification;
   * without it the funds are never settled to the merchant.
   * amount in MAJOR units.
   */
  async verifyTransaction(input: {
    sessionId: string
    orderId: number
    amount: number // MAJOR units
    currency: string
  }): Promise<IP24Result<{ status: string }>> {
    try {
      const amountMinor = toMinor(input.amount)
      const currency = input.currency.toUpperCase()
      const payload = {
        merchantId: this.creds.merchantId,
        posId: this.creds.posId,
        sessionId: String(input.sessionId),
        amount: amountMinor,
        currency,
        orderId: Number(input.orderId),
        sign: verifySign({
          sessionId: String(input.sessionId),
          orderId: Number(input.orderId),
          amountMinor,
          currency,
          crc: this.creds.crc,
        }),
      }
      const r = await this.http.put("/transaction/verify", payload)
      // Success response: { data: { status: "success" } }
      const status = r.data?.data?.status
      return { success: status === "success", data: { status } }
    } catch (e: any) {
      return this.err(e)
    }
  }

  /**
   * GET /transaction/by/sessionId/{sessionId}
   * Returns transaction detail incl. `status` (numeric: 0 = no payment,
   * 1 = advance/pre-payment received, 2 = paid & verified, 3 = returned)
   * and `orderId`, `amount` (minor). amountMajor added for convenience.
   */
  async getTransactionBySessionId(sessionId: string): Promise<IP24Result<any>> {
    try {
      const r = await this.http.get(
        `/transaction/by/sessionId/${encodeURIComponent(sessionId)}`
      )
      const data = r.data?.data
      if (!data) return { success: false, error: "No transaction data" }
      return {
        success: true,
        data: { ...data, amountMajor: data.amount != null ? toMajor(data.amount) : null },
      }
    } catch (e: any) {
      return this.err(e)
    }
  }

  /** GET /payment/methods/{lang}?amount=&currency= — amount in MAJOR units */
  async getPaymentMethods(
    lang: "pl" | "en" = "pl",
    amount?: number,
    currency: string = "PLN"
  ): Promise<IP24Result<any[]>> {
    try {
      const params: any = { currency: currency.toUpperCase() }
      if (amount != null) params.amount = toMinor(amount)
      const r = await this.http.get(`/payment/methods/${lang}`, { params })
      return { success: true, data: r.data?.data || [] }
    } catch (e: any) {
      return this.err(e)
    }
  }

  /**
   * POST /transaction/refund — amount in MAJOR units.
   */
  async refund(input: {
    orderId: number
    sessionId: string
    amount: number // MAJOR units
    description?: string
    requestId?: string
    refundsUuid?: string
    urlStatus?: string
  }): Promise<IP24Result<any>> {
    try {
      const payload: any = {
        requestId: input.requestId || crypto.randomUUID(),
        refundsUuid: input.refundsUuid || crypto.randomUUID(),
        refunds: [
          {
            orderId: Number(input.orderId),
            sessionId: String(input.sessionId),
            amount: toMinor(input.amount),
            description: input.description || "Refund",
          },
        ],
      }
      if (input.urlStatus) payload.urlStatus = input.urlStatus
      const r = await this.http.post("/transaction/refund", payload)
      return { success: true, data: r.data?.data }
    } catch (e: any) {
      return this.err(e)
    }
  }

  /** GET /refund/by/orderId/{orderId} */
  async getRefundsByOrderId(orderId: number): Promise<IP24Result<any>> {
    try {
      const r = await this.http.get(`/refund/by/orderId/${Number(orderId)}`)
      return { success: true, data: r.data?.data }
    } catch (e: any) {
      return this.err(e)
    }
  }
}

/**
 * Parse a gateway_config row into P24 credentials.
 * live_keys/test_keys JSON: { merchant_id, pos_id, api_key, crc }
 * pos_id falls back to merchant_id (common P24 setup).
 */
export function credsFromGatewayConfig(config: any): IP24Credentials | null {
  if (!config) return null
  const isLive = config.mode === "live"
  let keys = isLive ? config.live_keys : config.test_keys
  if (typeof keys === "string") {
    try { keys = JSON.parse(keys) } catch { return null }
  }
  const merchantId = Number(keys?.merchant_id)
  const posId = Number(keys?.pos_id || keys?.merchant_id)
  const apiKey = keys?.api_key
  const crc = keys?.crc
  if (!merchantId || !posId || !apiKey || !crc) return null
  return { merchantId, posId, apiKey, crc, sandbox: !isLive }
}

/**
 * Pick the right gateway_config row for a project slug from active p24 rows
 * (project_slugs is a JSON array; empty/null = default for all projects).
 */
export function pickP24Config(rows: any[], projectSlug?: string | null): any | null {
  if (!rows?.length) return null
  let config = null
  if (projectSlug) {
    config = rows.find((r: any) => {
      const slugs = Array.isArray(r.project_slugs) ? r.project_slugs : []
      return slugs.includes(projectSlug)
    })
  }
  if (!config) {
    config = rows.find((r: any) => !r.project_slugs || r.project_slugs.length === 0) || rows[0]
  }
  return config
}
