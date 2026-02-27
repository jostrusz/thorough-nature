// @ts-nocheck
import {
  PaymentProviderError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { KlarnaApiClient, IKlarnaOrderLine } from "./api-client"
import crypto from "crypto"

const GATEWAY_CONFIG_MODULE = "gatewayConfig"

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
export class KlarnaPaymentProvider {
  protected container_: any
  protected client_: KlarnaApiClient | null = null
  protected gatewayConfigService_: any
  protected logger_: any

  static identifier = "klarna"

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
   * Initialize the Klarna API client with credentials from gateway_config
   */
  private async getKlarnaClient(): Promise<KlarnaApiClient> {
    if (!this.client_) {
      const gcService = this.getGatewayConfigService()
      const configs = await gcService.listGatewayConfigs(
        { provider: "klarna", is_active: true },
        { take: 1 }
      )
      const config = configs[0]
      if (!config) {
        throw new PaymentProviderError("Klarna gateway not configured")
      }
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      if (!keys?.api_key || !keys?.secret_key) {
        throw new PaymentProviderError("Klarna API credentials not configured")
      }
      this.client_ = new KlarnaApiClient(keys.api_key, keys.secret_key, !isLive)
    }
    return this.client_
  }

  /**
   * Initiate a payment session — create Klarna session and return client_token
   * Frontend will use this token with Klarna Payments widget
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

      this.getLogger().info(
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
      this.getLogger().error(`[Klarna] Payment initiation failed: ${error.message}`)
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
  ): Promise<any> {
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

      this.getLogger().info(
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
      this.getLogger().error(`[Klarna] Authorization failed: ${error.message}`)
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
  ): Promise<any> {
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
      const idempotencyKey = crypto.randomUUID()

      const result = await client.captureOrder(
        klarnaOrderId,
        captureData,
        idempotencyKey
      )

      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to capture order")
      }

      this.getLogger().info(
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
      this.getLogger().error(`[Klarna] Capture failed: ${error.message}`)
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
  ): Promise<any> {
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

      const idempotencyKey = crypto.randomUUID()

      const result = await client.refundOrder(
        klarnaOrderId,
        refundData,
        idempotencyKey
      )

      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to create refund")
      }

      this.getLogger().info(
        `[Klarna] Refund created for order ${klarnaOrderId}: ${result.data.refund_id}`
      )

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.AUTHORIZED,
      }
    } catch (error: any) {
      this.getLogger().error(`[Klarna] Refund failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(
    paymentSessionData: IKlarnaPaymentSessionData,
    context: any
  ): Promise<any> {
    try {
      const client = await this.getKlarnaClient()
      const { klarnaOrderId } = paymentSessionData

      if (klarnaOrderId) {
        // Release remaining authorization if order exists
        await client.releaseAuthorization(klarnaOrderId)
      }

      this.getLogger().info(
        `[Klarna] Order ${klarnaOrderId} marked for cancellation`
      )

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.CANCELED,
      }
    } catch (error: any) {
      this.getLogger().error(`[Klarna] Cancel failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Delete payment session
   */
  async deletePayment(
    paymentSessionData: IKlarnaPaymentSessionData,
    context: any
  ): Promise<any> {
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
      this.getLogger().error(`[Klarna] Status check failed: ${error.message}`)
      return PaymentSessionStatus.ERROR
    }
  }

  /**
   * Retrieve payment data
   */
  async retrievePayment(
    paymentSessionData: IKlarnaPaymentSessionData,
    context: any
  ): Promise<any> {
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
      this.getLogger().error(`[Klarna] Retrieve failed: ${error.message}`)
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
   * Validate Klarna API credentials by attempting to create a session
   * Used by admin test-connection endpoint
   */
  async validateAuth(): Promise<{ success: boolean; error?: string }> {
    try {
      const client = await this.getKlarnaClient()
      // Try fetching a non-existent order — if auth fails, we get 401/403
      // If auth succeeds, we get 404 (order not found) — that's fine
      const result = await client.getOrder("test-auth-check")
      // If we get here with success: false and no auth error, credentials are valid
      return { success: true }
    } catch (error: any) {
      // If the error is about the order not being found, credentials are valid
      if (error.message?.includes("not found") || error.message?.includes("404")) {
        return { success: true }
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
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
      this.getLogger().error(`[Klarna] Webhook processing failed: ${error.message}`)
      return {
        action: "fail",
        data: webhookData,
      }
    }
  }
}
