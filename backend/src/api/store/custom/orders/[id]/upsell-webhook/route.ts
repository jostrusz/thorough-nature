// @ts-nocheck
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
    const { data: orders } = await queryModule.graph({
      entity: "order",
      fields: ["id", "currency_code", "metadata"],
      filters: { id },
    });

    if (!orders || orders.length === 0) {
      logger.warn("Upsell webhook: Order not found", { order_id: id });
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orders[0];
    const upsellProvider = order.metadata?.upsell_provider;
    const upsellSessionId = order.metadata?.upsell_session_id;

    // Idempotency: if upsell already completed, return success
    if (order.metadata?.upsell_status === "completed" && order.metadata?.upsell_payment_id) {
      logger.info("Upsell webhook: already processed (idempotent)", { order_id: id });
      return res.json({ success: true, status: "completed", message: "Already processed" });
    }

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
      currency: (order.currency_code || "eur").toLowerCase(),
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
