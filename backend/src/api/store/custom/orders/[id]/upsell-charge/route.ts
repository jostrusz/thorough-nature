// @ts-nocheck
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
