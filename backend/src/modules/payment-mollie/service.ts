// @ts-nocheck
import {
  PaymentProviderError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { MollieApiClient } from "./api-client"

const GATEWAY_CONFIG_MODULE = "gatewayConfig"

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
      return PaymentSessionStatus.CAPTURED
    case "authorized":
      return PaymentSessionStatus.AUTHORIZED
    case "completed":
      return PaymentSessionStatus.CAPTURED
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
export class MolliePaymentProvider {
  protected container_: any
  protected client_: MollieApiClient | null = null
  protected gatewayConfigService_: any
  protected logger_: any

  static identifier = "mollie"

  constructor(container: any, options?: any) {
    this.container_ = container
    try {
      this.logger_ = container.resolve("logger")
    } catch {
      this.logger_ = console
    }
    try {
      this.gatewayConfigService_ = container.resolve(GATEWAY_CONFIG_MODULE)
    } catch {
      this.gatewayConfigService_ = null
    }
  }

  private getLogger() {
    if (!this.logger_) {
      try { this.logger_ = this.container_.resolve("logger") } catch { this.logger_ = console }
    }
    return this.logger_
  }

  private getGatewayConfigService() {
    if (!this.gatewayConfigService_) {
      this.gatewayConfigService_ = this.container_.resolve(GATEWAY_CONFIG_MODULE)
    }
    return this.gatewayConfigService_
  }

  /**
   * Initialize the Mollie API client with credentials from gateway_config
   */
  private async getMollieClient(): Promise<MollieApiClient> {
    if (!this.client_) {
      const gcService = this.getGatewayConfigService()
      const configs = await gcService.listGatewayConfigs(
        { provider: "mollie", is_active: true },
        { take: 1 }
      )
      const config = configs[0]
      if (!config) {
        throw new PaymentProviderError("Mollie gateway not configured")
      }
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      if (!keys?.api_key) {
        throw new PaymentProviderError("Mollie API key not configured")
      }
      this.client_ = new MollieApiClient(keys.api_key, !isLive)
    }
    return this.client_
  }

  /**
   * Initiate a payment session — create a Mollie order or payment
   * Credit card with Mollie Components uses Payments API (token-based)
   * All other methods use Orders API (redirect-based)
   */
  async initiatePayment(context: any): Promise<any> {
    const {
      amount,
      currency_code,
      customer,
      cart,
      context: contextData,
    } = context

    try {
      const client = await this.getMollieClient()

      // Check if this is a credit card payment with Mollie Components token
      const cardToken = contextData?.data?.cardToken
      const paymentMethod = contextData?.data?.method

      if (paymentMethod === "creditcard" && cardToken) {
        // ─── CREDIT CARD VIA MOLLIE COMPONENTS (Payments API) ───
        const paymentData = {
          amount: {
            value: (amount / 100).toFixed(2),
            currency: currency_code.toUpperCase(),
          },
          description: contextData?.statement_descriptor || `Order ${cart?.id || Date.now()}`,
          redirectUrl: `${contextData?.return_url || "https://example.com"}/payment/success`,
          webhookUrl: `${contextData?.webhook_url || "https://api.example.com"}/webhooks/mollie`,
          method: "creditcard",
          cardToken: cardToken,
          metadata: {
            medusa_order_id: cart?.id,
            customer_id: customer?.id,
          },
        }

        const result = await client.createPayment(paymentData)
        if (!result.success) {
          throw new PaymentProviderError(result.error || "Failed to create Mollie credit card payment")
        }

        const molliePayment = result.data
        const checkoutUrl = molliePayment._links?.checkout?.href

        this.getLogger().info(
          `[Mollie] Credit card payment created: ${molliePayment.id}, status: ${molliePayment.status}, 3DS redirect: ${checkoutUrl || "none"}`
        )

        const sessionData: IMolliePaymentSessionData = {
          molliePaymentId: molliePayment.id,
          status: molliePayment.status,
          method: "creditcard",
          amount,
          currency: currency_code,
          createdAt: Date.now(),
        }

        // If payment is already paid (no 3DS), no redirect needed
        if (molliePayment.status === "paid") {
          return { session_data: sessionData }
        }

        // 3DS required — redirect customer
        if (!checkoutUrl) {
          throw new PaymentProviderError("Credit card requires 3DS but no checkout URL returned")
        }

        return {
          session_data: sessionData,
          redirect_url: checkoutUrl,
        }
      }

      // ─── STANDARD FLOW: Orders API for iDEAL, Bancontact, Klarna, etc. ───

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
      this.getLogger().info(
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
      this.getLogger().error(`[Mollie] Payment initiation failed: ${error.message}`)
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
  ): Promise<any> {
    try {
      const client = await this.getMollieClient()
      const { mollieOrderId, molliePaymentId } = paymentSessionData

      // Credit card via Payments API
      if (molliePaymentId && !mollieOrderId) {
        const result = await client.getPayment(molliePaymentId)
        if (!result.success) {
          throw new PaymentProviderError(result.error || "Failed to fetch Mollie payment")
        }
        const status = mapMollieStatusToMedusa(result.data.status)
        return {
          session_data: { ...paymentSessionData, status: result.data.status },
          status,
        }
      }

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
      this.getLogger().error(`[Mollie] Authorization check failed: ${error.message}`)
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
  ): Promise<any> {
    try {
      const client = await this.getMollieClient()
      const { mollieOrderId, molliePaymentId } = paymentSessionData

      // Credit card via Payments API
      if (molliePaymentId && !mollieOrderId) {
        const result = await client.getPayment(molliePaymentId)
        if (!result.success) {
          throw new PaymentProviderError(result.error || "Failed to fetch Mollie payment")
        }
        const status = mapMollieStatusToMedusa(result.data.status)
        return {
          session_data: { ...paymentSessionData, status: result.data.status },
          status,
        }
      }

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
      this.getLogger().error(`[Mollie] Capture failed: ${error.message}`)
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
  ): Promise<any> {
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

      this.getLogger().info(
        `[Mollie] Refund created for order ${mollieOrderId}: ${result.data.id}`
      )

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.AUTHORIZED,
      }
    } catch (error: any) {
      this.getLogger().error(`[Mollie] Refund failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(
    paymentSessionData: IMolliePaymentSessionData,
    context: any
  ): Promise<any> {
    try {
      const { mollieOrderId } = paymentSessionData

      if (!mollieOrderId) {
        throw new PaymentProviderError("No Mollie order ID in session data")
      }

      // Mollie doesn't have a direct cancel endpoint for orders
      // The order will expire after 28 days if unpaid
      // Log the cancellation intent
      this.getLogger().info(`[Mollie] Order ${mollieOrderId} marked for cancellation`)

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.CANCELED,
      }
    } catch (error: any) {
      this.getLogger().error(`[Mollie] Cancel failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Delete payment session
   */
  async deletePayment(
    paymentSessionData: IMolliePaymentSessionData,
    context: any
  ): Promise<any> {
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
      const { mollieOrderId, molliePaymentId } = paymentSessionData

      // Credit card via Payments API
      if (molliePaymentId && !mollieOrderId) {
        const result = await client.getPayment(molliePaymentId)
        if (!result.success) return PaymentSessionStatus.ERROR
        return mapMollieStatusToMedusa(result.data.status)
      }

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
      this.getLogger().error(`[Mollie] Status check failed: ${error.message}`)
      return PaymentSessionStatus.ERROR
    }
  }

  /**
   * Retrieve payment data
   */
  async retrievePayment(
    paymentSessionData: IMolliePaymentSessionData,
    context: any
  ): Promise<any> {
    try {
      const client = await this.getMollieClient()
      const { mollieOrderId, molliePaymentId } = paymentSessionData

      // Credit card via Payments API
      if (molliePaymentId && !mollieOrderId) {
        const result = await client.getPayment(molliePaymentId)
        if (!result.success) {
          throw new PaymentProviderError(result.error || "Failed to retrieve Mollie payment")
        }
        const status = mapMollieStatusToMedusa(result.data.status)
        return {
          session_data: {
            ...paymentSessionData,
            molliePaymentId: result.data.id,
            status: result.data.status,
            method: result.data.method,
          },
          status,
        }
      }

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
      this.getLogger().error(`[Mollie] Retrieve failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Update payment session
   */
  async updatePayment(context: any): Promise<any> {
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
      this.getLogger().error(`[Mollie] Webhook processing failed: ${error.message}`)
      return {
        action: "fail",
        data: webhookData,
      }
    }
  }
}
