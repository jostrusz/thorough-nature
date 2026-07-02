// @ts-nocheck
/**
 * Barion Smart Gateway API client (v2).
 *
 * Contract verified against the official SDKs (barion/barion-web-php,
 * aron123/node-barion). Key facts:
 *  - Base URLs: live https://api.barion.com, test https://api.test.barion.com
 *  - Redirect (hosted gateway): {web}/Pay?id={PaymentId}
 *    live https://secure.barion.com, test https://secure.test.barion.com
 *  - Auth: POSKey (GUID) sent as a field in the JSON body (POST) / query (GET).
 *    PHP SDK also sends an `x-pos-key` header — we mirror that, harmless.
 *  - Amounts are in MAJOR units (HUF is whole, EUR/CZK/PLN decimal). No ×100.
 *  - Callback (IPN) is unsigned and carries only a PaymentId — always verify by
 *    calling GetPaymentState with the POSKey (pull, never trust the push).
 */

export type BarionItem = {
  Name: string
  Description: string
  Quantity: number
  Unit: string
  UnitPrice: number
  ItemTotal: number
  SKU?: string
}

export type BarionTransaction = {
  POSTransactionId: string
  Payee: string
  Total: number
  Comment?: string
  Items?: BarionItem[]
}

export type BarionStartPaymentRequest = {
  PaymentType: "Immediate" | "Reservation" | "DelayedCapture"
  ReservationPeriod?: string
  GuestCheckOut: boolean
  FundingSources: string[]
  PaymentRequestId: string
  PaymentWindow?: string
  OrderNumber?: string
  RedirectUrl: string
  CallbackUrl: string
  Locale: string
  Currency: string
  Transactions: BarionTransaction[]
  PayerHint?: string
}

export class BarionApiClient {
  private apiUrl: string
  private webUrl: string
  private posKey: string
  public readonly payee: string
  private logger: any

  constructor(posKey: string, payee: string, isTest: boolean, logger?: any) {
    this.apiUrl = isTest ? "https://api.test.barion.com" : "https://api.barion.com"
    this.webUrl = isTest ? "https://secure.test.barion.com" : "https://secure.barion.com"
    this.posKey = posKey
    this.payee = payee
    this.logger = logger || console
  }

  /** Hosted Smart Gateway URL the customer is redirected to. */
  gatewayUrl(paymentId: string): string {
    return `${this.webUrl}/Pay?id=${encodeURIComponent(paymentId)}`
  }

  private async post(path: string, body: Record<string, any>): Promise<any> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    let res: Response
    try {
      res = await fetch(`${this.apiUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-pos-key": this.posKey },
        body: JSON.stringify({ POSKey: this.posKey, ...body }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    const json = await res.json().catch(() => ({}))
    const errors = Array.isArray(json?.Errors) ? json.Errors : []
    if (!res.ok || errors.length > 0) {
      const msg = errors.length
        ? errors.map((e: any) => e.Title || e.Description || e.ErrorCode).join("; ")
        : `HTTP ${res.status}`
      throw new Error(`Barion ${path} failed: ${msg}`)
    }
    return json
  }

  private async get(path: string, params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams({ POSKey: this.posKey, ...params }).toString()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    let res: Response
    try {
      res = await fetch(`${this.apiUrl}${path}?${qs}`, {
        headers: { "x-pos-key": this.posKey },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`Barion ${path} failed: HTTP ${res.status}`)
    return json
  }

  /** POST /v2/Payment/Start — create a payment, returns { PaymentId, Status, ... }. */
  async startPayment(req: BarionStartPaymentRequest): Promise<any> {
    return this.post("/v2/Payment/Start", req)
  }

  /** GET /v2/Payment/GetPaymentState — query current state by PaymentId. */
  async getPaymentState(paymentId: string): Promise<any> {
    return this.get("/v2/Payment/GetPaymentState", { PaymentId: paymentId })
  }

  /** POST /v2/Payment/Refund — refund one or more transactions of a Succeeded payment. */
  async refund(
    paymentId: string,
    transactionsToRefund: Array<{ TransactionId: string; POSTransactionId: string; AmountToRefund: number; Comment?: string }>
  ): Promise<any> {
    return this.post("/v2/Payment/Refund", { PaymentId: paymentId, TransactionsToRefund: transactionsToRefund })
  }

  /** POST /v2/Payment/FinishReservation — capture a reserved payment (Reservation flow). */
  async finishReservation(
    paymentId: string,
    transactions: Array<{ TransactionId: string; Total: number; Comment?: string }>
  ): Promise<any> {
    return this.post("/v2/Payment/FinishReservation", { PaymentId: paymentId, Transactions: transactions })
  }
}
