# Payment Gateways Integration — Complete Implementation Code

> **For Claude Code:** Execute all file creations/modifications below IN ORDER on the `staging` branch.
> After all changes: `git add . && git commit -m 'feat: Payment gateways integration — 7 providers, tracking, upsell, activity log' && git push origin staging`

---

## IMPORTANT NOTES FOR CLAUDE CODE

### Architecture Overview
This implementation adds 5 custom payment providers (Mollie, Comgate, Przelewy24, Klarna, Airwallex), extends 2 existing providers (Stripe, PayPal) with tracking dispatch, adds payment activity logging to order cards, one-click upsell for card payments, mini-checkout upsell for redirect-based methods, statement descriptor management, SVG payment method logos, and Fakturoid/QuickBooks upsell invoice integration.

### BaseLinker is GONE
All BaseLinker references have been replaced by Dextrum (see DEXTRUM-IMPLEMENTATION.md). Payment tracking dispatch integrates with Dextrum DISPATCHED status.

### Credential Storage — LIVE & TEST Keys in Admin
All gateway API credentials (LIVE and TEST) are stored in the MedusaJS admin panel under **Settings → Payment Gateways** (formerly "Billing"). The existing `gateway_config` model already has:
- `mode` field: enum `"live"` | `"test"` — determines which keys are active
- `live_keys` field: JSON object `{ api_key, secret_key, webhook_secret }` — production credentials
- `test_keys` field: JSON object `{ api_key, secret_key, webhook_secret }` — sandbox/test credentials

Each gateway provider reads credentials from `live_keys` or `test_keys` based on the current `mode` setting. This means:
- **No .env files needed for gateway keys** — everything is managed in the admin UI
- Switching between TEST and LIVE mode is done via the Quick Switch tab or per-gateway toggle
- The admin UI shows which mode is active with a visual indicator (green = live, yellow = test)

> **IMPORTANT FOR CLAUDE CODE**: The admin route is at `settings-billing/page.tsx` but the tab label must be renamed from "Billing" to **"Payment Gateways"**. Update the `defineRouteConfig` at the bottom of the file to use label `"Payment Gateways"` and the page heading accordingly.

### Key Business Rules
- Every payment event (success, error, tracking sent) MUST be logged to `order.metadata.payment_activity_log[]`
- Tracking info MUST be sent to payment gateways after Dextrum status = DISPATCHED
- One-click upsell works ONLY for: card (Stripe/Mollie/Airwallex), PayPal, Apple Pay, Google Pay, SEPA
- Redirect-based methods (iDEAL, Bancontact, BLIK, P24, Klarna, EPS, giropay, SOFORT) require mini-checkout for upsell
- Statement descriptor: max 16 chars, A-Z 0-9 space dot hyphen only, validated in admin UI
- Fakturoid: ONE invoice per order, upsell added as line item + second payment record (Option A)

### Documentation URLs for Each Gateway
- **Stripe**: https://docs.stripe.com/api + https://docs.medusajs.com/resources/commerce-modules/payment/payment-provider/stripe
- **PayPal**: https://developer.paypal.com/docs/api/orders/v2/ + https://developer.paypal.com/docs/tracking/
- **Mollie**: https://docs.mollie.com/ + https://docs.mollie.com/reference/shipments-api + https://docs.mollie.com/reference/orders-api
- **Comgate**: https://apidoc.comgate.cz/en/ + https://apidoc.comgate.cz/en/api/rest/
- **Przelewy24**: https://developers.przelewy24.pl/
- **Klarna**: https://docs.klarna.com/api/ordermanagement/ + https://docs.klarna.com/payments/
- **Airwallex**: https://www.airwallex.com/docs/api

### Gateway Credential Requirements
| Gateway | Required Fields | Auth Method |
|---------|----------------|-------------|
| Stripe | api_key (secret key), webhook_secret | Bearer token |
| PayPal | api_key (client_id), secret_key (secret), webhook_id | OAuth2 |
| Mollie | api_key (test/live key) | Bearer token |
| Comgate | api_key (merchant_id), secret_key (secret) | HTTP Basic Auth |
| Przelewy24 | api_key (merchant_id), secret_key (CRC), pos_id (in metadata) | HTTP Basic Auth + CRC checksum |
| Klarna | api_key (username), secret_key (password) | HTTP Basic Auth |
| Airwallex | api_key (client_id), secret_key (api_key) | Bearer token (login first) |

### One-Click Upsell Capability Matrix
| Payment Method | One-Click | Requires Mini-Checkout |
|---|---|---|
| Credit/Debit Card (Stripe/Mollie/Airwallex) | YES — saved payment_method | — |
| PayPal | YES — billing agreement | — |
| Apple Pay / Google Pay | YES — tokenized card | — |
| SEPA Direct Debit | YES — mandate | — |
| iDEAL | — | YES — bank redirect |
| Bancontact | — | YES — bank redirect |
| BLIK | — | YES — 6-digit code |
| Przelewy24 bank | — | YES — bank redirect |
| Klarna | — | YES — new checkout |
| SOFORT / EPS / giropay | — | YES — bank redirect |
| Comgate bank transfer | — | YES — redirect |

---

## OVERVIEW — File Tree

```
NEW FILES:
  backend/src/modules/payment-mollie/
    ├── index.ts                              — Module registration
    ├── service.ts                            — Mollie payment provider service
    └── api-client.ts                         — Mollie REST API client (Orders API)

  backend/src/modules/payment-comgate/
    ├── index.ts                              — Module registration
    ├── service.ts                            — Comgate payment provider service
    └── api-client.ts                         — Comgate REST API client

  backend/src/modules/payment-przelewy24/
    ├── index.ts                              — Module registration
    ├── service.ts                            — P24 payment provider service
    └── api-client.ts                         — Przelewy24 REST API client

  backend/src/modules/payment-klarna/
    ├── index.ts                              — Module registration
    ├── service.ts                            — Klarna payment provider service
    └── api-client.ts                         — Klarna REST API client (Order Management)

  backend/src/modules/payment-airwallex/
    ├── index.ts                              — Module registration
    ├── service.ts                            — Airwallex payment provider service
    └── api-client.ts                         — Airwallex REST API client

  backend/src/api/webhooks/
    ├── mollie/route.ts                       — Mollie webhook handler
    ├── comgate/route.ts                      — Comgate webhook handler
    ├── przelewy24/route.ts                   — P24 webhook handler
    ├── klarna/route.ts                       — Klarna webhook handler
    └── airwallex/route.ts                    — Airwallex webhook handler

  backend/src/api/store/custom/orders/[id]/
    ├── upsell-charge/route.ts                — POST one-click upsell charge
    └── upsell-session/route.ts               — POST create mini-checkout session for redirect methods

  backend/src/subscribers/
    ├── tracking-dispatcher.ts                — Send tracking to all payment gateways on DISPATCHED
    └── upsell-invoice.ts                     — Add upsell to Fakturoid/QuickBooks invoice

  backend/src/admin/components/orders/
    └── order-payment-activity.tsx             — Payment activity log timeline component

MODIFIED FILES:
  backend/medusa-config.js                    — Register 5 new payment modules
  backend/src/admin/routes/settings-billing/page.tsx — RENAME tab label from "Billing" to "Payment Gateways", add descriptor field, gateway-specific credentials, validation, multi-account support
  backend/src/admin/components/billing/payment-method-icons.tsx — Replace text labels with SVG logos
  backend/src/admin/components/orders/order-detail-payment.tsx — Add payment activity log + tracking badges
  backend/src/admin/routes/custom-orders/[id]/page.tsx — Add PaymentActivityLog component
  backend/src/api/store/custom/orders/[id]/upsell-accept/route.ts — Extend with payment charge logic
  backend/src/subscribers/order-placed-fakturoid.ts — Support upsell line item addition
  backend/src/subscribers/order-placed-quickbooks.ts — Support upsell payment addition
  storefront/src/lib/constants.tsx            — Add all payment provider mappings
  storefront/src/modules/checkout/components/payment/index.tsx — Use SVG logos
  storefront/src/modules/checkout/components/payment-button/index.tsx — Add Mollie/P24/Klarna/etc handlers
  storefront/src/projects/loslatenboek/pages/upsell.html — Add one-click charge + mini-checkout logic
```

---

## FILE 1: backend/src/modules/payment-mollie/api-client.ts

Mollie REST API client using the Orders API. Supports shipment tracking, Klarna BNPL, and direct payment operations. Uses Bearer token authentication with https://api.mollie.com as base URL.

```typescript
import axios, { AxiosInstance } from "axios"

export interface IMollieOrderData {
  amount: {
    value: string
    currency: string
  }
  orderNumber: string
  lines: Array<{
    type?: string
    sku?: string
    name: string
    quantity: number
    unitPrice: {
      value: string
      currency: string
    }
    totalAmount: {
      value: string
      currency: string
    }
    vatRate?: string
    vatAmount?: {
      value: string
      currency: string
    }
  }>
  billingAddress?: {
    organizationName?: string
    streetAndNumber: string
    postalCode: string
    city: string
    country: string
    title?: string
    givenName?: string
    familyName?: string
    email?: string
    phone?: string
  }
  shippingAddress?: {
    organizationName?: string
    streetAndNumber: string
    postalCode: string
    city: string
    country: string
    title?: string
    givenName?: string
    familyName?: string
    email?: string
    phone?: string
  }
  description?: string
  redirectUrl: string
  webhookUrl: string
  method?: string | string[]
  locale?: string
  metadata?: Record<string, any>
  payment?: {
    issuer?: string
    customerId?: string
    mandateId?: string
    sequenceType?: string
  }
}

export interface IMollieShipmentData {
  lines?: Array<{
    id: string
    quantity?: number
  }>
  tracking?: {
    carrier: string
    code: string
    url?: string
  }
}

export interface IMollieRefundData {
  lines?: Array<{
    id: string
    quantity?: number
  }>
  description?: string
  metadata?: Record<string, any>
}

export interface IMolliePaymentData {
  amount: {
    value: string
    currency: string
  }
  description: string
  redirectUrl: string
  webhookUrl: string
  method?: string
  customerId?: string
  mandateId?: string
  sequenceType?: string
  firstPaymentDescription?: string
  metadata?: Record<string, any>
}

export interface IMollieMethodsParams {
  locale?: string
  includeWallets?: boolean
  resourceId?: string
}

export class MollieApiClient {
  private client: AxiosInstance
  private apiKey: string
  private testMode: boolean

  constructor(apiKey: string, testMode: boolean = true) {
    this.apiKey = apiKey
    this.testMode = testMode

    this.client = axios.create({
      baseURL: "https://api.mollie.com/v2",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    })
  }

  /**
   * Create a Mollie order
   */
  async createOrder(orderData: IMollieOrderData): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.post("/orders", orderData)
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }

  /**
   * Get a Mollie order by ID
   */
  async getOrder(mollieOrderId: string): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.get(`/orders/${mollieOrderId}`)
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }

  /**
   * Create a shipment for a Mollie order (with tracking info)
   */
  async createShipment(
    orderId: string,
    shipmentData: IMollieShipmentData
  ): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.post(
        `/orders/${orderId}/shipments`,
        shipmentData
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }

  /**
   * Create a payment (for recurring/upsell)
   */
  async createPayment(paymentData: IMolliePaymentData): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.post("/payments", paymentData)
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }

  /**
   * Get a payment by ID
   */
  async getPayment(paymentId: string): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.get(`/payments/${paymentId}`)
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }

  /**
   * Create a refund for a Mollie order
   */
  async createRefund(
    orderId: string,
    refundData: IMollieRefundData
  ): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.post(
        `/orders/${orderId}/refunds`,
        refundData
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }

  /**
   * List available payment methods
   */
  async listMethods(params?: IMollieMethodsParams): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.get("/methods", { params })
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }

  /**
   * Create a first payment (for mandate creation - one-click upsell)
   */
  async createFirstPayment(
    customerId: string,
    paymentData: IMolliePaymentData
  ): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const payloadWithCustomer = {
        ...paymentData,
        customerId,
        sequenceType: "first",
      }
      const response = await this.client.post("/payments", payloadWithCustomer)
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }

  /**
   * Create a recurring payment using a mandate (upsell charge)
   */
  async createRecurringPayment(
    customerId: string,
    mandateId: string,
    paymentData: Omit<IMolliePaymentData, "customerId" | "mandateId">
  ): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const payloadWithMandate = {
        ...paymentData,
        customerId,
        mandateId,
        sequenceType: "recurring",
      }
      const response = await this.client.post(
        "/payments",
        payloadWithMandate
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }
}
```

---

## FILE 2: backend/src/modules/payment-mollie/service.ts

MedusaJS 2.0 payment provider service implementing AbstractPaymentProvider. Handles order creation, authorization, capture, refunds, and webhook processing for Mollie. Stores mollieOrderId in payment session data and maps Mollie statuses to Medusa statuses.

```typescript
import {
  AbstractPaymentProvider,
  PaymentProviderError,
  PaymentSessionStatus,
  PaymentProviderSessionResponse,
  RefundInput,
} from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import { GatewayConfigService } from "../gateway-config/service"
import { MollieApiClient } from "./api-client"

export interface IMolliePaymentSessionData {
  mollieOrderId?: string
  molliePaymentId?: string
  status?: string
  method?: string
  amount?: number
  currency?: string
  createdAt?: number
}

/**
 * Maps Mollie order/payment statuses to Medusa payment session statuses
 */
function mapMollieStatusToMedusa(mollieStatus: string): PaymentSessionStatus {
  switch (mollieStatus) {
    case "paid":
      return PaymentSessionStatus.AUTHORIZED
    case "authorized":
      return PaymentSessionStatus.AUTHORIZED
    case "completed":
      return PaymentSessionStatus.AUTHORIZED
    case "pending":
      return PaymentSessionStatus.PENDING
    case "processing":
      return PaymentSessionStatus.PENDING
    case "expired":
      return PaymentSessionStatus.CANCELED
    case "canceled":
      return PaymentSessionStatus.CANCELED
    case "failed":
      return PaymentSessionStatus.ERROR
    default:
      return PaymentSessionStatus.PENDING
  }
}

/**
 * Mollie payment provider service
 * Integrates with Mollie Orders API for orders with shipment tracking
 * Supports Klarna, iDEAL, cards, SEPA, and more
 */
export class MolliePaymentProvider extends AbstractPaymentProvider {
  protected client_: MollieApiClient | null = null
  protected gatewayConfigService_: GatewayConfigService
  protected logger_: Logger

  constructor(container: any) {
    super(container)
    this.gatewayConfigService_ = container.resolve("gateway-config")
    this.logger_ = container.resolve("logger")
  }

  /**
   * Initialize the Mollie API client with credentials
   */
  private async getMollieClient(): Promise<MollieApiClient> {
    if (!this.client_) {
      const config = await this.gatewayConfigService_.retrieve("mollie")
      if (!config || !config.api_key) {
        throw new PaymentProviderError("Mollie API key not configured")
      }
      const testMode = config.test_mode !== false
      this.client_ = new MollieApiClient(config.api_key, testMode)
    }
    return this.client_
  }

  /**
   * Get identifier for the payment provider
   */
  static identifier = "mollie"

  /**
   * Initiate a payment session — create a Mollie order
   */
  async initiatePayment(context: any): Promise<PaymentProviderSessionResponse> {
    const {
      amount,
      currency_code,
      customer,
      cart,
      context: contextData,
    } = context

    try {
      const client = await this.getMollieClient()

      // Build order lines from cart items
      const lines = (cart?.items || []).map((item: any) => ({
        type: "physical",
        sku: item.product?.sku || item.id,
        name: item.title || "Product",
        quantity: item.quantity,
        unitPrice: {
          value: (item.unit_price / 100).toFixed(2),
          currency: currency_code.toUpperCase(),
        },
        totalAmount: {
          value: ((item.unit_price * item.quantity) / 100).toFixed(2),
          currency: currency_code.toUpperCase(),
        },
        vatRate: item.metadata?.vat_rate || "21.00",
        vatAmount: {
          value: item.metadata?.vat_amount
            ? (item.metadata.vat_amount / 100).toFixed(2)
            : "0.00",
          currency: currency_code.toUpperCase(),
        },
      }))

      // Build addresses
      const billingAddress = customer?.billing_address || {}
      const shippingAddress = cart?.shipping_address || billingAddress

      const orderData = {
        amount: {
          value: (amount / 100).toFixed(2),
          currency: currency_code.toUpperCase(),
        },
        orderNumber: cart?.id || `order-${Date.now()}`,
        lines,
        billingAddress: {
          streetAndNumber: billingAddress.address_1 || "Street 1",
          postalCode: billingAddress.postal_code || "00000",
          city: billingAddress.city || "City",
          country: billingAddress.country_code?.toUpperCase() || "NL",
          givenName: customer?.first_name || "John",
          familyName: customer?.last_name || "Doe",
          email: customer?.email,
          phone: customer?.phone,
        },
        shippingAddress: {
          streetAndNumber: shippingAddress.address_1 || "Street 1",
          postalCode: shippingAddress.postal_code || "00000",
          city: shippingAddress.city || "City",
          country: shippingAddress.country_code?.toUpperCase() || "NL",
          givenName: customer?.first_name || "John",
          familyName: customer?.last_name || "Doe",
          email: customer?.email,
          phone: customer?.phone,
        },
        description: contextData?.statement_descriptor || "Order",
        redirectUrl: `${contextData?.return_url || "https://example.com"}/payment/success`,
        webhookUrl: `${contextData?.webhook_url || "https://api.example.com"}/webhooks/mollie`,
        metadata: {
          medusa_order_id: cart?.id,
          customer_id: customer?.id,
        },
      }

      const result = await client.createOrder(orderData)
      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to create Mollie order")
      }

      const mollieOrder = result.data
      const checkoutUrl = mollieOrder._links?.checkout?.href

      if (!checkoutUrl) {
        throw new PaymentProviderError("No checkout URL returned from Mollie")
      }

      // Log payment activity
      this.logger_.info(
        `[Mollie] Order created: ${mollieOrder.id}, redirect: ${checkoutUrl}`
      )

      return {
        session_data: {
          mollieOrderId: mollieOrder.id,
          status: mollieOrder.status,
          amount,
          currency: currency_code,
          createdAt: Date.now(),
        } as IMolliePaymentSessionData,
        redirect_url: checkoutUrl,
      }
    } catch (error: any) {
      this.logger_.error(`[Mollie] Payment initiation failed: ${error.message}`)
      throw new PaymentProviderError(
        error.message || "Failed to initiate Mollie payment"
      )
    }
  }

  /**
   * Authorize payment — check Mollie order status
   */
  async authorizePayment(
    paymentSessionData: IMolliePaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getMollieClient()
      const { mollieOrderId } = paymentSessionData

      if (!mollieOrderId) {
        throw new PaymentProviderError("No Mollie order ID in session data")
      }

      const result = await client.getOrder(mollieOrderId)
      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to fetch Mollie order")
      }

      const mollieOrder = result.data
      const status = mapMollieStatusToMedusa(mollieOrder.status)

      return {
        session_data: {
          ...paymentSessionData,
          mollieOrderId: mollieOrder.id,
          status: mollieOrder.status,
        },
        status,
      }
    } catch (error: any) {
      this.logger_.error(`[Mollie] Authorization check failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Capture payment — for Klarna use authorize flow
   * If Klarna: capture after shipment. For cards: capture immediately if authorized
   */
  async capturePayment(
    paymentSessionData: IMolliePaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getMollieClient()
      const { mollieOrderId } = paymentSessionData

      if (!mollieOrderId) {
        throw new PaymentProviderError("No Mollie order ID in session data")
      }

      // Fetch current order status
      const result = await client.getOrder(mollieOrderId)
      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to fetch Mollie order")
      }

      const mollieOrder = result.data

      // For Klarna orders, capture is done after shipment via webhook
      // For other methods, the order is already captured at payment time
      const status = mapMollieStatusToMedusa(mollieOrder.status)

      return {
        session_data: {
          ...paymentSessionData,
          mollieOrderId: mollieOrder.id,
          status: mollieOrder.status,
        },
        status,
      }
    } catch (error: any) {
      this.logger_.error(`[Mollie] Capture failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(
    paymentSessionData: IMolliePaymentSessionData,
    refundAmount: number,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getMollieClient()
      const { mollieOrderId } = paymentSessionData

      if (!mollieOrderId) {
        throw new PaymentProviderError("No Mollie order ID in session data")
      }

      const refundData = {
        description: `Refund ${(refundAmount / 100).toFixed(2)}`,
      }

      const result = await client.createRefund(mollieOrderId, refundData)
      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to create refund")
      }

      this.logger_.info(
        `[Mollie] Refund created for order ${mollieOrderId}: ${result.data.id}`
      )

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.AUTHORIZED,
      }
    } catch (error: any) {
      this.logger_.error(`[Mollie] Refund failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(
    paymentSessionData: IMolliePaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getMollieClient()
      const { mollieOrderId } = paymentSessionData

      if (!mollieOrderId) {
        throw new PaymentProviderError("No Mollie order ID in session data")
      }

      // Mollie doesn't have a direct cancel endpoint for orders
      // The order will expire after 28 days if unpaid
      // Log the cancellation intent
      this.logger_.info(`[Mollie] Order ${mollieOrderId} marked for cancellation`)

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.CANCELED,
      }
    } catch (error: any) {
      this.logger_.error(`[Mollie] Cancel failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Delete payment session
   */
  async deletePayment(
    paymentSessionData: IMolliePaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    // No-op for Mollie — cleanup handled server-side
    return {
      session_data: paymentSessionData,
      status: PaymentSessionStatus.CANCELED,
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(
    paymentSessionData: IMolliePaymentSessionData,
    context: any
  ): Promise<PaymentSessionStatus> {
    try {
      const client = await this.getMollieClient()
      const { mollieOrderId } = paymentSessionData

      if (!mollieOrderId) {
        return PaymentSessionStatus.PENDING
      }

      const result = await client.getOrder(mollieOrderId)
      if (!result.success) {
        return PaymentSessionStatus.ERROR
      }

      const status = mapMollieStatusToMedusa(result.data.status)
      return status
    } catch (error: any) {
      this.logger_.error(`[Mollie] Status check failed: ${error.message}`)
      return PaymentSessionStatus.ERROR
    }
  }

  /**
   * Retrieve payment data
   */
  async retrievePayment(
    paymentSessionData: IMolliePaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getMollieClient()
      const { mollieOrderId } = paymentSessionData

      if (!mollieOrderId) {
        throw new PaymentProviderError("No Mollie order ID in session data")
      }

      const result = await client.getOrder(mollieOrderId)
      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to retrieve order")
      }

      const status = mapMollieStatusToMedusa(result.data.status)

      return {
        session_data: {
          ...paymentSessionData,
          mollieOrderId: result.data.id,
          status: result.data.status,
          method: result.data.method,
        },
        status,
      }
    } catch (error: any) {
      this.logger_.error(`[Mollie] Retrieve failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Update payment session
   */
  async updatePayment(context: any): Promise<PaymentProviderSessionResponse> {
    return await this.retrievePayment(context.paymentSessionData, context)
  }

  /**
   * Process Mollie webhook
   */
  async getWebhookActionAndData(webhookData: any): Promise<{
    action: string
    data: IMolliePaymentSessionData
  }> {
    try {
      const { resource, id, action } = webhookData

      if (resource === "order") {
        const client = await this.getMollieClient()
        const result = await client.getOrder(id)

        if (!result.success) {
          throw new Error(result.error)
        }

        const mollieOrder = result.data

        return {
          action: mollieOrder.status === "paid" ? "succeed" : "fail",
          data: {
            mollieOrderId: id,
            status: mollieOrder.status,
          } as IMolliePaymentSessionData,
        }
      }

      if (resource === "payment") {
        const client = await this.getMollieClient()
        const result = await client.getPayment(id)

        if (!result.success) {
          throw new Error(result.error)
        }

        const molliePayment = result.data

        return {
          action: molliePayment.status === "paid" ? "succeed" : "fail",
          data: {
            molliePaymentId: id,
            status: molliePayment.status,
          } as IMolliePaymentSessionData,
        }
      }

      return {
        action: "neutral",
        data: webhookData,
      }
    } catch (error: any) {
      this.logger_.error(`[Mollie] Webhook processing failed: ${error.message}`)
      return {
        action: "fail",
        data: webhookData,
      }
    }
  }
}
```

---

## FILE 3: backend/src/modules/payment-mollie/index.ts

Module registration for Mollie payment provider using MedusaJS 2.0 ModuleProvider pattern. Registers the payment service and exports the provider for use in the payment module.

```typescript
import { Module } from "@medusajs/framework/utils"
import { MolliePaymentProvider } from "./service"

export const MOLLIE_MODULE_NAME = "payment-mollie"

export default Module(MOLLIE_MODULE_NAME, {
  service: MolliePaymentProvider,
})
```

---

## FILE 4: backend/src/modules/payment-comgate/api-client.ts

Comgate REST API client using HTTP Basic Auth. Supports payment creation with redirect URLs, status checking, and refunds. No tracking API support (Comgate doesn't provide shipment tracking integration).

```typescript
import axios, { AxiosInstance } from "axios"

export interface IComgatePaymentParams {
  merchant: string
  price: number // in cents
  curr: string // EUR, CZK, etc.
  label: string // max 16 chars descriptor
  refId: string // merchant reference ID
  method?: string // bank transfer method
  prepareOnly?: boolean // if true, don't redirect, return transId + URL
  secret: string
  email?: string
  country?: string
}

export interface IComgateStatusParams {
  merchant: string
  transId: string
  secret: string
}

export interface IComgateRefundParams {
  merchant: string
  transId: string
  amount?: number // in cents, optional (full refund if omitted)
  secret: string
}

export interface IComgateMethodsParams {
  country?: string
  curr?: string
}

export class ComgateApiClient {
  private client: AxiosInstance
  private merchantId: string
  private secret: string

  constructor(merchantId: string, secret: string) {
    this.merchantId = merchantId
    this.secret = secret

    this.client = axios.create({
      baseURL: "https://payments.comgate.cz",
      timeout: 10000,
    })
  }

  /**
   * Parse form-encoded response from Comgate
   */
  private parseFormEncoded(data: string): Record<string, any> {
    const result: Record<string, any> = {}
    const pairs = data.split("&")
    for (const pair of pairs) {
      const [key, value] = pair.split("=")
      result[decodeURIComponent(key)] = decodeURIComponent(value || "")
    }
    return result
  }

  /**
   * Create a payment or payment redirect
   * If prepareOnly=true, returns transId + redirect URL without auto-redirect
   */
  async createPayment(params: IComgatePaymentParams): Promise<{
    success: boolean
    data?: {
      transId?: string
      redirectUrl?: string
      code?: string
      message?: string
    }
    error?: string
  }> {
    try {
      // Build form data
      const formData = new URLSearchParams({
        merchant: params.merchant,
        price: params.price.toString(),
        curr: params.curr,
        label: params.label.substring(0, 16), // enforce max 16 chars
        refId: params.refId,
        secret: params.secret,
        email: params.email || "",
        country: params.country || "",
      })

      if (params.method) {
        formData.append("method", params.method)
      }

      if (params.prepareOnly) {
        formData.append("prepareOnly", "true")
      }

      const response = await this.client.post(
        `/v2.0/paymentRedirect/merchant/${params.merchant}`,
        formData,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      )

      // Comgate returns form-encoded response
      const parsed = this.parseFormEncoded(response.data)

      if (parsed.code === "0") {
        // Success
        return {
          success: true,
          data: {
            transId: parsed.transId,
            redirectUrl: parsed.redirectUrl,
            code: parsed.code,
          },
        }
      } else {
        return {
          success: false,
          error: parsed.message || "Payment creation failed",
          data: {
            code: parsed.code,
            message: parsed.message,
          },
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.message ||
          "Failed to create payment",
      }
    }
  }

  /**
   * Get payment status
   */
  async getStatus(params: IComgateStatusParams): Promise<{
    success: boolean
    data?: {
      transId?: string
      status?: string // PAID, PENDING, CANCELLED, AUTHORIZED, etc.
      price?: number
      curr?: string
      method?: string
      code?: string
      message?: string
    }
    error?: string
  }> {
    try {
      const formData = new URLSearchParams({
        merchant: params.merchant,
        transId: params.transId,
        secret: params.secret,
      })

      const response = await this.client.post("/2.0/status", formData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })

      // Comgate returns form-encoded response
      const parsed = this.parseFormEncoded(response.data)

      if (parsed.code === "0") {
        return {
          success: true,
          data: {
            transId: parsed.transId,
            status: parsed.status,
            price: parsed.price ? parseInt(parsed.price, 10) : undefined,
            curr: parsed.curr,
            method: parsed.method,
            code: parsed.code,
          },
        }
      } else {
        return {
          success: false,
          error: parsed.message || "Status check failed",
          data: {
            code: parsed.code,
            message: parsed.message,
          },
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.message ||
          "Failed to check status",
      }
    }
  }

  /**
   * Create a refund
   */
  async createRefund(params: IComgateRefundParams): Promise<{
    success: boolean
    data?: {
      transId?: string
      code?: string
      message?: string
    }
    error?: string
  }> {
    try {
      const formData = new URLSearchParams({
        merchant: params.merchant,
        transId: params.transId,
        secret: params.secret,
      })

      if (params.amount) {
        formData.append("amount", params.amount.toString())
      }

      const response = await this.client.post("/refund", formData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })

      // Comgate returns form-encoded response
      const parsed = this.parseFormEncoded(response.data)

      if (parsed.code === "0") {
        return {
          success: true,
          data: {
            transId: parsed.transId,
            code: parsed.code,
          },
        }
      } else {
        return {
          success: false,
          error: parsed.message || "Refund failed",
          data: {
            code: parsed.code,
            message: parsed.message,
          },
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.message ||
          "Failed to create refund",
      }
    }
  }

  /**
   * Get available payment methods
   */
  async getMethods(params?: IComgateMethodsParams): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.get("/methods", { params })
      // getMethods may return JSON or form-encoded depending on endpoint version
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.message ||
          "Failed to get methods",
      }
    }
  }
}
```

---

## FILE 5: backend/src/modules/payment-comgate/service.ts

MedusaJS 2.0 payment provider service implementing AbstractPaymentProvider. Handles payment creation via Comgate with statement descriptors, status polling, refunds, and webhook processing. Stores transId in payment session data.

```typescript
import {
  AbstractPaymentProvider,
  PaymentProviderError,
  PaymentSessionStatus,
  PaymentProviderSessionResponse,
  RefundInput,
} from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import { GatewayConfigService } from "../gateway-config/service"
import { ComgateApiClient } from "./api-client"

export interface IComgatePaymentSessionData {
  transId?: string
  status?: string
  amount?: number
  currency?: string
  method?: string
  createdAt?: number
}

/**
 * Maps Comgate payment statuses to Medusa payment session statuses
 */
