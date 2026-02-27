// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * POST /store/custom/orders/:id/upsell-charge
 *
 * One-click upsell charge using saved payment methods (off-session).
 * Supports: Stripe (payment_method_id), PayPal (vault_id), Mollie (mandate).
 */
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

    // Fetch order with metadata and currency
    const { data: orders } = await queryModule.graph({
      entity: "order",
      fields: ["id", "customer_id", "total", "currency_code", "metadata"],
      filters: { id },
    });

    if (!orders || orders.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orders[0];
    const currency = (order.currency_code || "eur").toLowerCase();

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

    // Idempotency: check if upsell already charged
    if (order.metadata?.upsell_status === "completed" && order.metadata?.upsell_payment_id) {
      return res.json({
        success: true,
        upsell_payment_id: order.metadata.upsell_payment_id,
        order_id: order.id,
        message: "Upsell already charged",
      });
    }

    // Get original payment method from metadata
    const originalPaymentMethodId = order.metadata?.payment_method_id;
    const paymentProvider = order.metadata?.payment_provider;

    if (!paymentProvider) {
      return res.status(400).json({
        error: "No payment provider information available for upsell",
      });
    }

    let upsellPaymentId: string;
    const upsellAmount = Math.round(upsell_price * 100); // Convert to cents/smallest unit

    // Handle Stripe one-click charge
    if (paymentProvider === "stripe") {
      if (!originalPaymentMethodId) {
        return res.status(400).json({ error: "No saved Stripe payment method for upsell" });
      }

      const stripe = req.scope.resolve("stripe");

      const paymentIntent = await stripe.paymentIntents.create({
        amount: upsellAmount,
        currency,
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

        // Mark as failed in metadata
        await updateOrderMetadata(req, order, {
          upsell_status: "failed",
          upsell_error: `Stripe charge status: ${paymentIntent.status}`,
          upsell_failed_at: new Date().toISOString(),
        });

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
              currency_code: currency.toUpperCase(),
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

        await updateOrderMetadata(req, order, {
          upsell_status: "failed",
          upsell_error: "PayPal order creation failed",
          upsell_failed_at: new Date().toISOString(),
        });

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

        await updateOrderMetadata(req, order, {
          upsell_status: "failed",
          upsell_error: "PayPal capture failed",
          upsell_failed_at: new Date().toISOString(),
        });

        return res.status(402).json({
          error: "PayPal upsell payment capture failed",
        });
      }

      upsellPaymentId = paypalOrder.result.id;
    }
    // Handle Mollie mandate (recurring payment)
    else if (paymentProvider?.startsWith("mollie")) {
      const mollieMandateId = order.metadata?.mollie_mandate_id;
      const mollieCustomerId = order.metadata?.mollie_customer_id;

      if (!mollieMandateId || !mollieCustomerId) {
        return res.status(400).json({
          error: "No Mollie mandate available for one-click upsell. Use redirect-based upsell session instead.",
        });
      }

      // Use our Mollie API client for recurring payments
      const { MollieApiClient } = await import("../../../../../modules/payment-mollie/api-client");

      // Get Mollie API key from gateway config
      const { GATEWAY_CONFIG_MODULE } = await import("../../../../../modules/gateway-config");
      const gatewayService = req.scope.resolve(GATEWAY_CONFIG_MODULE);
      const configs = await gatewayService.listGatewayConfigs(
        { provider: "mollie", is_active: true },
        { take: 1 }
      );
      const config = configs[0];
      if (!config) {
        return res.status(400).json({ error: "Mollie gateway not configured" });
      }

      const isLive = config.mode === "live";
      const keys = isLive ? config.live_keys : config.test_keys;
      const mollieClient = new MollieApiClient(keys.api_key, !isLive);

      const backendUrl =
        process.env.BACKEND_PUBLIC_URL ||
        (process.env.RAILWAY_PUBLIC_DOMAIN_VALUE
          ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN_VALUE}`
          : "http://localhost:9000");

      const result = await mollieClient.createRecurringPayment(
        mollieCustomerId,
        mollieMandateId,
        {
          amount: {
            value: (upsellAmount / 100).toFixed(2),
            currency: currency.toUpperCase(),
          },
          description: `Upsell charge for order ${order.id}`,
          redirectUrl: `${process.env.STOREFRONT_URL || backendUrl}/thank-you/${order.id}`,
          webhookUrl: `${backendUrl}/store/custom/orders/${order.id}/upsell-webhook`,
          metadata: {
            order_id: order.id,
            upsell: "true",
            upsell_product_id,
          },
        }
      );

      if (!result.success) {
        logger.error(`Mollie upsell recurring charge failed`, {
          order_id: order.id,
          error: result.error,
        });

        await updateOrderMetadata(req, order, {
          upsell_status: "failed",
          upsell_error: result.error || "Mollie recurring charge failed",
          upsell_failed_at: new Date().toISOString(),
        });

        return res.status(402).json({
          error: result.error || "Mollie recurring charge failed",
        });
      }

      upsellPaymentId = result.data.id;

      // If Mollie returns status "paid" immediately
      if (result.data.status === "paid") {
        // Charge completed immediately
      } else {
        // Charge is pending — webhook will confirm
        await updateOrderMetadata(req, order, {
          upsell_payment_id: upsellPaymentId,
          upsell_product_id,
          upsell_amount: upsellAmount,
          upsell_status: "pending",
          upsell_charged_at: new Date().toISOString(),
        });

        return res.json({
          success: true,
          upsell_payment_id: upsellPaymentId,
          order_id: order.id,
          status: "pending",
        });
      }
    } else {
      return res.status(400).json({
        error: `Payment provider ${paymentProvider} does not support one-click upsell`,
      });
    }

    // Update order metadata with upsell payment
    await updateOrderMetadata(req, order, {
      upsell_payment_id: upsellPaymentId,
      upsell_product_id,
      upsell_amount: upsellAmount,
      upsell_charged_at: new Date().toISOString(),
      upsell_status: "completed",
    });

    // Log to payment activity log
    try {
      const paymentActivityService = req.scope.resolve("paymentActivityService");
      await paymentActivityService.create({
        order_id: order.id,
        payment_id: upsellPaymentId,
        provider: paymentProvider,
        amount: upsellAmount,
        currency,
        status: "completed",
        type: "upsell_charge",
        metadata: {
          upsell_product_id,
          payment_method: originalPaymentMethodId,
        },
      });
    } catch {
      // Activity logging is non-critical
    }

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

    // Try to mark the upsell as errored in metadata
    try {
      const { id } = req.params;
      const orderService = req.scope.resolve("orderModuleService");
      await orderService.updateOrders(id, {
        metadata: {
          upsell_status: "error",
          upsell_error: error.message,
          upsell_error_at: new Date().toISOString(),
        },
      });
    } catch {
      // Ignore secondary error
    }

    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Helper: Update order metadata (merges with existing)
 */
async function updateOrderMetadata(req: any, order: any, updates: Record<string, any>) {
  try {
    const orderService = req.scope.resolve("orderModuleService");
    await orderService.updateOrders(order.id, {
      metadata: {
        ...order.metadata,
        ...updates,
      },
    });
    // Update local reference
    Object.assign(order.metadata, updates);
  } catch {
    // Non-critical - log and continue
  }
}
