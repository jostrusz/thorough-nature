// @ts-nocheck
import {
  AbstractPaymentProvider,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"

/**
 * Cash on Delivery (COD / Dobírka) payment provider.
 * No external API calls — payment is collected by the delivery driver.
 * Returns AUTHORIZED status so the order is created but stays "unpaid".
 * Admin can manually capture when COD money is received.
 */
class CodPaymentProviderService extends AbstractPaymentProvider {
  static identifier = "cod"

  protected logger_: any

  constructor(container: any, options?: any) {
    super(container, options)
    try {
      this.logger_ = container.logger || console
    } catch {
      this.logger_ = console
    }
  }

  async initiatePayment(context: any): Promise<any> {
    const { amount, currency_code, customer } = context

    this.logger_.info(
      `[COD] Payment initiated: ${amount} ${currency_code} for ${customer?.email || "unknown"}`
    )

    return {
      session_data: {
        id: "cod_" + Date.now(),
        method: "cod",
        amount,
        currency: currency_code,
        status: "pending",
        createdAt: Date.now(),
      },
    }
  }

  async authorizePayment(paymentSessionData: any): Promise<any> {
    this.logger_.info(`[COD] Payment authorized: ${paymentSessionData.id}`)

    return {
      session_data: {
        ...paymentSessionData,
        status: "authorized",
      },
      status: PaymentSessionStatus.AUTHORIZED,
    }
  }

  async capturePayment(paymentSessionData: any): Promise<any> {
    this.logger_.info(`[COD] Payment captured: ${paymentSessionData.id}`)

    return {
      session_data: {
        ...paymentSessionData,
        status: "captured",
        capturedAt: Date.now(),
      },
    }
  }

  async refundPayment(paymentSessionData: any, refundAmount: number): Promise<any> {
    this.logger_.info(`[COD] Refund requested: ${paymentSessionData.id}, amount: ${refundAmount}`)

    return {
      session_data: paymentSessionData,
    }
  }

  async cancelPayment(paymentSessionData: any): Promise<any> {
    this.logger_.info(`[COD] Payment cancelled: ${paymentSessionData.id}`)

    return {
      session_data: {
        ...paymentSessionData,
        status: "cancelled",
      },
    }
  }

  async deletePayment(paymentSessionData: any): Promise<any> {
    return {
      session_data: paymentSessionData,
    }
  }

  async getPaymentStatus(paymentSessionData: any): Promise<PaymentSessionStatus> {
    const status = paymentSessionData?.status || "pending"

    switch (status) {
      case "captured":
        return PaymentSessionStatus.CAPTURED
      case "authorized":
        return PaymentSessionStatus.AUTHORIZED
      case "cancelled":
        return PaymentSessionStatus.CANCELED
      default:
        return PaymentSessionStatus.AUTHORIZED
    }
  }

  async retrievePayment(paymentSessionData: any): Promise<any> {
    return {
      session_data: paymentSessionData,
    }
  }

  async updatePayment(context: any): Promise<any> {
    return {
      session_data: context.paymentSessionData || context.data || {},
    }
  }

  async getWebhookActionAndData(webhookData: any): Promise<any> {
    return {
      action: "authorized",
      data: webhookData,
    }
  }
}

export default CodPaymentProviderService