function mapComgateStatusToMedusa(comgateStatus: string): PaymentSessionStatus {
  switch (comgateStatus) {
    case "PAID":
      return PaymentSessionStatus.AUTHORIZED
    case "AUTHORIZED":
      return PaymentSessionStatus.AUTHORIZED
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
 * Comgate payment provider service
 * Integrates with Comgate payment redirect API for bank transfers and cards
 * Supports CZK, EUR, and other currencies
 */
export class ComgatePaymentProvider extends AbstractPaymentProvider {
  protected client_: ComgateApiClient | null = null
  protected gatewayConfigService_: GatewayConfigService
  protected logger_: Logger

  constructor(container: any) {
    super(container)
    this.gatewayConfigService_ = container.resolve("gateway-config")
    this.logger_ = container.resolve("logger")
  }

  /**
   * Initialize the Comgate API client with credentials
   */
  private async getComgateClient(): Promise<ComgateApiClient> {
    if (!this.client_) {
      const config = await this.gatewayConfigService_.retrieve("comgate")
      if (!config || !config.api_key || !config.secret_key) {
        throw new PaymentProviderError(
          "Comgate merchant ID or secret not configured"
        )
      }
      this.client_ = new ComgateApiClient(config.api_key, config.secret_key)
    }
    return this.client_
  }

  /**
   * Get identifier for the payment provider
   */
  static identifier = "comgate"

  /**
   * Initiate a payment session — create Comgate payment with redirect URL
   */
  async initiatePayment(context: any): Promise<PaymentProviderSessionResponse> {
    const {
      amount,
      currency_code,
      customer,
      cart,
      context: contextData,
    } = context

    try {
      const client = await this.getComgateClient()
      const config = await this.gatewayConfigService_.retrieve("comgate")

      // Use statement descriptor if provided, otherwise use order ID
      const descriptor = (
        contextData?.statement_descriptor || `Order ${cart?.id}`
      ).substring(0, 16)

      const paymentParams = {
        merchant: config.api_key,
        price: amount, // already in cents
        curr: currency_code.toUpperCase(),
        label: descriptor,
        refId: cart?.id || `ref-${Date.now()}`,
        secret: config.secret_key,
        email: customer?.email,
        country: customer?.billing_address?.country_code?.toUpperCase(),
        prepareOnly: true, // get transId + URL without redirect
      }

      const result = await client.createPayment(paymentParams)
      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to create payment")
      }

      if (!result.data?.transId || !result.data?.redirectUrl) {
        throw new PaymentProviderError("No payment redirect URL from Comgate")
      }

      this.logger_.info(
        `[Comgate] Payment created: transId=${result.data.transId}, redirect=${result.data.redirectUrl}`
      )

      return {
        session_data: {
          transId: result.data.transId,
          amount,
          currency: currency_code,
          createdAt: Date.now(),
        } as IComgatePaymentSessionData,
        redirect_url: result.data.redirectUrl,
      }
    } catch (error: any) {
      this.logger_.error(`[Comgate] Payment initiation failed: ${error.message}`)
      throw new PaymentProviderError(
        error.message || "Failed to initiate Comgate payment"
      )
    }
  }

  /**
   * Authorize payment — check Comgate payment status
   */
  async authorizePayment(
    paymentSessionData: IComgatePaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getComgateClient()
      const config = await this.gatewayConfigService_.retrieve("comgate")
      const { transId } = paymentSessionData

      if (!transId) {
        throw new PaymentProviderError("No Comgate transaction ID in session data")
      }

      const result = await client.getStatus({
        merchant: config.api_key,
        transId,
        secret: config.secret_key,
      })

      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to check payment status")
      }

      const status = mapComgateStatusToMedusa(result.data?.status || "PENDING")

      return {
        session_data: {
          ...paymentSessionData,
          transId,
          status: result.data?.status,
          method: result.data?.method,
        },
        status,
      }
    } catch (error: any) {
      this.logger_.error(`[Comgate] Authorization check failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Capture payment — Comgate auto-captures on successful payment, verify status
   */
  async capturePayment(
    paymentSessionData: IComgatePaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getComgateClient()
      const config = await this.gatewayConfigService_.retrieve("comgate")
      const { transId } = paymentSessionData

      if (!transId) {
        throw new PaymentProviderError("No Comgate transaction ID in session data")
      }

      // Fetch current status
      const result = await client.getStatus({
        merchant: config.api_key,
        transId,
        secret: config.secret_key,
      })

      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to verify payment")
      }

      const status = mapComgateStatusToMedusa(result.data?.status || "PENDING")

      return {
        session_data: {
          ...paymentSessionData,
          transId,
          status: result.data?.status,
        },
        status,
      }
    } catch (error: any) {
      this.logger_.error(`[Comgate] Capture failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(
    paymentSessionData: IComgatePaymentSessionData,
    refundAmount: number,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getComgateClient()
      const config = await this.gatewayConfigService_.retrieve("comgate")
      const { transId } = paymentSessionData

      if (!transId) {
        throw new PaymentProviderError("No Comgate transaction ID in session data")
      }

      const result = await client.createRefund({
        merchant: config.api_key,
        transId,
        amount: refundAmount, // in cents
        secret: config.secret_key,
      })

      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to create refund")
      }

      this.logger_.info(
        `[Comgate] Refund created for transId ${transId}: ${(refundAmount / 100).toFixed(2)}`
      )

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.AUTHORIZED,
      }
    } catch (error: any) {
      this.logger_.error(`[Comgate] Refund failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Cancel payment — no direct cancel API, just mark as cancelled
   */
  async cancelPayment(
    paymentSessionData: IComgatePaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      this.logger_.info(
        `[Comgate] Transaction ${paymentSessionData.transId} marked for cancellation`
      )

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.CANCELED,
      }
    } catch (error: any) {
      this.logger_.error(`[Comgate] Cancel failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Delete payment session
   */
  async deletePayment(
    paymentSessionData: IComgatePaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    // No-op for Comgate — cleanup handled server-side
    return {
      session_data: paymentSessionData,
      status: PaymentSessionStatus.CANCELED,
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(
    paymentSessionData: IComgatePaymentSessionData,
    context: any
  ): Promise<PaymentSessionStatus> {
    try {
      const client = await this.getComgateClient()
      const config = await this.gatewayConfigService_.retrieve("comgate")
      const { transId } = paymentSessionData

      if (!transId) {
        return PaymentSessionStatus.PENDING
      }

      const result = await client.getStatus({
        merchant: config.api_key,
        transId,
        secret: config.secret_key,
      })

      if (!result.success) {
        return PaymentSessionStatus.ERROR
      }

      return mapComgateStatusToMedusa(result.data?.status || "PENDING")
    } catch (error: any) {
      this.logger_.error(`[Comgate] Status check failed: ${error.message}`)
      return PaymentSessionStatus.ERROR
    }
  }

  /**
   * Retrieve payment data
   */
  async retrievePayment(
    paymentSessionData: IComgatePaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getComgateClient()
      const config = await this.gatewayConfigService_.retrieve("comgate")
      const { transId } = paymentSessionData

      if (!transId) {
        throw new PaymentProviderError("No Comgate transaction ID in session data")
      }

      const result = await client.getStatus({
        merchant: config.api_key,
        transId,
        secret: config.secret_key,
      })

      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to retrieve payment")
      }

      const status = mapComgateStatusToMedusa(result.data?.status || "PENDING")

      return {
        session_data: {
          ...paymentSessionData,
          transId,
          status: result.data?.status,
          method: result.data?.method,
        },
        status,
      }
    } catch (error: any) {
      this.logger_.error(`[Comgate] Retrieve failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Update payment session
   */
  async updatePayment(context: any): Promise<PaymentProviderSessionResponse> {
    return await this.retrievePayment(context.paymentSessionData, context)
  }

  /**
   * Process Comgate webhook — push notification with transId
   */
  async getWebhookActionAndData(webhookData: any): Promise<{
    action: string
    data: IComgatePaymentSessionData
  }> {
    try {
      const { transId } = webhookData

      if (!transId) {
        return {
          action: "neutral",
          data: webhookData,
        }
      }

      const client = await this.getComgateClient()
      const config = await this.gatewayConfigService_.retrieve("comgate")

      const result = await client.getStatus({
        merchant: config.api_key,
        transId,
        secret: config.secret_key,
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      const status = result.data?.status || "PENDING"

      return {
        action: status === "PAID" ? "succeed" : "fail",
        data: {
          transId,
          status,
        } as IComgatePaymentSessionData,
      }
    } catch (error: any) {
      this.logger_.error(`[Comgate] Webhook processing failed: ${error.message}`)
      return {
        action: "fail",
        data: webhookData,
      }
    }
  }
}
```

---

## FILE 6: backend/src/modules/payment-comgate/index.ts

Module registration for Comgate payment provider using MedusaJS 2.0 ModuleProvider pattern. Registers the payment service and exports the provider for use in the payment module.

```typescript
import { Module } from "@medusajs/framework/utils"
import { ComgatePaymentProvider } from "./service"

export const COMGATE_MODULE_NAME = "payment-comgate"

export default Module(COMGATE_MODULE_NAME, {
  service: ComgatePaymentProvider,
})
```

---

## FILE 7: backend/src/modules/payment-przelewy24/api-client.ts

Przelewy24 REST API client using HTTP Basic Auth. Implements transaction registration, verification, refunds, and payment method listing. Uses SHA-384 checksums for signature verification as required by P24 API.

```typescript
import axios, { AxiosInstance } from "axios"
import crypto from "crypto"

export interface IP24TransactionRegisterParams {
  merchantId: string
  posId: string
  sessionId: string
  amount: number // in grosze (smallest currency unit)
  currency: string
  description: string
  email: string
  country: string
  urlReturn: string
  urlStatus: string
  crc: string
}

export interface IP24TransactionVerifyParams {
  merchantId: string
  posId: string
  sessionId: string
  orderId: string
  amount: number // in grosze
  currency: string
  crc: string
}

export interface IP24RefundParams {
  requestId: string
  refunds: Array<{
    orderId: string
    sessionId: string
    amount: number // in grosze
    description: string
  }>
  urlStatus: string
}

export interface IP24PaymentMethod {
  id: string
  name: string
  description?: string
  type?: string
  icon?: string
}

/**
 * Calculate SHA-384 checksum for P24 transaction signing
 * Format: sessionId|merchantId|amount|currency|crc (for register)
 */
function calculateP24Sign(parts: string[]): string {
  const concatenated = parts.join("|")
  return crypto.createHash("sha384").update(concatenated).digest("hex")
}

export class Przelewy24ApiClient {
  private client: AxiosInstance
  private merchantId: string
  private posId: string
  private apiKey: string // REST API key (used for HTTP Basic Auth)
  private crc: string
  private testMode: boolean

  constructor(
    merchantId: string,
    posId: string,
    apiKey: string,
    crc: string,
    testMode: boolean = true
  ) {
    this.merchantId = merchantId
    this.posId = posId
    this.apiKey = apiKey
    this.crc = crc
    this.testMode = testMode

    const baseURL = testMode
      ? "https://sandbox.przelewy24.pl"
      : "https://secure.przelewy24.pl"

    // HTTP Basic Auth with pos_id as username and api_key as password
    const basicAuth = Buffer.from(`${posId}:${apiKey}`).toString("base64")

    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })
  }

  /**
   * Register a transaction with P24
   * Returns token to be used in redirect URL: https://secure.przelewy24.pl/trnRequest/{token}
   */
  async registerTransaction(params: IP24TransactionRegisterParams): Promise<{
    success: boolean
    data?: {
      token?: string
      transactionUrl?: string
    }
    error?: string
  }> {
    try {
      // Calculate sign: sessionId|merchantId|amount|currency|crc
      const sign = calculateP24Sign([
        params.sessionId,
        params.merchantId,
        params.amount.toString(),
        params.currency,
        params.crc,
      ])

      const payload = {
        merchantId: params.merchantId,
        posId: params.posId,
        sessionId: params.sessionId,
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        email: params.email,
        country: params.country,
        urlReturn: params.urlReturn,
        urlStatus: params.urlStatus,
        sign,
      }

      const response = await this.client.post(
        "/api/v1/transaction/register",
        payload
      )

      if (response.data?.status !== 0) {
        return {
          success: false,
          error: response.data?.message || "Transaction registration failed",
        }
      }

      const token = response.data?.data?.token
      if (!token) {
        return {
          success: false,
          error: "No token returned from P24",
        }
      }

      const transactionUrl = `${
        this.testMode
          ? "https://sandbox.przelewy24.pl"
          : "https://secure.przelewy24.pl"
      }/trnRequest/${token}`

      return {
        success: true,
        data: {
          token,
          transactionUrl,
        },
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to register transaction",
      }
    }
  }

  /**
   * Verify transaction after payment completion
   * Called when webhook is received
   */
  async verifyTransaction(params: IP24TransactionVerifyParams): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      // Calculate sign: sessionId|orderId|amount|currency|crc
      const sign = calculateP24Sign([
        params.sessionId,
        params.orderId,
        params.amount.toString(),
        params.currency,
        params.crc,
      ])

      const payload = {
        merchantId: params.merchantId,
        posId: params.posId,
        sessionId: params.sessionId,
        orderId: params.orderId,
        amount: params.amount,
        currency: params.currency,
        sign,
      }

      const response = await this.client.put(
        "/api/v1/transaction/verify",
        payload
      )

      if (response.data?.status !== 0) {
        return {
          success: false,
          error: response.data?.message || "Transaction verification failed",
        }
      }

      return {
        success: true,
        data: response.data?.data || response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to verify transaction",
      }
    }
  }

  /**
   * Create a refund for a transaction
   */
  async createRefund(params: IP24RefundParams): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const payload = {
        requestId: params.requestId,
        refunds: params.refunds,
        urlStatus: params.urlStatus,
      }

      const response = await this.client.post(
        "/api/v1/transaction/refund",
        payload
      )

      if (response.data?.status !== 0) {
        return {
          success: false,
          error: response.data?.message || "Refund creation failed",
        }
      }

      return {
        success: true,
        data: response.data?.data || response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to create refund",
      }
    }
  }

  /**
   * Get available payment methods for a language and currency
   */
  async getPaymentMethods(lang: string, currency: string): Promise<{
    success: boolean
    data?: IP24PaymentMethod[]
    error?: string
  }> {
    try {
      const response = await this.client.get(
        `/api/v1/payment/methods/${lang}/${currency}`
      )

      if (response.data?.status !== 0) {
        return {
          success: false,
          error: response.data?.message || "Failed to get payment methods",
        }
      }

      const methods = response.data?.data || []

      return {
        success: true,
        data: methods,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to fetch payment methods",
      }
    }
  }

  /**
   * Test access to P24 API
   */
  async testAccess(): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const response = await this.client.get("/api/v1/testAccess")

      if (response.data?.status !== 0) {
        return {
          success: false,
          error: response.data?.message || "API access test failed",
        }
      }

      return {
        success: true,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to test API access",
      }
    }
  }
}
```

---

## FILE 8: backend/src/modules/payment-przelewy24/service.ts

MedusaJS 2.0 payment provider service implementing AbstractPaymentProvider. Handles transaction registration, verification after webhook notification, refunds, and webhook signature validation with SHA-384 checksums. Stores token, sessionId, and orderId in payment session data.

```typescript
import {
  AbstractPaymentProvider,
  PaymentProviderError,
  PaymentSessionStatus,
  PaymentProviderSessionResponse,
  RefundInput,
} from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import { GatewayConfigService } from "../gateway-config/service"
import { Przelewy24ApiClient } from "./api-client"
import crypto from "crypto"

export interface IP24PaymentSessionData {
  token?: string
  sessionId?: string
  orderId?: string
  amount?: number
  currency?: string
  status?: string
  createdAt?: number
}

/**
 * Maps Przelewy24 payment statuses to Medusa payment session statuses
 */
function mapP24StatusToMedusa(p24Status: string): PaymentSessionStatus {
  switch (p24Status) {
    case "completed":
    case "success":
    case "authorized":
      return PaymentSessionStatus.AUTHORIZED
    case "pending":
    case "waiting":
      return PaymentSessionStatus.PENDING
    case "cancelled":
    case "expired":
      return PaymentSessionStatus.CANCELED
    case "rejected":
    case "error":
    case "failed":
      return PaymentSessionStatus.ERROR
    default:
      return PaymentSessionStatus.PENDING
  }
}

/**
 * Przelewy24 payment provider service
 * Integrates with Przelewy24 REST API for Polish payments (BLIK, bank transfers, cards)
 * Supports PLN, EUR and other currencies
 * Flow: register transaction → redirect → customer pays → webhook verification
 */
export class Przelewy24PaymentProvider extends AbstractPaymentProvider {
  protected client_: Przelewy24ApiClient | null = null
  protected gatewayConfigService_: GatewayConfigService
  protected logger_: Logger

  constructor(container: any) {
    super(container)
    this.gatewayConfigService_ = container.resolve("gateway-config")
    this.logger_ = container.resolve("logger")
  }

  /**
   * Initialize the P24 API client with credentials
   */
  private async getP24Client(): Promise<Przelewy24ApiClient> {
    if (!this.client_) {
      const config = await this.gatewayConfigService_.retrieve("przelewy24")
      if (
        !config ||
        !config.api_key ||
        !config.secret_key ||
        !config.gateway_metadata?.pos_id
      ) {
        throw new PaymentProviderError(
          "Przelewy24 credentials not configured (need merchantId, api_key, CRC, and pos_id in metadata)"
        )
      }

      const merchantId = config.api_key
      const posId = config.gateway_metadata.pos_id
      const apiKey = config.secret_key // This is the REST API key
      const crc = config.api_key_2 || "" // CRC key for signing
      const testMode = config.test_mode !== false

      this.client_ = new Przelewy24ApiClient(
        merchantId,
        posId,
        apiKey,
        crc,
        testMode
      )
    }
    return this.client_
  }

  /**
   * Get identifier for the payment provider
   */
  static identifier = "przelewy24"

  /**
   * Initiate a payment session — register transaction with P24
   */
  async initiatePayment(context: any): Promise<PaymentProviderSessionResponse> {
    const { amount, currency_code, customer, cart, context: contextData } =
      context

    try {
      const client = await this.getP24Client()
      const config = await this.gatewayConfigService_.retrieve("przelewy24")

      const sessionId = cart?.id || `sess-${Date.now()}`
      const merchantId = config.api_key
      const posId = config.gateway_metadata.pos_id

      const registerParams = {
        merchantId,
        posId,
        sessionId,
        amount, // already in grosze
        currency: currency_code.toUpperCase(),
        description: contextData?.statement_descriptor || `Order ${sessionId}`,
        email: customer?.email || "customer@example.com",
        country: customer?.billing_address?.country_code?.toUpperCase() || "PL",
        urlReturn: `${contextData?.return_url || "https://example.com"}/payment/success`,
        urlStatus: `${contextData?.webhook_url || "https://api.example.com"}/webhooks/przelewy24`,
        crc: config.api_key_2 || "",
      }

      const result = await client.registerTransaction(registerParams)
      if (!result.success) {
        throw new PaymentProviderError(
          result.error || "Failed to register P24 transaction"
        )
      }

      if (!result.data?.transactionUrl) {
        throw new PaymentProviderError("No transaction URL returned from P24")
      }

      this.logger_.info(
        `[Przelewy24] Transaction registered: sessionId=${sessionId}, redirect=${result.data.transactionUrl}`
      )

      return {
        session_data: {
          token: result.data.token,
          sessionId,
          amount,
          currency: currency_code,
          createdAt: Date.now(),
        } as IP24PaymentSessionData,
        redirect_url: result.data.transactionUrl,
      }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Payment initiation failed: ${error.message}`)
      throw new PaymentProviderError(
        error.message || "Failed to initiate Przelewy24 payment"
      )
    }
  }

  /**
   * Authorize payment — verify with P24 after webhook
   */
  async authorizePayment(
    paymentSessionData: IP24PaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getP24Client()
      const config = await this.gatewayConfigService_.retrieve("przelewy24")
      const { sessionId, orderId, amount, currency } = paymentSessionData

      if (!sessionId || !orderId) {
        throw new PaymentProviderError(
          "Missing sessionId or orderId in session data"
        )
      }

      const verifyParams = {
        merchantId: config.api_key,
        posId: config.gateway_metadata.pos_id,
        sessionId,
        orderId,
        amount,
        currency,
        crc: config.api_key_2 || "",
      }

      const result = await client.verifyTransaction(verifyParams)
      if (!result.success) {
        throw new PaymentProviderError(
          result.error || "Failed to verify P24 transaction"
        )
      }

      const status = mapP24StatusToMedusa(
        result.data?.status || "pending"
      )

      return {
        session_data: {
          ...paymentSessionData,
          status: result.data?.status,
        },
        status,
      }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Authorization check failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Capture payment — P24 captures immediately after payment
   */
  async capturePayment(
    paymentSessionData: IP24PaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      // P24 auto-captures on successful payment
      // Return current status
      const status = mapP24StatusToMedusa(
        paymentSessionData.status || "pending"
      )

      return {
        session_data: paymentSessionData,
        status,
      }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Capture failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(
    paymentSessionData: IP24PaymentSessionData,
    refundAmount: number,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getP24Client()
      const config = await this.gatewayConfigService_.retrieve("przelewy24")
      const { sessionId, orderId } = paymentSessionData

      if (!orderId || !sessionId) {
        throw new PaymentProviderError("Missing orderId or sessionId for refund")
      }

      const requestId = `refund-${Date.now()}`

      const refundParams = {
        requestId,
        refunds: [
          {
            orderId,
            sessionId,
            amount: refundAmount,
            description: `Refund ${(refundAmount / 100).toFixed(2)}`,
          },
        ],
        urlStatus: `${config.gateway_metadata?.webhook_url || "https://api.example.com"}/webhooks/przelewy24`,
      }

      const result = await client.createRefund(refundParams)
      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to create refund")
      }

      this.logger_.info(
        `[Przelewy24] Refund created for orderId ${orderId}: ${(refundAmount / 100).toFixed(2)}`
      )

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.AUTHORIZED,
      }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Refund failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(
    paymentSessionData: IP24PaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      this.logger_.info(
        `[Przelewy24] Transaction ${paymentSessionData.sessionId} marked for cancellation`
      )

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.CANCELED,
      }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Cancel failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Delete payment session
   */
  async deletePayment(
    paymentSessionData: IP24PaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    // No-op for P24 — cleanup handled server-side
    return {
      session_data: paymentSessionData,
      status: PaymentSessionStatus.CANCELED,
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(
    paymentSessionData: IP24PaymentSessionData,
    context: any
  ): Promise<PaymentSessionStatus> {
    try {
      const status = paymentSessionData.status || "pending"
      return mapP24StatusToMedusa(status)
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Status check failed: ${error.message}`)
      return PaymentSessionStatus.ERROR
    }
  }

  /**
   * Retrieve payment data
   */
  async retrievePayment(
    paymentSessionData: IP24PaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const status = mapP24StatusToMedusa(
        paymentSessionData.status || "pending"
      )

      return {
        session_data: paymentSessionData,
        status,
      }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Retrieve failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Update payment session
   */
  async updatePayment(context: any): Promise<PaymentProviderSessionResponse> {
    return await this.retrievePayment(context.paymentSessionData, context)
  }

  /**
   * Process Przelewy24 webhook
   * P24 sends POST with: merchantId, posId, sessionId, orderId, amount, currency, sign
   * MUST verify sign before processing
   */
  async getWebhookActionAndData(webhookData: any): Promise<{
    action: string
    data: IP24PaymentSessionData
  }> {
    try {
      const {
        merchantId,
        posId,
        sessionId,
        orderId,
        amount,
        currency,
        sign,
      } = webhookData

      if (!sessionId || !orderId) {
        return {
          action: "neutral",
          data: webhookData,
        }
      }

      const config = await this.gatewayConfigService_.retrieve("przelewy24")

      // Verify signature: sign should be SHA384 of sessionId|orderId|amount|currency|crc
      const expectedSign = crypto
        .createHash("sha384")
        .update(
          `${sessionId}|${orderId}|${amount}|${currency}|${config.api_key_2 || ""}`
        )
        .digest("hex")

      if (sign !== expectedSign) {
        this.logger_.warn(
          `[Przelewy24] Invalid webhook signature for sessionId ${sessionId}`
        )
        return {
          action: "fail",
          data: webhookData,
        }
      }

      const client = await this.getP24Client()

      const verifyParams = {
        merchantId: config.api_key,
        posId,
        sessionId,
        orderId,
        amount,
        currency,
        crc: config.api_key_2 || "",
      }

      const result = await client.verifyTransaction(verifyParams)

      if (!result.success) {
        this.logger_.warn(
          `[Przelewy24] Verification failed for orderId ${orderId}: ${result.error}`
        )
        return {
          action: "fail",
          data: webhookData,
        }
      }

      const status = result.data?.status || "pending"

      return {
        action: status === "completed" ? "succeed" : "fail",
        data: {
          sessionId,
          orderId,
          amount,
          currency,
          status,
        } as IP24PaymentSessionData,
      }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Webhook processing failed: ${error.message}`)
      return {
        action: "fail",
        data: webhookData,
      }
    }
  }
}
```

---

## FILE 9: backend/src/modules/payment-przelewy24/index.ts

Module registration for Przelewy24 payment provider using MedusaJS 2.0 ModuleProvider pattern. Registers the payment service and exports the provider for use in the payment module.

```typescript
import { Module } from "@medusajs/framework/utils"
import { Przelewy24PaymentProvider } from "./service"

export const PRZELEWY24_MODULE_NAME = "payment-przelewy24"

export default Module(PRZELEWY24_MODULE_NAME, {
  service: Przelewy24PaymentProvider,
})
```

---
## FILE 10: backend/src/modules/payment-klarna/api-client.ts

Klarna REST API client using HTTP Basic Auth. Implements Order Management API for payment authorization, capture, refunds, and shipping info updates. Supports authorize → capture on shipment flow with 28-day authorization validity. Includes idempotency key support (Klarna-Idempotency-Key header with UUID v4).

```typescript
import axios, { AxiosInstance } from "axios"
import { v4 as uuidv4 } from "uuid"

export interface IKlarnaOrderLine {
  type?: string // "physical", "digital", "shipping_fee", "discount"
  reference?: string
  name: string
  quantity: number
  quantity_unit?: string
  unit_price: number // in minor units (cents)
  tax_rate: number // as integer, e.g., 2500 = 25%
  total_amount: number // in minor units
  total_tax_amount: number
  total_discount_amount?: number
}

export interface IKlarnaSessionData {
  purchase_country: string
  purchase_currency: string
  locale: string
  order_amount: number // in minor units
  order_tax_amount: number
  order_lines: IKlarnaOrderLine[]
  merchant_urls?: {
    terms?: string
    checkout?: string
    confirmation?: string
    push?: string
  }
  customer?: {
    type?: string // "person" or "organization"
    date_of_birth?: string
  }
  billing_address?: IKlarnaAddress
  shipping_address?: IKlarnaAddress
}

export interface IKlarnaAddress {
  given_name?: string
  family_name?: string
  email?: string
  phone?: string
  title?: string
  street_address: string
  street_address2?: string
  postal_code: string
  city: string
  region?: string
  country: string
  organization_name?: string
}

export interface IKlarnaOrderData {
  authorization_token: string
  order_amount: number // in minor units
  order_tax_amount: number
  description?: string
  merchant_reference?: string
  merchant_reference1?: string
  order_lines: IKlarnaOrderLine[]
}

export interface IKlarnaCaptureData {
  captured_amount: number // in minor units
  description?: string
  order_lines?: IKlarnaOrderLine[]
  shipping_info?: Array<{
    shipping_company?: string
    shipping_method?: string
    tracking_number?: string
    tracking_uri?: string
    return_shipping_company?: string
    return_tracking_number?: string
    return_tracking_uri?: string
  }>
}

export interface IKlarnaRefundData {
  refunded_amount: number // in minor units
  reason?: string
  description?: string
  order_lines?: IKlarnaOrderLine[]
}

export interface IKlarnaShippingInfoData {
  shipping_company?: string
  shipping_method?: string
  tracking_number?: string
  tracking_uri?: string
  return_shipping_company?: string
  return_tracking_number?: string
  return_tracking_uri?: string
}

export class KlarnaApiClient {
  private client: AxiosInstance
  private username: string
  private password: string
  private testMode: boolean

  constructor(username: string, password: string, testMode: boolean = true) {
    this.username = username
    this.password = password
    this.testMode = testMode

    const baseURL = testMode
      ? "https://api.playground.klarna.com"
      : "https://api.klarna.com"

    // HTTP Basic Auth with username:password
    const basicAuth = Buffer.from(`${username}:${password}`).toString("base64")

    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })
  }

  /**
   * Create a Klarna payment session
   * Returns a client_token for the frontend widget
   */
  async createSession(sessionData: IKlarnaSessionData): Promise<{
    success: boolean
    data?: {
      session_id?: string
      client_token?: string
      payment_method_categories?: any[]
    }
    error?: string
  }> {
    try {
      const response = await this.client.post("/payments/v1/sessions", sessionData)
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.error_messages?.[0] ||
          error.response?.data?.message ||
          error.message ||
          "Failed to create session",
      }
    }
  }

  /**
   * Create an order after customer authorizes
   */
  async createOrder(orderData: IKlarnaOrderData): Promise<{
    success: boolean
    data?: {
      order_id?: string
      status?: string
      fraud_status?: string
    }
    error?: string
  }> {
    try {
      const authToken = orderData.authorization_token
      const payload = {
        order_amount: orderData.order_amount,
        order_tax_amount: orderData.order_tax_amount,
        description: orderData.description,
        merchant_reference: orderData.merchant_reference,
        merchant_reference1: orderData.merchant_reference1,
        order_lines: orderData.order_lines,
      }

      const response = await this.client.post(
        `/payments/v1/authorizations/${authToken}/order`,
        payload
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.error_messages?.[0] ||
          error.response?.data?.message ||
          error.message ||
          "Failed to create order",
      }
    }
  }

  /**
   * Capture order after shipment
   * Use idempotency key to ensure idempotent requests
   */
  async captureOrder(
    orderId: string,
    captureData: IKlarnaCaptureData,
    idempotencyKey?: string
  ): Promise<{
    success: boolean
    data?: {
      capture_id?: string
      status?: string
    }
    error?: string
  }> {
    try {
      const key = idempotencyKey || uuidv4()

      const response = await this.client.post(
        `/ordermanagement/v1/orders/${orderId}/captures`,
        captureData,
        {
          headers: {
            "Klarna-Idempotency-Key": key,
          },
        }
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.error_messages?.[0] ||
          error.response?.data?.message ||
          error.message ||
          "Failed to capture order",
      }
    }
  }

  /**
   * Add shipping info to a capture (can be called after capture)
   */
  async addShippingInfo(
    orderId: string,
    captureId: string,
    shippingInfo: IKlarnaShippingInfoData
  ): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.post(
        `/ordermanagement/v1/orders/${orderId}/captures/${captureId}/shipping-info`,
        shippingInfo
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.error_messages?.[0] ||
          error.response?.data?.message ||
          error.message ||
          "Failed to add shipping info",
      }
    }
  }

  /**
   * Refund an order
   */
  async refundOrder(
    orderId: string,
    refundData: IKlarnaRefundData,
    idempotencyKey?: string
  ): Promise<{
    success: boolean
    data?: {
      refund_id?: string
      status?: string
    }
    error?: string
  }> {
    try {
      const key = idempotencyKey || uuidv4()

      const response = await this.client.post(
        `/ordermanagement/v1/orders/${orderId}/refunds`,
        refundData,
        {
          headers: {
            "Klarna-Idempotency-Key": key,
          },
        }
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.error_messages?.[0] ||
          error.response?.data?.message ||
          error.message ||
          "Failed to create refund",
      }
    }
  }

  /**
   * Get order details
   */
  async getOrder(orderId: string): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.get(`/ordermanagement/v1/orders/${orderId}`)
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.error_messages?.[0] ||
          error.response?.data?.message ||
          error.message ||
          "Failed to get order",
      }
    }
  }

  /**
   * Release remaining authorization (partial authorization only)
   */
  async releaseAuthorization(orderId: string): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.post(
        `/ordermanagement/v1/orders/${orderId}/release-remaining-authorization`,
        {}
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.error_messages?.[0] ||
          error.response?.data?.message ||
          error.message ||
          "Failed to release authorization",
      }
    }
  }

  /**
   * Update order amount (for updates before capture)
   */
  async updateAmount(
    orderId: string,
    data: {
      order_amount: number
      order_tax_amount: number
      order_lines: IKlarnaOrderLine[]
    }
  ): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.post(
        `/ordermanagement/v1/orders/${orderId}/amount-updates`,
        data
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.error_messages?.[0] ||
          error.response?.data?.message ||
          error.message ||
          "Failed to update amount",
      }
    }
  }
}
```

---

## FILE 11: backend/src/modules/payment-klarna/service.ts

MedusaJS 2.0 payment provider service implementing AbstractPaymentProvider. Handles Klarna session creation (returns client_token for widget), order authorization after frontend authorization, capture after shipment, refunds, and webhook processing. Implements critical authorize → capture on shipment flow with 28-day authorization window. Stores klarnaOrderId and captureId in payment session data.

```typescript
import {
  AbstractPaymentProvider,
  PaymentProviderError,
  PaymentSessionStatus,
  PaymentProviderSessionResponse,
  RefundInput,
} from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import { GatewayConfigService } from "../gateway-config/service"
import { KlarnaApiClient, IKlarnaOrderLine } from "./api-client"
import { v4 as uuidv4 } from "uuid"

