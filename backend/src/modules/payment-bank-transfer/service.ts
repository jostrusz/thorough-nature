// @ts-nocheck
import {
  AbstractPaymentProvider,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"

/**
 * Bank Transfer (SEPA prevod / QR) payment provider.
 *
 * No external gateway — the customer pays via a manual SEPA credit transfer to
 * our IBAN using a structured RF reference (derived from the order display_id).
 * Money lands on our FIO EUR account; the `bank-transfer-reconcile` cron matches
 * the incoming payment by RF reference and captures it → order becomes paid →
 * fulfillment + ebooks.
 *
 * Flow mirrors COD: initiatePayment returns a pending session and the order is
 * created UNPAID (AUTHORIZED). Capture happens later from the reconcile cron via
 * capturePaymentWorkflow. The IBAN/BIC/beneficiary shown in the checkout QR come
 * from the `/store/payment-options` route (which reads gateway_config directly) —
 * the provider itself does not need the bank details to create the session.
 */
class BankTransferPaymentProviderService extends AbstractPaymentProvider {
  static identifier = "bank_transfer"

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
      `[Bank Transfer] Payment initiated: ${amount} ${currency_code} for ${customer?.email || "unknown"}`
    )

    return {
      data: {
        id: "bt_" + Date.now(),
        method: "bank_transfer",
        amount,
        currency: currency_code,
        status: "pending",
        createdAt: Date.now(),
      },
    }
  }

  async authorizePayment(paymentSessionData: any): Promise<any> {
    this.logger_.info(`[Bank Transfer] Payment authorized (awaiting transfer): ${paymentSessionData?.id}`)

    return {
      data: {
        ...paymentSessionData,
        status: "authorized",
      },
      status: PaymentSessionStatus.AUTHORIZED,
    }
  }

  async capturePayment(paymentSessionData: any): Promise<any> {
    this.logger_.info(`[Bank Transfer] Payment captured (transfer reconciled): ${paymentSessionData?.id}`)

    return {
      data: {
        ...paymentSessionData,
        status: "captured",
        capturedAt: Date.now(),
      },
    }
  }

  async refundPayment(paymentSessionData: any, refundAmount: number): Promise<any> {
    this.logger_.info(`[Bank Transfer] Refund requested: ${paymentSessionData?.id}, amount: ${refundAmount}`)

    return {
      data: paymentSessionData || {},
    }
  }

  async cancelPayment(paymentSessionData: any): Promise<any> {
    this.logger_.info(`[Bank Transfer] Payment cancelled: ${paymentSessionData?.id}`)

    return {
      data: {
        ...(paymentSessionData || {}),
        status: "cancelled",
      },
    }
  }

  async deletePayment(paymentSessionData: any): Promise<any> {
    return {
      data: paymentSessionData || {},
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
        // Order must be created despite being unpaid → AUTHORIZED, like COD.
        return PaymentSessionStatus.AUTHORIZED
    }
  }

  async retrievePayment(paymentSessionData: any): Promise<any> {
    return {
      data: paymentSessionData || {},
    }
  }

  async updatePayment(context: any): Promise<any> {
    return {
      data: context.paymentSessionData || context.data || {},
    }
  }

  async getWebhookActionAndData(webhookData: any): Promise<any> {
    // No provider webhook — reconciliation is driven by the FIO cron.
    return {
      action: "authorized",
      data: webhookData,
    }
  }
}

export default BankTransferPaymentProviderService
