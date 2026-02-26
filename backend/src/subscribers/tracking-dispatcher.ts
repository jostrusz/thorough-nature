// @ts-nocheck
/**
 * Tracking Dispatcher Subscriber
 * Sends tracking information to payment gateways when an order is dispatched via Dextrum WMS.
 * Supports: Stripe, PayPal, Mollie, Klarna
 */
import type { SubscriberConfig, SubscriberArgs } from "@medusajs/framework"
import axios from "axios"

export default async function trackingDispatcherHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event.data.id
  const orderModuleService = container.resolve("order") as any
  const logger = container.resolve("logger") as any

  try {
    const order = await orderModuleService.retrieveOrder(orderId, {
      relations: ["items"],
    })

    if (!order) {
      logger.warn(`[Tracking Dispatcher] Order not found: ${orderId}`)
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

    // Detect which payment gateway was used from metadata
    const providerId = order.metadata?.payment_provider || "unknown"

    // Send tracking to the appropriate gateway
    let trackingSendResult = {
      success: false,
      gateway: providerId,
      timestamp: new Date().toISOString(),
    }

    try {
      if (providerId === "stripe") {
        await sendTrackingToStripe(order, trackingNumber, trackingCarrier)
        trackingSendResult.success = true
      } else if (providerId === "paypal") {
        await sendTrackingToPayPal(order, trackingNumber, trackingCarrier)
        trackingSendResult.success = true
      } else if (providerId === "mollie") {
        await sendTrackingToMollie(order, trackingNumber, trackingCarrier)
        trackingSendResult.success = true
      } else if (providerId === "klarna") {
        await sendTrackingToKlarna(order, trackingNumber, trackingCarrier)
        trackingSendResult.success = true
      } else {
        logger.info(
          `[Tracking Dispatcher] Provider ${providerId} does not support tracking API for order ${order.id}`
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

    await orderModuleService.updateOrders([
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
    ])

    logger.info(
      `[Tracking Dispatcher] Order ${order.id} tracking dispatched to ${providerId}`
    )
  } catch (error: any) {
    logger.error(`[Tracking Dispatcher] Error: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: ["order.updated"],
}

async function sendTrackingToStripe(
  order: any,
  trackingNumber: string,
  trackingCarrier: string
): Promise<void> {
  const Stripe = (await import("stripe")).default
  const stripeClient = new Stripe(process.env.STRIPE_API_KEY || "")

  const paymentIntentId = order.metadata?.stripePaymentIntentId
  if (!paymentIntentId) {
    throw new Error("No Stripe Payment Intent ID found in order metadata")
  }

  await stripeClient.paymentIntents.update(paymentIntentId, {
    shipping: {
      carrier: trackingCarrier,
      tracking_number: trackingNumber,
    } as any,
  })
}

async function sendTrackingToPayPal(
  order: any,
  trackingNumber: string,
  trackingCarrier: string
): Promise<void> {
  const paypalOrderId = order.metadata?.paypalOrderId
  if (!paypalOrderId) {
    throw new Error("No PayPal Order ID found in order metadata")
  }

  const baseUrl = process.env.PAYPAL_API_BASE_URL || "https://api.paypal.com"
  const clientId = process.env.PAYPAL_CLIENT_ID || ""
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || ""

  const tokenRes = await axios.post(
    `${baseUrl}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      auth: { username: clientId, password: clientSecret },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  )

  const accessToken = tokenRes.data.access_token

  const trackingPayload: any = {
    tracking_number: trackingNumber,
    carrier: normalizePayPalCarrier(trackingCarrier),
  }

  if (trackingCarrier === "other") {
    trackingPayload.carrier_name_other = order.metadata?.tracking_carrier_other
  }

  await axios.post(
    `${baseUrl}/v2/checkout/orders/${paypalOrderId}/track`,
    trackingPayload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  )
}

async function sendTrackingToMollie(
  order: any,
  trackingNumber: string,
  trackingCarrier: string
): Promise<void> {
  const mollieOrderId = order.metadata?.mollieOrderId
  if (!mollieOrderId) {
    throw new Error("No Mollie Order ID found in order metadata")
  }

  const mollieApiKey = process.env.MOLLIE_API_KEY || ""

  await axios.post(
    `https://api.mollie.com/v2/orders/${mollieOrderId}/shipments`,
    {
      tracking: {
        carrier: normalizeMollieCarrier(trackingCarrier),
        code: trackingNumber,
        url: buildTrackingUrl(trackingCarrier, trackingNumber),
      },
    },
    {
      headers: {
        Authorization: `Bearer ${mollieApiKey}`,
        "Content-Type": "application/json",
      },
    }
  )
}

async function sendTrackingToKlarna(
  order: any,
  trackingNumber: string,
  trackingCarrier: string
): Promise<void> {
  const klarnaOrderId = order.metadata?.klarnaOrderId
  const klarnaCaptureId = order.metadata?.klarnaCaptureId
  if (!klarnaOrderId || !klarnaCaptureId) {
    throw new Error("No Klarna Order/Capture ID found in order metadata")
  }

  const baseUrl = process.env.KLARNA_API_BASE_URL || "https://api.klarna.com"
  const apiKey = process.env.KLARNA_API_KEY || ""
  const apiSecret = process.env.KLARNA_API_SECRET || ""
  const authToken = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")

  await axios.post(
    `${baseUrl}/ordermanagement/v1/orders/${klarnaOrderId}/captures/${klarnaCaptureId}/shipping-info`,
    {
      shipping_company: normalizeKlarnaCarrier(trackingCarrier),
      tracking_number: trackingNumber,
    },
    {
      headers: {
        Authorization: `Basic ${authToken}`,
        "Content-Type": "application/json",
      },
    }
  )
}

function normalizePayPalCarrier(carrier: string): string {
  const carrierMap: Record<string, string> = {
    dhl: "DHL", fedex: "FEDEX", ups: "UPS", usps: "USPS", dpe: "DPE", other: "OTHER",
  }
  return carrierMap[carrier.toLowerCase()] || "OTHER"
}

function normalizeMollieCarrier(carrier: string): string {
  const carrierMap: Record<string, string> = {
    dhl: "DHL", fedex: "FEDEX", ups: "UPS", usps: "USPS", dpe: "DPE", other: "OTHER",
  }
  return carrierMap[carrier.toLowerCase()] || "OTHER"
}

function normalizeKlarnaCarrier(carrier: string): string {
  const carrierMap: Record<string, string> = {
    dhl: "DHL", fedex: "FEDEX", ups: "UPS", usps: "USPS", dpe: "DPE", other: "OTHER",
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