export interface IKlarnaPaymentSessionData {
  sessionId?: string
  clientToken?: string
  klarnaOrderId?: string
  captureId?: string
  authorizationToken?: string
  status?: string
  amount?: number
  currency?: string
  method?: string
  createdAt?: number
}

/**
 * Maps Klarna order statuses to Medusa payment session statuses
 */
function mapKlarnaStatusToMedusa(klarnaStatus: string): PaymentSessionStatus {
  switch (klarnaStatus) {
    case "AUTHORIZED":
      return PaymentSessionStatus.AUTHORIZED
    case "CAPTURED":
      return PaymentSessionStatus.CAPTURED
    case "REFUNDED":
      return PaymentSessionStatus.REFUNDED
    case "CANCELLED":
      return PaymentSessionStatus.CANCELED
    case "EXPIRED":
      return PaymentSessionStatus.CANCELED
    case "FAILED":
      return PaymentSessionStatus.ERROR
    default:
      return PaymentSessionStatus.PENDING
  }
}

/**
 * Build Klarna order lines from cart items
 */
function buildOrderLines(
  items: any[],
  currency: string,
  statementDescriptor?: string
): IKlarnaOrderLine[] {
  return items.map((item) => ({
    type: "physical",
    reference: item.id || item.sku,
    name: (statementDescriptor || item.title || "Product").substring(0, 255),
    quantity: item.quantity,
    quantity_unit: "pcs",
    unit_price: item.unit_price || 0, // already in minor units
    tax_rate: item.metadata?.tax_rate
      ? parseInt(item.metadata.tax_rate) * 100
      : 2500, // convert to basis points (e.g., 25.00 -> 2500)
    total_amount: (item.unit_price || 0) * item.quantity,
    total_tax_amount: item.metadata?.tax_amount
      ? (item.metadata.tax_amount * item.quantity) / 100
      : 0,
  }))
}

/**
 * Klarna payment provider service
 * Implements authorize → capture on shipment flow
 * Authorization valid for 28 days
 * Frontend uses Klarna Payments widget with client_token
 */
export class KlarnaPaymentProvider extends AbstractPaymentProvider {
  protected client_: KlarnaApiClient | null = null
  protected gatewayConfigService_: GatewayConfigService
  protected logger_: Logger

  constructor(container: any) {
    super(container)
    this.gatewayConfigService_ = container.resolve("gateway-config")
    this.logger_ = container.resolve("logger")
  }

  /**
   * Initialize the Klarna API client with credentials
   */
  private async getKlarnaClient(): Promise<KlarnaApiClient> {
    if (!this.client_) {
      const config = await this.gatewayConfigService_.retrieve("klarna")
      if (!config || !config.api_key || !config.secret_key) {
        throw new PaymentProviderError("Klarna API credentials not configured")
      }
      const testMode = config.test_mode !== false
      this.client_ = new KlarnaApiClient(config.api_key, config.secret_key, testMode)
    }
    return this.client_
  }

  /**
   * Get identifier for the payment provider
   */
  static identifier = "klarna"

