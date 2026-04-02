// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { emitPaymentLog } from "../../../utils/payment-logger"

const GATEWAY_CONFIG_MODULE = "gatewayConfig"

/**
 * PayPal webhook handler
 *
 * Event types:
 * - CHECKOUT.ORDER.APPROVED — customer approved the payment
 * - CHECKOUT.ORDER.COMPLETED — order completed
 * - PAYMENT.AUTHORIZATION.CREATED — authorization created (29 days validity)
 * - PAYMENT.AUTHORIZATION.VOIDED — authorization voided (expired or cancelled)
 * - PAYMENT.CAPTURE.COMPLETED — payment captured successfully
 * - PAYMENT.CAPTURE.DENIED — capture denied
 * - PAYMENT.CAPTURE.PENDING — capture pending
 * - PAYMENT.CAPTURE.REFUNDED — refund completed
 * - PAYMENT.CAPTURE.REVERSED — payment reversed (dispute)
 * - CUSTOMER.DISPUTE.CREATED — dispute opened
 * - CUSTOMER.DISPUTE.RESOLVED — dispute resolved
 *
 * Always returns 200 OK to prevent PayPal retries.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const event = req.body as any
    const eventType = event.event_type
    const resource = event.resource || {}

    if (!eventType) {
      return res.status(200).json({ received: true, error: "No event_type" })
    }

    const logger = req.scope.resolve("logger")
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    logger.info(
      `[PayPal Webhook] Received event: ${eventType}, resource.id: ${resource.id}`
    )

    // ─── Verify webhook signature ───
    let signatureVerified = false
    try {
      const gcService = req.scope.resolve(GATEWAY_CONFIG_MODULE)
      const configs = await gcService.listGatewayConfigs(
        { provider: "paypal", is_active: true },
        { take: 1 }
      )
      const config = configs[0]
      if (config) {
        const isLive = config.mode === "live"
        const keys = isLive ? config.live_keys : config.test_keys
        // Support both generic key names (api_key/secret_key from admin form)
        // and PayPal-specific names (client_id/client_secret)
        const webhookId = keys?.webhook_id || keys?.webhook_secret
        const cfgClientId = keys?.client_id || keys?.api_key
        const cfgClientSecret = keys?.client_secret || keys?.secret_key

        if (webhookId && cfgClientId && cfgClientSecret) {
          const { PayPalApiClient } = await import(
            "../../../modules/payment-paypal/api-client"
          )
          const client = new PayPalApiClient({
            client_id: cfgClientId,
            client_secret: cfgClientSecret,
            mode: isLive ? "live" : "test",
          })

          const reqHeaders: Record<string, string> = {}
          for (const key of [
            "paypal-auth-algo",
            "paypal-cert-url",
            "paypal-transmission-id",
            "paypal-transmission-sig",
            "paypal-transmission-time",
          ]) {
            reqHeaders[key] = (req.headers[key] as string) || ""
          }

          signatureVerified = await client.verifyWebhookSignature(
            webhookId,
            reqHeaders,
            event
          )
          logger.info(
            `[PayPal Webhook] Signature verification: ${signatureVerified ? "SUCCESS" : "FAILED"}`
          )
        } else {
          logger.warn("[PayPal Webhook] No webhook_id configured — skipping signature verification")
        }
      }
    } catch (e: any) {
      logger.warn(`[PayPal Webhook] Signature verification error: ${e.message}`)
    }

    // Map event type to activity event and status
    const mapping = mapPayPalEvent(eventType)

    // ─── Find the Medusa order ───
    // Extract PayPal Order ID from the event resource
    let paypalOrderId: string | null = null

    // Different events have the order ID in different places
    if (resource.supplementary_data?.related_ids?.order_id) {
      paypalOrderId = resource.supplementary_data.related_ids.order_id
    } else if (
      eventType.startsWith("CHECKOUT.ORDER") &&
      resource.id
    ) {
      paypalOrderId = resource.id
    }

    // For capture/authorization events, the order ID might be in links
    if (!paypalOrderId && resource.links) {
      const orderLink = resource.links.find(
        (l: any) => l.rel === "up" && l.href?.includes("/checkout/orders/")
      )
      if (orderLink) {
        paypalOrderId = orderLink.href.split("/checkout/orders/")[1]?.split("/")?.[0]
      }
    }

    let order = null

    // Strategy 1: Search by paypalOrderId in metadata
    if (paypalOrderId) {
      try {
        const { data: orders } = await query.graph({
          entity: "order",
          fields: ["id", "metadata", "total", "currency_code"],
          filters: {},
          pagination: { order: { created_at: "DESC" }, skip: 0, take: 100 },
        })

        for (const o of orders || []) {
          if (
            o.metadata?.paypalOrderId === paypalOrderId ||
            o.metadata?.payment_paypal_order_id === paypalOrderId
          ) {
            order = o
            logger.info(`[PayPal Webhook] Found order ${o.id} via metadata`)
            break
          }
        }
      } catch (e: any) {
        logger.warn(`[PayPal Webhook] Metadata search failed: ${e.message}`)
      }
    }

    // Strategy 2: Search by payment session data
    if (!order) {
      try {
        const { data: orders } = await query.graph({
          entity: "order",
          fields: [
            "id",
            "metadata",
            "total",
            "currency_code",
            "payment_collections.*",
            "payment_collections.payments.*",
          ],
          filters: {},
          pagination: { order: { created_at: "DESC" }, skip: 0, take: 50 },
        })

        for (const o of orders || []) {
          const payments =
            o.payment_collections?.flatMap((pc: any) => pc.payments || []) || []
          for (const p of payments) {
            if (
              p.data?.paypalOrderId === paypalOrderId ||
              p.data?.paypalOrderId === resource.id
            ) {
              order = o
              logger.info(
                `[PayPal Webhook] Found order ${o.id} via payment session data`
              )
              break
            }
          }
          if (order) break
        }
      } catch (e: any) {
        logger.warn(`[PayPal Webhook] Payment session search failed: ${e.message}`)
      }
    }

    if (order) {
      const activityEntry: any = {
        timestamp: new Date().toISOString(),
        event: mapping.activityEvent,
        gateway: "paypal",
        payment_method: "paypal",
        status: mapping.activityStatus,
        amount: resource.amount?.value || order.total || 0,
        currency: resource.amount?.currency_code || order.currency_code,
        transaction_id: resource.id || paypalOrderId,
        webhook_event_type: eventType,
        provider_raw_status: resource.status || eventType,
        error_message: mapping.isFailEvent
          ? `PayPal event: ${eventType}`
          : undefined,
        detail: `PayPal event: ${eventType}`,
      }

      if (mapping.isFailEvent) {
        const processorResponse = resource.processor_response || {}
        activityEntry.error_code = processorResponse.response_code || resource.status || eventType
        activityEntry.decline_reason = resource.status_details?.reason
          || processorResponse.avs_code
          || `PayPal ${mapping.activityEvent}`
      }

      const existingLog = order.metadata?.payment_activity_log || []
      const updatedMetadata: any = {
        ...order.metadata,
        payment_activity_log: [...existingLog, activityEntry],
        paypalStatus: eventType,
      }

      if (paypalOrderId) {
        updatedMetadata.paypalOrderId = paypalOrderId
      }

      // Mark as captured when PayPal confirms capture
      if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
        updatedMetadata.payment_captured = true
        updatedMetadata.payment_captured_at = new Date().toISOString()
        updatedMetadata.payment_paypal_capture_id = resource.id
      }

      // Mark authorization voided (expired or cancelled)
      if (eventType === "PAYMENT.AUTHORIZATION.VOIDED") {
        updatedMetadata.paypal_authorization_voided = true
        updatedMetadata.paypal_voided_at = new Date().toISOString()
      }

      // Mark refund
      if (eventType === "PAYMENT.CAPTURE.REFUNDED") {
        updatedMetadata.paypal_refunded = true
        updatedMetadata.paypal_refunded_at = new Date().toISOString()
      }

      // Mark dispute
      if (eventType === "CUSTOMER.DISPUTE.CREATED") {
        updatedMetadata.paypal_dispute = true
        updatedMetadata.paypal_dispute_id = resource.dispute_id || resource.id
        updatedMetadata.paypal_dispute_at = new Date().toISOString()
      }

      // Mark dispute resolved
      if (eventType === "CUSTOMER.DISPUTE.RESOLVED") {
        updatedMetadata.paypal_dispute_resolved = true
        updatedMetadata.paypal_dispute_resolved_at = new Date().toISOString()
      }

      // Mark payment reversed (chargeback)
      if (eventType === "PAYMENT.CAPTURE.REVERSED") {
        updatedMetadata.paypal_reversed = true
        updatedMetadata.paypal_reversed_at = new Date().toISOString()
      }

      // Save authorization ID when created
      if (eventType === "PAYMENT.AUTHORIZATION.CREATED") {
        updatedMetadata.payment_paypal_authorization_id = resource.id
      }

      // Update order metadata via direct DB query (orderModuleService not available in webhook context)
      try {
        const { Pool } = require("pg")
        const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
        await pool.query(
          `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(updatedMetadata), order.id]
        )
        await pool.end()
      } catch (dbErr: any) {
        logger.warn(`[PayPal Webhook] DB update failed: ${dbErr.message}`)
      }

      logger.info(
        `[PayPal Webhook] Order ${order.id} updated with event: ${eventType}`
      )

      // Emit custom event when payment is captured so subscribers can react (e-book delivery etc.)
      if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
        try {
          const { ContainerRegistrationKeys } = await import("@medusajs/framework/utils")
          const eventBus = req.scope.resolve(ContainerRegistrationKeys.EVENT_BUS)
          await eventBus.emit("payment.captured", { id: order.id })
          logger.info(`[PayPal Webhook] Emitted payment.captured event for order ${order.id}`)
        } catch (e: any) {
          logger.warn(`[PayPal Webhook] Failed to emit payment.captured: ${e.message}`)
        }
      }

      emitPaymentLog(logger, {
        provider: "paypal",
        event: eventType,
        order_id: order.id,
        transaction_id: resource.id || paypalOrderId || undefined,
        status: mapping.activityStatus as any,
        amount: parseFloat(resource.amount?.value) || order.total || undefined,
        currency: resource.amount?.currency_code || order.currency_code,
        payment_method: "paypal",
        error_code: activityEntry.error_code,
        decline_reason: activityEntry.decline_reason,
        provider_raw_status: resource.status || eventType,
      })
    } else {
      logger.warn(
        `[PayPal Webhook] No Medusa order found for PayPal event: ${eventType}, resource: ${resource.id}, orderId: ${paypalOrderId}`
      )

      // ─── SAFETY NET: Auto-complete cart when payment was captured but order doesn't exist ───
      // This handles the case where PayPal express checkout captured payment client-side
      // but the browser closed/errored before completing the cart on the backend.
      if (eventType === "PAYMENT.CAPTURE.COMPLETED" && paypalOrderId) {
        logger.info(`[PayPal Webhook] Safety net: attempting to find and complete cart for PayPal order ${paypalOrderId}`)
        try {
          // Search for cart with this PayPal order in payment session data
          const { data: carts } = await query.graph({
            entity: "cart",
            fields: [
              "id",
              "completed_at",
              "email",
              "payment_collection.*",
              "payment_collection.payment_sessions.*",
            ],
            filters: {},
            pagination: { order: { created_at: "DESC" }, skip: 0, take: 50 },
          })

          let targetCart: any = null
          for (const cart of carts || []) {
            if (cart.completed_at) continue // skip already completed carts
            const sessions = cart.payment_collection?.payment_sessions || []
            for (const session of sessions) {
              if (
                session.data?.paypalOrderId === paypalOrderId ||
                session.data?.id === paypalOrderId
              ) {
                targetCart = cart
                break
              }
            }
            if (targetCart) break
          }

          if (targetCart) {
            logger.info(`[PayPal Webhook] Safety net: found uncompleted cart ${targetCart.id} — attempting to complete`)

            // Extract payer address from PayPal order and update the cart before completing
            try {
              const session = targetCart.payment_collection?.payment_sessions?.find(
                (s: any) => s.data?.paypalOrderId === paypalOrderId || s.data?.id === paypalOrderId
              )
              const projectSlug = session?.data?.project_slug || null
              const { PayPalApiClient } = await import("../../../modules/payment-paypal/api-client")

              // Resolve PayPal credentials for this project
              const gcService = req.scope.resolve(GATEWAY_CONFIG_MODULE)
              const gcFilters: any = { provider: "paypal", is_active: true }
              if (projectSlug) gcFilters.project_slug = projectSlug
              const configs = await gcService.listGatewayConfigs(gcFilters, { take: 1 })
              const config = configs[0]

              if (config) {
                const isLive = config.mode === "live"
                const keys = isLive ? config.live_keys : config.test_keys
                const client = new PayPalApiClient({
                  client_id: keys?.client_id || keys?.api_key,
                  client_secret: keys?.client_secret || keys?.secret_key,
                  mode: isLive ? "live" : "test",
                })

                const ppOrder = await client.getOrder(paypalOrderId)
                const payer = ppOrder?.payer
                const shipping = ppOrder?.purchase_units?.[0]?.shipping
                const payerAddr = payer?.address
                const shippingAddr = shipping?.address
                const resolved = shippingAddr || payerAddr

                if (resolved) {
                  let firstName = ""
                  let lastName = ""
                  const shippingName = shipping?.name?.full_name
                  if (shippingName) {
                    const parts = shippingName.split(" ")
                    firstName = parts[0] || ""
                    lastName = parts.slice(1).join(" ") || ""
                  } else if (payer?.name) {
                    firstName = payer.name.given_name || ""
                    lastName = payer.name.surname || ""
                  }

                  const mappedShipping = {
                    first_name: firstName,
                    last_name: lastName,
                    address_1: resolved.address_line_1 || "",
                    address_2: resolved.address_line_2 || "",
                    city: resolved.admin_area_2 || "",
                    province: resolved.admin_area_1 || "",
                    postal_code: resolved.postal_code || "",
                    country_code: resolved.country_code?.toLowerCase() || "",
                    phone: payer?.phone?.phone_number?.national_number || "",
                  }

                  const billingSource = payerAddr || shippingAddr
                  const mappedBilling = billingSource ? {
                    first_name: payer?.name?.given_name || firstName,
                    last_name: payer?.name?.surname || lastName,
                    address_1: billingSource.address_line_1 || "",
                    address_2: billingSource.address_line_2 || "",
                    city: billingSource.admin_area_2 || "",
                    province: billingSource.admin_area_1 || "",
                    postal_code: billingSource.postal_code || "",
                    country_code: billingSource.country_code?.toLowerCase() || "",
                    phone: payer?.phone?.phone_number?.national_number || "",
                  } : mappedShipping

                  // Update cart addresses via direct DB before completing
                  const { Pool } = require("pg")
                  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
                  const addrFields = ["first_name", "last_name", "address_1", "address_2", "city", "province", "postal_code", "country_code", "phone"]
                  const updateAddr = async (table: string, cartId: string, addr: any) => {
                    // Check if address exists for this cart
                    const existing = await pool.query(
                      `SELECT id FROM "cart_address" WHERE cart_id = $1 AND address_name = $2 LIMIT 1`,
                      [cartId, table]
                    )
                    if (existing.rows.length > 0) {
                      const sets = addrFields.map((f, i) => `"${f}" = $${i + 1}`).join(", ")
                      await pool.query(
                        `UPDATE "cart_address" SET ${sets}, updated_at = NOW() WHERE cart_id = $${addrFields.length + 1} AND address_name = $${addrFields.length + 2}`,
                        [...addrFields.map(f => addr[f] || ""), cartId, table]
                      )
                    }
                  }

                  // Use Medusa's cart service to update addresses properly
                  try {
                    const cartService = req.scope.resolve("cartModuleService") as any
                    if (cartService?.updateCarts) {
                      await cartService.updateCarts(targetCart.id, {
                        shipping_address: mappedShipping,
                        billing_address: mappedBilling,
                        ...(payer?.email_address ? { email: payer.email_address } : {}),
                      })
                      logger.info(`[PayPal Webhook] Safety net: updated cart ${targetCart.id} addresses from PayPal payer data`)
                    }
                  } catch (addrErr: any) {
                    logger.warn(`[PayPal Webhook] Safety net: cart address update via service failed: ${addrErr.message}, trying direct DB`)
                    // Fallback: update via direct SQL on the cart table
                    try {
                      await pool.query(
                        `UPDATE "cart" SET
                          shipping_address = $1::jsonb,
                          billing_address = $2::jsonb,
                          ${payer?.email_address ? "email = $4," : ""}
                          updated_at = NOW()
                        WHERE id = $3`,
                        [
                          JSON.stringify(mappedShipping),
                          JSON.stringify(mappedBilling),
                          targetCart.id,
                          ...(payer?.email_address ? [payer.email_address] : []),
                        ]
                      )
                      logger.info(`[PayPal Webhook] Safety net: updated cart ${targetCart.id} addresses via direct DB`)
                    } catch (sqlErr: any) {
                      logger.warn(`[PayPal Webhook] Safety net: direct DB address update also failed: ${sqlErr.message}`)
                    }
                  }
                  await pool.end()
                }
              }
            } catch (addrExtractErr: any) {
              logger.warn(`[PayPal Webhook] Safety net: failed to extract/update payer address: ${addrExtractErr.message}`)
            }

            // Complete the cart via Medusa's cart completion workflow
            const { completeCartWorkflow } = await import("@medusajs/medusa/core-flows")
            const result = await completeCartWorkflow(req.scope).run({
              input: { id: targetCart.id },
            })

            const completedOrder = (result as any)?.result?.order || (result as any)?.order
            if (completedOrder) {
              logger.info(`[PayPal Webhook] Safety net: ✅ Cart ${targetCart.id} completed → order ${completedOrder.id} (display_id: ${completedOrder.display_id})`)
            } else {
              logger.info(`[PayPal Webhook] Safety net: Cart completion returned:`, JSON.stringify(result).slice(0, 500))
            }
          } else {
            logger.warn(`[PayPal Webhook] Safety net: No uncompleted cart found for PayPal order ${paypalOrderId}`)
          }
        } catch (safetyErr: any) {
          logger.error(`[PayPal Webhook] Safety net failed: ${safetyErr.message}`)
        }
      }

      emitPaymentLog(logger, {
        provider: "paypal",
        event: eventType,
        transaction_id: resource.id || paypalOrderId || undefined,
        status: "pending",
        payment_method: "paypal",
        metadata: { order_not_found: true },
      })
    }

    return res.status(200).json({ received: true })
  } catch (error: any) {
    const logger = req.scope.resolve("logger")
    logger.error(`[PayPal Webhook] Error: ${error.message}`)
    // Always return 200 to prevent PayPal retries
    return res.status(200).json({ received: true, error: error.message })
  }
}

function mapPayPalEvent(eventType: string): {
  activityEvent: string
  activityStatus: string
  isSuccessEvent: boolean
  isFailEvent: boolean
} {
  switch (eventType) {
    case "CHECKOUT.ORDER.APPROVED":
      return {
        activityEvent: "order_approved",
        activityStatus: "pending",
        isSuccessEvent: false,
        isFailEvent: false,
      }
    case "CHECKOUT.ORDER.COMPLETED":
      return {
        activityEvent: "order_completed",
        activityStatus: "success",
        isSuccessEvent: true,
        isFailEvent: false,
      }
    case "PAYMENT.AUTHORIZATION.CREATED":
      return {
        activityEvent: "authorization_created",
        activityStatus: "success",
        isSuccessEvent: true,
        isFailEvent: false,
      }
    case "PAYMENT.AUTHORIZATION.VOIDED":
      return {
        activityEvent: "authorization_voided",
        activityStatus: "failed",
        isSuccessEvent: false,
        isFailEvent: true,
      }
    case "PAYMENT.CAPTURE.COMPLETED":
      return {
        activityEvent: "capture",
        activityStatus: "success",
        isSuccessEvent: true,
        isFailEvent: false,
      }
    case "PAYMENT.CAPTURE.DENIED":
      return {
        activityEvent: "capture_denied",
        activityStatus: "failed",
        isSuccessEvent: false,
        isFailEvent: true,
      }
    case "PAYMENT.CAPTURE.PENDING":
      return {
        activityEvent: "capture_pending",
        activityStatus: "pending",
        isSuccessEvent: false,
        isFailEvent: false,
      }
    case "PAYMENT.CAPTURE.REFUNDED":
      return {
        activityEvent: "refund",
        activityStatus: "success",
        isSuccessEvent: true,
        isFailEvent: false,
      }
    case "PAYMENT.CAPTURE.REVERSED":
      return {
        activityEvent: "payment_reversed",
        activityStatus: "failed",
        isSuccessEvent: false,
        isFailEvent: true,
      }
    case "CUSTOMER.DISPUTE.CREATED":
      return {
        activityEvent: "dispute_created",
        activityStatus: "failed",
        isSuccessEvent: false,
        isFailEvent: true,
      }
    case "CUSTOMER.DISPUTE.RESOLVED":
      return {
        activityEvent: "dispute_resolved",
        activityStatus: "success",
        isSuccessEvent: true,
        isFailEvent: false,
      }
    default:
      return {
        activityEvent: "status_update",
        activityStatus: "pending",
        isSuccessEvent: false,
        isFailEvent: false,
      }
  }
}
