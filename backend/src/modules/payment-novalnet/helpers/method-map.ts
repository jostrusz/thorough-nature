/**
 * Mapping between our internal frontend payment method codes
 * and Novalnet's `payment_type` API values.
 *
 * Reference: official payment_type list from Novalnet's published SDKs
 * (Payum, WooCommerce, Shopware 6, Magento 2 plugins).
 *
 * Apple Pay is intentionally OMITTED from the first wave — requires Apple
 * Developer setup (merchant ID + domain verification file) and will be
 * added later in a separate phase.
 */
export const NOVALNET_PAYMENT_TYPES = {
  creditcard: "CREDITCARD",
  sepa: "DIRECT_DEBIT_SEPA",
  invoice: "INVOICE",
  prepayment: "PREPAYMENT",
  ideal: "IDEAL",
  online_transfer: "ONLINE_TRANSFER", // Sofort / online bank transfer
  giropay: "GIROPAY",
  cashpayment: "CASHPAYMENT",         // Barzahlen / viacash
  przelewy24: "PRZELEWY24",
  eps: "EPS",
  paypal: "PAYPAL",
  postfinance_card: "POSTFINANCE_CARD",
  postfinance: "POSTFINANCE",
  bancontact: "BANCONTACT",
  multibanco: "MULTIBANCO",
  trustly: "TRUSTLY",
  wechatpay: "WECHATPAY",
  alipay: "ALIPAY",
} as const

export type NovalnetMethodCode = keyof typeof NOVALNET_PAYMENT_TYPES

/**
 * Methods that complete via redirect to a Novalnet/bank-hosted page.
 * For these we expect Novalnet to return `result.redirect_url` and the
 * customer is sent to it; on completion they return to our `return_url`
 * (a query-string callback `?payment_return=1&cart_id=…`).
 */
export const REDIRECT_METHODS: ReadonlySet<NovalnetMethodCode> = new Set([
  "ideal",
  "bancontact",
  "eps",
  "przelewy24",
  "online_transfer",
  "giropay",
  "paypal",
  "trustly",
  "postfinance",
  "postfinance_card",
  "wechatpay",
  "alipay",
])

/**
 * Methods that complete inline — no redirect. The customer enters card / IBAN
 * data into Novalnet's iframe / SDK on our checkout page and the response
 * comes back synchronously.
 *
 * Credit Card uses Novalnet's "Seamless Payment Form" iframe.
 * SEPA uses an inline IBAN input (we collect IBAN client-side and send to API).
 */
export const INLINE_METHODS: ReadonlySet<NovalnetMethodCode> = new Set([
  "creditcard",
  "sepa",
])

/**
 * "Post-payment" methods — the order is created immediately as authorized
 * (or pending), and the customer pays later via bank transfer / store cash.
 * Novalnet sends the payment instructions in the response which we forward
 * to the customer via email.
 */
export const POST_PAYMENT_METHODS: ReadonlySet<NovalnetMethodCode> = new Set([
  "invoice",
  "prepayment",
  "multibanco",
  "cashpayment",
])

/** Translate our internal code → Novalnet's API value. */
export function toNovalnetType(code: string): string | null {
  if (!code) return null
  const lower = code.toLowerCase().replace(/[-\s]/g, "_") as NovalnetMethodCode
  return NOVALNET_PAYMENT_TYPES[lower] || null
}

/** Reverse lookup: Novalnet API value → our internal code (lowercase). */
export function fromNovalnetType(novalnetType: string): string | null {
  if (!novalnetType) return null
  const upper = novalnetType.toUpperCase()
  for (const [internal, external] of Object.entries(NOVALNET_PAYMENT_TYPES)) {
    if (external === upper) return internal
  }
  return null
}