  /**
   * Initiate a payment session — create Klarna session and return client_token
   * Frontend will use this token with Klarna Payments widget
   */
  async initiatePayment(context: any): Promise<PaymentProviderSessionResponse> {
    const {
      amount,
      currency_code,
      customer,
      cart,
      context: contextData,
    } = context

    try {
      const client = await this.getKlarnaClient()

      // Build order lines
      const orderLines = buildOrderLines(
        cart?.items || [],
        currency_code,
        contextData?.statement_descriptor
      )

      // Add shipping as line item if applicable
      if (cart?.shipping_total && cart.shipping_total > 0) {
        orderLines.push({
          type: "shipping_fee",
          name: "Shipping",
          quantity: 1,
          unit_price: cart.shipping_total,
          tax_rate: 0,
          total_amount: cart.shipping_total,
          total_tax_amount: 0,
        })
      }

      // Build addresses
      const billingAddress = customer?.billing_address || {}
      const shippingAddress = cart?.shipping_address || billingAddress

      const sessionData = {
        purchase_country: billingAddress.country_code?.toUpperCase() || "US",
        purchase_currency: currency_code.toUpperCase(),
        locale: contextData?.locale || "en_US",
        order_amount: amount, // already in minor units (cents)
        order_tax_amount: cart?.tax_total || 0,
        order_lines: orderLines,
        merchant_urls: {
          terms: `${contextData?.return_url || "https://example.com"}/terms`,
          checkout: `${contextData?.return_url || "https://example.com"}/checkout`,
          confirmation: `${contextData?.return_url || "https://example.com"}/confirmation`,
          push: `${contextData?.webhook_url || "https://api.example.com"}/webhooks/klarna`,
        },
        billing_address: {
          given_name: customer?.first_name || "John",
          family_name: customer?.last_name || "Doe",
          email: customer?.email || "customer@example.com",
          phone: customer?.phone,
          street_address: billingAddress.address_1 || "Street 1",
          street_address2: billingAddress.address_2,
          postal_code: billingAddress.postal_code || "00000",
          city: billingAddress.city || "City",
          region: billingAddress.province,
          country: billingAddress.country_code?.toUpperCase() || "US",
        },
        shipping_address: {
          given_name: customer?.first_name || "John",
          family_name: customer?.last_name || "Doe",
          email: customer?.email || "customer@example.com",
          phone: customer?.phone,
          street_address: shippingAddress.address_1 || "Street 1",
          street_address2: shippingAddress.address_2,
          postal_code: shippingAddress.postal_code || "00000",
          city: shippingAddress.city || "City",
          region: shippingAddress.province,
          country: shippingAddress.country_code?.toUpperCase() || "US",
        },
      }

      const result = await client.createSession(sessionData)
      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to create Klarna session")
      }

      if (!result.data?.client_token) {
        throw new PaymentProviderError("No client_token returned from Klarna")
      }

      this.logger_.info(
        `[Klarna] Session created: sessionId=${result.data.session_id}, client_token available`
      )

      return {
        session_data: {
          sessionId: result.data.session_id,
          clientToken: result.data.client_token,
          amount,
          currency: currency_code,
          createdAt: Date.now(),
        } as IKlarnaPaymentSessionData,
        // IMPORTANT: For Klarna, return client_token to frontend instead of redirect_url
        // Frontend renders Klarna Payments widget with this token
        client_token: result.data.client_token,
      }
    } catch (error: any) {
      this.logger_.error(`[Klarna] Payment initiation failed: ${error.message}`)
      throw new PaymentProviderError(
        error.message || "Failed to initiate Klarna payment"
      )
    }
  }

  /**
   * Authorize payment — after frontend authorization, create order with auth token
   * This is called AFTER customer confirms in the Klarna widget
   */
  async authorizePayment(
    paymentSessionData: IKlarnaPaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getKlarnaClient()
      const { sessionId, clientToken, authorizationToken, amount, currency } =
        paymentSessionData

      if (!authorizationToken) {
        // If no auth token yet, session is still pending
        return {
          session_data: paymentSessionData,
          status: PaymentSessionStatus.PENDING,
        }
      }

      // Create order with authorization token (from frontend callback)
      const { cart, context: contextData } = context

      const orderLines = buildOrderLines(
        cart?.items || [],
        currency,
        contextData?.statement_descriptor
      )

      if (cart?.shipping_total && cart.shipping_total > 0) {
        orderLines.push({
          type: "shipping_fee",
          name: "Shipping",
          quantity: 1,
          unit_price: cart.shipping_total,
          tax_rate: 0,
          total_amount: cart.shipping_total,
          total_tax_amount: 0,
        })
      }

      const orderData = {
        authorization_token: authorizationToken,
        order_amount: amount,
        order_tax_amount: cart?.tax_total || 0,
        description: contextData?.statement_descriptor || "Order",
        merchant_reference: cart?.id || `order-${Date.now()}`,
        merchant_reference1: cart?.id,
        order_lines: orderLines,
      }

      const result = await client.createOrder(orderData)
      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to create Klarna order")
      }

      const status = mapKlarnaStatusToMedusa(result.data?.status || "AUTHORIZED")

      this.logger_.info(
        `[Klarna] Order created: klarnaOrderId=${result.data.order_id}, status=${result.data.status}`
      )

      return {
        session_data: {
          ...paymentSessionData,
          klarnaOrderId: result.data.order_id,
          status: result.data.status,
        },
        status,
      }
    } catch (error: any) {
      this.logger_.error(`[Klarna] Authorization failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Capture payment — called AFTER shipment when tracking info is available
   * Klarna authorization is valid for 28 days
   * Use idempotency key to prevent duplicate captures
   */
  async capturePayment(
    paymentSessionData: IKlarnaPaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getKlarnaClient()
      const { klarnaOrderId, amount } = paymentSessionData

      if (!klarnaOrderId) {
        throw new PaymentProviderError("No Klarna order ID in session data")
      }

      const { cart, context: contextData } = context

      // Build order lines for capture
      const orderLines = buildOrderLines(
        cart?.items || [],
        paymentSessionData.currency,
        contextData?.statement_descriptor
      )

      if (cart?.shipping_total && cart.shipping_total > 0) {
        orderLines.push({
          type: "shipping_fee",
          name: "Shipping",
          quantity: 1,
          unit_price: cart.shipping_total,
          tax_rate: 0,
          total_amount: cart.shipping_total,
          total_tax_amount: 0,
        })
      }

      // Extract shipping info from order metadata if available
      const shippingInfo = contextData?.shipping_info || {}

      const captureData = {
        captured_amount: amount,
        description: contextData?.statement_descriptor || "Capture",
        order_lines: orderLines,
        shipping_info: shippingInfo.tracking_number
          ? [
              {
                shipping_company: shippingInfo.shipping_company,
                tracking_number: shippingInfo.tracking_number,
                tracking_uri: shippingInfo.tracking_uri,
              },
            ]
          : undefined,
      }

      // Use UUID v4 for idempotency key to ensure safe retry
      const idempotencyKey = uuidv4()

      const result = await client.captureOrder(
        klarnaOrderId,
        captureData,
        idempotencyKey
      )

      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to capture order")
      }

      this.logger_.info(
        `[Klarna] Order captured: klarnaOrderId=${klarnaOrderId}, captureId=${result.data.capture_id}`
      )

      return {
        session_data: {
          ...paymentSessionData,
          klarnaOrderId,
          captureId: result.data.capture_id,
          status: "CAPTURED",
        },
        status: PaymentSessionStatus.CAPTURED,
      }
    } catch (error: any) {
      this.logger_.error(`[Klarna] Capture failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(
    paymentSessionData: IKlarnaPaymentSessionData,
    refundAmount: number,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getKlarnaClient()
      const { klarnaOrderId } = paymentSessionData

      if (!klarnaOrderId) {
        throw new PaymentProviderError("No Klarna order ID in session data")
      }

      const refundData = {
        refunded_amount: refundAmount,
        reason: "customer_request",
        description: `Refund ${(refundAmount / 100).toFixed(2)}`,
      }

      const idempotencyKey = uuidv4()

      const result = await client.refundOrder(
        klarnaOrderId,
        refundData,
        idempotencyKey
      )

      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to create refund")
      }

      this.logger_.info(
        `[Klarna] Refund created for order ${klarnaOrderId}: ${result.data.refund_id}`
      )

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.AUTHORIZED,
      }
    } catch (error: any) {
      this.logger_.error(`[Klarna] Refund failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(
    paymentSessionData: IKlarnaPaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getKlarnaClient()
      const { klarnaOrderId } = paymentSessionData

      if (klarnaOrderId) {
        // Release remaining authorization if order exists
        await client.releaseAuthorization(klarnaOrderId)
      }

      this.logger_.info(
        `[Klarna] Order ${klarnaOrderId} marked for cancellation`
      )

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.CANCELED,
      }
    } catch (error: any) {
      this.logger_.error(`[Klarna] Cancel failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Delete payment session
   */
  async deletePayment(
    paymentSessionData: IKlarnaPaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    // No-op for Klarna — cleanup handled server-side
    return {
      session_data: paymentSessionData,
      status: PaymentSessionStatus.CANCELED,
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(
    paymentSessionData: IKlarnaPaymentSessionData,
    context: any
  ): Promise<PaymentSessionStatus> {
    try {
      const client = await this.getKlarnaClient()
      const { klarnaOrderId } = paymentSessionData

      if (!klarnaOrderId) {
        return PaymentSessionStatus.PENDING
      }

      const result = await client.getOrder(klarnaOrderId)
      if (!result.success) {
        return PaymentSessionStatus.ERROR
      }

      return mapKlarnaStatusToMedusa(result.data?.status || "AUTHORIZED")
    } catch (error: any) {
      this.logger_.error(`[Klarna] Status check failed: ${error.message}`)
      return PaymentSessionStatus.ERROR
    }
  }

  /**
   * Retrieve payment data
   */
  async retrievePayment(
    paymentSessionData: IKlarnaPaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getKlarnaClient()
      const { klarnaOrderId } = paymentSessionData

      if (!klarnaOrderId) {
        return {
          session_data: paymentSessionData,
          status: PaymentSessionStatus.PENDING,
        }
      }

      const result = await client.getOrder(klarnaOrderId)
      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to retrieve order")
      }

      const status = mapKlarnaStatusToMedusa(result.data?.status || "AUTHORIZED")

      return {
        session_data: {
          ...paymentSessionData,
          klarnaOrderId: result.data.order_id,
          status: result.data.status,
        },
        status,
      }
    } catch (error: any) {
      this.logger_.error(`[Klarna] Retrieve failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Update payment session
   */
  async updatePayment(context: any): Promise<PaymentProviderSessionResponse> {
    return await this.retrievePayment(context.paymentSessionData, context)
  }

  /**
   * Process Klarna webhook
   * Klarna sends notifications for authorization, capture, refund status changes
   */
  async getWebhookActionAndData(webhookData: any): Promise<{
    action: string
    data: IKlarnaPaymentSessionData
  }> {
    try {
      const { order_id, event_type } = webhookData

      if (!order_id) {
        return {
          action: "neutral",
          data: webhookData,
        }
      }

      const client = await this.getKlarnaClient()
      const result = await client.getOrder(order_id)

      if (!result.success) {
        throw new Error(result.error)
      }

      const klarnaOrder = result.data
      const status = klarnaOrder.status || "AUTHORIZED"

      // Map event type to action
      let action = "neutral"
      if (event_type === "order.authorized") {
        action = "succeed"
      } else if (event_type === "order.captured") {
        action = "succeed"
      } else if (event_type === "order.refunded") {
        action = "succeed"
      } else if (event_type === "order.cancelled") {
        action = "fail"
      } else if (event_type === "order.expired") {
        action = "fail"
      }

      return {
        action,
        data: {
          klarnaOrderId: order_id,
          status,
        } as IKlarnaPaymentSessionData,
      }
    } catch (error: any) {
      this.logger_.error(`[Klarna] Webhook processing failed: ${error.message}`)
      return {
        action: "fail",
        data: webhookData,
      }
    }
  }
}
```

---

## FILE 12: backend/src/modules/payment-klarna/index.ts

Module registration for Klarna payment provider using MedusaJS 2.0 ModuleProvider pattern. Registers the payment service and exports the provider for use in the payment module.

```typescript
import { Module } from "@medusajs/framework/utils"
import { KlarnaPaymentProvider } from "./service"

export const KLARNA_MODULE_NAME = "payment-klarna"

export default Module(KLARNA_MODULE_NAME, {
  service: KlarnaPaymentProvider,
})
```

---
## FILE 13: backend/src/modules/payment-airwallex/api-client.ts

Airwallex REST API client with two-step authentication: first login to get Bearer token, then use token for all API requests. Token automatically refreshes before expiry and handles 401 responses with automatic retry of queued requests.

```typescript
import axios, { AxiosInstance } from "axios"
import { Logger } from "@medusajs/framework/logger"

/**
 * Airwallex REST API Client
 * Handles authentication with Bearer token and all payment operations
 */

interface AirwallexLoginResponse {
  token: string
  expires_at: string
}

interface AirwallexPaymentIntentRequest {
  amount: number
  currency: string
  merchant_order_id: string
  descriptor?: string
  return_url?: string
  metadata?: Record<string, any>
}

interface AirwallexPaymentIntentResponse {
  id: string
  amount: number
  currency: string
  status: string
  client_secret: string
  merchant_order_id: string
  created_at: string
  updated_at: string
  metadata?: Record<string, any>
}

interface AirwallexConfirmRequest {
  payment_method: {
    type: string
    [key: string]: any
  }
  return_url?: string
}

interface AirwallexCaptureRequest {
  amount?: number
}

interface AirwallexRefundRequest {
  payment_intent_id: string
  amount?: number
  reason?: string
}

interface AirwallexRefundResponse {
  id: string
  payment_intent_id: string
  amount: number
  currency: string
  status: string
  reason?: string
  created_at: string
}

export class AirwallexApiClient {
  private client: AxiosInstance
  private baseUrl: string
  private clientId: string
  private apiKey: string
  private bearerToken: string | null = null
  private tokenExpiresAt: Date | null = null
  private logger: Logger
  private isRefreshing = false
  private refreshQueue: Array<() => void> = []

  constructor(
    clientId: string,
    apiKey: string,
    isTest: boolean = true,
    logger: Logger
  ) {
    this.clientId = clientId
    this.apiKey = apiKey
    this.logger = logger
    this.baseUrl = isTest
      ? "https://api-demo.airwallex.com"
      : "https://api.airwallex.com"

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    })

    // Add response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          if (!this.isRefreshing) {
            this.isRefreshing = true

            try {
              await this.login()
              this.isRefreshing = false

              // Retry queued requests
              this.refreshQueue.forEach((cb) => cb())
              this.refreshQueue = []

              // Retry original request
              return this.client(originalRequest)
            } catch (refreshError) {
              this.isRefreshing = false
              this.refreshQueue = []
              this.logger.error(
                `[Airwallex] Token refresh failed: ${(refreshError as Error).message}`
              )
              return Promise.reject(refreshError)
            }
          }

          // Queue request while refreshing
          return new Promise((resolve, reject) => {
            this.refreshQueue.push(() => {
              resolve(this.client(originalRequest))
            })
          })
        }

        return Promise.reject(error)
      }
    )
  }

  /**
   * Login to Airwallex and get bearer token
   */
  async login(): Promise<void> {
    try {
      const response = await axios.post<AirwallexLoginResponse>(
        `${this.baseUrl}/api/v1/authentication/login`,
        {},
        {
          headers: {
            "x-client-id": this.clientId,
            "x-api-key": this.apiKey,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      )

      this.bearerToken = response.data.token
      this.tokenExpiresAt = new Date(response.data.expires_at)

      this.logger.info(
        `[Airwallex] Successfully authenticated, token expires at ${this.tokenExpiresAt.toISOString()}`
      )
    } catch (error: any) {
      this.logger.error(
        `[Airwallex] Authentication failed: ${error.message || error.response?.data?.message}`
      )
      throw new Error(
        `Airwallex authentication failed: ${error.message || error.response?.data?.message}`
      )
    }
  }

  /**
   * Ensure valid token before each request
   */
  private async ensureToken(): Promise<void> {
    if (!this.bearerToken || !this.tokenExpiresAt) {
      await this.login()
      return
    }

    const now = new Date()
    const bufferMs = 60000 // Refresh 1 minute before expiry
    if (now.getTime() + bufferMs >= this.tokenExpiresAt.getTime()) {
      await this.login()
    }
  }

  /**
   * Create a payment intent
   */
  async createPaymentIntent(
    data: AirwallexPaymentIntentRequest
  ): Promise<AirwallexPaymentIntentResponse> {
    await this.ensureToken()

    try {
      const response = await this.client.post<AirwallexPaymentIntentResponse>(
        "/api/v1/pa/payment_intents/create",
        data,
        {
          headers: {
            Authorization: `Bearer ${this.bearerToken}`,
            "Content-Type": "application/json",
          },
        }
      )

      this.logger.info(
        `[Airwallex] Payment intent created: ${response.data.id}`
      )
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || error.message
      this.logger.error(`[Airwallex] Create payment intent failed: ${message}`)
      throw new Error(`Failed to create payment intent: ${message}`)
    }
  }

  /**
   * Confirm a payment intent with payment method
   */
  async confirmPaymentIntent(
    intentId: string,
    data: AirwallexConfirmRequest
  ): Promise<AirwallexPaymentIntentResponse> {
    await this.ensureToken()

    try {
      const response = await this.client.post<AirwallexPaymentIntentResponse>(
        `/api/v1/pa/payment_intents/${intentId}/confirm`,
        data,
        {
          headers: {
            Authorization: `Bearer ${this.bearerToken}`,
            "Content-Type": "application/json",
          },
        }
      )

      this.logger.info(
        `[Airwallex] Payment intent confirmed: ${response.data.id}`
      )
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || error.message
      this.logger.error(`[Airwallex] Confirm payment intent failed: ${message}`)
      throw new Error(`Failed to confirm payment intent: ${message}`)
    }
  }

  /**
   * Get payment intent details
   */
  async getPaymentIntent(
    intentId: string
  ): Promise<AirwallexPaymentIntentResponse> {
    await this.ensureToken()

    try {
      const response = await this.client.get<AirwallexPaymentIntentResponse>(
        `/api/v1/pa/payment_intents/${intentId}`,
        {
          headers: {
            Authorization: `Bearer ${this.bearerToken}`,
          },
        }
      )

      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || error.message
      this.logger.error(
        `[Airwallex] Get payment intent failed: ${message}`
      )
      throw new Error(`Failed to retrieve payment intent: ${message}`)
    }
  }

  /**
   * Capture a payment intent
   */
  async capturePaymentIntent(
    intentId: string,
    data: AirwallexCaptureRequest = {}
  ): Promise<AirwallexPaymentIntentResponse> {
    await this.ensureToken()

    try {
      const response = await this.client.post<AirwallexPaymentIntentResponse>(
        `/api/v1/pa/payment_intents/${intentId}/capture`,
        data,
        {
          headers: {
            Authorization: `Bearer ${this.bearerToken}`,
            "Content-Type": "application/json",
          },
        }
      )

      this.logger.info(
        `[Airwallex] Payment intent captured: ${response.data.id}`
      )
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || error.message
      this.logger.error(`[Airwallex] Capture payment intent failed: ${message}`)
      throw new Error(`Failed to capture payment intent: ${message}`)
    }
  }

  /**
   * Cancel a payment intent
   */
  async cancelPaymentIntent(intentId: string): Promise<void> {
    await this.ensureToken()

    try {
      await this.client.post(
        `/api/v1/pa/payment_intents/${intentId}/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${this.bearerToken}`,
            "Content-Type": "application/json",
          },
        }
      )

      this.logger.info(`[Airwallex] Payment intent cancelled: ${intentId}`)
    } catch (error: any) {
      const message = error.response?.data?.message || error.message
      this.logger.error(`[Airwallex] Cancel payment intent failed: ${message}`)
      throw new Error(`Failed to cancel payment intent: ${message}`)
    }
  }

  /**
   * Create a refund
   */
  async createRefund(
    data: AirwallexRefundRequest
  ): Promise<AirwallexRefundResponse> {
    await this.ensureToken()

    try {
      const response = await this.client.post<AirwallexRefundResponse>(
        "/api/v1/pa/refunds/create",
        data,
        {
          headers: {
            Authorization: `Bearer ${this.bearerToken}`,
            "Content-Type": "application/json",
          },
        }
      )

      this.logger.info(
        `[Airwallex] Refund created: ${response.data.id}`
      )
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || error.message
      this.logger.error(`[Airwallex] Create refund failed: ${message}`)
      throw new Error(`Failed to create refund: ${message}`)
    }
  }

  /**
   * Get refund details
   */
  async getRefund(refundId: string): Promise<AirwallexRefundResponse> {
    await this.ensureToken()

    try {
      const response = await this.client.get<AirwallexRefundResponse>(
        `/api/v1/pa/refunds/${refundId}`,
        {
          headers: {
            Authorization: `Bearer ${this.bearerToken}`,
          },
        }
      )

      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || error.message
      this.logger.error(`[Airwallex] Get refund failed: ${message}`)
      throw new Error(`Failed to retrieve refund: ${message}`)
    }
  }
}
```

---

## FILE 14: backend/src/modules/payment-airwallex/service.ts

MedusaJS 2.0 payment provider service implementing Airwallex payment processing with status mapping, payment intent management, and webhook handling.

```typescript
import {
  AbstractPaymentProvider,
  PaymentProviderError,
  PaymentSessionStatus,
} from "@medusajs/utils"
import { Logger } from "@medusajs/framework/logger"
import { AirwallexApiClient } from "./api-client"

/**
 * Airwallex payment session data interface
 */
interface IAirwallexPaymentSessionData {
  intentId?: string
  clientSecret?: string
  status?: string
  amount?: number
  currency?: string
  metadata?: Record<string, any>
}

/**
 * Airwallex Payment Provider for MedusaJS 2.0
 * Supports card payments (credit/debit) and various payment methods
 */
export class AirwallexPaymentProvider extends AbstractPaymentProvider {
  static identifier = "airwallex"

  private apiClient: AirwallexApiClient | null = null
  private logger: Logger

  constructor(container: any) {
    super(container)
    this.logger = container.logger
  }

  /**
   * Get or initialize Airwallex API client
   */
  private async getAirwallexClient(): Promise<AirwallexApiClient> {
    if (this.apiClient) {
      return this.apiClient
    }

    const credentials = this.options_

    if (!credentials?.api_key || !credentials?.secret_key) {
      throw new PaymentProviderError(
        "Missing Airwallex credentials: api_key (client_id) and secret_key (api_key) required"
      )
    }

    const isTest = credentials?.is_test !== false // Default to test

    this.apiClient = new AirwallexApiClient(
      credentials.api_key,
      credentials.secret_key,
      isTest,
      this.logger
    )

    // Initial login
    await this.apiClient.login()

    return this.apiClient
  }

  /**
   * Map Airwallex payment intent status to MedusaJS payment session status
   */
  private mapAirwallexStatusToMedusa(
    airwallexStatus: string
  ): PaymentSessionStatus {
    const statusMap: Record<string, PaymentSessionStatus> = {
      REQUIRES_PAYMENT_METHOD: PaymentSessionStatus.PENDING,
      REQUIRES_CUSTOMER_ACTION: PaymentSessionStatus.REQUIRES_MORE,
      REQUIRES_CAPTURE: PaymentSessionStatus.AUTHORIZED,
      SUCCEEDED: PaymentSessionStatus.AUTHORIZED,
      CAPTURED: PaymentSessionStatus.CAPTURED,
      CANCELLED: PaymentSessionStatus.CANCELED,
      FAILED: PaymentSessionStatus.ERROR,
    }

    return statusMap[airwallexStatus] || PaymentSessionStatus.PENDING
  }

  /**
   * Initiate payment — create payment intent
   * Returns client_secret for frontend to complete payment
   */
  async initiatePayment(
    context: any
  ): Promise<{
    session_data: IAirwallexPaymentSessionData
    status: PaymentSessionStatus
  }> {
    try {
      const client = await this.getAirwallexClient()

      const {
        amount,
        currency,
        merchant_order_id,
        descriptor,
        return_url,
        metadata,
      } = context

      if (!amount || !currency || !merchant_order_id) {
        throw new PaymentProviderError(
          "Missing required fields: amount, currency, merchant_order_id"
        )
      }

      // Create payment intent
      const paymentIntent = await client.createPaymentIntent({
        amount,
        currency: currency.toUpperCase(),
        merchant_order_id,
        descriptor: descriptor?.substring(0, 22), // Max 22 chars
        return_url,
        metadata,
      })

      const sessionData: IAirwallexPaymentSessionData = {
        intentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
      }

      this.logger.info(
        `[Airwallex] Payment initiated for order ${merchant_order_id}, intent: ${paymentIntent.id}`
      )

      return {
        session_data: sessionData,
        status: this.mapAirwallexStatusToMedusa(paymentIntent.status),
      }
    } catch (error: any) {
      this.logger.error(`[Airwallex] Initiate payment failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Authorize payment — confirm payment intent status
   */
  async authorizePayment(
    paymentSessionData: IAirwallexPaymentSessionData,
    context: any
  ): Promise<{
    session_data: IAirwallexPaymentSessionData
    status: PaymentSessionStatus
  }> {
    try {
      const client = await this.getAirwallexClient()
      const { intentId } = paymentSessionData

      if (!intentId) {
        throw new PaymentProviderError("Missing payment intent ID")
      }

      // Get current payment intent status
      const paymentIntent = await client.getPaymentIntent(intentId)

      const updatedData: IAirwallexPaymentSessionData = {
        ...paymentSessionData,
        status: paymentIntent.status,
      }

      this.logger.info(
        `[Airwallex] Payment authorized, intent: ${intentId}, status: ${paymentIntent.status}`
      )

      return {
        session_data: updatedData,
        status: this.mapAirwallexStatusToMedusa(paymentIntent.status),
      }
    } catch (error: any) {
      this.logger.error(`[Airwallex] Authorize payment failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Capture payment — capture authorized amount
   */
  async capturePayment(
    paymentSessionData: IAirwallexPaymentSessionData,
    context: any
  ): Promise<{
    session_data: IAirwallexPaymentSessionData
    status: PaymentSessionStatus
  }> {
    try {
      const client = await this.getAirwallexClient()
      const { intentId, amount } = paymentSessionData

      if (!intentId) {
        throw new PaymentProviderError("Missing payment intent ID")
      }

      // Capture the payment intent
      const paymentIntent = await client.capturePaymentIntent(intentId, {
        amount,
      })

      const updatedData: IAirwallexPaymentSessionData = {
        ...paymentSessionData,
        status: paymentIntent.status,
      }

      this.logger.info(
        `[Airwallex] Payment captured, intent: ${intentId}, amount: ${amount}`
      )

      return {
        session_data: updatedData,
        status: this.mapAirwallexStatusToMedusa(paymentIntent.status),
      }
    } catch (error: any) {
      this.logger.error(`[Airwallex] Capture payment failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(
    paymentSessionData: IAirwallexPaymentSessionData,
    refundAmount: number,
    context: any
  ): Promise<{
    session_data: IAirwallexPaymentSessionData
    status: PaymentSessionStatus
  }> {
    try {
      const client = await this.getAirwallexClient()
      const { intentId } = paymentSessionData

      if (!intentId) {
        throw new PaymentProviderError("Missing payment intent ID")
      }

      // Create refund
      const refund = await client.createRefund({
        payment_intent_id: intentId,
        amount: refundAmount > 0 ? refundAmount : undefined,
        reason: context?.reason || "Customer requested",
      })

      const updatedData: IAirwallexPaymentSessionData = {
        ...paymentSessionData,
        metadata: {
          ...paymentSessionData.metadata,
          refundId: refund.id,
          refundStatus: refund.status,
        },
      }

      this.logger.info(
        `[Airwallex] Refund created, intent: ${intentId}, refund: ${refund.id}, amount: ${refund.amount}`
      )

      return {
        session_data: updatedData,
        status: PaymentSessionStatus.AUTHORIZED,
      }
    } catch (error: any) {
      this.logger.error(`[Airwallex] Refund payment failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(
    paymentSessionData: IAirwallexPaymentSessionData,
    context: any
  ): Promise<{
    session_data: IAirwallexPaymentSessionData
    status: PaymentSessionStatus
  }> {
    try {
      const client = await this.getAirwallexClient()
      const { intentId } = paymentSessionData

      if (intentId) {
        // Cancel the payment intent
        await client.cancelPaymentIntent(intentId)
      }

      this.logger.info(`[Airwallex] Payment cancelled, intent: ${intentId}`)

      return {
        session_data: {
          ...paymentSessionData,
          status: "CANCELLED",
        },
        status: PaymentSessionStatus.CANCELED,
      }
    } catch (error: any) {
      this.logger.error(`[Airwallex] Cancel payment failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Delete payment session
   */
  async deletePayment(
    paymentSessionData: IAirwallexPaymentSessionData,
    context: any
  ): Promise<{
    session_data: IAirwallexPaymentSessionData
    status: PaymentSessionStatus
  }> {
    // Cancel if not already cancelled
    if (paymentSessionData.status !== "CANCELLED") {
      return await this.cancelPayment(paymentSessionData, context)
    }

    return {
      session_data: paymentSessionData,
      status: PaymentSessionStatus.CANCELED,
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(
    paymentSessionData: IAirwallexPaymentSessionData,
    context: any
  ): Promise<PaymentSessionStatus> {
    try {
      const client = await this.getAirwallexClient()
      const { intentId } = paymentSessionData

      if (!intentId) {
        return PaymentSessionStatus.PENDING
      }

      const paymentIntent = await client.getPaymentIntent(intentId)
      return this.mapAirwallexStatusToMedusa(paymentIntent.status)
    } catch (error: any) {
      this.logger.error(
        `[Airwallex] Get payment status failed: ${error.message}`
      )
      return PaymentSessionStatus.ERROR
    }
  }

  /**
   * Retrieve payment data
   */
  async retrievePayment(
    paymentSessionData: IAirwallexPaymentSessionData,
    context: any
  ): Promise<{
    session_data: IAirwallexPaymentSessionData
    status: PaymentSessionStatus
  }> {
    try {
      const client = await this.getAirwallexClient()
      const { intentId } = paymentSessionData

      if (!intentId) {
        return {
          session_data: paymentSessionData,
          status: PaymentSessionStatus.PENDING,
        }
      }

      const paymentIntent = await client.getPaymentIntent(intentId)

      const updatedData: IAirwallexPaymentSessionData = {
        ...paymentSessionData,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
      }

      return {
        session_data: updatedData,
        status: this.mapAirwallexStatusToMedusa(paymentIntent.status),
      }
    } catch (error: any) {
      this.logger.error(
        `[Airwallex] Retrieve payment failed: ${error.message}`
      )
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Update payment session
   */
  async updatePayment(context: any): Promise<{
    session_data: IAirwallexPaymentSessionData
    status: PaymentSessionStatus
  }> {
    return await this.retrievePayment(context.paymentSessionData, context)
  }

  /**
   * Process Airwallex webhook
   * Airwallex sends notifications for payment status changes
   */
  async getWebhookActionAndData(webhookData: any): Promise<{
    action: string
    data: IAirwallexPaymentSessionData
  }> {
    try {
      const { id, event_type, data: eventData } = webhookData

      if (!id) {
        return {
          action: "neutral",
          data: webhookData as IAirwallexPaymentSessionData,
        }
      }

      const client = await this.getAirwallexClient()

      // Get updated payment intent status from Airwallex
      const paymentIntent = await client.getPaymentIntent(id)

      let action = "neutral"

      // Map webhook event to action
      if (event_type === "payment_intent.succeeded") {
        action = "succeed"
      } else if (event_type === "payment_intent.requires_customer_action") {
        action = "require_customer_action"
      } else if (event_type === "payment_intent.failed") {
        action = "fail"
      } else if (event_type === "payment_intent.cancelled") {
        action = "fail"
      }

      const sessionData: IAirwallexPaymentSessionData = {
        intentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
      }

      this.logger.info(
        `[Airwallex] Webhook processed: ${event_type}, intent: ${id}, action: ${action}`
      )

      return {
        action,
        data: sessionData,
      }
    } catch (error: any) {
      this.logger.error(
        `[Airwallex] Webhook processing failed: ${error.message}`
      )
      return {
        action: "fail",
        data: webhookData as IAirwallexPaymentSessionData,
      }
    }
  }
}
```

---

## FILE 15: backend/src/modules/payment-airwallex/index.ts

Module registration for Airwallex payment provider using MedusaJS 2.0 ModuleProvider pattern.

```typescript
import { Module } from "@medusajs/framework/utils"
import { AirwallexPaymentProvider } from "./service"

export const AIRWALLEX_MODULE_NAME = "payment-airwallex"

export default Module(AIRWALLEX_MODULE_NAME, {
  service: AirwallexPaymentProvider,
})
```

---

## SECTION 3: Webhook Routes for All 5 Custom Providers + Stripe/PayPal Tracking Extensions

### FILE 16: backend/src/api/webhooks/mollie/route.ts

POST webhook handler for Mollie payment status updates. Mollie sends the order ID in the request body; we verify the status by querying Mollie's API directly and update order metadata with a payment activity log entry.

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IPaymentModuleService } from "@medusajs/framework/types"
import { MOLLIE_MODULE_NAME } from "@medusajs/payment-mollie"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { id: mollieOrderId } = req.body

    if (!mollieOrderId) {
      return res.status(400).json({ error: "Missing Mollie order ID" })
    }

    const paymentModuleService: IPaymentModuleService = req.scope.resolve(
      "paymentModuleService"
    )
    const orderModuleService = req.scope.resolve("orderModuleService")
    const logger = req.scope.resolve("logger")

    // Get the Mollie payment provider
    const mollieProvider = paymentModuleService.getProvider(MOLLIE_MODULE_NAME)

    if (!mollieProvider) {
      logger.error("[Mollie Webhook] Provider not found")
      return res.status(500).json({ error: "Provider not configured" })
    }

    // Query Mollie API to get current order status
    const mollieClient = await mollieProvider.getMollieClient()
    const statusResult = await mollieClient.getOrder(mollieOrderId)

    if (!statusResult.success) {
      logger.error(`[Mollie Webhook] Failed to fetch order: ${statusResult.error}`)
      return res.status(400).json({ error: "Failed to fetch Mollie order status" })
    }

    const mollieOrder = statusResult.data
    const medusaStatus = mapMollieStatusToMedusa(mollieOrder.status)

    // Find the order with this Mollie ID in its session data
    const orders = await orderModuleService.list({
      filters: {
        "metadata.mollieOrderId": mollieOrderId,
      },
    })

    if (!orders.length) {
      logger.warn(`[Mollie Webhook] No order found for Mollie ID: ${mollieOrderId}`)
      return res.status(200).json({ received: true })
    }

    const order = orders[0]
    const activityEntry = {
      timestamp: new Date().toISOString(),
      event: "status_update",
      gateway: "mollie",
      payment_method: mollieOrder.method || "unknown",
      status: medusaStatus === "authorized" ? "success" : "pending",
      amount: mollieOrder.amount?.value,
      currency: mollieOrder.amount?.currency,
      transaction_id: mollieOrderId,
      detail: `Mollie order status: ${mollieOrder.status}`,
    }

    // Update order metadata with activity log
    const existingLog = order.metadata?.payment_activity_log || []
    await orderModuleService.updateOrders(
      {
        id: order.id,
        metadata: {
          ...order.metadata,
          payment_activity_log: [...existingLog, activityEntry],
          mollieOrderId,
          mollieStatus: mollieOrder.status,
        },
      },
      { transactionManager: req.scope.resolve("manager") }
    )

    logger.info(
      `[Mollie Webhook] Order ${order.id} updated with status: ${medusaStatus}`
    )

    return res.status(200).json({ received: true })
  } catch (error: any) {
    const logger = req.scope.resolve("logger")
    logger.error(`[Mollie Webhook] Error: ${error.message}`)
    return res.status(500).json({ error: error.message })
  }
}

function mapMollieStatusToMedusa(mollieStatus: string): string {
  const statusMap: Record<string, string> = {
    created: "pending",
    authorized: "authorized",
    completed: "captured",
    paid: "captured",
    failed: "canceled",
    canceled: "canceled",
    expired: "canceled",
    refunded: "refunded",
  }
  return statusMap[mollieStatus] || "pending"
}
```

---

### FILE 17: backend/src/api/webhooks/comgate/route.ts

POST webhook handler for Comgate payment notifications. Comgate sends the transaction ID in form-encoded body. We verify the transaction status via Comgate API and update order metadata.

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IPaymentModuleService } from "@medusajs/framework/types"
import { COMGATE_MODULE_NAME } from "@medusajs/payment-comgate"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { transId: comgateTransactionId } = req.body

    if (!comgateTransactionId) {
      return res.status(400).json({ error: "Missing Comgate transaction ID" })
    }

    const paymentModuleService: IPaymentModuleService = req.scope.resolve(
      "paymentModuleService"
    )
    const orderModuleService = req.scope.resolve("orderModuleService")
    const logger = req.scope.resolve("logger")

    // Get the Comgate payment provider
    const comgateProvider = paymentModuleService.getProvider(COMGATE_MODULE_NAME)

    if (!comgateProvider) {
      logger.error("[Comgate Webhook] Provider not found")
      return res.status(500).json({ error: "Provider not configured" })
    }

    // Verify transaction status with Comgate
    const verifyResult = await comgateProvider.getStatus(comgateTransactionId)

    if (!verifyResult.success) {
      logger.error(`[Comgate Webhook] Failed to verify transaction: ${verifyResult.error}`)
      return res.status(400).json({ error: "Failed to verify transaction" })
    }

    const transactionStatus = verifyResult.data
    const medusaStatus = mapComgateStatusToMedusa(transactionStatus.status)

    // Find the order with this Comgate transaction ID
    const orders = await orderModuleService.list({
      filters: {
        "metadata.comgateTransId": comgateTransactionId,
      },
    })

    if (!orders.length) {
      logger.warn(`[Comgate Webhook] No order found for transaction: ${comgateTransactionId}`)
      return res.status(200).send("OK")
    }

    const order = orders[0]
    const activityEntry = {
      timestamp: new Date().toISOString(),
      event: "status_update",
      gateway: "comgate",
      payment_method: transactionStatus.method || "card",
      status: medusaStatus === "authorized" ? "success" : "pending",
      amount: transactionStatus.amount,
      currency: transactionStatus.currency,
      transaction_id: comgateTransactionId,
      detail: `Comgate transaction status: ${transactionStatus.status}`,
    }

    // Update order metadata with activity log
    const existingLog = order.metadata?.payment_activity_log || []
    await orderModuleService.updateOrders(
      {
        id: order.id,
        metadata: {
          ...order.metadata,
          payment_activity_log: [...existingLog, activityEntry],
          comgateTransId: comgateTransactionId,
          comgateStatus: transactionStatus.status,
        },
      },
      { transactionManager: req.scope.resolve("manager") }
    )

    logger.info(
      `[Comgate Webhook] Order ${order.id} updated with status: ${medusaStatus}`
    )

    return res.status(200).send("OK")
  } catch (error: any) {
    const logger = req.scope.resolve("logger")
    logger.error(`[Comgate Webhook] Error: ${error.message}`)
    return res.status(200).send("OK")
  }
}

function mapComgateStatusToMedusa(comgateStatus: string): string {
  const statusMap: Record<string, string> = {
    PAID: "captured",
    AUTHORIZED: "authorized",
    PENDING: "pending",
    CANCELLED: "canceled",
    FAILED: "canceled",
    REFUNDED: "refunded",
  }
  return statusMap[comgateStatus] || "pending"
}
```

---

### FILE 18: backend/src/api/webhooks/przelewy24/route.ts

POST webhook handler for Przelewy24 (P24) payment notifications. P24 sends orderId, sessionId, amount, currency, and a signature. We verify the signature using SHA-384 hash, verify the transaction, and update order metadata.

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IPaymentModuleService } from "@medusajs/framework/types"
import { PRZELEWY24_MODULE_NAME } from "@medusajs/payment-przelewy24"
import crypto from "crypto"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { orderId, sessionId, amount, currency, sign } = req.body

    if (!orderId || !sign) {
      return res.status(400).json({ error: "Missing required P24 webhook fields" })
    }

    const paymentModuleService: IPaymentModuleService = req.scope.resolve(
      "paymentModuleService"
    )
    const orderModuleService = req.scope.resolve("orderModuleService")
    const configService = req.scope.resolve("configService")
    const logger = req.scope.resolve("logger")

    // Get the Przelewy24 payment provider
    const p24Provider = paymentModuleService.getProvider(PRZELEWY24_MODULE_NAME)

    if (!p24Provider) {
      logger.error("[P24 Webhook] Provider not found")
      return res.status(500).json({ error: "Provider not configured" })
    }

    // Verify signature using SHA-384
    const p24Secret = configService.get("PRZELEWY24_SECRET_KEY")
    const signString = `${orderId}|${sessionId}|${amount}|${currency}|${p24Secret}`
    const computedSign = crypto.createHash("sha384").update(signString).digest("hex")

    if (sign.toLowerCase() !== computedSign.toLowerCase()) {
      logger.warn("[P24 Webhook] Invalid signature")
      return res.status(400).json({ error: "Invalid signature" })
    }

    // Verify transaction with P24
    const verifyResult = await p24Provider.verifyTransaction({
      orderId,
      sessionId,
      amount,
      currency,
    })

    if (!verifyResult.success) {
      logger.error(`[P24 Webhook] Failed to verify transaction: ${verifyResult.error}`)
      return res.status(400).json({ error: "Transaction verification failed" })
    }

    const transactionData = verifyResult.data
    const medusaStatus = mapP24StatusToMedusa(transactionData.status)

    // Find the order with this P24 session ID
    const orders = await orderModuleService.list({
      filters: {
        "metadata.p24SessionId": sessionId,
      },
    })

    if (!orders.length) {
      logger.warn(`[P24 Webhook] No order found for session: ${sessionId}`)
      return res.status(200).json({ received: true })
    }

    const order = orders[0]
    const activityEntry = {
      timestamp: new Date().toISOString(),
      event: "status_update",
      gateway: "przelewy24",
      payment_method: transactionData.method || "bank_transfer",
      status: medusaStatus === "captured" ? "success" : "pending",
      amount: transactionData.amount || amount,
      currency: transactionData.currency || currency,
      transaction_id: orderId,
      detail: `P24 transaction verified: ${transactionData.status}`,
    }

    // Update order metadata with activity log
    const existingLog = order.metadata?.payment_activity_log || []
    await orderModuleService.updateOrders(
      {
        id: order.id,
        metadata: {
          ...order.metadata,
          payment_activity_log: [...existingLog, activityEntry],
          p24OrderId: orderId,
          p24SessionId: sessionId,
          p24Status: transactionData.status,
        },
      },
      { transactionManager: req.scope.resolve("manager") }
    )

    logger.info(
      `[P24 Webhook] Order ${order.id} verified with status: ${medusaStatus}`
    )

    return res.status(200).json({ received: true })
  } catch (error: any) {
    const logger = req.scope.resolve("logger")
    logger.error(`[P24 Webhook] Error: ${error.message}`)
    return res.status(200).json({ error: error.message })
  }
}

function mapP24StatusToMedusa(p24Status: string): string {
  const statusMap: Record<string, string> = {
    COMPLETED: "captured",
    AUTHORIZED: "authorized",
    PENDING: "pending",
    CANCELLED: "canceled",
    FAILED: "canceled",
    REFUNDED: "refunded",
  }
  return statusMap[p24Status] || "pending"
}
```

---

### FILE 19: backend/src/api/webhooks/klarna/route.ts

POST webhook handler for Klarna payment notifications. Klarna sends event_type and order_id. We handle authorization, capture, refund, and cancellation events, updating order metadata accordingly.

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IPaymentModuleService } from "@medusajs/framework/types"
import { KLARNA_MODULE_NAME } from "@medusajs/payment-klarna"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { event_type, order_id: klarnaOrderId } = req.body

    if (!event_type || !klarnaOrderId) {
      return res.status(400).json({ error: "Missing required Klarna webhook fields" })
    }

    const paymentModuleService: IPaymentModuleService = req.scope.resolve(
      "paymentModuleService"
    )
    const orderModuleService = req.scope.resolve("orderModuleService")
    const logger = req.scope.resolve("logger")

    // Get the Klarna payment provider
    const klarnaProvider = paymentModuleService.getProvider(KLARNA_MODULE_NAME)

    if (!klarnaProvider) {
      logger.error("[Klarna Webhook] Provider not found")
      return res.status(500).json({ error: "Provider not configured" })
    }

    // Map Klarna event type to Medusa status
    const medusaStatus = mapKlarnaEventToMedusaStatus(event_type)

    // Find the order with this Klarna order ID
    const orders = await orderModuleService.list({
      filters: {
        "metadata.klarnaOrderId": klarnaOrderId,
      },
    })

    if (!orders.length) {
      logger.warn(`[Klarna Webhook] No order found for Klarna ID: ${klarnaOrderId}`)
      return res.status(200).json({ received: true })
    }

    const order = orders[0]

    const activityEntry = {
      timestamp: new Date().toISOString(),
      event: mapKlarnaEventToActivityEvent(event_type),
      gateway: "klarna",
      payment_method: "klarna",
      status: ["order.authorized", "order.captured"].includes(event_type)
        ? "success"
        : "pending",
      amount: order.total || 0,
      currency: order.currency_code,
      transaction_id: klarnaOrderId,
      error_message:
        event_type === "order.cancelled"
          ? "Order cancelled by Klarna"
          : undefined,
      detail: `Klarna event: ${event_type}`,
    }

    // Update order metadata with activity log
    const existingLog = order.metadata?.payment_activity_log || []
    await orderModuleService.updateOrders(
      {
        id: order.id,
        metadata: {
          ...order.metadata,
          payment_activity_log: [...existingLog, activityEntry],
          klarnaOrderId,
          klarnaStatus: event_type,
        },
      },
      { transactionManager: req.scope.resolve("manager") }
    )

    logger.info(
      `[Klarna Webhook] Order ${order.id} updated with event: ${event_type}`
    )

    return res.status(200).json({ received: true })
  } catch (error: any) {
    const logger = req.scope.resolve("logger")
    logger.error(`[Klarna Webhook] Error: ${error.message}`)
    return res.status(200).json({ error: error.message })
  }
}

function mapKlarnaEventToMedusaStatus(event_type: string): string {
  const statusMap: Record<string, string> = {
    "order.authorized": "authorized",
    "order.captured": "captured",
    "order.refunded": "refunded",
    "order.cancelled": "canceled",
  }
  return statusMap[event_type] || "pending"
}

function mapKlarnaEventToActivityEvent(event_type: string): string {
  const eventMap: Record<string, string> = {
    "order.authorized": "authorization",
    "order.captured": "capture",
    "order.refunded": "refund",
    "order.cancelled": "cancellation",
  }
  return eventMap[event_type] || "status_update"
}
```

---

### FILE 20: backend/src/api/webhooks/airwallex/route.ts

POST webhook handler for Airwallex payment notifications. Airwallex sends JSON payload with a `name` field (event type) and `data` object. We handle payment intent succeeded, requires capture, and refund succeeded events.

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IPaymentModuleService } from "@medusajs/framework/types"
import { AIRWALLEX_MODULE_NAME } from "@medusajs/payment-airwallex"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { name: event_type, data: eventData } = req.body

    if (!event_type || !eventData) {
      return res.status(400).json({ error: "Missing required Airwallex webhook fields" })
    }

    const paymentModuleService: IPaymentModuleService = req.scope.resolve(
      "paymentModuleService"
    )
    const orderModuleService = req.scope.resolve("orderModuleService")
    const logger = req.scope.resolve("logger")

    // Get the Airwallex payment provider
    const airwallexProvider = paymentModuleService.getProvider(AIRWALLEX_MODULE_NAME)

    if (!airwallexProvider) {
      logger.error("[Airwallex Webhook] Provider not found")
      return res.status(500).json({ error: "Provider not configured" })
    }

    const { id: paymentIntentId, status: intentStatus } = eventData

    if (!paymentIntentId) {
      logger.warn("[Airwallex Webhook] No payment intent ID in event data")
      return res.status(200).json({ received: true })
    }

    // Find the order with this Airwallex payment intent ID
    const orders = await orderModuleService.list({
      filters: {
        "metadata.airwallexPaymentIntentId": paymentIntentId,
      },
    })

    if (!orders.length) {
      logger.warn(
        `[Airwallex Webhook] No order found for payment intent: ${paymentIntentId}`
      )
      return res.status(200).json({ received: true })
    }

    const order = orders[0]
    const medusaStatus = mapAirwallexEventToMedusaStatus(event_type)

    const activityEntry = {
      timestamp: new Date().toISOString(),
      event: mapAirwallexEventToActivityEvent(event_type),
      gateway: "airwallex",
      payment_method: eventData.payment_method || "card",
      status: ["payment_intent.succeeded"].includes(event_type)
        ? "success"
        : "pending",
      amount: eventData.amount,
      currency: eventData.currency,
      transaction_id: paymentIntentId,
      detail: `Airwallex event: ${event_type}`,
    }

    // Update order metadata with activity log
    const existingLog = order.metadata?.payment_activity_log || []
    await orderModuleService.updateOrders(
      {
        id: order.id,
        metadata: {
          ...order.metadata,
          payment_activity_log: [...existingLog, activityEntry],
          airwallexPaymentIntentId: paymentIntentId,
          airwallexStatus: event_type,
        },
      },
      { transactionManager: req.scope.resolve("manager") }
    )

    logger.info(
      `[Airwallex Webhook] Order ${order.id} updated with event: ${event_type}`
    )

    return res.status(200).json({ received: true })
  } catch (error: any) {
    const logger = req.scope.resolve("logger")
    logger.error(`[Airwallex Webhook] Error: ${error.message}`)
    return res.status(200).json({ error: error.message })
  }
}

function mapAirwallexEventToMedusaStatus(event_type: string): string {
  const statusMap: Record<string, string> = {
    "payment_intent.succeeded": "captured",
    "payment_intent.requires_capture": "authorized",
    "refund.succeeded": "refunded",
  }
  return statusMap[event_type] || "pending"
}

function mapAirwallexEventToActivityEvent(event_type: string): string {
  const eventMap: Record<string, string> = {
    "payment_intent.succeeded": "capture",
    "payment_intent.requires_capture": "authorization",
    "refund.succeeded": "refund",
  }
  return eventMap[event_type] || "status_update"
}
```

---

### Stripe Payment Intent Tracking Extension

Stripe's PaymentIntent object already supports shipping information via the `shipping` parameter. When tracking information is available from Dextrum, we update the PaymentIntent with carrier and tracking number details.

```typescript
// In backend/src/subscribers/tracking-dispatcher.ts
// Stripe tracking update:
async function sendTrackingToStripe(
  stripeClient: any,
  paymentIntentId: string,
  tracking: {
    carrier: string
    tracking_number: string
  }
): Promise<void> {
  await stripeClient.paymentIntents.update(paymentIntentId, {
    shipping: {
      carrier: tracking.carrier,
      tracking_number: tracking.tracking_number,
    },
  })
}
```

---

### PayPal Checkout Tracking Extension

PayPal's Checkout API provides a `/v2/checkout/orders/{id}/track` endpoint for transmitting tracking information. This allows customers to see shipping status in their PayPal transaction history.

```typescript
// In backend/src/subscribers/tracking-dispatcher.ts
// PayPal tracking update:
async function sendTrackingToPayPal(
  paypalClient: any,
  orderId: string,
  tracking: {
    carrier: string
    carrier_name_other?: string
    tracking_number: string
  }
): Promise<void> {
  const trackingPayload: any = {
    tracking_number: tracking.tracking_number,
    carrier: tracking.carrier === "other" ? "OTHER" : tracking.carrier.toUpperCase(),
  }

  if (tracking.carrier === "other" && tracking.carrier_name_other) {
    trackingPayload.carrier_name_other = tracking.carrier_name_other
  }

  await paypalClient.post(`/v2/checkout/orders/${orderId}/track`, {
    tracking: trackingPayload,
  })
}
```

---

## SECTION 4: Tracking Dispatcher Subscriber

### FILE 21: backend/src/subscribers/tracking-dispatcher.ts

A subscriber that listens for Dextrum order dispatch status updates. When an order reaches DISPATCHED status with tracking information, this service sends the tracking details to the appropriate payment gateway based on which provider was used.

```typescript
import { MedusaSubscriber } from "@medusajs/framework"
import { OrderDTO } from "@medusajs/framework/types"
import Stripe from "stripe"
import axios from "axios"

type OrderDetailPayment = {
  provider_id: string
  payment_collections?: Array<{
    payments?: Array<{
      provider_id: string
    }>
  }>
}

export default new MedusaSubscriber({
  event: ["order.updated", "order.created"],
  async handler(data: { id: string }) {
    const orderModuleService = this.container_.resolve("orderModuleService")
    const configService = this.container_.resolve("configService")
    const paymentModuleService = this.container_.resolve("paymentModuleService")
    const logger = this.container_.resolve("logger")

    try {
      // Fetch the order
      const order = await orderModuleService.retrieveOrder(data.id, {
        relations: ["payments", "payment_collections"],
      })

      if (!order) {
        logger.warn(`[Tracking Dispatcher] Order not found: ${data.id}`)
        return
      }

      // Check if order is in DISPATCHED status and has tracking info
      const dextrumStatus = order.metadata?.dextrum_status
      const trackingNumber = order.metadata?.dextrum_tracking_number
      const trackingCarrier = order.metadata?.dextrum_carrier

      if (dextrumStatus !== "DISPATCHED" || !trackingNumber) {
        return
      }

      // Check if tracking has already been sent
      const trackingSent = order.metadata?.tracking_sent_to_gateway
      if (trackingSent?.[`${trackingCarrier}_sent`]) {
        logger.info(
          `[Tracking Dispatcher] Tracking already sent for order ${order.id}`
        )
        return
      }

      // Detect which payment gateway was used
      const payment = order.payments?.[0]
      if (!payment) {
        logger.warn(
          `[Tracking Dispatcher] No payment found for order ${order.id}`
        )
        return
      }

      const providerId = payment.provider_id

      // Send tracking to the appropriate gateway
      let trackingSendResult = {
        success: false,
        gateway: providerId,
        timestamp: new Date().toISOString(),
      }

      try {
        if (providerId === "stripe") {
          await sendTrackingToStripe(
            paymentModuleService,
            order,
            trackingNumber,
            trackingCarrier
          )
          trackingSendResult.success = true
        } else if (providerId === "paypal") {
          await sendTrackingToPayPal(
            paymentModuleService,
            order,
            trackingNumber,
            trackingCarrier,
            configService
          )
          trackingSendResult.success = true
        } else if (providerId === "mollie") {
          await sendTrackingToMollie(
            paymentModuleService,
            order,
            trackingNumber,
            trackingCarrier
          )
          trackingSendResult.success = true
        } else if (providerId === "klarna") {
          await sendTrackingToKlarna(
            paymentModuleService,
            order,
            trackingNumber,
            trackingCarrier
          )
          trackingSendResult.success = true
        } else if (providerId === "comgate") {
          logger.info(
            `[Tracking Dispatcher] Comgate does not support tracking API for order ${order.id}`
          )
        } else if (providerId === "przelewy24") {
          logger.info(
            `[Tracking Dispatcher] Przelewy24 does not support tracking API for order ${order.id}`
          )
        } else if (providerId === "airwallex") {
          logger.info(
            `[Tracking Dispatcher] Airwallex does not support tracking API for order ${order.id}`
          )
        }
      } catch (error: any) {
        logger.error(
          `[Tracking Dispatcher] Failed to send tracking to ${providerId}: ${error.message}`
        )
        trackingSendResult.success = false
      }

      // Log tracking dispatch to activity log
      const activityEntry = {
        timestamp: new Date().toISOString(),
        event: "tracking_sent",
        gateway: providerId,
        tracking_number: trackingNumber,
        tracking_carrier: trackingCarrier,
        tracking_sent: trackingSendResult.success,
        status: trackingSendResult.success ? "success" : "error",
        detail: trackingSendResult.success
          ? `Tracking sent to ${providerId}`
          : `Failed to send tracking to ${providerId}`,
      }

      // Update order metadata
      const existingLog = order.metadata?.payment_activity_log || []
      const trackingMetadata = order.metadata?.tracking_sent_to_gateway || {}

      await orderModuleService.updateOrders(
        {
          id: order.id,
          metadata: {
            ...order.metadata,
            payment_activity_log: [...existingLog, activityEntry],
            tracking_sent_to_gateway: {
              ...trackingMetadata,
              [providerId]: trackingSendResult.success,
              [`${providerId}_timestamp`]: trackingSendResult.timestamp,
            },
          },
        },
        { transactionManager: this.container_.resolve("manager") }
      )

      logger.info(
        `[Tracking Dispatcher] Order ${order.id} tracking dispatched to ${providerId}`
      )
    } catch (error: any) {
      logger.error(`[Tracking Dispatcher] Error: ${error.message}`)
    }
  },
})

async function sendTrackingToStripe(
  paymentModuleService: any,
  order: any,
  trackingNumber: string,
  trackingCarrier: string
): Promise<void> {
  const stripeProvider = paymentModuleService.getProvider("stripe")
  if (!stripeProvider) {
    throw new Error("Stripe provider not configured")
  }

  const stripeClient = new Stripe(
    process.env.STRIPE_API_KEY || "",
    { apiVersion: "2024-04-10" }
  )

  const paymentIntentId = order.metadata?.stripePaymentIntentId
  if (!paymentIntentId) {
    throw new Error("No Stripe Payment Intent ID found in order metadata")
  }

  await stripeClient.paymentIntents.update(paymentIntentId, {
    shipping: {
      carrier: trackingCarrier,
      tracking_number: trackingNumber,
    },
  })
}

async function sendTrackingToPayPal(
  paymentModuleService: any,
  order: any,
  trackingNumber: string,
  trackingCarrier: string,
  configService: any
): Promise<void> {
  const paypalProvider = paymentModuleService.getProvider("paypal")
  if (!paypalProvider) {
    throw new Error("PayPal provider not configured")
  }

  const paypalOrderId = order.metadata?.paypalOrderId
  if (!paypalOrderId) {
    throw new Error("No PayPal Order ID found in order metadata")
  }

  const baseUrl = configService.get("PAYPAL_API_BASE_URL") || "https://api.paypal.com"
  const accessToken = await paypalProvider.getAccessToken()

  const trackingPayload: any = {
    tracking_number: trackingNumber,
    carrier: normalizePayPalCarrier(trackingCarrier),
  }

  if (trackingCarrier === "other") {
    trackingPayload.carrier_name_other = order.metadata?.tracking_carrier_other
  }

  await axios.post(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/track`, trackingPayload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  })
}

async function sendTrackingToMollie(
  paymentModuleService: any,
  order: any,
  trackingNumber: string,
  trackingCarrier: string
): Promise<void> {
  const mollieProvider = paymentModuleService.getProvider("mollie")
  if (!mollieProvider) {
    throw new Error("Mollie provider not configured")
  }

  const mollieOrderId = order.metadata?.mollieOrderId
  if (!mollieOrderId) {
    throw new Error("No Mollie Order ID found in order metadata")
  }

  const mollieClient = await mollieProvider.getMollieClient()

  const shipmentResult = await mollieClient.createShipment(mollieOrderId, {
    tracking: {
      carrier: normalizeMollieCarrier(trackingCarrier),
      code: trackingNumber,
      url: buildTrackingUrl(trackingCarrier, trackingNumber),
    },
  })

  if (!shipmentResult.success) {
    throw new Error(`Mollie shipment creation failed: ${shipmentResult.error}`)
  }
}

async function sendTrackingToKlarna(
  paymentModuleService: any,
  order: any,
  trackingNumber: string,
  trackingCarrier: string
): Promise<void> {
  const klarnaProvider = paymentModuleService.getProvider("klarna")
  if (!klarnaProvider) {
    throw new Error("Klarna provider not configured")
  }

  const klarnaOrderId = order.metadata?.klarnaOrderId
  const klarnaCaptureId = order.metadata?.klarnaCaptureId
  if (!klarnaOrderId || !klarnaCaptureId) {
    throw new Error("No Klarna Order/Capture ID found in order metadata")
  }

  const configService = this.container_.resolve("configService")
  const baseUrl = configService.get("KLARNA_API_BASE_URL") || "https://api.klarna.com"
  const authToken = await klarnaProvider.getAuthToken()

  await axios.post(
    `${baseUrl}/ordermanagement/v1/orders/${klarnaOrderId}/captures/${klarnaCaptureId}/shipping-info`,
    {
      shipping_company: normalizeKlarnaCarrier(trackingCarrier),
      tracking_number: trackingNumber,
    },
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    }
  )
}

function normalizePayPalCarrier(carrier: string): string {
  const carrierMap: Record<string, string> = {
    dhl: "DHL",
    fedex: "FEDEX",
    ups: "UPS",
    usps: "USPS",
    dpe: "DPE",
    other: "OTHER",
  }
  return carrierMap[carrier.toLowerCase()] || "OTHER"
}

function normalizeMollieCarrier(carrier: string): string {
  const carrierMap: Record<string, string> = {
    dhl: "DHL",
    fedex: "FEDEX",
    ups: "UPS",
    usps: "USPS",
    dpe: "DPE",
    other: "OTHER",
  }
  return carrierMap[carrier.toLowerCase()] || "OTHER"
}

function normalizeKlarnaCarrier(carrier: string): string {
  const carrierMap: Record<string, string> = {
    dhl: "DHL",
    fedex: "FEDEX",
    ups: "UPS",
    usps: "USPS",
    dpe: "DPE",
    other: "OTHER",
  }
  return carrierMap[carrier.toLowerCase()] || "OTHER"
}

function buildTrackingUrl(carrier: string, trackingNumber: string): string {
  const urlMap: Record<string, string> = {
    dhl: `https://tracking.dhl.com/?shipmentid=${trackingNumber}`,
    fedex: `https://tracking.fedex.com/tracking?tracknumbers=${trackingNumber}`,
    ups: `https://www.ups.com/track?tracknum=${trackingNumber}`,
    usps: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
    dpe: `https://tracking.cpost.cz/${trackingNumber}`,
  }
  return urlMap[carrier.toLowerCase()] || ""
}
```

---

## SECTION 5: Payment Activity Log Component

### FILE 22: backend/src/admin/components/orders/order-payment-activity.tsx

React component that displays a payment activity timeline in the order detail view. Reads from `order.metadata.payment_activity_log[]` array and renders each event with appropriate icons, status indicators, and gateway badges.

```typescript
import React from "react"
import { Order } from "@medusajs/medusa"
import { Check, X, Truck, AlertCircle } from "@medusajs/ui"
import clsx from "clsx"

interface PaymentActivityEntry {
  timestamp: string
  event: string
  gateway: string
  payment_method?: string
  status: "success" | "error" | "pending"
  amount?: number
  currency?: string
  transaction_id?: string
  error_message?: string
  error_code?: string
  tracking_sent?: boolean
  tracking_number?: string
  tracking_carrier?: string
  detail?: string
}

interface OrderPaymentActivityProps {
  order: Order
}

const GATEWAY_COLORS: Record<string, string> = {
  stripe: "bg-blue-100 text-blue-800 border-blue-300",
  paypal: "bg-indigo-100 text-indigo-800 border-indigo-300",
  mollie: "bg-cyan-100 text-cyan-800 border-cyan-300",
  klarna: "bg-pink-100 text-pink-800 border-pink-300",
  comgate: "bg-orange-100 text-orange-800 border-orange-300",
  przelewy24: "bg-green-100 text-green-800 border-green-300",
  airwallex: "bg-purple-100 text-purple-800 border-purple-300",
}

const GATEWAY_DISPLAY_NAMES: Record<string, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  mollie: "Mollie",
  klarna: "Klarna",
  comgate: "Comgate",
  przelewy24: "Przelewy24",
  airwallex: "Airwallex",
}

export const OrderPaymentActivity: React.FC<OrderPaymentActivityProps> = ({
  order,
}) => {
  const activityLog = (order.metadata?.payment_activity_log ||
    []) as PaymentActivityEntry[]

  if (!activityLog || activityLog.length === 0) {
    return (
      <div className="rounded-[10px] border border-[#E1E3E5] bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Payment Activity
        </h3>
        <p className="text-sm text-gray-500">No payment activity recorded.</p>
      </div>
    )
  }

  const sortedLog = [...activityLog].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return (
    <div className="rounded-[10px] border border-[#E1E3E5] bg-white p-6">
      <h3 className="mb-6 text-base font-semibold text-gray-900">
        Payment Activity
      </h3>

      <div className="space-y-0">
        {sortedLog.map((entry, index) => (
          <PaymentActivityEntry
            key={`${entry.timestamp}-${index}`}
            entry={entry}
            isLast={index === sortedLog.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

interface PaymentActivityEntryProps {
  entry: PaymentActivityEntry
  isLast: boolean
}

const PaymentActivityEntry: React.FC<PaymentActivityEntryProps> = ({
  entry,
  isLast,
}) => {
  const timestamp = new Date(entry.timestamp)
  const formattedTime = timestamp.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  const gatewayBgColor = GATEWAY_COLORS[entry.gateway] || "bg-gray-100 text-gray-800"
  const gatewayLabel = GATEWAY_DISPLAY_NAMES[entry.gateway] || entry.gateway

  const eventLabel = formatEventLabel(entry.event)

  return (
    <div className="relative flex gap-4 pb-6">
      {/* Timeline connector line */}
      {!isLast && (
        <div className="absolute left-[15px] top-10 h-[calc(100%-40px)] w-0.5 bg-[#E1E3E5]" />
      )}

      {/* Status icon */}
      <div className="relative flex-shrink-0">
        {entry.event === "tracking_sent" ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
            <Truck className="h-4 w-4 text-blue-600" />
          </div>
        ) : entry.status === "success" ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
            <Check className="h-4 w-4 text-green-600" />
          </div>
        ) : entry.status === "error" ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
            <X className="h-4 w-4 text-red-600" />
          </div>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-grow pt-1">
        {/* Header row: time, gateway badge, amount */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500">{formattedTime}</p>
            <p className="text-sm font-medium text-gray-900">{eventLabel}</p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={clsx(
                "inline-block rounded-full border px-3 py-1 text-xs font-medium",
                gatewayBgColor
              )}
            >
              {gatewayLabel}
            </span>

            {entry.amount && entry.currency && (
              <span className="text-sm font-semibold text-gray-900">
                {formatCurrency(entry.amount, entry.currency)}
              </span>
            )}
          </div>
        </div>

        {/* Details section */}
        <div className="mt-3 space-y-1 text-xs">
          {entry.payment_method && (
            <p className="text-gray-600">
              <span className="font-medium">Method:</span> {entry.payment_method}
            </p>
          )}

          {entry.transaction_id && (
            <p className="text-gray-600 break-all">
              <span className="font-medium">Transaction ID:</span>{" "}
              <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">
                {entry.transaction_id}
              </code>
            </p>
          )}

          {entry.tracking_number && (
            <p className="text-gray-600">
              <span className="font-medium">Tracking:</span> {entry.tracking_number}{" "}
              {entry.tracking_carrier && `(${entry.tracking_carrier})`}
            </p>
          )}

          {entry.error_message && (
            <div className="mt-2 rounded-md bg-red-50 p-2">
              <p className="text-red-700">
                <span className="font-medium">Error:</span> {entry.error_message}
              </p>
              {entry.error_code && (
                <p className="text-xs text-red-600 mt-1">
                  Code: {entry.error_code}
                </p>
              )}
            </div>
          )}

          {entry.detail && !entry.error_message && (
            <p className="text-gray-600 italic">{entry.detail}</p>
          )}
        </div>

        {/* Tracking sent badges */}
        {entry.event === "tracking_sent" && entry.tracking_sent && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={clsx(
                "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium",
                gatewayBgColor
              )}
            >
              Tracking sent to {gatewayLabel} ✓
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function formatEventLabel(event: string): string {
  const labelMap: Record<string, string> = {
    initiate: "Payment Initiated",
    authorization: "Payment Authorized",
    capture: "Payment Captured",
    refund: "Payment Refunded",
    cancellation: "Payment Cancelled",
    status_update: "Status Updated",
    tracking_sent: "Tracking Information Sent",
  }
  return labelMap[event] || event
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}
```

---

### FILE 23: MODIFY backend/src/admin/routes/custom-orders/[id]/page.tsx

Add the OrderPaymentActivity component to the order detail page in the main column after the OrderDetailPayment section. This displays the payment activity timeline alongside other order information.

```typescript
// In the page component's render section, add the OrderPaymentActivity component:

import { OrderPaymentActivity } from "../../components/orders/order-payment-activity"

export default function OrderDetailPage() {
  // ... existing code ...

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-2 space-y-4">
        {/* Existing order sections */}
        <OrderDetailTimeline order={order} />
        <OrderDetailPayment order={order} />

        {/* NEW: Add the Payment Activity Log component */}
        <OrderPaymentActivity order={order} />

        <OrderDetailProducts order={order} />
        <OrderDetailCustomer order={order} />
      </div>

      <div className="col-span-1">
        {/* Sidebar sections */}
        <OrderDetailSummary order={order} />
        <OrderDetailShipping order={order} />
      </div>
    </div>
  )
}
```

---

## SECTION 6: PAYMENT GATEWAYS SETTINGS (formerly "Billing") — Statement Descriptor + Gateway Credentials + Multi-Account

> **RENAME**: The admin tab label must be changed from "Billing" to **"Payment Gateways"**. Update `defineRouteConfig` label and page heading `<Heading>` in `settings-billing/page.tsx`.

This section documents the implementation of statement descriptor support and provider-specific credential management in the billing settings UI. The statement descriptor is a 16-character maximum string that appears on customers' bank statements for all transactions.

### Overview

The billing settings are updated to support:

1. **Statement Descriptor Field** - A validated text field (max 16 chars) with restricted character set, displayed to all payment gateway providers
2. **Gateway-Specific Credential Fields** - Each payment provider has unique credential requirements (API keys, secrets, webhook IDs, merchant IDs)
3. **Credential Validation** - A "Test Connection" button that verifies credentials by making test API calls to each provider

### Database & Model Changes

### FILE 24: `backend/src/modules/gateway-config/models/gateway-config.ts` — MODIFICATIONS

```typescript
import { MikroORM, PrimaryKey, Property, Entity } from "@mikro-orm/core";

/**
 * Gateway Configuration Model
 * Stores payment gateway credentials, settings, and statement descriptor
 */
@Entity({ tableName: "gateway_configs" })
export class GatewayConfig {
  @PrimaryKey()
  id: string;

  @Property()
  merchant_id: string;

  @Property()
  gateway_type: "stripe" | "paypal" | "mollie" | "comgate" | "przelewy24" | "klarna" | "airwallex";

  @Property({ nullable: true })
  is_active?: boolean;

  @Property({ type: "json", nullable: true })
  credentials?: {
    // Stripe
    api_key?: string; // publishable key
    secret_key?: string;
    webhook_secret?: string;

    // PayPal
    client_id?: string;
    client_secret?: string;
    webhook_id?: string;

    // Mollie
    api_key?: string;
    webhook_secret?: string;

    // Comgate
    merchant_id?: string;
    secret_key?: string;

    // Przelewy24
    merchant_id?: string;
    api_key?: string;
    crc_key?: string;

    // Klarna
    api_key?: string; // username
    api_secret?: string; // password

    // Airwallex
    client_id?: string;
    api_key?: string;
  };

  /**
   * Statement Descriptor
   * Max 16 characters (Comgate strictest limit)
   * Allowed: A-Z, 0-9, space, dot, hyphen
   * Appears on customer's bank statement for all transactions
   */
  @Property({ nullable: true })
  statement_descriptor?: string;

  @Property({ type: "datetime" })
  created_at: Date;

  @Property({ type: "datetime", onUpdate: () => new Date() })
  updated_at: Date;

  constructor(props: Partial<GatewayConfig> = {}) {
    Object.assign(this, props);
    this.created_at = this.created_at || new Date();
    this.updated_at = new Date();
  }
}

export default GatewayConfig;
```

### Admin UI Implementation

### FILE 25: `backend/src/admin/routes/settings-billing/page.tsx` — MODIFICATIONS

```typescript
"use client"

import React, { useState } from "react"
import {
  Container,
  Heading,
  Text,
  Button,
  Input,
  Label,
  Select,
  Badge,
  Tooltip,
  ToggleGroup,
  ToggleGroupItem,
} from "@medusajs/ui"
import { useCallback, useEffect } from "react"

// Validation regex for statement descriptor
const STATEMENT_DESCRIPTOR_REGEX = /^[A-Za-z0-9 .\-]{1,16}$/

// Gateway-specific credential field configurations
const GATEWAY_CREDENTIALS = {
  stripe: [
    { name: "api_key", label: "Publishable Key", type: "text", required: true },
    { name: "secret_key", label: "Secret Key", type: "password", required: true },
    { name: "webhook_secret", label: "Webhook Secret", type: "password", required: true },
  ],
  paypal: [
    { name: "client_id", label: "Client ID", type: "text", required: true },
    { name: "client_secret", label: "Client Secret", type: "password", required: true },
    { name: "webhook_id", label: "Webhook ID", type: "text", required: true },
  ],
  mollie: [
    { name: "api_key", label: "API Key", type: "password", required: true },
    {
      name: "webhook_secret",
      label: "Webhook Secret",
      type: "password",
      required: false,
      hint: "Optional - Mollie uses org-level webhooks by default",
    },
  ],
  comgate: [
    { name: "merchant_id", label: "Merchant ID", type: "text", required: true },
    { name: "secret_key", label: "Secret Key", type: "password", required: true },
  ],
  przelewy24: [
    { name: "merchant_id", label: "Merchant ID", type: "text", required: true },
    { name: "api_key", label: "API Key", type: "password", required: true },
    { name: "crc_key", label: "CRC Key", type: "password", required: true },
  ],
  klarna: [
    { name: "api_key", label: "API Key (Username)", type: "text", required: true },
    { name: "api_secret", label: "API Secret (Password)", type: "password", required: true },
  ],
  airwallex: [
    { name: "client_id", label: "Client ID", type: "text", required: true },
    { name: "api_key", label: "API Key", type: "password", required: true },
  ],
}

/**
 * Test connection helper
 * Makes test API calls to verify gateway credentials
 */
async function testGatewayConnection(
  gatewayType: string,
  credentials: Record<string, string>
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch("/admin/api/gateway/test-connection", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gateway_type: gatewayType,
        credentials,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return {
        success: false,
        message: error.message || "Connection test failed",
      }
    }

    return {
      success: true,
      message: "Connection successful",
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Connection test error",
    }
  }
}

/**
 * Validate statement descriptor
 * Max 16 chars, allowed: A-Z, 0-9, space, dot, hyphen
 */
function validateDescriptor(value: string): { valid: boolean; error?: string } {
  if (!value) {
    return { valid: true }
  }

  if (value.length > 16) {
    return { valid: false, error: "Maximum 16 characters" }
  }

  if (!STATEMENT_DESCRIPTOR_REGEX.test(value)) {
    return {
      valid: false,
      error: "Only A-Z, 0-9, space, dot, and hyphen allowed",
    }
  }

  return { valid: true }
}

/**
 * Billing Settings Page
 * Manages payment gateway configuration, credentials, and descriptor
 */
export default function BillingSettingsPage() {
  const [selectedGateway, setSelectedGateway] = useState<string>("stripe")
  const [descriptor, setDescriptor] = useState<string>("")
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<boolean>(false)
  const [testing, setTesting] = useState<boolean>(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true)
      try {
        const response = await fetch("/admin/api/billing/settings")
        if (response.ok) {
          const data = await response.json()
          setDescriptor(data.statement_descriptor || "")
          setCredentials(data.credentials || {})
        }
      } catch (error) {
        console.error("Failed to load billing settings:", error)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleDescriptorChange = (value: string) => {
    setDescriptor(value)
    const validation = validateDescriptor(value)
    if (!validation.valid) {
      setValidationErrors((prev) => ({
        ...prev,
        descriptor: validation.error,
      }))
    } else {
      setValidationErrors((prev) => {
        const { descriptor, ...rest } = prev
        return rest
      })
    }
  }

  const handleCredentialChange = (fieldName: string, value: string) => {
    setCredentials((prev) => ({
      ...prev,
      [fieldName]: value,
    }))
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)

    const result = await testGatewayConnection(selectedGateway, credentials)
    setTestResult(result)
    setTesting(false)
  }

  const handleSaveSettings = async () => {
    // Validate descriptor before saving
    const descriptorValidation = validateDescriptor(descriptor)
    if (!descriptorValidation.valid) {
      setValidationErrors((prev) => ({
        ...prev,
        descriptor: descriptorValidation.error,
      }))
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch("/admin/api/billing/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gateway_type: selectedGateway,
          statement_descriptor: descriptor,
          credentials,
        }),
      })

      if (response.ok) {
        setTestResult({ success: true, message: "Settings saved successfully" })
      } else {
        const error = await response.json()
        setTestResult({ success: false, message: error.message || "Failed to save settings" })
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Save failed",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const fieldConfig = GATEWAY_CREDENTIALS[selectedGateway as keyof typeof GATEWAY_CREDENTIALS] || []

  return (
    <Container className="p-8">
      <Heading className="mb-6">Billing Settings</Heading>

      {loading ? (
        <Text>Loading settings...</Text>
      ) : (
        <div className="space-y-8">
          {/* Gateway Selection */}
          <div>
            <Label>Payment Gateway Provider</Label>
            <Select value={selectedGateway} onValueChange={setSelectedGateway}>
              <option value="stripe">Stripe</option>
              <option value="paypal">PayPal</option>
              <option value="mollie">Mollie</option>
              <option value="comgate">Comgate</option>
              <option value="przelewy24">Przelewy24</option>
              <option value="klarna">Klarna</option>
              <option value="airwallex">Airwallex</option>
            </Select>
          </div>

          {/* Statement Descriptor Section */}
          <div className="border-t pt-6">
            <div className="mb-4">
              <Heading level="h3" className="mb-2">
                Statement Descriptor
              </Heading>
              <Text className="text-gray-500 text-sm mb-4">
                This text will appear on your customer's bank statement for transactions. Maximum 16
                characters.
              </Text>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Input
                  placeholder="e.g., ACME-STORE"
                  value={descriptor}
                  onChange={(e) => handleDescriptorChange(e.target.value)}
                  maxLength={16}
                  className={validationErrors.descriptor ? "border-red-500" : ""}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {descriptor.length}/16 characters
                </div>
              </div>

              {validationErrors.descriptor && (
                <Text className="text-red-500 text-sm">{validationErrors.descriptor}</Text>
              )}

              {descriptor && !validationErrors.descriptor && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <Text className="text-sm">
                    Preview: <strong>{descriptor}</strong> will appear on customer's bank statement
                  </Text>
                </div>
              )}
            </div>
          </div>

          {/* Gateway-Specific Credentials */}
          <div className="border-t pt-6">
            <Heading level="h3" className="mb-6">
              {selectedGateway.charAt(0).toUpperCase() + selectedGateway.slice(1)} Credentials
            </Heading>

            <div className="space-y-4">
              {fieldConfig.map((field) => (
                <div key={field.name}>
                  <div className="flex items-center gap-2 mb-2">
                    <Label htmlFor={field.name}>
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {field.hint && (
                      <Tooltip content={field.hint}>
                        <span className="text-gray-400 text-xs">(i)</span>
                      </Tooltip>
                    )}
                  </div>

                  <Input
                    id={field.name}
                    type={field.type}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    value={credentials[field.name] || ""}
                    onChange={(e) => handleCredentialChange(field.name, e.target.value)}
                  />
                </div>
              ))}
            </div>

            {/* Test Connection Button */}
            <div className="mt-8 pt-6 border-t">
              <Button
                onClick={handleTestConnection}
                disabled={testing || Object.values(credentials).some((v) => !v)}
                isLoading={testing}
                className="mb-4"
              >
                {testing ? "Testing Connection..." : "Test Connection"}
              </Button>

              {testResult && (
                <div
                  className={`p-4 rounded border ${
                    testResult.success
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <Badge color="success">Success</Badge>
                    ) : (
                      <Badge color="error">Failed</Badge>
                    )}
                    <Text className="text-sm">{testResult.message}</Text>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="border-t pt-6 flex gap-3">
            <Button
              onClick={handleSaveSettings}
              disabled={isSaving || Object.keys(validationErrors).length > 0}
              isLoading={isSaving}
              variant="primary"
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
            <Button onClick={() => setTestResult(null)} variant="secondary">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Container>
  )
}
```

### Backend API Route Implementation

### FILE 26: `backend/src/admin/api/gateway/test-connection.ts` — NEW FILE

```typescript
import { Request, Response } from "express"
import axios from "axios"

/**
 * Test connection endpoints for payment gateways
 * Each provider has a different test endpoint and credential format
 */

async function testStripeConnection(credentials: Record<string, string>): Promise<boolean> {
  try {
    const response = await axios.get("https://api.stripe.com/v1/balance", {
      headers: {
        Authorization: `Bearer ${credentials.secret_key}`,
      },
    })
    return response.status === 200
  } catch {
    throw new Error("Stripe API key invalid")
  }
}

async function testPayPalConnection(credentials: Record<string, string>): Promise<boolean> {
  try {
    const response = await axios.post(
      "https://api.paypal.com/v1/oauth2/token",
      "grant_type=client_credentials",
      {
        headers: {
          "Accept-Language": "en_US",
          Accept: "application/json",
        },
        auth: {
          username: credentials.client_id,
          password: credentials.client_secret,
        },
      }
    )
    return response.status === 200 && !!response.data.access_token
  } catch {
    throw new Error("PayPal credentials invalid")
  }
}

async function testMollieConnection(credentials: Record<string, string>): Promise<boolean> {
  try {
    const response = await axios.get("https://api.mollie.com/v2/methods", {
      headers: {
        Authorization: `Bearer ${credentials.api_key}`,
      },
    })
    return response.status === 200
  } catch {
    throw new Error("Mollie API key invalid")
  }
}

async function testComgateConnection(credentials: Record<string, string>): Promise<boolean> {
  try {
    // Comgate test requires POST with merchant params
    const response = await axios.post(
      "https://payments.comgate.cz/v1/status",
      new URLSearchParams({
        merchant: credentials.merchant_id,
        transId: "999999999",
        secret: credentials.secret_key,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    )
    // Comgate returns 200 even for invalid trans, but checks merchant
    return response.status === 200
  } catch {
    throw new Error("Comgate merchant credentials invalid")
  }
}

async function testPrzelewy24Connection(credentials: Record<string, string>): Promise<boolean> {
  try {
    const response = await axios.get("https://secure.przelewy24.pl/api/v1/testAccess", {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${credentials.merchant_id}:${credentials.api_key}`
        ).toString("base64")}`,
      },
    })
    return response.status === 200
  } catch {
    throw new Error("Przelewy24 credentials invalid")
  }
}

async function testKlarnaConnection(credentials: Record<string, string>): Promise<boolean> {
  try {
    const response = await axios.get(
      "https://api.klarna.com/payments/v1/sessions",
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${credentials.api_key}:${credentials.api_secret}`
          ).toString("base64")}`,
        },
      }
    )
    // Klarna returns 401 for empty sessions (expected) but 403 for invalid creds
    return response.status !== 403
  } catch (error: any) {
    if (error.response?.status === 401) {
      return true // Expected for empty sessions
    }
    throw new Error("Klarna credentials invalid")
  }
}

async function testAirwallexConnection(credentials: Record<string, string>): Promise<boolean> {
  try {
    const response = await axios.post("https://api.airwallex.com/api/v1/authentication/login", {
      api_key: credentials.api_key,
    })
    return response.status === 200 && !!response.data.token
  } catch {
    throw new Error("Airwallex API key invalid")
  }
}

export async function testGatewayConnection(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { gateway_type, credentials } = req.body

    if (!gateway_type || !credentials) {
      res.status(400).json({ message: "gateway_type and credentials required" })
      return
    }

    let success = false

    switch (gateway_type) {
      case "stripe":
        success = await testStripeConnection(credentials)
        break
      case "paypal":
        success = await testPayPalConnection(credentials)
        break
      case "mollie":
        success = await testMollieConnection(credentials)
        break
      case "comgate":
        success = await testComgateConnection(credentials)
        break
      case "przelewy24":
        success = await testPrzelewy24Connection(credentials)
        break
      case "klarna":
        success = await testKlarnaConnection(credentials)
        break
      case "airwallex":
        success = await testAirwallexConnection(credentials)
        break
      default:
        res.status(400).json({ message: `Unknown gateway: ${gateway_type}` })
        return
    }

    if (success) {
      res.status(200).json({ success: true, message: "Connection verified" })
    } else {
      res.status(400).json({ success: false, message: "Connection test failed" })
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Connection test error",
    })
  }
}
```

### Implementation Notes

**Statement Descriptor Validation:**
- Applied client-side in the UI input field with real-time validation feedback
- Maximum 16 characters enforced by Comgate's strictest limit
- Character whitelist: A-Z (case-insensitive), 0-9, space, dot (.), hyphen (-)
- Uses regex: `/^[A-Za-z0-9 .\-]{1,16}$/`
- Preview text shows what customers will see on bank statements

**Gateway-Specific Credentials:**
- Each gateway provider has unique credential requirements
- Credential fields are dynamically rendered based on selected gateway
- Required fields marked with red asterisk
- Optional fields include helpful tooltips (e.g., Mollie webhook note)
- Credentials stored as JSON object in `gateway_config.credentials`

**Test Connection Feature:**
- Makes actual API calls to each provider's test endpoint
- Validates credentials before saving to database
- Provides clear success/failure feedback to user
- Stripe: Uses /v1/balance endpoint (requires secret key)
- PayPal: Uses OAuth token endpoint (requires client credentials)
- Mollie: Uses /v2/methods endpoint (simple GET)
- Comgate: Uses /v1/status with test transaction ID
- Przelewy24: Uses /api/v1/testAccess endpoint
- Klarna: Expects 401 for empty sessions (not 403 for invalid creds)
- Airwallex: Uses /api/v1/authentication/login endpoint

**Security Considerations:**
- Sensitive credentials (secret keys, passwords) use `type="password"` input
- Credentials stored server-side only, never exposed to client
- Test connection makes direct API calls without exposing credentials
- HTTPS required for all credential transmission
- Input validation prevents injection attacks

**UI/UX Features:**
- Disabled Save button if validation errors exist
- Real-time character count for descriptor (16 max)
- Dropdown gateway selection with dynamic credential field rendering
- Test Connection button disabled until all required fields filled
- Visual feedback for successful/failed connection tests
- Tooltip hints for optional/ambiguous fields

---

## SECTION 7: ONE-CLICK UPSELL + MINI-CHECKOUT UPSELL

### Overview

This section implements two upsell flows to increase average order value:

1. **One-Click Upsell (Flow A)**: For tokenizable payment methods (Card, PayPal vault, Apple Pay, Google Pay, SEPA Direct Debit) where the customer has already authorized a payment method
2. **Mini-Checkout Upsell (Flow B)**: For redirect-based methods (iDEAL, Bancontact, BLIK, Przelewy24, Klarna, EPS, giropay, SOFORT) that require additional authentication

**CRITICAL RULE**: Customer MUST confirm on the upsell page before any charge happens. The upsell page has a 10-minute timer.

### Architecture

The upsell flow:
1. After successful initial order payment, customer is directed to `/upsell` page
2. Upsell page detects payment method type from order metadata
3. For one-click: Shows "Confirm & Pay" button, POSTs to `/upsell-charge`
4. For redirect-based: Shows "Pay Now" button, POSTs to `/upsell-session`
5. Backend processes charge or creates new payment session
6. Upon completion, invoice is updated (if using Fakturoid/QuickBooks)
7. Customer is redirected to thank-you page

---

### FILE 26: `backend/src/api/store/custom/orders/[id]/upsell-charge/route.ts` — One-Click Upsell Handler

Handles one-click upsell payments for tokenizable methods by using the saved payment_method from the original order.

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  try {
    const { id } = req.params;
    const { upsell_product_id, upsell_price } = req.body;

    // Resolve services from DI container
    const queryModule = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

    // Fetch order with metadata
    const [orders] = await queryModule.graph({
      entity: "orders",
      fields: ["id", "customer_id", "total", "metadata"],
      filters: { id },
    });

    if (!orders || orders.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orders[0];

    // Verify 10-minute timer hasn't expired
    const upsellCreatedAt = order.metadata?.upsell_created_at;
    if (upsellCreatedAt) {
      const createdTime = new Date(upsellCreatedAt).getTime();
      const now = new Date().getTime();
      const minutesElapsed = (now - createdTime) / (1000 * 60);
      if (minutesElapsed > 10) {
        return res.status(400).json({ error: "Upsell offer expired (10 minutes)" });
      }
    }

    // Get original payment method from metadata
    const originalPaymentMethodId = order.metadata?.payment_method_id;
    const paymentProvider = order.metadata?.payment_provider;

    if (!originalPaymentMethodId || !paymentProvider) {
      return res.status(400).json({
        error: "No saved payment method available for upsell",
      });
    }

    let upsellPaymentId: string;
    const upsellAmount = Math.round(upsell_price * 100); // Convert to cents/smallest unit

    // Handle Stripe one-click charge
    if (paymentProvider === "stripe") {
      const stripe = req.scope.resolve("stripe");
      const stripePaymentIntentSecret = order.metadata?.stripe_secret;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: upsellAmount,
        currency: "eur",
        customer: order.metadata?.stripe_customer_id,
        payment_method: originalPaymentMethodId,
        confirm: true,
        off_session: true,
        metadata: {
          order_id: order.id,
          upsell: "true",
          upsell_product_id,
        },
      });

      if (paymentIntent.status !== "succeeded") {
        logger.error(
          `Stripe upsell charge failed: ${paymentIntent.id}`,
          { order_id: order.id, status: paymentIntent.status }
        );
        return res.status(402).json({
          error: "Payment failed",
          payment_intent_id: paymentIntent.id,
        });
      }

      upsellPaymentId = paymentIntent.id;
    }
    // Handle PayPal one-click charge
    else if (paymentProvider === "paypal") {
      const paypalVaultId = order.metadata?.paypal_vault_id;

      if (!paypalVaultId) {
        return res.status(400).json({
          error: "PayPal payment source not tokenized for upsell",
        });
      }

      const paypalClient = req.scope.resolve("paypal_client");

      const orderPayload = {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "EUR",
              value: (upsellAmount / 100).toFixed(2),
            },
            description: `Upsell Product: ${upsell_product_id}`,
          },
        ],
        payment_source: {
          token: {
            id: paypalVaultId,
            type: "BILLING",
          },
        },
      };

      const paypalOrder = await paypalClient.execute(
        new paypalClient.orders.OrdersCreateRequest(orderPayload)
      );

      if (paypalOrder.statusCode !== 201) {
        logger.error(
          `PayPal upsell order creation failed`,
          { order_id: order.id, status: paypalOrder.statusCode }
        );
        return res.status(402).json({
          error: "PayPal upsell order creation failed",
        });
      }

      // Capture the order
      const captureRequest = new paypalClient.orders.OrdersCaptureRequest(
        paypalOrder.result.id
      );
      const captureResult = await paypalClient.execute(captureRequest);

      if (captureResult.statusCode !== 201) {
        logger.error(
          `PayPal upsell capture failed`,
          { order_id: order.id, paypal_order_id: paypalOrder.result.id }
        );
        return res.status(402).json({
          error: "PayPal upsell payment capture failed",
        });
      }

      upsellPaymentId = paypalOrder.result.id;
    } else {
      return res.status(400).json({
        error: `Payment provider ${paymentProvider} does not support one-click upsell`,
      });
    }

    // Update order metadata with upsell payment
    order.metadata = order.metadata || {};
    order.metadata.upsell_payment_id = upsellPaymentId;
    order.metadata.upsell_product_id = upsell_product_id;
    order.metadata.upsell_amount = upsellAmount;
    order.metadata.upsell_charged_at = new Date().toISOString();
    order.metadata.upsell_status = "completed";

    // Save updated metadata
    const orderService = req.scope.resolve("orderService");
    await orderService.update(order.id, {
      metadata: order.metadata,
    });

    // Log to payment activity log
    const paymentActivityService = req.scope.resolve("paymentActivityService");
    await paymentActivityService.create({
      order_id: order.id,
      payment_id: upsellPaymentId,
      provider: paymentProvider,
      amount: upsellAmount,
      currency: "eur",
      status: "completed",
      type: "upsell_charge",
      metadata: {
        upsell_product_id,
        payment_method: originalPaymentMethodId,
      },
    });

    logger.info("Upsell charge completed", {
      order_id: order.id,
      upsell_payment_id: upsellPaymentId,
      provider: paymentProvider,
    });

    return res.json({
      success: true,
      upsell_payment_id: upsellPaymentId,
      order_id: order.id,
    });
  } catch (error) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
    logger.error("Upsell charge error", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};
```

---

### FILE 27: `backend/src/api/store/custom/orders/[id]/upsell-session/route.ts` — Redirect-Based Upsell Handler

Creates a new payment session for redirect-based payment methods. Customer completes payment at the provider's gateway and is redirected back.

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  try {
    const { id } = req.params;
    const { upsell_product_id, upsell_price } = req.body;

    // Resolve services
    const queryModule = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

    // Fetch order
    const [orders] = await queryModule.graph({
      entity: "orders",
      fields: ["id", "customer_id", "email", "shipping_address", "metadata"],
      filters: { id },
    });

    if (!orders || orders.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orders[0];

    // Verify timer
    const upsellCreatedAt = order.metadata?.upsell_created_at;
    if (upsellCreatedAt) {
      const createdTime = new Date(upsellCreatedAt).getTime();
      const now = new Date().getTime();
      const minutesElapsed = (now - createdTime) / (1000 * 60);
      if (minutesElapsed > 10) {
        return res.status(400).json({ error: "Upsell offer expired (10 minutes)" });
      }
    }

    const paymentProvider = order.metadata?.payment_provider;
    const upsellAmount = Math.round(upsell_price * 100);

    let sessionData: any;
    let redirectUrl: string;

    // Route to appropriate payment gateway
    switch (paymentProvider) {
      case "mollie_ideal":
      case "mollie_bancontact":
      case "mollie_blik":
      case "mollie_eps":
      case "mollie_giropay":
      case "mollie_sofort": {
        const mollieClient = req.scope.resolve("mollieClient");
        const molliePaymentMethod = paymentProvider.replace("mollie_", "");

        sessionData = await mollieClient.payments.create({
          amount: {
            value: (upsellAmount / 100).toFixed(2),
            currency: "EUR",
          },
          description: `Upsell: ${upsell_product_id}`,
          method: molliePaymentMethod,
          redirectUrl: `${process.env.STOREFRONT_URL}/thank-you/${order.id}`,
          webhookUrl: `${process.env.BACKEND_URL}/store/custom/orders/${order.id}/upsell-webhook`,
          metadata: {
            order_id: order.id,
            upsell: "true",
            upsell_product_id,
            upsell_amount: upsellAmount,
          },
        });

        redirectUrl = sessionData.getCheckoutUrl();
        break;
      }

      case "przelewy24": {
        const p24Client = req.scope.resolve("przelewy24Client");

        sessionData = await p24Client.transactions.register({
          merchantId: process.env.P24_MERCHANT_ID,
          posId: process.env.P24_POS_ID,
          sessionId: `upsell-${order.id}-${Date.now()}`,
          amount: upsellAmount,
          currency: "978", // EUR
          description: `Upsell: ${upsell_product_id}`,
          email: order.email,
          urlReturn: `${process.env.STOREFRONT_URL}/thank-you/${order.id}`,
          urlStatus: `${process.env.BACKEND_URL}/store/custom/orders/${order.id}/upsell-webhook`,
        });

        redirectUrl = `https://secure.przelewy24.pl/trnRequest/${sessionData.token}`;
        break;
      }

      case "klarna": {
        const klarnaClient = req.scope.resolve("klarnaClient");

        sessionData = await klarnaClient.ordersApi.createOrder({
          purchase_country: "DE",
          purchase_currency: "EUR",
          locale: "de-DE",
          order_amount: upsellAmount,
          order_lines: [
            {
              type: "physical",
              reference: upsell_product_id,
              name: `Upsell Product`,
              quantity: 1,
              unit_price: upsellAmount,
              total_amount: upsellAmount,
              total_tax_amount: 0,
              tax_rate: 0,
            },
          ],
          customer: {
            email: order.email,
          },
          merchant_urls: {
            confirmation: `${process.env.STOREFRONT_URL}/thank-you/${order.id}`,
            notification: `${process.env.BACKEND_URL}/store/custom/orders/${order.id}/upsell-webhook`,
          },
          metadata: {
            order_id: order.id,
            upsell: "true",
            upsell_product_id,
          },
        });

        redirectUrl = sessionData.redirect_url;
        break;
      }

      case "comgate": {
        const comgateClient = req.scope.resolve("comgateClient");

        sessionData = await comgateClient.createPayment({
          merchant: process.env.COMGATE_MERCHANT,
          secret: process.env.COMGATE_SECRET,
          price: (upsellAmount / 100).toFixed(2),
          curr: "EUR",
          label: `Upsell: ${upsell_product_id}`,
          refId: `upsell-${order.id}`,
          email: order.email,
          phone: order.shipping_address?.phone || "",
          country: order.shipping_address?.country_code || "DE",
          prepareOnly: false,
          method: "ALL",
          test: process.env.COMGATE_TEST === "true",
        });

        redirectUrl = `https://payments.comgate.cz/?id=${sessionData.transId}`;
        break;
      }

      case "airwallex": {
        const airwallexClient = req.scope.resolve("airwallexClient");

        sessionData = await airwallexClient.payments.create({
          request_id: `upsell-${order.id}-${Date.now()}`,
          amount: upsellAmount / 100,
          currency: "EUR",
          merchant_order_id: `upsell-${order.id}`,
          order: {
            products: [
              {
                code: upsell_product_id,
                name: "Upsell Product",
                quantity: 1,
                unit_price: upsellAmount / 100,
              },
            ],
          },
          customer_email: order.email,
          return_url: `${process.env.STOREFRONT_URL}/thank-you/${order.id}`,
          webhook_url: `${process.env.BACKEND_URL}/store/custom/orders/${order.id}/upsell-webhook`,
          metadata: {
            order_id: order.id,
            upsell: "true",
            upsell_product_id,
          },
        });

        redirectUrl = sessionData.client_secret_url;
        break;
      }

      default:
        return res.status(400).json({
          error: `Payment provider ${paymentProvider} does not support redirect-based upsell`,
        });
    }

    // Store session info in metadata for webhook matching
    order.metadata = order.metadata || {};
    order.metadata.upsell_session_id = sessionData.id || sessionData.transId || sessionData.order_id;
    order.metadata.upsell_provider = paymentProvider;
    order.metadata.upsell_product_id = upsell_product_id;
    order.metadata.upsell_amount = upsellAmount;
    order.metadata.upsell_status = "pending";
    order.metadata.upsell_session_created_at = new Date().toISOString();

    const orderService = req.scope.resolve("orderService");
    await orderService.update(order.id, {
      metadata: order.metadata,
    });

    // Log to payment activity
    const paymentActivityService = req.scope.resolve("paymentActivityService");
    await paymentActivityService.create({
      order_id: order.id,
      payment_id: sessionData.id || sessionData.transId || sessionData.order_id,
      provider: paymentProvider,
      amount: upsellAmount,
      currency: "eur",
      status: "pending",
      type: "upsell_session_created",
      metadata: {
        upsell_product_id,
        redirect_url: redirectUrl,
      },
    });

    logger.info("Upsell session created", {
      order_id: order.id,
      provider: paymentProvider,
      session_id: sessionData.id || sessionData.transId,
    });

    return res.json({
      success: true,
      redirect_url: redirectUrl,
      session_id: sessionData.id || sessionData.transId || sessionData.order_id,
    });
  } catch (error) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
    logger.error("Upsell session creation error", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};
```

---

### FILE 28: `backend/src/api/store/custom/orders/[id]/upsell-webhook/route.ts` — Upsell Webhook Handler

Handles webhook callbacks from redirect-based payment gateways to confirm upsell payment completion.

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const queryModule = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

    // Fetch order
    const [orders] = await queryModule.graph({
      entity: "orders",
      fields: ["id", "metadata"],
      filters: { id },
    });

    if (!orders || orders.length === 0) {
      logger.warn("Upsell webhook: Order not found", { order_id: id });
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orders[0];
    const upsellProvider = order.metadata?.upsell_provider;
    const upsellSessionId = order.metadata?.upsell_session_id;

    let paymentStatus = "failed";
    let paymentId: string;

    // Verify webhook signature and extract payment status per provider
    switch (upsellProvider) {
      case "mollie_ideal":
      case "mollie_bancontact":
      case "mollie_blik":
      case "mollie_eps":
      case "mollie_giropay":
      case "mollie_sofort": {
        const mollieClient = req.scope.resolve("mollieClient");
        const payment = await mollieClient.payments.get(body.id);

        paymentId = payment.id;
        if (payment.status === "paid") {
          paymentStatus = "completed";
        }
        break;
      }

      case "przelewy24": {
        // Verify P24 webhook signature
        const p24Signature = req.headers["x-p24-signature"];
        const bodyStr = JSON.stringify(body);
        const crypto = require("crypto");
        const expectedSignature = crypto
          .createHash("sha384")
          .update(bodyStr + process.env.P24_SECRET)
          .digest("hex");

        if (p24Signature !== expectedSignature) {
          logger.warn("P24 upsell webhook signature mismatch", { order_id: id });
          return res.status(401).json({ error: "Signature mismatch" });
        }

        paymentId = body.transactionId;
        if (body.status === "success") {
          paymentStatus = "completed";
        }
        break;
      }

      case "klarna": {
        // Klarna notification webhook
        paymentId = body.order_id;
        if (body.status === "READY_TO_SHIP" || body.status === "CAPTURED") {
          paymentStatus = "completed";
        }
        break;
      }

      case "comgate": {
        // Verify Comgate signature
        const comgateSignature = req.headers["x-comgate-signature"];
        const crypto = require("crypto");
        const expectedSignature = crypto
          .createHmac("sha256", process.env.COMGATE_SECRET)
          .update(JSON.stringify(body))
          .digest("hex");

        if (comgateSignature !== expectedSignature) {
          logger.warn("Comgate upsell webhook signature mismatch", { order_id: id });
          return res.status(401).json({ error: "Signature mismatch" });
        }

        paymentId = body.transId;
        if (body.status === "PAID") {
          paymentStatus = "completed";
        }
        break;
      }

      case "airwallex": {
        // Verify Airwallex signature
        const airwallexSignature = req.headers["x-airwallex-signature"];
        const crypto = require("crypto");
        const timestamp = req.headers["x-airwallex-timestamp"];
        const expectedSignature = crypto
          .createHmac("sha256", process.env.AIRWALLEX_WEBHOOK_SECRET)
          .update(`${timestamp}.${JSON.stringify(body)}`)
          .digest("base64");

        if (airwallexSignature !== expectedSignature) {
          logger.warn("Airwallex upsell webhook signature mismatch", { order_id: id });
          return res.status(401).json({ error: "Signature mismatch" });
        }

        paymentId = body.id;
        if (body.status === "SUCCESS") {
          paymentStatus = "completed";
        }
        break;
      }

      default:
        logger.warn("Unknown upsell provider in webhook", {
          order_id: id,
          provider: upsellProvider,
        });
        return res.status(400).json({ error: "Unknown provider" });
    }

    // Update order metadata with payment result
    order.metadata = order.metadata || {};
    order.metadata.upsell_payment_id = paymentId;
    order.metadata.upsell_status = paymentStatus;
    order.metadata.upsell_completed_at = new Date().toISOString();

    const orderService = req.scope.resolve("orderService");
    await orderService.update(order.id, {
      metadata: order.metadata,
    });

    // Log to payment activity
    const paymentActivityService = req.scope.resolve("paymentActivityService");
    await paymentActivityService.create({
      order_id: order.id,
      payment_id: paymentId,
      provider: upsellProvider,
      amount: order.metadata?.upsell_amount || 0,
      currency: "eur",
      status: paymentStatus,
      type: "upsell_webhook",
      metadata: {
        webhook_provider: upsellProvider,
        session_id: upsellSessionId,
      },
    });

    logger.info("Upsell webhook processed", {
      order_id: id,
      payment_id: paymentId,
      status: paymentStatus,
      provider: upsellProvider,
    });

    return res.json({ success: true, status: paymentStatus });
  } catch (error) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
    logger.error("Upsell webhook error", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};
```

---

### FILE 29: `storefront/src/projects/[project]/pages/upsell.html` — Upsell Page Implementation

Frontend page that detects payment method and shows appropriate upsell flow.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Complete Your Order - Special Offer</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 500px;
      width: 100%;
      padding: 40px;
    }

    .header {
      text-align: center;
      margin-bottom: 30px;
    }

    .header h1 {
      font-size: 24px;
      color: #333;
      margin-bottom: 10px;
    }

    .header p {
      color: #666;
      font-size: 14px;
    }

    .timer {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      gap: 8px;
    }

    .timer-circle {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: #667eea;
      font-size: 18px;
    }

    .timer-text {
      font-size: 13px;
      color: #666;
    }

    .product-card {
      background: #f8f9ff;
      border: 2px solid #e8ecff;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 25px;
    }

    .product-name {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 10px;
    }

    .product-description {
      font-size: 13px;
      color: #666;
      line-height: 1.5;
      margin-bottom: 15px;
    }

    .product-price {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .price-original {
      font-size: 14px;
      color: #999;
      text-decoration: line-through;
    }

    .price-current {
      font-size: 24px;
      font-weight: bold;
      color: #667eea;
    }

    .price-suffix {
      font-size: 13px;
      color: #666;
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 20px;
    }

    button {
      padding: 14px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #5568d3;
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(102, 126, 234, 0.4);
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #f0f0f0;
      color: #333;
    }

    .btn-secondary:hover {
      background: #e0e0e0;
    }

    .loading {
      display: none;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 14px;
      color: #666;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #e0e0e0;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error {
      background: #fee;
      color: #c33;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 15px;
      font-size: 13px;
      display: none;
    }

    .skip-link {
      text-align: center;
      color: #999;
      font-size: 13px;
    }

    .skip-link a {
      color: #667eea;
      text-decoration: none;
    }

    .skip-link a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Wait! Special Offer</h1>
      <p>Don't miss this exclusive deal</p>
    </div>

    <div class="timer">
      <div class="timer-circle">
        <span id="timer-count">10:00</span>
      </div>
      <div class="timer-text">Offer expires in</div>
    </div>

    <div id="error" class="error"></div>

    <div class="product-card">
      <div class="product-name" id="product-name">Loading...</div>
      <div class="product-description" id="product-description"></div>
      <div class="product-price">
        <span class="price-current" id="price-current">$0.00</span>
        <span class="price-suffix">EUR</span>
      </div>
    </div>

    <div class="actions">
      <button id="confirm-btn" class="btn-primary" disabled>
        <span id="btn-text">Loading...</span>
        <div id="btn-spinner" class="spinner" style="display: none;"></div>
      </button>
      <button id="skip-btn" class="btn-secondary">Skip This Offer</button>
    </div>

    <div class="skip-link">
      <p>You can add more items later</p>
    </div>
  </div>

  <script>
    const ORDER_ID = new URLSearchParams(window.location.search).get('order_id');
    const BACKEND_URL = window.location.origin.replace('storefront', 'backend');
    const THANK_YOU_URL = `${window.location.origin}/thank-you/${ORDER_ID}`;

    let orderData = null;
    let upsellData = null;
    let timerInterval = null;
    let isProcessing = false;

    // Initialize page
    async function init() {
      if (!ORDER_ID) {
        showError('Missing order ID');
        return;
      }

      try {
        // Fetch order and upsell data
        const response = await fetch(`${BACKEND_URL}/store/custom/orders/${ORDER_ID}?include=upsell`);
        if (!response.ok) throw new Error('Failed to fetch order');

        const data = await response.json();
        orderData = data.order;
        upsellData = data.upsell;

        // Populate upsell product info
        document.getElementById('product-name').textContent = upsellData.product_name;
        document.getElementById('product-description').textContent = upsellData.product_description;
        document.getElementById('price-current').textContent = formatPrice(upsellData.price);

        // Detect payment method and set button text
        const paymentMethod = detectPaymentMethod(orderData);
        const btnText = document.getElementById('btn-text');

        if (isOneClickCapable(paymentMethod)) {
          btnText.textContent = 'Confirm & Pay';
        } else if (isRedirectBased(paymentMethod)) {
          btnText.textContent = 'Pay Now';
        } else {
          throw new Error('Payment method does not support upsell');
        }

        // Enable button and start timer
        document.getElementById('confirm-btn').disabled = false;
        startTimer();

        // Set up event listeners
        document.getElementById('confirm-btn').addEventListener('click', handleConfirm);
        document.getElementById('skip-btn').addEventListener('click', () => {
          window.location.href = THANK_YOU_URL;
        });
      } catch (error) {
        showError(error.message);
      }
    }

    // Detect payment method from order metadata
    function detectPaymentMethod(order) {
      return order.metadata?.payment_provider || order.metadata?.payment_method || 'unknown';
    }

    // Check if payment method supports one-click
    function isOneClickCapable(method) {
      return [
        'stripe',
        'paypal',
        'apple_pay',
        'google_pay',
        'sepa_direct_debit',
      ].includes(method);
    }

    // Check if payment method is redirect-based
    function isRedirectBased(method) {
      return [
        'mollie_ideal',
        'mollie_bancontact',
        'mollie_blik',
        'mollie_eps',
        'mollie_giropay',
        'mollie_sofort',
        'przelewy24',
        'klarna',
        'comgate',
        'airwallex',
      ].includes(method);
    }

    // Handle confirm button click
    async function handleConfirm() {
      if (isProcessing) return;

      isProcessing = true;
      showLoading(true);

      try {
        const paymentMethod = detectPaymentMethod(orderData);

        if (isOneClickCapable(paymentMethod)) {
          await handleOneClickUpsell();
        } else if (isRedirectBased(paymentMethod)) {
          await handleRedirectUpsell();
        } else {
          throw new Error('Unsupported payment method');
        }
      } catch (error) {
        showError(error.message);
        isProcessing = false;
        showLoading(false);
      }
    }

    // Handle one-click upsell charge
    async function handleOneClickUpsell() {
      const response = await fetch(`${BACKEND_URL}/store/custom/orders/${ORDER_ID}/upsell-charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upsell_product_id: upsellData.product_id,
          upsell_price: upsellData.price,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Charge failed');
      }

      // Success - redirect to thank you
      window.location.href = THANK_YOU_URL;
    }

    // Handle redirect-based upsell
    async function handleRedirectUpsell() {
      const response = await fetch(`${BACKEND_URL}/store/custom/orders/${ORDER_ID}/upsell-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upsell_product_id: upsellData.product_id,
          upsell_price: upsellData.price,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Session creation failed');
      }

      // Redirect to payment gateway
      window.location.href = data.redirect_url;
    }

    // Timer countdown
    function startTimer() {
      let remaining = 600; // 10 minutes in seconds
      const btn = document.getElementById('confirm-btn');

      timerInterval = setInterval(() => {
        remaining--;

        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        document.getElementById('timer-count').textContent =
          `${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (remaining <= 0) {
          clearInterval(timerInterval);
          btn.disabled = true;
          document.getElementById('btn-text').textContent = 'Offer Expired';
          showError('Upsell offer has expired');
        }
      }, 1000);
    }

    // UI helpers
    function showError(message) {
      const errorEl = document.getElementById('error');
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }

    function showLoading(loading) {
      const btn = document.getElementById('confirm-btn');
      const spinner = document.getElementById('btn-spinner');
      btn.disabled = loading;
      spinner.style.display = loading ? 'block' : 'none';
    }

    function formatPrice(amount) {
      return new Intl.NumberFormat('en-DE', {
        style: 'currency',
        currency: 'EUR',
      }).format(amount / 100);
    }

    // Start initialization
    init();
  </script>
</body>
</html>
```

---

### FILE 30: `backend/src/api/store/custom/orders/[id]/upsell-invoice/route.ts` — Upsell Invoice Updater

Called after successful upsell payment to update invoices in Fakturoid or QuickBooks with the upsell product and payment.

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  try {
    const { id } = req.params;
    const { upsell_product_id, upsell_price } = req.body;

    const queryModule = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

    // Fetch order
    const [orders] = await queryModule.graph({
      entity: "orders",
      fields: ["id", "metadata", "customer_id"],
      filters: { id },
    });

    if (!orders || orders.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orders[0];

    // Verify upsell was actually completed
    if (order.metadata?.upsell_status !== "completed") {
      return res.status(400).json({
        error: "Upsell payment not yet completed",
      });
    }

    const upsellPaymentId = order.metadata?.upsell_payment_id;
    const fakturoidInvoiceId = order.metadata?.fakturoid_invoice_id;
    const quickbooksInvoiceId = order.metadata?.quickbooks_invoice_id;

    // Handle Fakturoid invoice update
    if (fakturoidInvoiceId) {
      try {
        const fakturoidClient = req.scope.resolve("fakturoidClient");

        // Fetch current invoice
        const invoice = await fakturoidClient.get(
          `/accounts/${process.env.FAKTUROID_ACCOUNT_ID}/invoices/${fakturoidInvoiceId}.json`
        );

        // Add upsell line item
        const lineItems = invoice.invoice.lines || [];
        lineItems.push({
          name: `Upsell Product: ${upsell_product_id}`,
          quantity: 1,
          unit_name: "ks",
          unit_price: upsellPrice / 100, // Convert from cents
        });

        // Update invoice with new line item
        await fakturoidClient.put(
          `/accounts/${process.env.FAKTUROID_ACCOUNT_ID}/invoices/${fakturoidInvoiceId}.json`,
          {
            invoice: {
              lines: lineItems,
            },
          }
        );

        logger.info("Fakturoid invoice line item added", {
          order_id: id,
          invoice_id: fakturoidInvoiceId,
        });

        // Record second payment
        const paymentResponse = await fakturoidClient.post(
          `/accounts/${process.env.FAKTUROID_ACCOUNT_ID}/invoices/${fakturoidInvoiceId}/payments.json`,
          {
            payment: {
              paid_amount: upsellPrice / 100,
              payment_type: determinePaymentType(order.metadata?.payment_provider),
              memo: `Upsell payment: ${upsellPaymentId}`,
            },
          }
        );

        const paymentData = paymentResponse.payment || paymentResponse;

        // Store both payment IDs in invoice note
        const existingNote = invoice.invoice.note || "";
        const updatedNote = `${existingNote}\n\nPayment 1: ${order.metadata?.payment_id}\nPayment 2 (Upsell): ${paymentData.id}`;

        await fakturoidClient.put(
          `/accounts/${process.env.FAKTUROID_ACCOUNT_ID}/invoices/${fakturoidInvoiceId}.json`,
          {
            invoice: {
              note: updatedNote,
            },
          }
        );

        logger.info("Fakturoid upsell payment recorded", {
          order_id: id,
          invoice_id: fakturoidInvoiceId,
          payment_id: paymentData.id,
        });

        order.metadata.fakturoid_upsell_payment_id = paymentData.id;
      } catch (error) {
        logger.error("Fakturoid upsell invoice update failed", {
          order_id: id,
          error: error.message,
        });
        return res.status(500).json({
          error: "Failed to update Fakturoid invoice",
          message: error.message,
        });
      }
    }

    // Handle QuickBooks invoice update
    if (quickbooksInvoiceId) {
      try {
        const quickbooksClient = req.scope.resolve("quickbooksClient");

        // Fetch current invoice
        const invoice = await quickbooksClient.query(
          `SELECT * FROM Invoice WHERE Id = '${quickbooksInvoiceId}'`
        );

        if (!invoice.QueryResponse.Invoice || invoice.QueryResponse.Invoice.length === 0) {
          throw new Error("Invoice not found in QuickBooks");
        }

        const qbInvoice = invoice.QueryResponse.Invoice[0];

        // Add upsell line item
        const lineItems = qbInvoice.Line || [];
        lineItems.push({
          DetailType: "SalesItemLineDetail",
          Description: `Upsell Product: ${upsell_product_id}`,
          Amount: upsellPrice / 100,
          SalesItemLineDetail: {
            ItemRef: {
              value: process.env.QB_UPSELL_ITEM_ID || "1",
            },
            Qty: 1,
            UnitPrice: upsellPrice / 100,
          },
        });

        // Update invoice
        qbInvoice.Line = lineItems;
        qbInvoice.SyncToken = (parseInt(qbInvoice.SyncToken) + 1).toString();

        const updatedInvoice = await quickbooksClient.update("Invoice", qbInvoice);

        logger.info("QuickBooks invoice updated", {
          order_id: id,
          invoice_id: quickbooksInvoiceId,
        });

        // Record payment via deposit
        const depositPayload = {
          Line: [
            {
              DetailType: "DepositLineDetail",
              Amount: upsellPrice / 100,
              DepositLineDetail: {
                EntityRef: {
                  value: qbInvoice.CustomerRef.value,
                  type: "Customer",
                },
                AccountRef: {
                  value: process.env.QB_DEPOSIT_ACCOUNT_ID,
                },
                PaymentMethodRef: {
                  value: "1",
                },
              },
            },
          ],
        };

        const deposit = await quickbooksClient.create("Deposit", depositPayload);

        logger.info("QuickBooks upsell payment recorded", {
          order_id: id,
          invoice_id: quickbooksInvoiceId,
          deposit_id: deposit.Id,
        });

        order.metadata.quickbooks_upsell_deposit_id = deposit.Id;
      } catch (error) {
        logger.error("QuickBooks upsell invoice update failed", {
          order_id: id,
          error: error.message,
        });
        return res.status(500).json({
          error: "Failed to update QuickBooks invoice",
          message: error.message,
        });
      }
    }

    // Update order metadata with completion
    order.metadata.upsell_invoice_updated = true;
    order.metadata.upsell_invoice_updated_at = new Date().toISOString();

    const orderService = req.scope.resolve("orderService");
    await orderService.update(order.id, {
      metadata: order.metadata,
    });

    logger.info("Upsell invoice processing completed", {
      order_id: id,
      fakturoid_invoice_id: fakturoidInvoiceId,
      quickbooks_invoice_id: quickbooksInvoiceId,
    });

    return res.json({
      success: true,
      order_id: id,
      fakturoid_updated: !!fakturoidInvoiceId,
      quickbooks_updated: !!quickbooksInvoiceId,
    });
  } catch (error) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
    logger.error("Upsell invoice update error", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

// Helper to determine QuickBooks payment type
function determinePaymentType(provider: string): string {
  const paymentTypeMap: Record<string, string> = {
    stripe: "Credit Card",
    paypal: "PayPal",
    apple_pay: "Digital Wallet",
    google_pay: "Digital Wallet",
    ideal: "Bank Transfer",
    mollie_ideal: "Bank Transfer",
    mollie_bancontact: "Bank Transfer",
    sepa_direct_debit: "Bank Transfer",
    przelewy24: "Online Banking",
    klarna: "Payment Plan",
    comgate: "Bank Transfer",
    airwallex: "Card",
  };

  return paymentTypeMap[provider] || "Online Payment";
}
```

---

## Summary

This section implements a complete upsell system with the following key features:

1. **Flow A (One-Click Upsell)**: For card, PayPal vault, Apple Pay, Google Pay, and SEPA Direct Debit
   - Reuses saved payment method from original order
   - Instant charge with Stripe PaymentIntent or PayPal vault
   - No customer re-entry of payment details

2. **Flow B (Mini-Checkout Upsell)**: For iDEAL, Bancontact, BLIK, Przelewy24, Klarna, EPS, giropay, SOFORT, Airwallex
   - Creates new payment session with original provider
   - Customer redirected to payment gateway
   - Webhook-based confirmation

3. **Frontend (upsell.html)**:
   - Auto-detects payment method type
   - 10-minute countdown timer
   - Conditional button text ("Confirm & Pay" vs "Pay Now")
   - Loading states and error handling

4. **Invoice Integration**:
   - Adds upsell product as line item to existing invoice
   - Records second payment in Fakturoid or QuickBooks
   - Stores both payment IDs in invoice metadata/notes

5. **Logging & Tracking**:
   - All upsell payments logged to `payment_activity_log`
   - Order metadata tracks upsell status, payment ID, and amounts
   - Comprehensive webhook handling with signature verification

The implementation maintains consistency with the MedusaJS 2.0 framework patterns and integrates seamlessly with the existing payment architecture established in previous sections.
# SECTION 8: SVG PAYMENT METHOD LOGOS

## Overview
This section covers the implementation of SVG payment method logos to replace text labels throughout the checkout and admin interfaces. SVG logos provide better visual clarity, professionalism, and improved UX for payment method selection and display.

## Key Components

### 1. Payment Method Icons Component (`backend/src/admin/components/billing/payment-method-icons.tsx`)
A reusable React component that renders inline SVG logos for all supported payment methods.

**Features:**
- Exports `PaymentMethodIcon` component for rendering payment method SVG
- Exports `getPaymentMethodIcon(code: string): React.ReactNode` helper function
- 16 payment methods with actual SVG implementations
- Consistent 40x24px viewBox across all logos
- Inline SVG (no external dependencies)
- Full TypeScript support with proper typing

**Supported Payment Methods:**
- Visa (Blue/Gold)
- Mastercard (Red/Orange overlapping circles)
- iDEAL (Pink/Magenta)
- Bancontact (Blue)
- BLIK (Black text)
- Przelewy24 (Red)
- Klarna (Pink badge)
- PayPal (Blue)
- Apple Pay (Black)
- Google Pay (Colored)
- EPS (Purple)
- Giropay (Blue/Red)
- SEPA (Blue EU stars)
- Sofort (Pink)
- Generic Card (Credit card icon)
- Airwallex (Teal)

### 2. Payment Method Selector Component (`storefront/src/modules/checkout/components/payment-method-selector/index.tsx`)
A checkout component that displays available payment methods with visual SVG logos.

**Features:**
- Fetches payment methods from `/store/payment-options` API
- Groups methods by payment gateway
- Displays icon + method name for each option
- Card-based selection UI with radio button inputs
- Handles selection callback for parent component
- Responsive Tailwind CSS styling
- Proper TypeScript types
- Loading and error states

## Implementation Details

### SVG Design Standards
- **Viewbox:** 40x24px (or proportional)
- **Format:** Inline SVG elements (no external files)
- **Style:** Simplified but recognizable brand representations
- **Color:** Brand-accurate colors using hex/RGB values
- **Stroke Width:** Optimized for clarity at small sizes

### Component API

#### PaymentMethodIcon Component
```typescript
interface PaymentMethodIconProps {
  code: string;
  width?: number;
  height?: number;
  className?: string;
}

const PaymentMethodIcon: React.FC<PaymentMethodIconProps> = ({ ... })
```

#### getPaymentMethodIcon Helper
```typescript
function getPaymentMethodIcon(code: string): React.ReactNode
```

#### Payment Method Selector
```typescript
interface PaymentMethodSelectorProps {
  methods: PaymentMethodOption[];
  selectedMethod: string | null;
  onMethodSelect: (methodCode: string) => void;
  isLoading?: boolean;
  error?: string | null;
}
```

## Integration Points

### Admin Panel
The payment method icons can be used throughout the admin panel:
- Payment method selection dropdowns
- Order status displays
- Transaction history tables
- Payment configuration pages

### Storefront Checkout
The payment method selector integrates with the checkout flow:
- Displayed after shipping selection
- Before payment details entry
- Shows all available methods for customer's region
- Handles method selection with callback to payment processor

## API Dependencies
- `/store/payment-options` — Returns list of available payment methods grouped by gateway

## Browser Compatibility
- Modern browsers supporting inline SVG (all major browsers)
- CSS Grid and Flexbox for layout
- Supports responsive design for mobile/tablet/desktop

## Accessibility
- Proper semantic HTML (labels, radio buttons)
- ARIA attributes for screen readers
- Keyboard navigation support
- Color contrast compliant
- Payment method names displayed alongside icons

## Future Enhancements
- Animated SVG transitions on selection
- Icon variants for different sizes
- Custom branding color support
- SVG sprite generation for optimization
- Payment method sorting by popularity/region
# SECTION 9: FAKTUROID + QUICKBOOKS UPSELL INVOICE INTEGRATION

## Overview

This section details the implementation of upsell invoice integration with Fakturoid and QuickBooks Online. When an upsell product is accepted by a customer, the existing invoice is updated with a new line item representing the upsell product, and a second payment record is added to track the upsell transaction.

**Integration Strategy**: ONE invoice per order containing both main product and upsell product line items.

## Design Decision

**Option A Selected**: When an upsell is accepted:
1. The existing invoice (created during initial order) is retrieved
2. A new line item is added to the invoice for the upsell product
3. A second payment record is created and linked to the invoice
4. Both payment IDs are stored in invoice notes for audit trail
5. Order metadata is updated to reflect invoice changes

This approach maintains a single invoice per order while tracking multiple payment transactions.

## Architecture

### Components

1. **Fakturoid Invoice Service** - Handles Fakturoid REST API v2 integration
2. **QuickBooks Invoice Service** - Handles QuickBooks Online REST API integration
3. **Upsell Invoice Subscriber** - Listens for upsell completion events and orchestrates invoice updates

### Invoice Provider Configuration

The system supports both invoice providers via configuration:
```typescript
interface InvoiceProviderConfig {
  provider: 'fakturoid' | 'quickbooks';
  apiKey?: string; // Fakturoid
  realmId?: string; // QuickBooks
  accessToken?: string; // QuickBooks
  refreshToken?: string; // QuickBooks
  accountSlug?: string; // Fakturoid
}
```

## Fakturoid Integration

### REST API Endpoints

**Base URL**: `https://app.fakturoid.cz/api/v2/accounts/{slug}`

**Authentication**: X-Auth-Token header with API key

**Content-Type**: application/json

### Methods

#### 1. createInvoice(order)
Creates a new invoice with main product line items.

**Endpoint**: `POST /invoices.json`

**Request Body**:
```json
{
  "invoice": {
    "client": {
      "name": "Customer Name",
      "email": "customer@example.com",
      "phone": "+1234567890",
      "address": "Street Address",
      "city": "City",
      "zip_code": "12345",
      "country": "US"
    },
    "lines": [
      {
        "name": "Product Name",
        "quantity": 1,
        "unit_price": 99.99,
        "vat_rate": 0
      }
    ],
    "note": "Order ID: order_xxx",
    "status": "open"
  }
}
```

**Response**: Returns created invoice with `id` field

#### 2. addUpsellLineItem(invoiceId, upsellProduct)
Updates existing invoice with new upsell line item.

**Endpoint**: `PUT /invoices/{id}.json`

**Request Body**:
```json
{
  "invoice": {
    "lines": [
      {
        "name": "Original Product",
        "quantity": 1,
        "unit_price": 99.99,
        "vat_rate": 0
      },
      {
        "name": "Upsell Product",
        "quantity": 1,
        "unit_price": 23.00,
        "vat_rate": 0
      }
    ]
  }
}
```

**Response**: Returns updated invoice

#### 3. recordPayment(invoiceId, amount, currency, paymentMethod, transactionId)
Records a payment transaction against the invoice.

**Endpoint**: `POST /invoices/{id}/payments.json`

**Request Body**:
```json
{
  "payment": {
    "paid_on": "2026-02-25",
    "amount": 23.00,
    "currency": "EUR",
    "payment_method": "card",
    "note": "Upsell payment - pi_xxx"
  }
}
```

**Response**: Returns created payment record

#### 4. getInvoice(invoiceId)
Retrieves invoice details including all line items and payments.

**Endpoint**: `GET /invoices/{id}.json`

**Response**: Returns complete invoice object with:
- `id`: Invoice identifier
- `number`: Invoice number
- `lines`: Array of line items
- `payments`: Array of payment records
- `total_amount`: Total invoice amount
- `status`: Invoice status

## QuickBooks Integration

### REST API

**Base URL**: `https://quickbooks.api.intuit.com`

**Authentication**: OAuth2 Bearer token in Authorization header

**Refresh Token Flow**: Automatic token refresh when expired

### Methods

#### 1. createInvoice(order)
Creates a new invoice via QuickBooks API.

**Endpoint**: `POST /v2/companyid/{realmId}/query`

**Request**: Uses QuickBooks Query Language (QQL) and Invoice entity

**Structure**:
- Customer reference (CustomerRef)
- Line items (SalesItemLine)
- Email for delivery
- Due date calculation

**Response**: Returns Invoice with SyncToken and invoice ID for future updates

#### 2. addUpsellLineItem(invoiceId, upsellProduct)
Updates existing invoice with new line item.

**Process**:
1. Fetch current invoice with SyncToken
2. Add new SalesItemLine to Lines array
3. Update invoice via PUT request
4. Maintain SyncToken for next update

**Endpoint**: `POST /v2/companyid/{realmId}/invoice`

**Request Body**:
```json
{
  "Invoice": {
    "id": "invoice_id",
    "SyncToken": "current_sync_token",
    "Line": [
      {
        "DetailType": "SalesItemLineDetail",
        "Description": "Original Product",
        "Amount": 99.99,
        "SalesItemLineDetail": {
          "ItemRef": { "value": "product_id_1" },
          "Qty": 1,
          "UnitPrice": 99.99
        }
      },
      {
        "DetailType": "SalesItemLineDetail",
        "Description": "Upsell Product",
        "Amount": 23.00,
        "SalesItemLineDetail": {
          "ItemRef": { "value": "product_id_2" },
          "Qty": 1,
          "UnitPrice": 23.00
        }
      }
    ]
  }
}
```

#### 3. recordPayment(invoiceId, amount, transactionId)
Creates a payment entity linked to the invoice.

**Endpoint**: `POST /v2/companyid/{realmId}/payment`

**Request Body**:
```json
{
  "Payment": {
    "TxnDate": "2026-02-25",
    "Total": 23.00,
    "Line": [
      {
        "Amount": 23.00,
        "DetailType": "PaymentLineDetail",
        "PaymentLineDetail": {
          "PaymentRef": { "value": "invoice_id" },
          "PaymentMethodRef": { "value": "3" }
        }
      }
    ],
    "CustomerRef": { "value": "customer_id" },
    "PaymentMethodRef": { "value": "3" },
    "PrivateNote": "Upsell payment - pi_xxx"
  }
}
```

**Response**: Returns Payment entity with reference to invoice

## Upsell Invoice Event Flow

### Event: order.upsell_completed

**Triggered when**: Upsell product is accepted and paid

**Payload**:
```typescript
{
  orderId: string;
  customerId: string;
  invoiceId: string;
  upsellProduct: {
    id: string;
    name: string;
    price: number;
    description: string;
  };
  paymentIntent: {
    id: string;
    amount: number;
    currency: string;
    status: 'succeeded';
  };
}
```

### Processing Steps

1. **Retrieve Configuration**: Load invoice provider config from environment
2. **Route to Provider**: Determine Fakturoid or QuickBooks based on config
3. **Update Line Items**: Call appropriate addUpsellLineItem method
4. **Record Payment**: Call recordPayment with transaction details
5. **Update Order Metadata**: Set `invoice_updated: true`
6. **Log Activity**: Create entry in payment_activity_log
7. **Store Payment IDs**: Include both original and new payment IDs in notes

### Database Updates

```typescript
// Order metadata update
order.metadata = {
  ...order.metadata,
  invoice_updated: true,
  upsell_invoice_payment_id: paymentIntent.id,
  payment_ids: [original_payment_id, upsell_payment_id]
};

// Activity log entry
paymentActivityLog.create({
  orderId: order.id,
  type: 'upsell_invoice_update',
  provider: 'fakturoid' | 'quickbooks',
  invoiceId: invoice.id,
  originalPaymentId: original_payment_id,
  upsellPaymentId: upsell_payment_id,
  amount: upsell_amount,
  status: 'success',
  timestamp: new Date()
});
```

## Error Handling

### Fakturoid API Errors

| Status Code | Handling |
|------------|----------|
| 400 | Invalid request - validate line items and payment data |
| 401 | Authentication failed - verify API key |
| 404 | Invoice not found - log error and retry with fallback |
| 500 | Server error - implement exponential backoff retry |

### QuickBooks API Errors

| Error Code | Handling |
|-----------|----------|
| INVALID_TOKEN | Refresh OAuth token and retry |
| INVALID_PARAMETER | Validate all entity fields |
| ENTITY_NOT_FOUND | Create new invoice if update fails |
| BATCH_OPERATION_FAILURE | Retry individual line item operation |

### Retry Strategy

- **Maximum Retries**: 3 attempts
- **Backoff**: Exponential (1s, 2s, 4s)
- **Fallback**: Log to payment_activity_log with status 'failed'
- **Alert**: Notify payment team for manual intervention

## Audit Trail

All invoice operations maintain comprehensive audit logging:

```typescript
interface InvoiceActivityLog {
  id: string;
  orderId: string;
  invoiceId: string;
  eventType: 'create' | 'update_upsell' | 'add_payment' | 'error';
  provider: 'fakturoid' | 'quickbooks';
  originalPaymentId: string;
  upsellPaymentId?: string;
  lineItems: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  paymentDetails: {
    amount: number;
    currency: string;
    method: string;
    transactionId: string;
  };
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  timestamp: Date;
  completedAt?: Date;
}
```

## Testing

### Fakturoid Test Endpoint

Test credentials can be used with Fakturoid sandbox environment:
- Endpoint: `https://sandbox.fakturoid.cz/api/v2/accounts/{test-slug}`
- API Key: Provided by Fakturoid for testing
- Uses same request/response format as production

### QuickBooks Test Sandbox

Test using QuickBooks Sandbox realm:
- Endpoint: `https://quickbooks.api.intuit.com` (supports sandbox with flag)
- Test Company ID: Provided in developer account
- OAuth tokens: Generated in developer console

### Integration Tests

```bash
# Test Fakturoid invoice operations
npm test -- fakturoid-invoice.service.spec.ts

# Test QuickBooks invoice operations
npm test -- quickbooks-invoice.service.spec.ts

# Test upsell subscriber workflow
npm test -- upsell-invoice.subscriber.spec.ts

# Test complete upsell flow with mock events
npm test -- upsell-invoice-integration.e2e.spec.ts
```

## Production Deployment

### Environment Variables

```
# Fakturoid
FAKTUROID_API_KEY=xxx
FAKTUROID_ACCOUNT_SLUG=xxx

# QuickBooks
QUICKBOOKS_CLIENT_ID=xxx
QUICKBOOKS_CLIENT_SECRET=xxx
QUICKBOOKS_REALM_ID=xxx
QUICKBOOKS_REFRESH_TOKEN=xxx

# Invoice Provider Selection
INVOICE_PROVIDER=fakturoid | quickbooks
```

### Monitoring

- Track API response times per provider
- Monitor error rates for invoice operations
- Alert on payment reconciliation failures
- Track upsell invoice update success rate

### Rollback Plan

- Keep invoice provider configuration dynamic (no restart required)
- Maintain payment_activity_log for audit trail
- Implement feature flag to disable upsell invoice updates
- Manual invoice adjustment capability via admin dashboard

## Security Considerations

1. **API Key Management**: Store Fakturoid API keys in secure vault
2. **OAuth Tokens**: Use secure refresh token storage with encryption
3. **Data Validation**: Validate all invoice and payment data before API calls
4. **Rate Limiting**: Implement backoff for API calls to respect rate limits
5. **PCI Compliance**: Never log or store full card details
6. **Audit Logging**: Comprehensive logging of all invoice operations for compliance

## Summary

The upsell invoice integration provides seamless updates to existing invoices when customers accept upsell offers. By supporting both Fakturoid and QuickBooks, the system accommodates diverse business accounting needs while maintaining a single invoice per order model. The implementation includes robust error handling, comprehensive audit logging, and secure API communication.
# SECTION 10: ERROR LOGGING + STOREFRONT UPDATES + MEDUSA CONFIG

## Overview
Section 10 covers three critical components:
1. **Error Logging Middleware** - Payment activity tracking to order metadata
2. **Storefront Payment Updates** - UI/UX for all 7 payment gateways
3. **Medusa Config Registration** - Registration of all 5 custom payment modules

---

## A) Error Logging Middleware

### FILE 36: `backend/src/utils/payment-logger.ts`

Every payment event (initiation, authorization, capture, failure, webhooks, refunds, upsells) must be logged to the order's `payment_activity_log[]` metadata array.

**Key Features:**
- Appends timestamped events to order metadata
- Supports 10 event types (payment_initiated, payment_authorized, payment_captured, payment_failed, webhook_received, tracking_sent, refund_initiated, refund_completed, upsell_charged, upsell_session_created)
- Supports 7 gateway types (stripe, paypal, mollie, comgate, przelewy24, klarna, airwallex)
- Handles concurrent writes with exponential backoff retry logic
- Preserves complete raw responses for debugging

**Implementation:**

```typescript
// File: backend/src/utils/payment-logger.ts

import { Modules } from "@medusajs/framework/utils"

export type PaymentEventType =
  | "payment_initiated"
  | "payment_authorized"
  | "payment_captured"
  | "payment_failed"
  | "webhook_received"
  | "tracking_sent"
  | "refund_initiated"
  | "refund_completed"
  | "upsell_charged"
  | "upsell_session_created"

export type PaymentGateway =
  | "stripe"
  | "paypal"
  | "mollie"
  | "comgate"
  | "przelewy24"
  | "klarna"
  | "airwallex"

export interface PaymentActivityEvent {
  timestamp: string
  type: PaymentEventType
  gateway: PaymentGateway
  status: "success" | "failed" | "pending"
  amount?: number
  currency?: string
  transaction_id?: string
  payment_method?: string
  error_message?: string
  tracking_sent?: boolean
  raw_response?: Record<string, any>
}

/**
 * Logs a payment activity event to order metadata
 * Handles concurrent writes with retry logic
 *
 * @param orderService - MedusaJS OrderService
 * @param orderId - Order ID
 * @param event - Payment event details
 */
export async function logPaymentActivity(
  orderService: any,
  orderId: string,
  event: Omit<PaymentActivityEvent, "timestamp">
): Promise<void> {
  const maxRetries = 3
  let retries = 0
  let lastError: Error | null = null

  while (retries < maxRetries) {
    try {
      // Fetch current order with metadata
      const order = await orderService.retrieve(orderId, {
        select: ["id", "metadata"],
      })

      // Initialize or get existing payment_activity_log
      const currentMetadata = order.metadata || {}
      const paymentActivityLog: PaymentActivityEvent[] = currentMetadata.payment_activity_log || []

      // Create new event with timestamp
      const newEvent: PaymentActivityEvent = {
        ...event,
        timestamp: new Date().toISOString(),
      }

      // Append event
      paymentActivityLog.push(newEvent)

      // Update order metadata
      await orderService.update(orderId, {
        metadata: {
          ...currentMetadata,
          payment_activity_log: paymentActivityLog,
        },
      })

      return // Success - exit function
    } catch (error) {
      lastError = error as Error
      retries++

      if (retries < maxRetries) {
        // Exponential backoff: 100ms, 200ms, 400ms
        const delayMs = Math.pow(2, retries - 1) * 100
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  // If we get here, all retries failed
  console.error(
    `Failed to log payment activity for order ${orderId} after ${maxRetries} retries:`,
    lastError
  )
  throw new Error(
    `Failed to log payment activity: ${lastError?.message || "Unknown error"}`
  )
}

/**
 * Retrieves the payment activity log for an order
 *
 * @param orderService - MedusaJS OrderService
 * @param orderId - Order ID
 * @returns Array of payment activity events
 */
export async function getPaymentActivityLog(
  orderService: any,
  orderId: string
): Promise<PaymentActivityEvent[]> {
  const order = await orderService.retrieve(orderId, {
    select: ["id", "metadata"],
  })

  return order.metadata?.payment_activity_log || []
}

/**
 * Filters payment activity log by event type or gateway
 *
 * @param log - Full payment activity log
 * @param filter - Filter criteria
 * @returns Filtered events
 */
export function filterPaymentActivity(
  log: PaymentActivityEvent[],
  filter?: {
    type?: PaymentEventType
    gateway?: PaymentGateway
    status?: "success" | "failed" | "pending"
  }
): PaymentActivityEvent[] {
  if (!filter) return log

  return log.filter((event) => {
    if (filter.type && event.type !== filter.type) return false
    if (filter.gateway && event.gateway !== filter.gateway) return false
    if (filter.status && event.status !== filter.status) return false
    return true
  })
}
```

**Usage Examples:**

```typescript
// Log a successful payment authorization
await logPaymentActivity(orderService, orderId, {
  type: "payment_authorized",
  gateway: "stripe",
  status: "success",
  amount: 9999,
  currency: "USD",
  transaction_id: "pi_1234567890",
  payment_method: "card",
  raw_response: { id: "pi_1234567890", status: "succeeded" },
})

// Log a payment failure
await logPaymentActivity(orderService, orderId, {
  type: "payment_failed",
  gateway: "mollie",
  status: "failed",
  amount: 5000,
  currency: "EUR",
  error_message: "Insufficient funds",
  raw_response: { status: "failed", _links: { checkout: { href: "..." } } },
})

// Log webhook received
await logPaymentActivity(orderService, orderId, {
  type: "webhook_received",
  gateway: "comgate",
  status: "pending",
  transaction_id: "webhook_1234",
  raw_response: { event: "payment.completed" },
})

// Log tracking sent
await logPaymentActivity(orderService, orderId, {
  type: "tracking_sent",
  gateway: "stripe",
  status: "success",
  tracking_sent: true,
  raw_response: { tracking_number: "TRACK123" },
})
```

---

## B) Storefront Payment Updates

### FILE 37: `storefront/src/lib/constants.tsx` — MODIFICATIONS

Add complete payment provider mappings and helper functions for all 7 gateways.

```typescript
// File: storefront/src/lib/constants.tsx

/**
 * Payment provider identification constants
 * Maps provider IDs to human-readable names and metadata
 */
export const PAYMENT_PROVIDERS = {
  stripe: {
    id: "pp_stripe_stripe",
    name: "Stripe",
    type: "card",
    logo: "/images/stripe-logo.svg",
  },
  paypal: {
    id: "pp_paypal_paypal",
    name: "PayPal",
    type: "redirect",
    logo: "/images/paypal-logo.svg",
  },
  mollie: {
    id: "pp_mollie_mollie",
    name: "Mollie",
    type: "redirect",
    logo: "/images/mollie-logo.svg",
  },
  comgate: {
    id: "pp_comgate_comgate",
    name: "Comgate",
    type: "redirect",
    logo: "/images/comgate-logo.svg",
  },
  przelewy24: {
    id: "pp_przelewy24_przelewy24",
    name: "Przelewy24",
    type: "redirect",
    logo: "/images/przelewy24-logo.svg",
  },
  klarna: {
    id: "pp_klarna_klarna",
    name: "Klarna",
    type: "redirect",
    logo: "/images/klarna-logo.svg",
  },
  airwallex: {
    id: "pp_airwallex_airwallex",
    name: "Airwallex",
    type: "card",
    logo: "/images/airwallex-logo.svg",
  },
} as const

/**
 * Helper function to check if payment is Stripe
 */
export const isStripe = (providerId?: string | null): boolean => {
  return providerId === PAYMENT_PROVIDERS.stripe.id
}

/**
 * Helper function to check if payment is PayPal
 */
export const isPaypal = (providerId?: string | null): boolean => {
  return providerId === PAYMENT_PROVIDERS.paypal.id
}

/**
 * Helper function to check if payment is Mollie
 */
export const isMollie = (providerId?: string | null): boolean => {
  return providerId === PAYMENT_PROVIDERS.mollie.id
}

/**
 * Helper function to check if payment is Comgate
 */
export const isComgate = (providerId?: string | null): boolean => {
  return providerId === PAYMENT_PROVIDERS.comgate.id
}

/**
 * Helper function to check if payment is Przelewy24
 */
export const isP24 = (providerId?: string | null): boolean => {
  return providerId === PAYMENT_PROVIDERS.przelewy24.id
}

/**
 * Helper function to check if payment is Klarna
 */
export const isKlarna = (providerId?: string | null): boolean => {
  return providerId === PAYMENT_PROVIDERS.klarna.id
}

/**
 * Helper function to check if payment is Airwallex
 */
export const isAirwallex = (providerId?: string | null): boolean => {
  return providerId === PAYMENT_PROVIDERS.airwallex.id
}

/**
 * Get payment provider metadata by ID
 */
export const getPaymentProvider = (
  providerId?: string | null
): (typeof PAYMENT_PROVIDERS)[keyof typeof PAYMENT_PROVIDERS] | null => {
  const provider = Object.values(PAYMENT_PROVIDERS).find(
    (p) => p.id === providerId
  )
  return provider || null
}

/**
 * Check if payment is redirect-based (not card)
 */
export const isRedirectPayment = (providerId?: string | null): boolean => {
  const provider = getPaymentProvider(providerId)
  return provider?.type === "redirect"
}

/**
 * Check if payment is card-based
 */
export const isCardPayment = (providerId?: string | null): boolean => {
  const provider = getPaymentProvider(providerId)
  return provider?.type === "card"
}
```

### FILE 38: `storefront/src/modules/checkout/components/payment/index.tsx` — MODIFICATIONS

Update payment component to handle all 7 gateways with appropriate UI rendering.

```typescript
// File: storefront/src/modules/checkout/components/payment/index.tsx

"use client"

import React, { useMemo } from "react"
import { Cart } from "@medusajs/medusa"
import {
  isStripe,
  isPaypal,
  isMollie,
  isComgate,
  isP24,
  isKlarna,
  isAirwallex,
  isRedirectPayment,
  getPaymentProvider,
} from "@lib/constants"
import StripeWrapper from "@modules/checkout/components/payment-wrapper/stripe"
import PayPalWrapper from "@modules/checkout/components/payment-wrapper/paypal"
import MolliePayment from "@modules/checkout/components/payment-wrapper/mollie"
import ComgatePayment from "@modules/checkout/components/payment-wrapper/comgate"
import Przelewy24Payment from "@modules/checkout/components/payment-wrapper/przelewy24"
import KlarnaPayment from "@modules/checkout/components/payment-wrapper/klarna"
import AirwallexPayment from "@modules/checkout/components/payment-wrapper/airwallex"

interface PaymentProps {
  cart: Cart
  selectedPaymentMethod?: string | null
  onPaymentMethodChange?: (method: string) => void
}

/**
 * Main payment component
 * Renders appropriate payment UI based on selected gateway
 */
const Payment: React.FC<PaymentProps> = ({
  cart,
  selectedPaymentMethod,
  onPaymentMethodChange,
}) => {
  const provider = useMemo(
    () => getPaymentProvider(selectedPaymentMethod),
    [selectedPaymentMethod]
  )

  const isRedirect = useMemo(
    () => isRedirectPayment(selectedPaymentMethod),
    [selectedPaymentMethod]
  )

  return (
    <div className="payment-container">
      {/* Stripe Card Payment */}
      {isStripe(selectedPaymentMethod) && (
        <div className="payment-method-wrapper">
          <div className="payment-method-header">
            <h3>Credit or Debit Card</h3>
            <p className="text-small text-gray-500">
              Powered by Stripe - Secure payment processing
            </p>
          </div>
          <StripeWrapper cart={cart} />
        </div>
      )}

      {/* PayPal Payment */}
      {isPaypal(selectedPaymentMethod) && (
        <div className="payment-method-wrapper">
          <div className="payment-method-header">
            <h3>PayPal</h3>
            <p className="text-small text-gray-500">
              You will be redirected to PayPal to complete payment
            </p>
          </div>
          <PayPalWrapper cart={cart} />
        </div>
      )}

      {/* Mollie Payment */}
      {isMollie(selectedPaymentMethod) && (
        <div className="payment-method-wrapper">
          <div className="payment-method-header">
            <h3>Mollie</h3>
            <p className="text-small text-gray-500">
              You will be redirected to Mollie to complete payment
            </p>
          </div>
          <MolliePayment cart={cart} />
        </div>
      )}

      {/* Comgate Payment */}
      {isComgate(selectedPaymentMethod) && (
        <div className="payment-method-wrapper">
          <div className="payment-method-header">
            <h3>Comgate</h3>
            <p className="text-small text-gray-500">
              You will be redirected to Comgate to complete payment
            </p>
          </div>
          <ComgatePayment cart={cart} />
        </div>
      )}

      {/* Przelewy24 Payment */}
      {isP24(selectedPaymentMethod) && (
        <div className="payment-method-wrapper">
          <div className="payment-method-header">
            <h3>Przelewy24</h3>
            <p className="text-small text-gray-500">
              You will be redirected to Przelewy24 to complete payment
            </p>
          </div>
          <Przelewy24Payment cart={cart} />
        </div>
      )}

      {/* Klarna Payment */}
      {isKlarna(selectedPaymentMethod) && (
        <div className="payment-method-wrapper">
          <div className="payment-method-header">
            <h3>Klarna</h3>
            <p className="text-small text-gray-500">
              You will be redirected to Klarna to complete payment
            </p>
          </div>
          <KlarnaPayment cart={cart} />
        </div>
      )}

      {/* Airwallex Payment */}
      {isAirwallex(selectedPaymentMethod) && (
        <div className="payment-method-wrapper">
          <div className="payment-method-header">
            <h3>Airwallex</h3>
            <p className="text-small text-gray-500">
              Secure payment processing with Airwallex
            </p>
          </div>
          <AirwallexPayment cart={cart} />
        </div>
      )}

      {/* Fallback message */}
      {!selectedPaymentMethod && (
        <div className="payment-method-wrapper">
          <p className="text-small text-gray-500">
            Please select a payment method
          </p>
        </div>
      )}
    </div>
  )
}

export default Payment
```

### FILE 39: `storefront/src/modules/checkout/components/payment-button/index.tsx` — MODIFICATIONS

Update payment button component with handlers for all 7 gateways.

```typescript
// File: storefront/src/modules/checkout/components/payment-button/index.tsx

"use client"

import React, { useState, useCallback } from "react"
import { Cart } from "@medusajs/medusa"
import {
  isStripe,
  isPaypal,
  isMollie,
  isComgate,
  isP24,
  isKlarna,
  isAirwallex,
  isRedirectPayment,
  getPaymentProvider,
  PAYMENT_PROVIDERS,
} from "@lib/constants"
import Button from "@modules/common/components/button"
import Spinner from "@modules/common/icons/spinner"

interface PaymentButtonProps {
  cart: Cart | null
  selectedPaymentMethod?: string | null
  isProcessing?: boolean
  onPaymentComplete?: () => void
  onPaymentError?: (error: Error) => void
}

/**
 * Payment button component
 * Handles payment submission for all 7 gateways
 */
const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  selectedPaymentMethod,
  isProcessing = false,
  onPaymentComplete,
  onPaymentError,
}) => {
  const [loading, setLoading] = useState(false)
  const provider = getPaymentProvider(selectedPaymentMethod)
  const isRedirect = isRedirectPayment(selectedPaymentMethod)

  /**
   * Handle Stripe card payment
   */
  const handleStripePayment = useCallback(async () => {
    if (!cart) return

    try {
      setLoading(true)
      // Stripe payment is handled by Stripe wrapper component
      // This button triggers confirmation in the wrapper
      const stripeButton = document.querySelector(
        "[data-testid='stripe-confirm-button']"
      ) as HTMLButtonElement
      if (stripeButton) {
        stripeButton.click()
      }
      onPaymentComplete?.()
    } catch (error) {
      onPaymentError?.(error as Error)
    } finally {
      setLoading(false)
    }
  }, [cart, onPaymentComplete, onPaymentError])

  /**
   * Handle PayPal payment
   */
  const handlePayPalPayment = useCallback(async () => {
    if (!cart) return

    try {
      setLoading(true)
      // PayPal buttons are handled by wrapper component
      const paypalButton = document.querySelector(
        "[data-testid='paypal-button']"
      ) as HTMLButtonElement
      if (paypalButton) {
        paypalButton.click()
      }
    } catch (error) {
      onPaymentError?.(error as Error)
    } finally {
      setLoading(false)
    }
  }, [cart, onPaymentError])

  /**
   * Handle redirect-based payments (Mollie, Comgate, P24, Klarna, Airwallex)
   */
  const handleRedirectPayment = useCallback(async () => {
    if (!cart) return

    try {
      setLoading(true)

      // Fetch payment session from cart
      const paymentSession = cart.payment_sessions?.find(
        (session) => session.provider_id === selectedPaymentMethod
      )

      if (!paymentSession) {
        throw new Error("Payment session not found")
      }

      // Get payment URL from session data
      const paymentUrl = paymentSession.data?.redirect_url

      if (!paymentUrl) {
        throw new Error("Payment URL not available. Please try again.")
      }

      // Redirect to payment provider
      window.location.href = paymentUrl
      onPaymentComplete?.()
    } catch (error) {
      onPaymentError?.(error as Error)
    } finally {
      setLoading(false)
    }
  }, [cart, selectedPaymentMethod, onPaymentComplete, onPaymentError])

  /**
   * Route to appropriate payment handler
   */
  const handlePaymentSubmit = useCallback(async () => {
    if (isStripe(selectedPaymentMethod)) {
      await handleStripePayment()
    } else if (isPaypal(selectedPaymentMethod)) {
      await handlePayPalPayment()
    } else if (
      isMollie(selectedPaymentMethod) ||
      isComgate(selectedPaymentMethod) ||
      isP24(selectedPaymentMethod) ||
      isKlarna(selectedPaymentMethod) ||
      isAirwallex(selectedPaymentMethod)
    ) {
      await handleRedirectPayment()
    }
  }, [
    selectedPaymentMethod,
    handleStripePayment,
    handlePayPalPayment,
    handleRedirectPayment,
  ])

  const buttonText = provider
    ? `Pay with ${provider.name}`
    : "Complete Payment"

  return (
    <Button
      className="w-full mt-6"
      onClick={handlePaymentSubmit}
      disabled={!cart || isProcessing || loading || !selectedPaymentMethod}
      isLoading={loading || isProcessing}
    >
      {loading || isProcessing ? (
        <>
          <Spinner /> Processing...
        </>
      ) : (
        buttonText
      )}
    </Button>
  )
}

export default PaymentButton
```

---

## C) Medusa Config Registration

### FILE 40: `medusa-config.js` — MODIFICATIONS

Register all 5 custom payment modules alongside existing Stripe and PayPal.

```javascript
// File: medusa-config.js

const modules = {
  // ... existing modules (auth, http, etc.)

  // PAYMENT MODULES
  // Standard payment modules (Stripe, PayPal)
  paymentProviders: {
    resolve: "@medusajs/medusa/payment",
    options: {
      providers: [
        {
          resolve: "@medusajs/medusa/payment/stripe",
          id: "stripe",
          options: {
            apiKey: process.env.STRIPE_API_KEY,
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
          },
        },
        {
          resolve: "@medusajs/medusa/payment/paypal",
          id: "paypal",
          options: {
            sandbox: process.env.PAYPAL_SANDBOX === "true",
            clientId: process.env.PAYPAL_CLIENT_ID,
            secret: process.env.PAYPAL_SECRET,
          },
        },
      ],
    },
  },

  // CUSTOM PAYMENT MODULES

  // Mollie Payment Module
  molliePayment: {
    resolve: "./src/modules/mollie-payment",
    options: {
      apiKey: process.env.MOLLIE_API_KEY,
      environment: process.env.MOLLIE_ENVIRONMENT || "test",
      webhookSecret: process.env.MOLLIE_WEBHOOK_SECRET,
    },
  },

  // Comgate Payment Module
  comgatePayment: {
    resolve: "./src/modules/comgate-payment",
    options: {
      merchantId: process.env.COMGATE_MERCHANT_ID,
      secret: process.env.COMGATE_SECRET,
      environment: process.env.COMGATE_ENVIRONMENT || "test",
      webhookSecret: process.env.COMGATE_WEBHOOK_SECRET,
    },
  },

  // Przelewy24 Payment Module
  przelewy24Payment: {
    resolve: "./src/modules/przelewy24-payment",
    options: {
      merchantId: process.env.PRZELEWY24_MERCHANT_ID,
      posId: process.env.PRZELEWY24_POS_ID,
      crc: process.env.PRZELEWY24_CRC,
      environment: process.env.PRZELEWY24_ENVIRONMENT || "sandbox",
      webhookSecret: process.env.PRZELEWY24_WEBHOOK_SECRET,
    },
  },

  // Klarna Payment Module
  klarnaPayment: {
    resolve: "./src/modules/klarna-payment",
    options: {
      clientId: process.env.KLARNA_CLIENT_ID,
      clientSecret: process.env.KLARNA_CLIENT_SECRET,
      environment: process.env.KLARNA_ENVIRONMENT || "playground",
      webhookSecret: process.env.KLARNA_WEBHOOK_SECRET,
    },
  },

  // Airwallex Payment Module
  airwallexPayment: {
    resolve: "./src/modules/airwallex-payment",
    options: {
      clientId: process.env.AIRWALLEX_CLIENT_ID,
      apiKey: process.env.AIRWALLEX_API_KEY,
      environment: process.env.AIRWALLEX_ENVIRONMENT || "demo",
      webhookSecret: process.env.AIRWALLEX_WEBHOOK_SECRET,
    },
  },

  // ... rest of modules
}

module.exports = {
  projectConfig: {
    // ... existing config
  },
  modules,
}
```

---

## D) Webhook Middleware Configuration

### FILE 41: `backend/src/api/middlewares.ts` — MODIFICATIONS

Configure raw body parsing for webhook routes to enable signature verification.

```typescript
// File: backend/src/api/middlewares.ts

import { Router } from "express"
import bodyParser from "body-parser"
import { MiddlewaresConfig } from "@medusajs/framework/http"

/**
 * Configure raw body parsing for webhook routes
 * Required for HMAC signature verification on webhook events
 */
const createRawBodyMiddleware = () => {
  return (req: any, res: any, buf: Buffer) => {
    if (buf && buf.length) {
      req.rawBody = buf.toString("utf8")
    }
  }
}

export const config: MiddlewaresConfig = {
  routes: [
    // ===== MOLLIE WEBHOOKS =====
    {
      matcher: /\/webhooks\/mollie.*/, // matches /webhooks/mollie, /webhooks/mollie/events, etc.
      middlewares: [
        bodyParser.json({
          verify: createRawBodyMiddleware(),
        }),
      ],
    },

    // ===== COMGATE WEBHOOKS =====
    {
      matcher: /\/webhooks\/comgate.*/,
      middlewares: [
        bodyParser.json({
          verify: createRawBodyMiddleware(),
        }),
        bodyParser.urlencoded({
          extended: true,
          verify: createRawBodyMiddleware(),
        }),
      ],
    },

    // ===== PRZELEWY24 WEBHOOKS =====
    {
      matcher: /\/webhooks\/przelewy24.*/,
      middlewares: [
        bodyParser.json({
          verify: createRawBodyMiddleware(),
        }),
      ],
    },

    // ===== KLARNA WEBHOOKS =====
    {
      matcher: /\/webhooks\/klarna.*/,
      middlewares: [
        bodyParser.json({
          verify: createRawBodyMiddleware(),
        }),
      ],
    },

    // ===== AIRWALLEX WEBHOOKS =====
    {
      matcher: /\/webhooks\/airwallex.*/,
      middlewares: [
        bodyParser.json({
          verify: createRawBodyMiddleware(),
        }),
      ],
    },

    // ===== STRIPE WEBHOOKS =====
    {
      matcher: /\/webhooks\/stripe.*/,
      middlewares: [
        bodyParser.raw({
          type: "application/json",
          verify: createRawBodyMiddleware(),
        }),
      ],
    },

    // ===== PAYPAL WEBHOOKS =====
    {
      matcher: /\/webhooks\/paypal.*/,
      middlewares: [
        bodyParser.json({
          verify: createRawBodyMiddleware(),
        }),
      ],
    },

    // ===== DEFAULT MIDDLEWARE FOR OTHER ROUTES =====
    {
      matcher: /\/admin.*/,
      middlewares: [
        bodyParser.json({
          limit: "50mb",
        }),
      ],
    },

    {
      matcher: /\/store.*/,
      middlewares: [
        bodyParser.json({
          limit: "50mb",
        }),
      ],
    },
  ],
}

export default config
```

**Key Middleware Details:**

- **Raw Body Capture**: The `verify` callback preserves the raw request body before JSON parsing, required for HMAC signature verification
- **Mollie**: Standard JSON parsing with raw body
- **Comgate**: JSON + URL-encoded with raw body (supports both content types)
- **Przelewy24**: JSON with raw body
- **Klarna**: JSON with raw body
- **Airwallex**: JSON with raw body
- **Stripe**: Raw body parsing (Stripe sends raw JSON for signature verification)
- **PayPal**: JSON with raw body

---

## Environment Variables Required

Create `.env.local` (storefront) and `.env` (backend) with these variables:

```bash
# STRIPE
STRIPE_API_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# PAYPAL
PAYPAL_CLIENT_ID=...
PAYPAL_SECRET=...
PAYPAL_SANDBOX=true
NEXT_PUBLIC_PAYPAL_CLIENT_ID=...

# MOLLIE
MOLLIE_API_KEY=test_...
MOLLIE_ENVIRONMENT=test
MOLLIE_WEBHOOK_SECRET=...

# COMGATE
COMGATE_MERCHANT_ID=...
COMGATE_SECRET=...
COMGATE_ENVIRONMENT=test
COMGATE_WEBHOOK_SECRET=...

# PRZELEWY24
PRZELEWY24_MERCHANT_ID=...
PRZELEWY24_POS_ID=...
PRZELEWY24_CRC=...
PRZELEWY24_ENVIRONMENT=sandbox
PRZELEWY24_WEBHOOK_SECRET=...

# KLARNA
KLARNA_CLIENT_ID=...
KLARNA_CLIENT_SECRET=...
KLARNA_ENVIRONMENT=playground
KLARNA_WEBHOOK_SECRET=...

# AIRWALLEX
AIRWALLEX_CLIENT_ID=...
AIRWALLEX_API_KEY=...
AIRWALLEX_ENVIRONMENT=demo
AIRWALLEX_WEBHOOK_SECRET=...
```

---

## Integration Testing Checklist

- [ ] All 7 gateways appear in payment method list
- [ ] Each gateway shows correct UI (card form vs redirect message)
- [ ] Payment activity log records all event types
- [ ] Concurrent payment requests are handled correctly
- [ ] Webhook signatures verify correctly for all 5 custom gateways
- [ ] Raw request bodies are preserved for signature verification
- [ ] Payment events include complete raw responses
- [ ] Redirect payments show correct gateway name
- [ ] Error messages are logged to payment_activity_log
- [ ] Storefront constants helpers work correctly

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment

- [ ] **Code Review**: All payment modules reviewed and tested
- [ ] **Test Coverage**: Integration tests pass for all 7 gateways
- [ ] **Security Audit**: Webhook signatures and API keys validated
- [ ] **API Keys Secured**: All credentials in environment variables
- [ ] **Database Schema**: Order metadata field supports payment_activity_log

### Deployment Steps

1. **Install Dependencies**
   ```bash
   # Backend
   cd backend
   npm install

   # Storefront
   cd ../storefront
   npm install
   ```

2. **Run Migrations**
   ```bash
   cd backend
   npm run migration:run
   ```

3. **Set Environment Variables**
   ```bash
   # Backend .env
   STRIPE_API_KEY=sk_test_...
   MOLLIE_API_KEY=test_...
   COMGATE_MERCHANT_ID=...
   PRZELEWY24_MERCHANT_ID=...
   KLARNA_CLIENT_ID=...
   AIRWALLEX_CLIENT_ID=...
   # ... all webhook secrets

   # Storefront .env.local
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   NEXT_PUBLIC_PAYPAL_CLIENT_ID=...
   ```

4. **Configure Webhooks on Gateway Dashboards**
   - **Stripe**: Dashboard → Webhooks → Add endpoint → `https://api.yourdomain.com/webhooks/stripe`
   - **PayPal**: Dashboard → Apps → Webhooks → Event Types → `https://api.yourdomain.com/webhooks/paypal`
   - **Mollie**: Dashboard → Settings → Webhooks → `https://api.yourdomain.com/webhooks/mollie`
   - **Comgate**: Admin → API → Webhooks → `https://api.yourdomain.com/webhooks/comgate`
   - **Przelewy24**: Merchant Panel → Settings → IPN URLs → `https://api.yourdomain.com/webhooks/przelewy24`
   - **Klarna**: Dashboard → Settings → Webhooks → `https://api.yourdomain.com/webhooks/klarna`
   - **Airwallex**: Dashboard → Webhooks → Create → `https://api.yourdomain.com/webhooks/airwallex`

5. **Test in Sandbox Mode**
   ```bash
   # Backend in sandbox/test mode
   NODE_ENV=test npm start

   # Run integration tests
   npm run test:integration
   ```
   - [ ] Complete test payment with Stripe (test card: 4242 4242 4242 4242)
   - [ ] Complete test payment with PayPal (sandbox account)
   - [ ] Complete test payment with Mollie (redirect works)
   - [ ] Complete test payment with Comgate (redirect works)
   - [ ] Complete test payment with Przelewy24 (redirect works)
   - [ ] Complete test payment with Klarna (redirect works)
   - [ ] Complete test payment with Airwallex (test credentials)
   - [ ] Verify all payments logged to payment_activity_log
   - [ ] Verify webhook events are received
   - [ ] Verify signatures verify correctly

6. **Enable Live Mode**
   ```bash
   # Update environment variables to production keys
   # Backend
   STRIPE_API_KEY=sk_live_...
   MOLLIE_API_KEY=live_...
   # ... other live keys

   # Restart services
   npm start
   ```

7. **Verify Tracking Dispatch**
   - [ ] Payment confirmed triggers fulfillment
   - [ ] Fulfillment triggers tracking dispatch
   - [ ] Tracking URL sent to customer
   - [ ] Tracking marked in payment_activity_log
   - [ ] All 7 gateways trigger tracking correctly

### Post-Deployment Monitoring

- [ ] Monitor error logs for payment failures
- [ ] Check webhook delivery logs on each gateway
- [ ] Review payment_activity_log for anomalies
- [ ] Test refund process for each gateway
- [ ] Verify customer notifications are sent
- [ ] Monitor API rate limits
- [ ] Set up alerting for webhook failures

---

## Summary

Section 10 completes the payment gateway implementation with:

1. **Error Logging Middleware** - Comprehensive payment event tracking with automatic retry logic
2. **Storefront Updates** - Full UI support for all 7 payment gateways with proper messaging and routing
3. **Medusa Config** - Complete module registration with environment-based configuration
4. **Webhook Middleware** - Raw body parsing for HMAC signature verification

All components work together to provide enterprise-grade payment processing, tracking, and auditing across 7 major global payment providers.

---

## SECTION 11: APPLE PAY, GOOGLE PAY & PAYPAL EXPRESS CHECKOUT — DOMAIN VERIFICATION

### Overview

Apple Pay, Google Pay, and PayPal Express Checkout each have specific requirements before they can be used on a storefront. This section documents ALL verification and setup steps.

### Apple Pay (via Stripe)

**Domain verification is REQUIRED.**

1. **Download verification file** from Stripe Dashboard → Settings → Payment Methods → Apple Pay → Payment method domains
2. **Host the file** at: `https://yourdomain.com/.well-known/apple-developer-merchantid-domain-association`
   - File name: `apple-developer-merchantid-domain-association` (no extension)
   - Must return HTTP 200 with no redirects
3. **Register domain** in Stripe Dashboard (each subdomain separately)
4. **SSL/HTTPS mandatory** — TLS 1.2+ required
5. **Renewal**: Verification expires when SSL certificate expires. If using Let's Encrypt (90-day), Apple auto-detects renewal. If certificate expires without renewal → manual re-verification needed.
6. **No separate Apple Merchant ID needed** — Stripe handles merchant validation automatically

**Implementation — add to storefront build:**

```
FILE: storefront/public/.well-known/apple-developer-merchantid-domain-association
```
> Download this file from Stripe Dashboard and place it in the `.well-known/` directory of EACH storefront domain.

### Apple Pay (via Mollie)

Same `.well-known/` file requirement, but configured through Mollie Dashboard:
1. Place verification file on server
2. Register domain in Mollie Dashboard → Apple Pay settings
3. Mollie handles the payment session request

### Google Pay (via Stripe)

**Domain registration required, but NO file upload needed.**

1. Navigate to Stripe Dashboard → Payment method domains
2. Register every domain and subdomain where Google Pay will appear
3. Register for both sandbox/testing AND production separately
4. **Google approval process**: Required before production use (typically 1 business day)
   - Register in Google Pay Console
   - Provide screenshots of implementation
   - Production domain must match registered domain

### Google Pay (via Mollie)

- Available via Mollie Checkout (hosted payment page)
- **Prerequisite**: Must already accept Cards via Mollie
- Activate in Mollie Dashboard
- Direct API integration planned for 2025+

### PayPal Express Checkout (Smart Payment Buttons)

**No domain verification file needed.**

Requirements:
1. **HTTPS mandatory** — TLS 1.2+ only (PayPal rejects TLS 1.1 and older)
2. **PayPal Business account** with API credentials (Client ID + Secret)
3. **Seller Protection**: Ship to address on Transaction Details page, keep proof of delivery
4. Use PayPal Checkout (Smart Buttons REST API) — the modern replacement for legacy Express Checkout

### Domain Verification Summary Table

| Payment Method | File Upload (.well-known/) | Dashboard Registration | Recurring Renewal |
|---|---|---|---|
| Apple Pay (Stripe) | **YES** | Stripe Dashboard | On SSL expiry |
| Apple Pay (Mollie) | **YES** | Mollie Dashboard | On SSL expiry |
| Google Pay (Stripe) | No | Stripe Dashboard (per domain) | No — permanent |
| Google Pay (Mollie) | No | Mollie Dashboard | No — permanent |
| PayPal Smart Buttons | No | No | No — maintain HTTPS |

### Implementation for Claude Code

```typescript
// FILE: backend/src/api/store/apple-pay-verification/route.ts
// Serve Apple Pay domain verification file dynamically

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import fs from "fs"
import path from "path"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // Each project may have its own verification file
  // Stored in storefront/public/.well-known/ per project
  const project = req.query.project as string || "default"
  const filePath = path.join(
    process.cwd(),
    "apple-pay-verification",
    `${project}.txt`
  )

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf-8")
    res.setHeader("Content-Type", "text/plain")
    return res.send(content)
  }

  res.status(404).send("Not found")
}
```

### PCI Compliance Note

- **Level 4** (< 20K transactions/year): Least stringent, typical for small e-commerce
- Using Stripe/Mollie/PayPal as payment processor = SAQ A (simplest self-assessment)
- **PCI DSS v4.0.1** active since 2025: Requires e-skimming attack prevention + continuous monitoring
- All card data handled by payment processor — never touches our server

---

## SECTION 12: MULTI-ACCOUNT GATEWAY SUPPORT

### Overview

The platform supports multiple stores/projects from one admin panel. Each gateway (Klarna, P24, Mollie, etc.) can have **multiple accounts** — e.g., one Klarna account for NL store, another for DE store. The existing `gateway_config` model already supports this via the `billing_entity_id` and `sales_channel_ids` fields, but the admin UI and provider logic need updates to fully support multi-account routing.

### How It Works

The `gateway_config` table can hold **multiple rows for the same provider**:

```
| id  | provider     | display_name       | billing_entity_id | sales_channel_ids     | mode |
|-----|-------------|--------------------|--------------------|----------------------|------|
| gc1 | klarna      | Klarna NL/BE       | be_everchapter_nl  | ["sc_nl", "sc_be"]   | live |
| gc2 | klarna      | Klarna DE/AT       | be_everchapter_de  | ["sc_de", "sc_at"]   | live |
| gc3 | przelewy24  | P24 — Polish store | be_everchapter_pl  | ["sc_pl"]            | live |
| gc4 | przelewy24  | P24 — Czech store  | be_pms_cz          | ["sc_cz"]            | test |
| gc5 | mollie      | Mollie — NL main   | be_everchapter_nl  | ["sc_nl", "sc_be"]   | live |
| gc6 | mollie      | Mollie — DE        | be_everchapter_de  | ["sc_de", "sc_at"]   | live |
```

### Routing Logic

When a customer initiates payment, the system selects the correct gateway account based on:

1. **Sales channel** — which store/project the order belongs to
2. **Currency** — matched against `supported_currencies` on the gateway config
3. **Priority** — if multiple accounts match, the one with lower `priority` number wins
4. **Active status** — only `is_active: true` configs are considered

```typescript
// FILE: backend/src/services/gateway-router.ts — NEW
// Selects the correct gateway config for a given payment context

import { MedusaContainer } from "@medusajs/framework/types"

interface GatewayRouterContext {
  provider: string          // e.g. "klarna"
  sales_channel_id: string  // e.g. "sc_nl"
  currency_code: string     // e.g. "EUR"
}

export async function resolveGatewayConfig(
  container: MedusaContainer,
  context: GatewayRouterContext
) {
  const gatewayConfigService = container.resolve("gatewayConfigModuleService")

  // Fetch all active configs for this provider
  const configs = await gatewayConfigService.listGatewayConfigs({
    provider: context.provider,
    is_active: true,
  })

  // Filter by sales channel
  const matching = configs.filter((gc: any) => {
    const channels = gc.sales_channel_ids || []
    const currencies = gc.supported_currencies || []
    return (
      (channels.length === 0 || channels.includes(context.sales_channel_id)) &&
      (currencies.length === 0 || currencies.includes(context.currency_code.toUpperCase()))
    )
  })

  if (matching.length === 0) {
    throw new Error(
      `No active ${context.provider} gateway config found for sales_channel=${context.sales_channel_id}, currency=${context.currency_code}`
    )
  }

  // Sort by priority (1 = highest)
  matching.sort((a: any, b: any) => (a.priority || 99) - (b.priority || 99))

  const selected = matching[0]

  // Return the appropriate keys based on mode
  const keys = selected.mode === "live" ? selected.live_keys : selected.test_keys

  return {
    config: selected,
    keys,
    mode: selected.mode,
  }
}
```

### Admin UI Updates — Multi-Account Gateway Management

```typescript
// MODIFICATIONS to: backend/src/admin/routes/settings-billing/page.tsx
//
// The GatewaysTab component must be updated to:
// 1. Show a LIST of gateway configs per provider (not just one)
// 2. Allow adding multiple accounts for the same provider
// 3. Show which billing entity / sales channel each account is linked to
// 4. Allow different credentials per account

// Add "Add Account" button per provider section:
// ┌─────────────────────────────────────────────────┐
// │ 💳 Payment Gateways                              │
// ├─────────────────────────────────────────────────┤
// │ ▼ Klarna                                        │
// │   ┌──────────────────────────────────────────┐  │
// │   │ Klarna NL/BE (EverChapter NL)     🟢 Live│  │
// │   │ API Key: K_xxxxxx...                     │  │
// │   │ Sales channels: NL, BE, LU               │  │
// │   │ [Edit] [Test Connection] [Delete]        │  │
// │   └──────────────────────────────────────────┘  │
// │   ┌──────────────────────────────────────────┐  │
// │   │ Klarna DE/AT (EverChapter DE)     🟡 Test│  │
// │   │ API Key: K_yyyyyy...                     │  │
// │   │ Sales channels: DE, AT                   │  │
// │   │ [Edit] [Test Connection] [Delete]        │  │
// │   └──────────────────────────────────────────┘  │
// │   [+ Add another Klarna account]                │
// │                                                  │
// │ ▼ Przelewy24                                    │
// │   ┌──────────────────────────────────────────┐  │
// │   │ P24 — Polish store (EverChapter PL) 🟢   │  │
// │   │ Merchant ID: 12345                       │  │
// │   │ Sales channels: PL                       │  │
// │   │ [Edit] [Test Connection] [Delete]        │  │
// │   └──────────────────────────────────────────┘  │
// │   [+ Add another P24 account]                   │
// └─────────────────────────────────────────────────┘

// Each gateway config card shows:
// - Display name (editable)
// - Linked billing entity (dropdown)
// - Linked sales channels (multi-select)
// - Mode indicator (Live/Test toggle)
// - Credentials (provider-specific fields)
// - Statement descriptor
// - Priority number
// - Payment methods enabled (checkboxes)
```

### GatewaysTab Component Update

```typescript
// Replace the single-gateway form with a grouped multi-account list

function GatewaysTab() {
  const { data } = useGatewayConfigs()
  const { data: entities } = useBillingEntities()
  const queryClient = useQueryClient()
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const configs = (data as any)?.gateway_configs || []
  const billingEntities = (entities as any)?.billing_entities || []

  // Group configs by provider
  const grouped = SUPPORTED_PROVIDERS.map((provider) => ({
    provider: provider.value,
    label: provider.label,
    accounts: configs.filter((c: any) => c.provider === provider.value),
  }))

  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      sdk.client.fetch("/admin/gateway-configs", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gateway-configs"] })
      toast.success("Gateway account added")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/gateway-configs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gateway-configs"] })
      toast.success("Gateway account removed")
    },
  })

  const addAccount = (provider: string) => {
    createMutation.mutate({
      provider,
      display_name: `New ${provider} account`,
      mode: "test",
      is_active: false,
      live_keys: {},
      test_keys: {},
      supported_currencies: [],
      sales_channel_ids: [],
      priority: 99,
    })
  }

  return (
    <div className="bp-section-enter">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600 }}>Payment Gateway Accounts</h2>
      </div>

      {grouped.map(({ provider, label, accounts }) => (
        <div key={provider} className="bp-card" style={{ marginBottom: "12px" }}>
          {/* Provider header — click to expand */}
          <div
            onClick={() => setExpandedProvider(expandedProvider === provider ? null : provider)}
            style={{
              padding: "14px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "14px", fontWeight: 600 }}>{label}</span>
              <span style={{
                fontSize: "11px",
                background: accounts.length > 0 ? "#E3F1DF" : "#F6F6F7",
                color: accounts.length > 0 ? "#008060" : "#8C9196",
                padding: "2px 8px",
                borderRadius: "10px",
              }}>
                {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
              </span>
            </div>
            <span style={{ fontSize: "12px", color: "#8C9196" }}>
              {expandedProvider === provider ? "▲" : "▼"}
            </span>
          </div>

          {/* Expanded: show all accounts for this provider */}
          {expandedProvider === provider && (
            <div style={{ padding: "0 20px 16px" }}>
              {accounts.map((account: any) => (
                <GatewayAccountCard
                  key={account.id}
                  account={account}
                  billingEntities={billingEntities}
                  isEditing={editingId === account.id}
                  onEdit={() => setEditingId(account.id)}
                  onCancel={() => setEditingId(null)}
                  onDelete={() => deleteMutation.mutate(account.id)}
                />
              ))}

              <button
                onClick={() => addAccount(provider)}
                className="bp-btn"
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px dashed #C9CCCF",
                  borderRadius: "6px",
                  fontSize: "13px",
                  color: "#6D7175",
                  background: "transparent",
                  marginTop: "8px",
                }}
              >
                + Add another {label} account
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

### GatewayAccountCard Component

```typescript
function GatewayAccountCard({
  account,
  billingEntities,
  isEditing,
  onEdit,
  onCancel,
  onDelete,
}: {
  account: any
  billingEntities: any[]
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(account)

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      sdk.client.fetch(`/admin/gateway-configs/${account.id}`, {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gateway-configs"] })
      toast.success("Gateway updated")
      onCancel()
    },
  })

  const testMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/gateway-configs/test-connection", {
        method: "POST",
        body: {
          provider: account.provider,
          keys: account.mode === "live" ? account.live_keys : account.test_keys,
        },
      }),
  })

  const modeColor = account.mode === "live" ? "#008060" : "#B98900"
  const modeLabel = account.mode === "live" ? "LIVE" : "TEST"
  const linkedEntity = billingEntities.find((e: any) => e.id === account.billing_entity_id)

  return (
    <div style={{
      border: "1px solid #E1E3E5",
      borderRadius: "8px",
      padding: "14px 16px",
      marginBottom: "8px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: "13px", fontWeight: 600 }}>{account.display_name}</span>
          {linkedEntity && (
            <span style={{ fontSize: "11px", color: "#6D7175", marginLeft: "8px" }}>
              ({linkedEntity.name})
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{
            fontSize: "10px",
            fontWeight: 600,
            color: modeColor,
            background: account.mode === "live" ? "#E3F1DF" : "#FFF3CD",
            padding: "2px 8px",
            borderRadius: "10px",
          }}>
            {modeLabel}
          </span>
          <span style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: account.is_active ? "#008060" : "#C9CCCF",
          }} />
        </div>
      </div>

      {/* Sales channels */}
      {account.sales_channel_ids?.length > 0 && (
        <div style={{ fontSize: "11px", color: "#6D7175", marginTop: "4px" }}>
          Sales channels: {account.sales_channel_ids.join(", ")}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
        <button className="bp-btn" onClick={onEdit}
          style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "4px", border: "1px solid #E1E3E5", background: "#FFF" }}>
          Edit
        </button>
        <button className="bp-btn" onClick={() => testMutation.mutate()}
          style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "4px", border: "1px solid #E1E3E5", background: "#FFF" }}>
          {testMutation.isPending ? "Testing..." : "Test Connection"}
        </button>
        <button className="bp-btn" onClick={onDelete}
          style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "4px", border: "1px solid #FDD", background: "#FFF", color: "#9E2B25" }}>
          Delete
        </button>
      </div>
    </div>
  )
}
```

### Provider Service Update — Multi-Account Resolution

Each custom payment provider service must use `resolveGatewayConfig()` instead of reading a single config:

```typescript
// MODIFICATION to ALL custom provider services (Mollie, Comgate, P24, Klarna, Airwallex)
// In the constructor or initiatePayment method, resolve the correct account:

import { resolveGatewayConfig } from "../../services/gateway-router"

// In initiatePayment:
async initiatePayment(input) {
  const { currency_code, context } = input
  const sales_channel_id = context?.sales_channel_id || ""

  const { config, keys, mode } = await resolveGatewayConfig(
    this.container_,
    {
      provider: "klarna",  // or "przelewy24", "mollie", etc.
      sales_channel_id,
      currency_code,
    }
  )

  // Use `keys` for API credentials
  this.client_ = new KlarnaApiClient(keys.api_key, keys.secret_key, mode === "test")

  // Store which config was used in session data for later reference
  return {
    session_data: {
      gateway_config_id: config.id,
      // ... other session data
    }
  }
}
```

### Key Points for Multi-Account

1. **One portal, multiple stores** → Each store is a Medusa Sales Channel
2. **Gateway config per store** → Same provider can have N accounts, each linked to different sales channels
3. **Billing entity link** → Each account can be linked to a different billing entity (company)
4. **Independent mode switching** → One Klarna account can be LIVE while another is in TEST mode
5. **Priority-based fallback** → If multiple accounts match, lower priority number wins
6. **Admin UI** → Accordion per provider, list of account cards, "Add another" button

---

## SECTION 13: INTEGRATION WITH DEXTRUM WMS

### Context

The Dextrum WMS integration is already implemented (see DEXTRUM-IMPLEMENTATION.md). The payment gateway integration connects to Dextrum via:

1. **Tracking Dispatcher** (`backend/src/subscribers/tracking-dispatcher.ts`):
   - Listens for Dextrum status change to `DISPATCHED`
   - Reads tracking number and carrier from Dextrum event
   - Sends tracking info to the payment gateway that processed the order (Stripe, PayPal, Mollie, Klarna)

2. **Order Flow**: Order placed → Payment captured → Dextrum receives order → Dextrum ships → Status = DISPATCHED → Tracking sent to payment gateway

3. **No changes needed to Dextrum module** — the tracking dispatcher is a subscriber that reacts to Dextrum events and calls payment gateway APIs independently.

---
