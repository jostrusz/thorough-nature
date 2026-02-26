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
