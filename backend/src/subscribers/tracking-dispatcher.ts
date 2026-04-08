// @ts-nocheck
/**
 * Tracking Dispatcher Subscriber
 *
 * When an order is dispatched via Dextrum WMS (order.updated with dextrum_status=DISPATCHED):
 * 1. Auto-captures PayPal/Klarna payments (if not yet captured)
 * 2. Sends tracking information to the payment gateway
 *
 * Capture flow:
 * - PayPal: capture authorization -> get capture_id -> send tracking via /track API
 * - Klarna: capture with shipping_info in one call (Klarna supports it natively)
 * - Mollie/Stripe: auto-captured on payment, just send tracking
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

    // Check if tracking has already been sent to this provider
    const providerId = order.metadata?.payment_provider || "unknown"
    const trackingSent = order.metadata?.tracking_sent_to_gateway
    if (trackingSent?.[providerId]) {
      logger.info(
        `[Tracking Dispatcher] Tracking already sent to ${providerId} for order ${order.id}`
      )
      return
    }

    const activityLog = [...(order.metadata?.payment_activity_log || [])]
    let updatedMetadata = { ...order.metadata }
    const trackingUrl = buildTrackingUrl(trackingCarrier, trackingNumber)

    // ─── Step 1: Auto-capture if needed (PayPal / Klarna) ─────────────
    const alreadyCaptured = order.metadata?.payment_captured === true

    if (!alreadyCaptured && (providerId === "paypal" || providerId.includes("paypal") || providerId === "klarna" || providerId.includes("klarna") || providerId === "airwallex" || providerId.includes("airwallex"))) {
      logger.info(
        `[Tracking Dispatcher] Auto-capturing ${providerId} payment for order ${order.id}`
      )

      try {
        if (providerId === "paypal" || providerId.includes("paypal")) {
          const captureResult = await capturePayPal(order, container, logger)
          activityLog.push({
            timestamp: new Date().toISOString(),
            event: "capture",
            gateway: "paypal",
            status: "success",
            amount: order.total,
            currency: order.currency_code,
            capture_id: captureResult.captureId,
            detail: "Auto-captured on shipment dispatch",
          })
          updatedMetadata.payment_captured = true
          updatedMetadata.payment_captured_at = new Date().toISOString()
          updatedMetadata.paypalCaptureId = captureResult.captureId
        } else if (providerId === "klarna" || providerId.includes("klarna")) {
          // Klarna: capture with shipping_info included
          const captureResult = await captureKlarna(
            order,
            container,
            logger,
            trackingNumber,
            trackingCarrier,
            trackingUrl
          )
          activityLog.push({
            timestamp: new Date().toISOString(),
            event: "capture",
            gateway: "klarna",
            status: "success",
            amount: order.total,
            currency: order.currency_code,
            capture_id: captureResult.captureId,
            tracking_number: trackingNumber,
            tracking_carrier: trackingCarrier,
            detail: "Auto-captured on shipment dispatch (with tracking)",
          })
          updatedMetadata.payment_captured = true
          updatedMetadata.payment_captured_at = new Date().toISOString()
          updatedMetadata.klarnaCaptureId = captureResult.captureId

          // Klarna tracking was included in capture, mark as sent
          activityLog.push({
            timestamp: new Date().toISOString(),
            event: "tracking_sent",
            gateway: "klarna",
            tracking_number: trackingNumber,
            tracking_carrier: trackingCarrier,
            status: "success",
            detail: "Tracking sent with capture request",
          })
          updatedMetadata.tracking_sent_to_gateway = {
            ...(updatedMetadata.tracking_sent_to_gateway || {}),
            klarna: true,
            klarna_timestamp: new Date().toISOString(),
          }

          // Save intermediate state and return (Klarna is done in one step)
          updatedMetadata.payment_activity_log = activityLog
          await orderModuleService.updateOrders([
            { id: order.id, metadata: updatedMetadata },
          ])
          logger.info(
            `[Tracking Dispatcher] Order ${order.id} captured + tracking sent to Klarna`
          )
          return
        } else if (providerId === "airwallex" || providerId.includes("airwallex")) {
          const captureResult = await captureAirwallex(order, container, logger)
          activityLog.push({
            timestamp: new Date().toISOString(),
            event: "capture",
            gateway: "airwallex",
            status: "success",
            amount: order.total,
            currency: order.currency_code,
            capture_id: captureResult.captureId,
            detail: "Auto-captured on shipment dispatch",
          })
          updatedMetadata.payment_captured = true
          updatedMetadata.payment_captured_at = new Date().toISOString()
          updatedMetadata.airwallexCaptureId = captureResult.captureId
        }
      } catch (captureError: any) {
        logger.error(
          `[Tracking Dispatcher] Auto-capture failed for ${providerId}: ${captureError.message}`
        )
        activityLog.push({
          timestamp: new Date().toISOString(),
          event: "capture",
          gateway: providerId,
          status: "error",
          error_message: captureError.message,
          detail: `Auto-capture failed: ${captureError.message}`,
        })
        // Save error log and abort — don't send tracking if capture failed
        updatedMetadata.payment_activity_log = activityLog
        await orderModuleService.updateOrders([
          { id: order.id, metadata: updatedMetadata },
        ])
        return
      }
    }

    // ─── Step 2: Send tracking to the payment gateway ─────────────────
    let trackingSendResult = {
      success: false,
      gateway: providerId,
      timestamp: new Date().toISOString(),
    }

    try {
      if (providerId === "stripe" || providerId.includes("stripe")) {
        await sendTrackingToStripe(order, trackingNumber, trackingCarrier)
        trackingSendResult.success = true
      } else if (providerId === "paypal" || providerId.includes("paypal")) {
        // Use capture_id from either the auto-capture or existing metadata
        const captureId =
          updatedMetadata.paypalCaptureId || order.metadata?.paypalCaptureId
        await sendTrackingToPayPal(
          order,
          trackingNumber,
          trackingCarrier,
          captureId,
          container,
          logger
        )
        trackingSendResult.success = true
      } else if (providerId === "mollie" || providerId.includes("mollie")) {
        await sendTrackingToMollie(order, trackingNumber, trackingCarrier)
        trackingSendResult.success = true
      } else if (providerId === "airwallex" || providerId.includes("airwallex")) {
        // Airwallex does not have a native tracking API
        // Tracking is stored in order metadata only
        logger.info(
          `[Tracking Dispatcher] Airwallex does not support tracking API, stored in metadata for order ${order.id}`
        )
        trackingSendResult.success = true
      } else if (providerId === "klarna" || providerId.includes("klarna")) {
        // Already captured + tracking sent, check if we need to add shipping info
        const captureId =
          updatedMetadata.klarnaCaptureId || order.metadata?.klarnaCaptureId
        if (captureId) {
          await sendTrackingToKlarna(
            order,
            trackingNumber,
            trackingCarrier,
            captureId,
            container,
            logger,
            trackingUrl
          )
          trackingSendResult.success = true
        } else {
          logger.warn(
            `[Tracking Dispatcher] No Klarna capture ID found for order ${order.id}`
          )
        }
      } else {
        logger.info(
          `[Tracking Dispatcher] Provider ${providerId} does not support tracking API`
        )
      }
    } catch (error: any) {
      logger.error(
        `[Tracking Dispatcher] Failed to send tracking to ${providerId}: ${error.message}`
      )
      trackingSendResult.success = false
    }

    // Log tracking dispatch to activity log
    activityLog.push({
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
    })

    // Update order metadata
    updatedMetadata.payment_activity_log = activityLog
    updatedMetadata.tracking_sent_to_gateway = {
      ...(updatedMetadata.tracking_sent_to_gateway || {}),
      [providerId]: trackingSendResult.success,
      [`${providerId}_timestamp`]: trackingSendResult.timestamp,
    }

    await orderModuleService.updateOrders([
      { id: order.id, metadata: updatedMetadata },
    ])

    logger.info(
      `[Tracking Dispatcher] Order ${order.id} tracking dispatched to ${providerId}`
    )

    // ─── Step 3: Send shipment notification email to customer ─────────
    // Delay 5 seconds to allow all metadata to settle (multiple events may arrive close together)
    if (!order.metadata?.shipment_email_sent && trackingNumber) {
      setTimeout(async () => {
        try {
          // Re-read order to get latest metadata (may have been updated by concurrent events)
          const freshOrder = await orderModuleService.retrieveOrder(orderId, {
            relations: ["items", "shipping_address"],
          })

          // Double-check: status is DISPATCHED, tracking exists, email not yet sent
          if (freshOrder.metadata?.shipment_email_sent) {
            logger.info(`[Tracking Dispatcher] Shipment email already sent for order ${orderId}, skipping`)
            return
          }
          if (freshOrder.metadata?.dextrum_status !== "DISPATCHED") return
          const freshTracking = freshOrder.metadata?.dextrum_tracking_number
          if (!freshTracking) return

          // Mark email as sent FIRST to prevent duplicates
          await orderModuleService.updateOrders([{
            id: orderId,
            metadata: { ...freshOrder.metadata, shipment_email_sent: true, shipment_email_sent_at: new Date().toISOString() },
          }])

          // Resolve shipping address
          let shippingAddress: any = freshOrder.shipping_address
          try {
            if (shippingAddress?.id) {
              shippingAddress = await (orderModuleService as any).orderAddressService_.retrieve(shippingAddress.id)
            }
          } catch { /* keep existing */ }

          // Build tracking URL
          const freshCarrier = freshOrder.metadata?.dextrum_carrier || "GLS"
          const freshTrackingUrl = freshOrder.metadata?.dextrum_tracking_url || buildTrackingUrl(freshCarrier, freshTracking)

          // Get project-specific email config
          const { getProjectEmailConfig, getEmailSubject } = require("../utils/project-email-config")
          const { EmailTemplates, resolveTemplateKey } = require("../modules/email-notifications/templates")
          const { resolveBillingEntity } = require("../utils/resolve-billing-entity")
          const { logEmailActivity } = require("../utils/email-logger")
          const { renderEmailToHtml } = require("../utils/render-email-html")
          const { Modules } = require("@medusajs/framework/utils")

          const notificationService = container.resolve(Modules.NOTIFICATION) as any
          const projectConfig = getProjectEmailConfig(freshOrder)
          const templateKey = resolveTemplateKey(EmailTemplates.SHIPMENT_NOTIFICATION, projectConfig.project)
          const displayId = freshOrder.metadata?.custom_order_number || freshOrder.display_id || freshOrder.id
          const emailSubject = getEmailSubject(projectConfig, "shipmentSent", { id: String(displayId) })
          const emailPreview = getEmailSubject(projectConfig, "shipmentPreview")

          // Resolve billing entity for footer
          let billingEntity: any = null
          try { billingEntity = await resolveBillingEntity(container, orderId) } catch { /* ok */ }

          // Send the email
          await notificationService.createNotifications({
            to: freshOrder.email,
            channel: "email",
            template: templateKey,
            ...(projectConfig.fromEmail ? { from: projectConfig.fromEmail } : {}),
            data: {
              emailOptions: { replyTo: projectConfig.replyTo, subject: emailSubject },
              order: freshOrder,
              shippingAddress,
              trackingNumber: freshTracking,
              trackingUrl: freshTrackingUrl,
              trackingCompany: freshCarrier,
              billingEntity,
              preview: emailPreview,
            },
          })

          // Log email activity in order timeline
          const htmlBody = await renderEmailToHtml(templateKey, {
            order: freshOrder, shippingAddress, trackingNumber: freshTracking,
            trackingUrl: freshTrackingUrl, trackingCompany: freshCarrier,
            billingEntity, preview: emailPreview,
          }).catch(() => "")

          await logEmailActivity(orderModuleService, orderId, {
            template: "shipment_notification",
            subject: emailSubject,
            to: freshOrder.email,
            status: "sent",
            ...(htmlBody ? { html_body: htmlBody } : {}),
          }).catch(() => {})

          logger.info(`[Tracking Dispatcher] ✅ Shipment email sent to ${freshOrder.email} for order ${displayId} (tracking: ${freshTracking})`)
        } catch (emailErr: any) {
          logger.error(`[Tracking Dispatcher] ❌ Failed to send shipment email for order ${orderId}: ${emailErr.message}`)
        }
      }, 5000) // 5 second delay
    }
  } catch (error: any) {
    logger.error(`[Tracking Dispatcher] Error: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: ["order.updated"],
}

// ─── Auto-Capture: PayPal ──────────────────────────────────────────────
async function capturePayPal(
  order: any,
  container: any,
  logger: any
): Promise<{ captureId: string }> {
  const paypalOrderId = order.metadata?.paypalOrderId
  const authorizationId = order.metadata?.authorizationId

  if (!paypalOrderId && !authorizationId) {
    throw new Error("No PayPal Order ID or Authorization ID found")
  }

  // Get credentials: try gatewayConfig first, fallback to env vars
  let clientId: string | undefined
  let clientSecret: string | undefined
  let mode: "live" | "test" = "test"

  try {
    const gcService = container.resolve("gatewayConfig")
    const configs = await gcService.listGatewayConfigs(
      { provider: "paypal", is_active: true },
      { take: 1 }
    )
    const config = configs[0]
    if (config) {
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      clientId = keys?.client_id || keys?.api_key
      clientSecret = keys?.client_secret || keys?.secret_key
      mode = isLive ? "live" : "test"
    }
  } catch {
    // gatewayConfig not available, use env vars
  }

  if (!clientId) clientId = process.env.PAYPAL_CLIENT_ID
  if (!clientSecret) clientSecret = process.env.PAYPAL_CLIENT_SECRET
  if (process.env.PAYPAL_MODE === "live") mode = "live"

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured")
  }

  const { PayPalApiClient } = await import(
    "../modules/payment-paypal/api-client"
  )
  const client = new PayPalApiClient({
    client_id: clientId,
    client_secret: clientSecret,
    mode,
  })

  const currency = order.currency_code?.toUpperCase() || "EUR"
  const amountValue = Number(order.total).toFixed(2)

  if (authorizationId) {
    const result = await client.captureAuthorization(authorizationId, {
      currency_code: currency,
      value: amountValue,
    })
    logger.info(
      `[Tracking Dispatcher] PayPal authorization ${authorizationId} captured: ${result.id}`
    )
    return { captureId: result.id }
  } else {
    const result = await client.captureOrder(paypalOrderId)
    const captureId =
      result.purchase_units?.[0]?.payments?.captures?.[0]?.id || result.id
    logger.info(
      `[Tracking Dispatcher] PayPal order ${paypalOrderId} captured: ${captureId}`
    )
    return { captureId }
  }
}

// ─── Auto-Capture: Klarna (with shipping_info) ────────────────────────
async function captureKlarna(
  order: any,
  container: any,
  logger: any,
  trackingNumber: string,
  trackingCarrier: string,
  trackingUrl: string
): Promise<{ captureId: string }> {
  const klarnaOrderId = order.metadata?.klarnaOrderId
  if (!klarnaOrderId) {
    throw new Error("No Klarna Order ID found")
  }

  // Get credentials: try gatewayConfig first, fallback to env vars
  let apiKey: string | undefined
  let secretKey: string | undefined
  let testMode = true

  try {
    const gcService = container.resolve("gatewayConfig")
    const configs = await gcService.listGatewayConfigs(
      { provider: "klarna", is_active: true },
      { take: 1 }
    )
    const config = configs[0]
    if (config) {
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      apiKey = keys?.api_key
      secretKey = keys?.secret_key
      testMode = !isLive
    }
  } catch {
    // gatewayConfig not available, use env vars
  }

  if (!apiKey) apiKey = process.env.KLARNA_API_KEY
  if (!secretKey) secretKey = process.env.KLARNA_SECRET_KEY
  if (process.env.KLARNA_TEST_MODE === "false") testMode = false

  if (!apiKey || !secretKey) {
    throw new Error("Klarna credentials not configured")
  }

  const { KlarnaApiClient } = await import(
    "../modules/payment-klarna/api-client"
  )
  const client = new KlarnaApiClient(apiKey, secretKey, testMode)

  // Capture with shipping_info included (Klarna supports this natively)
  // order.total is in major units (e.g. 99 = €99.00); Klarna needs minor units (cents)
  const result = await client.captureOrder(klarnaOrderId, {
    captured_amount: Math.round(Number(order.total) * 100),
    description: `Capture for order ${order.display_id || order.id}`,
    shipping_info: [
      {
        shipping_company: normalizeKlarnaCarrier(trackingCarrier),
        tracking_number: trackingNumber,
        tracking_uri: trackingUrl || undefined,
      },
    ],
  })

  if (!result.success) {
    throw new Error(result.error || "Klarna capture failed")
  }

  const captureId = result.data?.capture_id || "unknown"
  logger.info(
    `[Tracking Dispatcher] Klarna order ${klarnaOrderId} captured with tracking: ${captureId}`
  )
  return { captureId }
}

// ─── Auto-Capture: Airwallex ──────────────────────────────────────────
async function captureAirwallex(
  order: any,
  container: any,
  logger: any
): Promise<{ captureId: string }> {
  const intentId = order.metadata?.airwallexPaymentIntentId || order.metadata?.intentId
  if (!intentId) {
    throw new Error("No Airwallex Payment Intent ID found")
  }

  // Get credentials from gateway config
  let apiKey: string | undefined
  let secretKey: string | undefined
  let isTest = true

  try {
    const gcService = container.resolve("gatewayConfig")
    const configs = await gcService.listGatewayConfigs(
      { provider: "airwallex", is_active: true },
      { take: 1 }
    )
    const config = configs[0]
    if (config) {
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      apiKey = keys?.api_key
      secretKey = keys?.secret_key
      isTest = !isLive
    }
  } catch {
    // gatewayConfig not available
  }

  if (!apiKey) apiKey = process.env.AIRWALLEX_CLIENT_ID
  if (!secretKey) secretKey = process.env.AIRWALLEX_API_KEY
  if (process.env.AIRWALLEX_TEST_MODE === "false") isTest = false

  if (!apiKey || !secretKey) {
    throw new Error("Airwallex credentials not configured")
  }

  const { AirwallexApiClient } = await import(
    "../modules/payment-airwallex/api-client"
  )
  // Resolve account_id for org-level keys
  let accountId: string | undefined
  try {
    const gcService2 = container.resolve("gatewayConfig")
    const configs2 = await gcService2.listGatewayConfigs(
      { provider: "airwallex", is_active: true },
      { take: 1 }
    )
    const k = configs2[0]?.mode === "live" ? configs2[0]?.live_keys : configs2[0]?.test_keys
    accountId = k?.account_id
  } catch {}

  const client = new AirwallexApiClient(apiKey, secretKey, isTest, logger, accountId)
  await client.login()

  // Airwallex uses major units (same as order.total, no conversion needed)
  const result = await client.capturePaymentIntent(intentId, {
    amount: Number(order.total),
  })

  logger.info(
    `[Tracking Dispatcher] Airwallex intent ${intentId} captured: ${result.id}`
  )
  return { captureId: result.id }
}

// ─── Send Tracking: Stripe ─────────────────────────────────────────────
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

// ─── Send Tracking: PayPal (requires capture_id) ───────────────────────
async function sendTrackingToPayPal(
  order: any,
  trackingNumber: string,
  trackingCarrier: string,
  captureId: string | undefined,
  container: any,
  logger: any
): Promise<void> {
  const paypalOrderId = order.metadata?.paypalOrderId
  if (!paypalOrderId) {
    throw new Error("No PayPal Order ID found in order metadata")
  }

  if (!captureId) {
    // Try to get capture_id from PayPal order details
    logger.warn(
      `[Tracking Dispatcher] No capture_id for PayPal, attempting to fetch from order`
    )
  }

  // Get credentials
  let clientId: string | undefined
  let clientSecret: string | undefined
  let mode: "live" | "test" = "test"

  try {
    const gcService = container.resolve("gatewayConfig")
    const configs = await gcService.listGatewayConfigs(
      { provider: "paypal", is_active: true },
      { take: 1 }
    )
    const config = configs[0]
    if (config) {
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      clientId = keys?.client_id || keys?.api_key
      clientSecret = keys?.client_secret || keys?.secret_key
      mode = isLive ? "live" : "test"
    }
  } catch {
    // fallback to env vars
  }

  if (!clientId) clientId = process.env.PAYPAL_CLIENT_ID
  if (!clientSecret) clientSecret = process.env.PAYPAL_CLIENT_SECRET
  if (process.env.PAYPAL_MODE === "live") mode = "live"

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured for tracking")
  }

  const { PayPalApiClient } = await import(
    "../modules/payment-paypal/api-client"
  )
  const client = new PayPalApiClient({
    client_id: clientId,
    client_secret: clientSecret,
    mode,
  })

  // If no capture_id, try to get it from PayPal order
  if (!captureId) {
    const orderDetails = await client.getOrder(paypalOrderId)
    captureId =
      orderDetails.purchase_units?.[0]?.payments?.captures?.[0]?.id
    if (!captureId) {
      throw new Error("Could not find capture_id from PayPal order")
    }
    logger.info(
      `[Tracking Dispatcher] Found PayPal capture_id from order: ${captureId}`
    )
  }

  // Get country code for better carrier mapping
  let countryCode = ""
  try {
    const orderModuleService = container.resolve("order") as any
    const orderForAddr = await orderModuleService.retrieveOrder(order.id, { relations: ["shipping_address"] })
    let shipAddr: any = orderForAddr?.shipping_address
    try {
      if (shipAddr?.id) shipAddr = await (orderModuleService as any).orderAddressService_.retrieve(shipAddr.id)
    } catch {}
    countryCode = shipAddr?.country_code || ""
  } catch {}

  await client.addTracking(
    paypalOrderId,
    captureId,
    trackingNumber,
    normalizePayPalCarrier(trackingCarrier, countryCode),
    true
  )

  logger.info(
    `[Tracking Dispatcher] PayPal tracking sent for order ${paypalOrderId}`
  )
}

// ─── Send Tracking: Mollie ─────────────────────────────────────────────
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

// ─── Send Tracking: Klarna (after capture, adds shipping info) ─────────
async function sendTrackingToKlarna(
  order: any,
  trackingNumber: string,
  trackingCarrier: string,
  captureId: string,
  container: any,
  logger: any,
  trackingUrl: string
): Promise<void> {
  const klarnaOrderId = order.metadata?.klarnaOrderId
  if (!klarnaOrderId) {
    throw new Error("No Klarna Order ID found in order metadata")
  }

  // Get credentials
  let apiKey: string | undefined
  let secretKey: string | undefined
  let testMode = true

  try {
    const gcService = container.resolve("gatewayConfig")
    const configs = await gcService.listGatewayConfigs(
      { provider: "klarna", is_active: true },
      { take: 1 }
    )
    const config = configs[0]
    if (config) {
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      apiKey = keys?.api_key
      secretKey = keys?.secret_key
      testMode = !isLive
    }
  } catch {
    // fallback to env vars
  }

  if (!apiKey) apiKey = process.env.KLARNA_API_KEY
  if (!secretKey) secretKey = process.env.KLARNA_SECRET_KEY
  if (process.env.KLARNA_TEST_MODE === "false") testMode = false

  if (!apiKey || !secretKey) {
    throw new Error("Klarna credentials not configured for tracking")
  }

  const { KlarnaApiClient } = await import(
    "../modules/payment-klarna/api-client"
  )
  const client = new KlarnaApiClient(apiKey, secretKey, testMode)

  await client.addShippingInfo(klarnaOrderId, captureId, {
    shipping_company: normalizeKlarnaCarrier(trackingCarrier),
    tracking_number: trackingNumber,
    tracking_uri: trackingUrl || undefined,
  })

  logger.info(
    `[Tracking Dispatcher] Klarna tracking sent for order ${klarnaOrderId}`
  )
}

// ─── Carrier Normalization ─────────────────────────────────────────────
function normalizePayPalCarrier(carrier: string, countryCode?: string): string {
  const c = (carrier || "").toLowerCase()
  const cc = (countryCode || "").toLowerCase()

  if (c.includes("gls")) {
    const glsMap: Record<string, string> = { cz: "GLS_CZ", nl: "NLD_GLS", de: "GLS_DE", hu: "GLS_HUN", sk: "GLS_SLOV" }
    return glsMap[cc] || "GLS"
  }
  if (c.includes("packeta") || c.includes("zasilkovna")) return "PACKETA"
  if (c.includes("inpost")) return "INPOST_PACZKOMATY"
  if (c.includes("ppl")) return "PPL"
  if (c.includes("postnl")) return "NLD_POSTNL"
  if (c.includes("dhl")) {
    const dhlMap: Record<string, string> = { de: "DE_DHL", nl: "NLD_DHL", pl: "DHL_PL" }
    return dhlMap[cc] || "DHL"
  }
  if (c.includes("dpd")) {
    const dpdMap: Record<string, string> = { pl: "DPD_POLAND", de: "DPD_DE", nl: "DPD_NL", hu: "DPD_HGRY" }
    return dpdMap[cc] || "DPD"
  }
  if (c.includes("ceska") || c.includes("cpost")) return "CESKA_CZ"
  if (c.includes("poczta")) return "PL_POCZTA_POLSKA"

  const fallbackMap: Record<string, string> = {
    fedex: "FEDEX", ups: "UPS", usps: "USPS",
  }
  return fallbackMap[c] || "OTHER"
}

function normalizeMollieCarrier(carrier: string): string {
  const carrierMap: Record<string, string> = {
    dhl: "DHL",
    "dhl-parcel": "DHL Parcel",
    dpd: "DPD",
    fedex: "FedEx",
    ups: "UPS",
    usps: "USPS",
    dpe: "DPE",
    postnl: "PostNL",
    gls: "GLS",
    other: "Other",
  }
  return carrierMap[carrier.toLowerCase()] || carrier
}

function normalizeKlarnaCarrier(carrier: string): string {
  const carrierMap: Record<string, string> = {
    dhl: "DHL",
    "dhl-parcel": "DHL Parcel",
    dpd: "DPD",
    fedex: "FedEx",
    ups: "UPS",
    usps: "USPS",
    dpe: "DPE",
    postnl: "PostNL",
    gls: "GLS",
    other: "Other",
  }
  return carrierMap[carrier.toLowerCase()] || carrier
}

function buildTrackingUrl(carrier: string, trackingNumber: string): string {
  const urlMap: Record<string, string> = {
    dhl: `https://tracking.dhl.com/?shipmentid=${trackingNumber}`,
    "dhl-parcel": `https://www.dhlparcel.nl/nl/volg-je-pakket?tc=${trackingNumber}`,
    dpd: `https://tracking.dpd.de/parcelstatus?query=${trackingNumber}`,
    fedex: `https://tracking.fedex.com/tracking?tracknumbers=${trackingNumber}`,
    ups: `https://www.ups.com/track?tracknum=${trackingNumber}`,
    usps: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
    dpe: `https://tracking.cpost.cz/${trackingNumber}`,
    postnl: `https://postnl.nl/tracktrace/?B=${trackingNumber}`,
    gls: `https://gls-group.eu/GROUP/en/parcel-tracking?match=${trackingNumber}`,
  }
  return urlMap[carrier.toLowerCase()] || ""
}
