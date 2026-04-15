import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../../../modules/dextrum"
import { generateTrackingUrl } from "../../../utils/tracking-url"
import { Pool } from "pg"
import { getProjectEmailConfig, getEmailSubject, buildDispatchSms } from "../../../utils/project-email-config"
import { sendSms, isGoSmsConfigured } from "../../../utils/gosms-client"
import { EmailTemplates, resolveTemplateKey } from "../../../modules/email-notifications/templates"
import { resolveBillingEntity } from "../../../utils/resolve-billing-entity"
import { logEmailActivity } from "../../../utils/email-logger"
import { renderEmailToHtml } from "../../../utils/render-email-html"
import { normalizePhone } from "../../../utils/normalize-phone"

// ═══════════════════════════════════════════
// WEBHOOK EVENT → DELIVERY STATUS MAPPING
// ═══════════════════════════════════════════
const EVENT_STATUS_MAP: Record<string, string> = {
  // Event 7 (order processing)
  "7_1": "IMPORTED",
  "7_2": "PROCESSED",
  "7_3": "PROCESSED",

  // Event 12 (despatch advice) = shipped
  "12": "DISPATCHED",

  // Event 26 (label printed) = packed
  "26": "PACKED",

  // Event 28 (partial pick)
  "28": "PARTIALLY_PICKED",

  // Event 29 (carrier status update)
  "29_transit": "IN_TRANSIT",
  "29_delivered": "DELIVERED",

  // Event 20 (order cancelled)
  "20": "CANCELLED",

  // Event 34 (allocation issue)
  "34": "ALLOCATION_ISSUE",

  // Event 3 (location/warehouse change — triggers stock availability update)
  "3": "STOCK_CHANGE",

  // Event 33 (stock level change)
  "33": "STOCK_CHANGE",
}

// GET /webhooks/mystock — Returns server outbound IP (for firewall whitelisting)
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const response = await fetch("https://api.ipify.org?format=json")
    const data = await response.json() as { ip: string }
    res.json({ ip: data.ip })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

// ═══════════════════════════════════════════
// WEBHOOK BASIC AUTH CREDENTIALS
// mySTOCK requires HTTP Basic Auth on webhook endpoints
// ═══════════════════════════════════════════
const WEBHOOK_USERNAME = process.env.MYSTOCK_WEBHOOK_USERNAME || "mystock"
const WEBHOOK_PASSWORD = process.env.MYSTOCK_WEBHOOK_PASSWORD || "YTA2VdKNszJMdxnS1RKVNnntWBEurxY5"

function validateBasicAuth(req: MedusaRequest): boolean {
  const authHeader = req.headers["authorization"] as string
  if (!authHeader || !authHeader.startsWith("Basic ")) return false
  const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8")
  const [username, password] = decoded.split(":")
  return username === WEBHOOK_USERNAME && password === WEBHOOK_PASSWORD
}

// POST /webhooks/mystock — Receive mySTOCK webhook events
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  console.log(`[mySTOCK Webhook] Incoming POST /webhooks/mystock — body keys: ${Object.keys(req.body || {}).join(", ") || "empty"}`)

  // Validate Basic Auth
  if (!validateBasicAuth(req)) {
    console.warn(`[mySTOCK Webhook] ❌ Basic Auth failed — missing or invalid credentials`)
    res.status(401).json({ data: null, errors: [{ code: "UNAUTHORIZED", message: "Invalid credentials" }] })
    return
  }
  console.log(`[mySTOCK Webhook] ✅ Basic Auth verified`)

  try {
    const event = req.body as any

    if (!event || !event.eventId) {
      console.warn(`[mySTOCK Webhook] Invalid payload — missing eventId. Body:`, JSON.stringify(req.body).slice(0, 500))
      res.status(400).json({ data: null, errors: [{ code: "INVALID_PAYLOAD", message: "Missing eventId" }] })
      return
    }

    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any

    // 1. Deduplicate by eventId
    const existingEvents = await dextrumService.listDextrumEventLogs(
      { event_id: event.eventId },
      { take: 1 }
    )
    if (existingEvents[0]) {
      console.log(`[mySTOCK Webhook] Event ${event.eventId} already processed — returning success`)
      res.json({ data: { id: existingEvents[0].id }, errors: [] })
      return
    }

    // 2. Find the Medusa order by documentId or documentCode
    const documentId = event.documentId || event.data?.documentId
    const documentCode = event.documentCode || event.data?.documentCode
    const eventType = String(event.eventType ?? event.type ?? "")
    // Handle eventSubtype carefully — 0 is a valid value, don't treat as falsy
    const rawSubtype = event.eventSubtype ?? event.subtype ?? event.data?.eventSubtype ?? event.data?.subtype ?? ""
    const eventSubtype = String(rawSubtype)

    // Log ALL events with documentCode/documentId for matching debugging
    console.log(`[mySTOCK Webhook] Event ${event.eventId} type=${eventType} sub=${eventSubtype || "-"} docCode=${documentCode || "?"} docId=${documentId || "?"} time=${event.eventTime || "?"}`)

    // Log full body for dispatch/delivery events to debug tracking info
    if (["12", "29"].includes(eventType)) {
      console.log(`[mySTOCK Webhook] Event ${eventType} FULL BODY:`, JSON.stringify(event).slice(0, 2000))
    }

    let orderMap = null
    let matchedBy = "none"
    if (documentId) {
      const maps = await dextrumService.listDextrumOrderMaps(
        { mystock_order_id: documentId },
        { take: 1 }
      )
      orderMap = maps[0]
      if (orderMap) matchedBy = "documentId"
    }
    if (!orderMap && documentCode) {
      const maps = await dextrumService.listDextrumOrderMaps(
        { mystock_order_code: documentCode },
        { take: 1 }
      )
      orderMap = maps[0]
      if (orderMap) matchedBy = "documentCode"
    }
    console.log(`[mySTOCK Webhook] Match: ${matchedBy} → order=${orderMap?.mystock_order_code || "NOT FOUND"} (medusa=${orderMap?.medusa_order_id || "?"}) currentStatus=${orderMap?.delivery_status || "?"}`)

    // 3. Determine new delivery status
    let newStatus = ""
    const key = eventSubtype ? `${eventType}_${eventSubtype}` : eventType

    if (EVENT_STATUS_MAP[key]) {
      newStatus = EVENT_STATUS_MAP[key]
    } else if (EVENT_STATUS_MAP[eventType]) {
      newStatus = EVENT_STATUS_MAP[eventType]
    }

    // Special handling for Event 29 (carrier/delivery updates)
    // mySTOCK sends event 29 for multiple purposes — differentiated by note text:
    //   - note "Ostatní data přijata" = tracking assigned (NOT delivered) → DISPATCHED
    //   - note "Zásilka je u vás" / "doručena" = delivered → DELIVERED
    //   - subtype 1 = confirmed delivery → DELIVERED
    if (eventType === "29") {
      const carrierStatus = (event.data?.status ?? event.status ?? "").toLowerCase()
      const eventNote = (event.note ?? event.data?.note ?? "").toLowerCase()
      const sub = parseInt(eventSubtype, 10)

      console.log(`[mySTOCK Webhook] Event 29 DEBUG — rawSubtype=${JSON.stringify(rawSubtype)} eventSubtype="${eventSubtype}" sub=${sub} carrierStatus="${carrierStatus}" note="${eventNote}" docCode=${documentCode || "?"}`)

      // Delivery-related phrases in note (Czech carrier messages)
      // NOTE: "předán" excluded — "připravena k předání dopravci" = handoff to courier, NOT delivery
      // NOTE: "doručení na adresu" excluded — it's a delivery TYPE name (home delivery), not confirmation
      // NOTE: "připravena k předání" excluded — handoff to courier, NOT delivery
      // NOTE: "vyzvednut" = courier picked up from warehouse → DISPATCHED, NOT delivery
      const isPreparedForHandoff = eventNote.includes("připravena k předání")
        || eventNote.includes("předání externímu dopravci")
        || eventNote.includes("předání dopravci")
        || eventNote.includes("vyzvednut")
      const isDeliveryNote = !isPreparedForHandoff && (
        eventNote.includes("zásilka je u vás")
        || eventNote.includes("doručena")
        || eventNote.includes("doručeno")
        || eventNote.includes("delivered")
        || eventNote.includes("převzat")
        || eventNote.includes("dodán")
      )

      if (sub === 1) {
        // Subtype 1 = confirmed delivery
        newStatus = "DELIVERED"
        console.log(`[mySTOCK Webhook] Event 29 subtype=1 → DELIVERED for ${documentCode || documentId}`)
      } else if (isDeliveryNote) {
        // Note indicates package was delivered — regardless of subtype
        newStatus = "DELIVERED"
        console.log(`[mySTOCK Webhook] Event 29 delivery note detected ("${event.note || ""}") → DELIVERED for ${documentCode || documentId}`)
      } else if (carrierStatus === "transit" || carrierStatus === "in_transit") {
        newStatus = "IN_TRANSIT"
      } else if (isPreparedForHandoff || eventNote.includes("ostatní data") || eventNote.includes("data přijata")) {
        // Handoff to courier or tracking data assigned = DISPATCHED, NOT delivery
        newStatus = "DISPATCHED"
        console.log(`[mySTOCK Webhook] Event 29 tracking/handoff (note: "${event.note || ""}") → DISPATCHED`)
      } else if (eventSubtype === "" || eventSubtype === "0" || sub === 0) {
        // Empty/zero subtype without known note — default to DISPATCHED
        newStatus = "DISPATCHED"
        console.log(`[mySTOCK Webhook] Event 29 empty subtype, unknown note ("${event.note || ""}") → DISPATCHED`)
      } else {
        // Any other subtype — treat as delivered
        newStatus = "DELIVERED"
        console.log(`[mySTOCK Webhook] Event 29 subtype=${eventSubtype} (unknown) → treating as DELIVERED for ${documentCode || documentId}`)
      }
    }

    const previousStatus = orderMap?.delivery_status || null
    const now = new Date().toISOString()

    // 4. Validate status transition — prevent impossible jumps
    const STATUS_ORDER: Record<string, number> = {
      IMPORTED: 1, PROCESSED: 2, PACKED: 3, DISPATCHED: 4, IN_TRANSIT: 5, DELIVERED: 6, CANCELLED: 99,
    }
    const prevRank = STATUS_ORDER[previousStatus || ""] || 0
    const newRank = STATUS_ORDER[newStatus] || 0

    // Skip if new status is behind or equal to current (except CANCELLED which always applies)
    // But allow DELIVERED to always go through (rank 6) since it's the final state
    // Also allow DISPATCHED duplicates through — the action blocks (Klarna capture, PayPal tracking,
    // SMS, email) have their own deduplication guards and need to run even on repeated DISPATCHED events
    // (e.g. Event 29 carrier handoff arriving after Event 12 initial dispatch)
    const isDispatchedDuplicate = newStatus === "DISPATCHED" && newRank <= prevRank
    if (orderMap && newStatus && newStatus !== "CANCELLED" && newStatus !== "DELIVERED" && newStatus !== "DISPATCHED" && newRank <= prevRank) {
      console.log(`[mySTOCK Webhook] Event ${event.eventId} type=${eventType} — skipping status ${newStatus} (rank ${newRank}), order ${orderMap.mystock_order_code} already at ${previousStatus} (rank ${prevRank})`)
      // Still log the event but don't update the order
      await dextrumService.createDextrumEventLogs({
        event_id: event.eventId,
        event_type: eventType,
        event_subtype: eventSubtype || null,
        document_code: documentCode || null,
        document_id: documentId || null,
        raw_payload: JSON.stringify(event).slice(0, 4000),
        status: "SKIPPED",
        processed_at: now,
      })
      res.json({ data: { id: event.eventId }, errors: [] })
      return
    }
    if (isDispatchedDuplicate) {
      console.log(`[mySTOCK Webhook] Event ${event.eventId} type=${eventType} — duplicate DISPATCHED for ${orderMap?.mystock_order_code}, allowing through for action blocks (Klarna/PayPal/SMS/email)`)
    }

    // 5. Update dextrum_order_map
    if (orderMap && newStatus) {
      const updateData: any = {
        delivery_status: newStatus,
        delivery_status_updated_at: now,
      }

      // Extract tracking info from event
      // mySTOCK event 12 structure: shippingLabel (top-level) + extensionData.transportInformation[].trackingNumbers[]
      const transportInfo = event.extensionData?.transportInformation?.[0]
      const trackingFromEvent =
        event.shippingLabel ||
        transportInfo?.trackingNumbers?.[0]?.fullTrackingNumber ||
        transportInfo?.trackingNumbers?.[0]?.trackingNumber ||
        event.fullTrackingNumber || event.data?.fullTrackingNumber ||
        event.trackingNumber || event.data?.trackingNumber ||
        event.logisticLabelCode || event.data?.logisticLabelCode || null
      if (trackingFromEvent) {
        updateData.tracking_number = trackingFromEvent
        console.log(`[mySTOCK Webhook] Tracking number extracted: ${trackingFromEvent}`)
      }
      // Extract carrier name from extensionData
      const carrierFromEvent =
        transportInfo?.transportOperator ||
        event.carrierName || event.data?.carrierName ||
        event.carrierCode || event.data?.carrierCode || null
      if (carrierFromEvent) {
        updateData.carrier_name = carrierFromEvent
      }
      if (event.data?.trackingUrl || event.trackingUrl) {
        updateData.tracking_url = event.data?.trackingUrl || event.trackingUrl
      }
      if (newStatus === "DISPATCHED") {
        updateData.dispatched_at = now
      }
      if (newStatus === "DELIVERED") {
        updateData.delivered_at = now
      }

      await dextrumService.updateDextrumOrderMaps({ id: orderMap.id, ...updateData })

      // 5. Also update Medusa order metadata + auto-fulfill on DISPATCHED
      try {
        const queryService = req.scope.resolve("query") as any
        const { data: [order] } = await queryService.graph({
          entity: "order",
          fields: ["id", "metadata", "items.*", "fulfillments.*"],
          filters: { id: orderMap.medusa_order_id },
        })
        if (order) {
          const meta = (order as any).metadata || {}

          // Auto-generate tracking URL if we have a tracking number but no URL
          // IMPORTANT: Never overwrite existing tracking number or URL — keep the first one
          const existingTracking = meta.dextrum_tracking_number
          const existingTrackingUrl = meta.dextrum_tracking_url
          if (existingTracking && updateData.tracking_number && existingTracking !== updateData.tracking_number) {
            console.log(`[mySTOCK Webhook] Tracking already set (${existingTracking}), ignoring new tracking (${updateData.tracking_number})`)
            delete updateData.tracking_number
          }
          if (existingTrackingUrl && updateData.tracking_url) {
            delete updateData.tracking_url
          }

          const trackingNum = updateData.tracking_number || meta.dextrum_tracking_number
          let trackingUrl = existingTrackingUrl || updateData.tracking_url || ""
          let carrierCode = updateData.carrier_name || meta.dextrum_carrier || ""

          if (trackingNum && !trackingUrl) {
            try {
              // Fetch shipping address to get country + zip via orderModuleService
              const orderModuleService = req.scope.resolve(Modules.ORDER) as any
              const orderForAddr = await orderModuleService.retrieveOrder(orderMap.medusa_order_id, {
                relations: ["shipping_address"],
              })
              let shippingAddress: any = orderForAddr?.shipping_address
              try {
                if (shippingAddress?.id) {
                  shippingAddress = await (orderModuleService as any).orderAddressService_.retrieve(shippingAddress.id)
                }
              } catch { /* keep existing */ }
              const countryCode = shippingAddress?.country_code || ""
              const postalCode = shippingAddress?.postal_code || ""

              const generated = generateTrackingUrl(trackingNum, countryCode, postalCode, carrierCode)
              if (generated.trackingUrl) {
                trackingUrl = generated.trackingUrl
                updateData.tracking_url = trackingUrl
              }
              if (generated.carrier && !carrierCode) {
                carrierCode = generated.carrier
                updateData.carrier_name = carrierCode
              }
            } catch (addrErr: any) {
              console.error(`[Webhook] Failed to resolve shipping address for tracking URL:`, addrErr.message)
            }
          }

          const timelineEntry = {
            type: "dextrum",
            status: newStatus,
            date: now,
            detail: event.data?.description || `Status: ${newStatus}`,
            tracking_number: trackingNum,
          }
          const dextrumTimeline = meta.dextrum_timeline || []
          dextrumTimeline.push(timelineEntry)

          const updatedMeta = {
            ...meta,
            dextrum_status: newStatus,
            dextrum_status_updated_at: now,
            dextrum_tracking_number: trackingNum,
            dextrum_tracking_url: trackingUrl,
            dextrum_carrier: carrierCode,
            dextrum_timeline: dextrumTimeline,
          }
          const metaPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
          await metaPool.query(
            `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(updatedMeta), orderMap.medusa_order_id]
          )
          await metaPool.end()

          // Auto-fulfill on DISPATCHED — DISABLED.
          // The previous implementation did a raw INSERT into the order_fulfillment
          // PIVOT table (id, order_id, fulfillment_id) with a non-existent `metadata`
          // column, so every DISPATCHED event logged:
          //   `column "metadata" of relation "order_fulfillment" does not exist`
          // Tracking, delivery-status, and timeline data is already persisted on
          // order.metadata (dextrum_tracking_number/tracking_url/carrier/timeline),
          // which is what the custom admin UI renders. A proper Medusa fulfillment
          // record would need fulfillment + fulfillment_item + fulfillment_label +
          // order_fulfillment pivot, plus a mandatory location_id — wiring that up
          // belongs in a followup. For now, silence the noise.

          // ── PayPal tracking ──────────────────────────────────────────
          // Send tracking info to PayPal so customer sees it in their PayPal app
          if (newStatus === "DISPATCHED" && trackingNum && updatedMeta.paypalOrderId && !updatedMeta.tracking_sent_to_gateway?.paypal) {
            try {
              await sendTrackingToPayPalFromWebhook(
                updatedMeta.paypalOrderId,
                updatedMeta.paypalCaptureId,
                trackingNum,
                carrierCode,
                orderMap.medusa_order_id,
                req.scope,
                updatedMeta.project_id
              )
              // Mark as sent in metadata
              updatedMeta.tracking_sent_to_gateway = {
                ...(updatedMeta.tracking_sent_to_gateway || {}),
                paypal: true,
                paypal_timestamp: new Date().toISOString(),
              }
              // Save updated metadata with tracking_sent flag
              const ppPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
              await ppPool.query(
                `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
                [JSON.stringify(updatedMeta), orderMap.medusa_order_id]
              )
              await ppPool.end()
              console.log(`[mySTOCK Webhook] ✅ PayPal tracking sent for order ${orderMap.medusa_order_id}`)
            } catch (ppErr: any) {
              console.error(`[mySTOCK Webhook] ❌ PayPal tracking failed for order ${orderMap.medusa_order_id}:`, ppErr.message)
            }
          }

          // ── Klarna capture + tracking ─────────────────────────────────
          // Capture Klarna payment and send tracking info when order is dispatched
          if (newStatus === "DISPATCHED" && trackingNum && updatedMeta.klarnaOrderId
              && updatedMeta.payment_provider === "klarna"
              && !updatedMeta.tracking_sent_to_gateway?.klarna) {
            try {
              await captureAndTrackKlarnaFromWebhook(
                updatedMeta.klarnaOrderId,
                updatedMeta.klarnaCaptureId,
                trackingNum,
                carrierCode,
                trackingUrl,
                orderMap.medusa_order_id,
                req.scope,
                updatedMeta.project_id
              )
              // Mark as sent + captured in metadata
              updatedMeta.tracking_sent_to_gateway = {
                ...(updatedMeta.tracking_sent_to_gateway || {}),
                klarna: true,
                klarna_timestamp: new Date().toISOString(),
              }
              updatedMeta.payment_captured = true
              updatedMeta.payment_captured_at = updatedMeta.payment_captured_at || new Date().toISOString()
              // Save updated metadata
              const klarnaPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
              await klarnaPool.query(
                `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
                [JSON.stringify(updatedMeta), orderMap.medusa_order_id]
              )
              await klarnaPool.end()
              console.log(`[mySTOCK Webhook] ✅ Klarna captured + tracking sent for order ${orderMap.medusa_order_id}`)

              // Update Medusa internal payment status so admin shows "Paid"
              try {
                const paymentModuleService = req.scope.resolve(Modules.PAYMENT) as any
                const queryService = req.scope.resolve("query") as any
                const { data: [orderWithPayments] } = await queryService.graph({
                  entity: "order",
                  fields: ["id", "payment_collections.payments.*"],
                  filters: { id: orderMap.medusa_order_id },
                })
                const payments = orderWithPayments?.payment_collections?.flatMap((pc: any) => pc.payments || []) || []
                const payment = payments[0]
                if (payment?.id && payment.captured_at == null) {
                  // Fetch order total from order_summary
                  const totalPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
                  const totalResult = await totalPool.query(
                    `SELECT totals->>'current_order_total' as order_total FROM order_summary WHERE order_id = $1 LIMIT 1`,
                    [orderMap.medusa_order_id]
                  )
                  await totalPool.end()
                  const orderTotal = Number(totalResult.rows[0]?.order_total || 0)
                  await paymentModuleService.capturePayment({
                    payment_id: payment.id,
                    amount: orderTotal,
                  })
                  console.log(`[mySTOCK Webhook] ✅ Medusa payment ${payment.id} marked as captured (Paid) for order ${orderMap.medusa_order_id}`)
                }
              } catch (medusaPayErr: any) {
                // Non-fatal: Klarna capture succeeded, just Medusa status update failed
                console.warn(`[mySTOCK Webhook] ⚠️ Could not update Medusa payment status for order ${orderMap.medusa_order_id}: ${medusaPayErr.message}`)
              }
            } catch (klarnaErr: any) {
              console.error(`[mySTOCK Webhook] ❌ Klarna capture/tracking failed for order ${orderMap.medusa_order_id}:`, klarnaErr.message)
            }
          }

          // ── Shipment notification email ──────────────────────────────
          // After DISPATCHED status + tracking number are set, send shipment email to customer
          // Uses 5-second delay to allow both pieces of data to settle
          const shouldCheckEmail = (newStatus === "DISPATCHED" || updatedMeta.dextrum_status === "DISPATCHED") && !updatedMeta.shipment_email_sent
          if (shouldCheckEmail) {
            const capturedOrderId = orderMap.medusa_order_id
            const capturedScope = req.scope
            setTimeout(async () => {
              try {
                // Re-read order metadata from DB to get latest state
                const emailPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
                const emailResult = await emailPool.query(
                  `SELECT metadata FROM "order" WHERE id = $1 LIMIT 1`,
                  [capturedOrderId]
                )
                await emailPool.end()
                const freshMeta = emailResult.rows[0]?.metadata || {}

                // Check all conditions: DISPATCHED + tracking + not yet sent
                if (freshMeta.dextrum_status !== "DISPATCHED") return
                if (!freshMeta.dextrum_tracking_number) return
                if (freshMeta.shipment_email_sent === true) {
                  console.log(`[Webhook] Shipment email already sent for order ${capturedOrderId}, skipping`)
                  return
                }

                // Mark email as sent FIRST to prevent duplicates (optimistic lock)
                const markPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
                const markResult = await markPool.query(
                  `UPDATE "order" SET metadata = metadata || $1::jsonb, updated_at = NOW()
                   WHERE id = $2 AND (metadata->>'shipment_email_sent' IS NULL OR metadata->>'shipment_email_sent' = 'false')
                   RETURNING id`,
                  [JSON.stringify({ shipment_email_sent: true, shipment_email_sent_at: new Date().toISOString() }), capturedOrderId]
                )
                await markPool.end()

                if (markResult.rowCount === 0) {
                  console.log(`[Webhook] Shipment email already sent (race condition) for order ${capturedOrderId}`)
                  return
                }

                // Retrieve order with items + shipping_address for the email
                const orderModuleSvc = capturedScope.resolve(Modules.ORDER) as any
                const notificationSvc = capturedScope.resolve(Modules.NOTIFICATION) as any
                const freshOrder = await orderModuleSvc.retrieveOrder(capturedOrderId, {
                  relations: ["items", "shipping_address"],
                })

                if (!freshOrder || !freshOrder.email) {
                  console.error(`[Webhook] Cannot send shipment email: order ${capturedOrderId} not found or has no email`)
                  return
                }

                // Resolve shipping address
                let shipAddr: any = freshOrder.shipping_address
                try {
                  if (shipAddr?.id) {
                    shipAddr = await (orderModuleSvc as any).orderAddressService_.retrieve(shipAddr.id)
                  }
                } catch { /* keep existing */ }

                // Build tracking info
                const freshTracking = freshMeta.dextrum_tracking_number
                const freshCarrier = freshMeta.dextrum_carrier || "GLS"
                const freshTrackingUrl = freshMeta.dextrum_tracking_url || `https://gls-group.com/GROUP/en/parcel-tracking?match=${freshTracking}`

                // Determine project-specific email config
                const projectConfig = getProjectEmailConfig(freshOrder)
                const templateKey = resolveTemplateKey(EmailTemplates.SHIPMENT_NOTIFICATION, projectConfig.project)
                const displayId = freshMeta.custom_order_number || (freshOrder as any).display_id || freshOrder.id
                const emailSubject = getEmailSubject(projectConfig, "shipmentSent", { id: String(displayId) })
                const emailPreview = getEmailSubject(projectConfig, "shipmentPreview")

                // Resolve billing entity for email footer
                let billingEntity: any = null
                try { billingEntity = await resolveBillingEntity(capturedScope, capturedOrderId) } catch { /* ok */ }

                // Send the email
                await notificationSvc.createNotifications({
                  to: freshOrder.email,
                  channel: "email",
                  template: templateKey,
                  ...(projectConfig.fromEmail ? { from: projectConfig.fromEmail } : {}),
                  data: {
                    emailOptions: { replyTo: projectConfig.replyTo, subject: emailSubject },
                    order: freshOrder,
                    shippingAddress: shipAddr,
                    trackingNumber: freshTracking,
                    trackingUrl: freshTrackingUrl,
                    trackingCompany: freshCarrier,
                    billingEntity,
                    preview: emailPreview,
                  },
                })

                // Render HTML for email log
                const htmlBody = await renderEmailToHtml(templateKey, {
                  emailOptions: { replyTo: projectConfig.replyTo, subject: emailSubject },
                  order: freshOrder,
                  shippingAddress: shipAddr,
                  trackingNumber: freshTracking,
                  trackingUrl: freshTrackingUrl,
                  trackingCompany: freshCarrier,
                  billingEntity,
                  preview: emailPreview,
                }).catch(() => "")

                await logEmailActivity(orderModuleSvc, capturedOrderId, {
                  template: "shipment_notification",
                  subject: emailSubject,
                  to: freshOrder.email,
                  status: "sent",
                  ...(htmlBody ? { html_body: htmlBody } : {}),
                }).catch(() => {})

                // Add timeline entry
                const timelinePool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
                await timelinePool.query(
                  `UPDATE "order" SET metadata = jsonb_set(
                    COALESCE(metadata, '{}'::jsonb),
                    '{dextrum_timeline}',
                    COALESCE(metadata->'dextrum_timeline', '[]'::jsonb) || $1::jsonb
                  ), updated_at = NOW() WHERE id = $2`,
                  [JSON.stringify([{ type: "email", status: "shipment_email_sent", date: new Date().toISOString(), detail: "Shipment notification sent" }]), capturedOrderId]
                )
                await timelinePool.end()

                console.log(`[Webhook] Shipment email sent to ${freshOrder.email} for order ${displayId} (tracking: ${freshTracking})`)
              } catch (emailErr: any) {
                console.error(`[Webhook] Failed to send shipment email for order ${capturedOrderId}:`, emailErr.message)
              }
            }, 5000) // 5 second delay to wait for both DISPATCHED + tracking
          }

          // ── SMS dispatch notification (GoSMS) ─────────────────────────
          // Send SMS when DISPATCHED + tracking available, with deduplication
          const shouldCheckSms = isGoSmsConfigured()
            && (newStatus === "DISPATCHED" || updatedMeta.dextrum_status === "DISPATCHED")
            && !updatedMeta.sms_dispatch_sent
          if (shouldCheckSms) {
            const smsOrderId = orderMap.medusa_order_id
            const smsScope = req.scope
            setTimeout(async () => {
              try {
                // Re-read metadata for latest state
                const smsPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
                const smsResult = await smsPool.query(
                  `SELECT metadata FROM "order" WHERE id = $1 LIMIT 1`,
                  [smsOrderId]
                )
                await smsPool.end()
                const smsMeta = smsResult.rows[0]?.metadata || {}

                if (smsMeta.dextrum_status !== "DISPATCHED") return
                if (!smsMeta.dextrum_tracking_url) return
                if (smsMeta.sms_dispatch_sent === true) {
                  console.log(`[GoSMS] SMS already sent for order ${smsOrderId}, skipping`)
                  return
                }

                // Claim this SMS with optimistic lock (prevents duplicate attempts)
                const markSmsPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
                const markSmsResult = await markSmsPool.query(
                  `UPDATE "order" SET metadata = metadata || $1::jsonb, updated_at = NOW()
                   WHERE id = $2 AND (metadata->>'sms_dispatch_sent' IS NULL OR metadata->>'sms_dispatch_sent' = 'false')
                     AND (metadata->>'sms_dispatch_attempting' IS NULL OR metadata->>'sms_dispatch_attempting' = 'false')
                   RETURNING id`,
                  [JSON.stringify({ sms_dispatch_attempting: true }), smsOrderId]
                )
                await markSmsPool.end()

                if (markSmsResult.rowCount === 0) {
                  console.log(`[GoSMS] SMS already sent or in progress for order ${smsOrderId}`)
                  return
                }

                // Get order shipping address for phone number
                const orderModSvc = smsScope.resolve(Modules.ORDER) as any
                const smsOrder = await orderModSvc.retrieveOrder(smsOrderId, {
                  relations: ["shipping_address"],
                })

                let phone: string | undefined
                let countryCode = ""
                try {
                  if (smsOrder?.shipping_address?.id) {
                    const addr = await (orderModSvc as any).orderAddressService_.retrieve(smsOrder.shipping_address.id)
                    phone = addr?.phone
                    countryCode = addr?.country_code || ""
                  }
                } catch {
                  phone = smsOrder?.shipping_address?.phone
                  countryCode = smsOrder?.shipping_address?.country_code || ""
                }

                if (!phone) {
                  console.log(`[GoSMS] No phone number for order ${smsOrderId}, skipping SMS`)
                  // Release lock so it can retry
                  const relPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
                  await relPool.query(`UPDATE "order" SET metadata = metadata - 'sms_dispatch_attempting', updated_at = NOW() WHERE id = $1`, [smsOrderId])
                  await relPool.end()
                  return
                }

                // Normalize phone to international format using country code
                const phoneResult = normalizePhone(phone, countryCode)
                const formattedPhone = phoneResult.normalized

                if (formattedPhone === "000") {
                  console.log(`[GoSMS] No valid phone number for order ${smsOrderId}, skipping SMS`)
                  const relPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
                  await relPool.query(`UPDATE "order" SET metadata = metadata - 'sms_dispatch_attempting', updated_at = NOW() WHERE id = $1`, [smsOrderId])
                  await relPool.end()
                  return
                }

                if (phoneResult.warning) {
                  console.log(`[GoSMS] Phone normalization for order ${smsOrderId}: ${phoneResult.warning}`)
                }

                // Build SMS text from project config
                const smsProjectConfig = getProjectEmailConfig(smsOrder)
                const smsText = buildDispatchSms(smsProjectConfig, smsMeta.dextrum_tracking_url)

                if (!smsText) {
                  console.log(`[GoSMS] No SMS template for project ${smsProjectConfig.project}, skipping`)
                  const relPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
                  await relPool.query(`UPDATE "order" SET metadata = metadata - 'sms_dispatch_attempting', updated_at = NOW() WHERE id = $1`, [smsOrderId])
                  await relPool.end()
                  return
                }

                const sent = await sendSms(formattedPhone, smsText)
                const smsTimestamp = new Date().toISOString()
                if (sent) {
                  // Mark as successfully sent AFTER confirmed delivery
                  // Also append entry to sms_activity_log for the order timeline
                  const logEntry = {
                    timestamp: smsTimestamp,
                    to: formattedPhone,
                    text: smsText,
                    status: "sent",
                    gateway: "gosms",
                  }
                  const successPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
                  await successPool.query(
                    `UPDATE "order" SET
                       metadata = (metadata || $1::jsonb) || jsonb_build_object(
                         'sms_activity_log',
                         COALESCE(metadata->'sms_activity_log', '[]'::jsonb) || $2::jsonb
                       ),
                       updated_at = NOW()
                     WHERE id = $3`,
                    [
                      JSON.stringify({ sms_dispatch_sent: true, sms_dispatch_sent_at: smsTimestamp, sms_dispatch_attempting: false }),
                      JSON.stringify([logEntry]),
                      smsOrderId,
                    ]
                  )
                  await successPool.end()
                  console.log(`[GoSMS] ✅ SMS sent to ${formattedPhone} for order ${smsOrderId}`)
                } else {
                  // Release lock so it can retry on next event, and log failure to timeline
                  const logEntry = {
                    timestamp: smsTimestamp,
                    to: formattedPhone,
                    text: smsText,
                    status: "failed",
                    gateway: "gosms",
                    error_message: "sendSms returned false",
                  }
                  const relPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
                  await relPool.query(
                    `UPDATE "order" SET
                       metadata = (metadata || $1::jsonb) || jsonb_build_object(
                         'sms_activity_log',
                         COALESCE(metadata->'sms_activity_log', '[]'::jsonb) || $2::jsonb
                       ),
                       updated_at = NOW()
                     WHERE id = $3`,
                    [
                      JSON.stringify({ sms_dispatch_attempting: false, sms_dispatch_last_error: "sendSms returned false" }),
                      JSON.stringify([logEntry]),
                      smsOrderId,
                    ]
                  )
                  await relPool.end()
                  console.warn(`[GoSMS] ⚠️ SMS failed/skipped for order ${smsOrderId}`)
                }
              } catch (smsErr: any) {
                console.error(`[GoSMS] ❌ Failed to send SMS for order ${smsOrderId}:`, smsErr.message)
                // Release lock so it can retry on next event, and log failure to timeline
                try {
                  const logEntry = {
                    timestamp: new Date().toISOString(),
                    status: "failed",
                    gateway: "gosms",
                    error_message: smsErr.message,
                  }
                  const errPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
                  await errPool.query(
                    `UPDATE "order" SET
                       metadata = (metadata || $1::jsonb) || jsonb_build_object(
                         'sms_activity_log',
                         COALESCE(metadata->'sms_activity_log', '[]'::jsonb) || $2::jsonb
                       ),
                       updated_at = NOW()
                     WHERE id = $3`,
                    [
                      JSON.stringify({ sms_dispatch_attempting: false, sms_dispatch_last_error: smsErr.message }),
                      JSON.stringify([logEntry]),
                      smsOrderId,
                    ]
                  )
                  await errPool.end()
                } catch { /* ignore */ }
              }
            }, 7000) // 7 second delay (after email's 5s)
          }
        }
      } catch (err: any) {
        console.error("Failed to update Medusa order metadata:", err.message)
      }
    }

    // 5b. Handle stock change events
    if (eventType === "3" || eventType === "33" || newStatus === "STOCK_CHANGE") {
      const productCode = event.data?.productCode || event.productCode
      if (productCode) {
        try {
          const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
          const config = configs[0]
          if (config?.api_url) {
            const { MyStockApiClient } = await import("../../../modules/dextrum/api-client.js")
            const client = new MyStockApiClient({
              apiUrl: config.api_url,
              username: config.api_username,
              password: config.api_password,
            })
            const warehouseCode = config.default_warehouse_code || "MAIN"
            const stockCards = await client.getStockCard(warehouseCode, productCode)
            if (stockCards[0]) {
              const card = stockCards[0]
              const existing = await dextrumService.listDextrumInventorys(
                { sku: productCode },
                { take: 1 }
              )
              const inventoryData = {
                sku: productCode,
                available_stock: Number(card.availableStock ?? 0),
                physical_stock: Number(card.physicalStock ?? 0),
                reserved_stock: Number(card.reservedStock ?? 0),
                blocked_stock: Number(card.blockedStock ?? 0),
                warehouse_code: warehouseCode,
                last_synced_at: new Date().toISOString(),
                stock_changed: true,
                previous_available: existing[0]?.available_stock ?? 0,
              }
              if (existing[0]) {
                await dextrumService.updateDextrumInventorys(existing[0].id, inventoryData)
              } else {
                await dextrumService.createDextrumInventorys(inventoryData)
              }
            }
          }
        } catch (invErr: any) {
          console.error("[Webhook] Inventory update failed for", productCode, invErr.message)
        }
      }
    }

    // 6. Log the event
    const eventLog = await dextrumService.createDextrumEventLogs({
      event_id: event.eventId,
      event_type: eventType,
      event_subtype: eventSubtype || null,
      document_id: documentId || null,
      document_code: documentCode || null,
      status: orderMap ? "processed" : "unmatched",
      medusa_order_id: orderMap?.medusa_order_id || null,
      delivery_status_before: previousStatus,
      delivery_status_after: newStatus || null,
      raw_payload: event,
    })

    console.log(`[mySTOCK Webhook] Event ${event.eventId} type=${eventType} processed → ${newStatus || "no_change"}`)

    // mySTOCK expects: { data: { id: "..." }, errors: [] }
    res.json({ data: { id: eventLog?.id || event.eventId }, errors: [] })
  } catch (error: any) {
    console.error("[mySTOCK Webhook] Error:", error)
    // Always return 200 to prevent mySTOCK from retrying
    res.json({ data: { id: "error" }, errors: [{ code: "PROCESSING_ERROR", message: error.message }] })
  }
}

// ═══════════════════════════════════════════
// PAYPAL TRACKING HELPER
// ═══════════════════════════════════════════

/**
 * Map internal carrier code to PayPal carrier enum.
 * PayPal has country-specific carrier codes for better tracking.
 * Falls back to generic code or "OTHER" if unknown.
 */
function mapCarrierToPayPal(carrier: string, countryCode?: string): { carrier: string; carrier_name_other?: string } {
  const cc = (countryCode || "").toLowerCase()
  const c = (carrier || "").toLowerCase()

  // GLS — country-specific codes
  if (c.includes("gls")) {
    const glsMap: Record<string, string> = {
      cz: "GLS_CZ", nl: "NLD_GLS", de: "GLS_DE", hu: "GLS_HUN", sk: "GLS_SLOV",
    }
    return { carrier: glsMap[cc] || "GLS" }
  }

  // Packeta / Zásilkovna
  if (c.includes("packeta") || c.includes("zasilkovna") || c.includes("zásilkovna")) {
    return { carrier: "PACKETA" }
  }

  // InPost
  if (c.includes("inpost")) {
    return { carrier: "INPOST_PACZKOMATY" }
  }

  // PPL (Czech)
  if (c.includes("ppl")) {
    return { carrier: "PPL" }
  }

  // PostNL
  if (c.includes("postnl")) {
    return { carrier: "NLD_POSTNL" }
  }

  // PostNord
  if (c.includes("postnord")) {
    return { carrier: "OTHER", carrier_name_other: "PostNord" }
  }

  // DHL — country-specific
  if (c.includes("dhl")) {
    const dhlMap: Record<string, string> = {
      de: "DE_DHL", nl: "NLD_DHL", pl: "DHL_PL",
    }
    return { carrier: dhlMap[cc] || "DHL" }
  }

  // DPD — country-specific
  if (c.includes("dpd")) {
    const dpdMap: Record<string, string> = {
      pl: "DPD_POLAND", de: "DPD_DE", nl: "DPD_NL", hu: "DPD_HGRY", sk: "DPD_SK_SFTP",
    }
    return { carrier: dpdMap[cc] || "DPD" }
  }

  // Česká pošta
  if (c.includes("ceska") || c.includes("česká") || c.includes("cpost")) {
    return { carrier: "CESKA_CZ" }
  }

  // Poczta Polska
  if (c.includes("poczta")) {
    return { carrier: "PL_POCZTA_POLSKA" }
  }

  // Fallback: use carrier name as-is with OTHER
  if (carrier) {
    return { carrier: "OTHER", carrier_name_other: carrier }
  }

  return { carrier: "OTHER", carrier_name_other: "Unknown" }
}

/**
 * Send tracking info to PayPal for a dispatched order.
 * If captureId is not available, fetches it from PayPal order details.
 */
async function sendTrackingToPayPalFromWebhook(
  paypalOrderId: string,
  captureId: string | undefined,
  trackingNumber: string,
  carrier: string,
  medusaOrderId: string,
  scope: any,
  projectSlug?: string
): Promise<void> {
  // 1. Get PayPal credentials from gateway config or env vars
  // Match by project_slug so we pick the right merchant account when multiple
  // gateway_config rows exist (one per brand).
  let clientId: string | undefined
  let clientSecret: string | undefined
  let mode: "live" | "test" = "test"

  try {
    const pgPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    const { rows } = await pgPool.query(
      `SELECT id, display_name, mode, live_keys, test_keys, project_slugs FROM gateway_config
       WHERE provider = 'paypal' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC`
    )
    await pgPool.end()
    let config: any = null
    if (rows.length > 0) {
      if (projectSlug) {
        config = rows.find((r: any) => Array.isArray(r.project_slugs) && r.project_slugs.includes(projectSlug)) || null
      }
      if (!config) {
        config = rows.find((r: any) => !r.project_slugs || r.project_slugs.length === 0) || rows[0]
        if (projectSlug) {
          console.warn(`[PayPal Tracking] No gateway_config matched project "${projectSlug}", falling back to "${config.display_name || config.id}"`)
        }
      } else {
        console.log(`[PayPal Tracking] Matched gateway_config "${config.display_name || config.id}" for project "${projectSlug}"`)
      }
    }
    if (config) {
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      clientId = keys?.client_id || keys?.api_key
      clientSecret = keys?.client_secret || keys?.secret_key
      mode = isLive ? "live" : "test"
    }
  } catch (e: any) {
    console.warn(`[PayPal Tracking] DB query failed: ${e.message}`)
  }

  if (!clientId) clientId = process.env.PAYPAL_CLIENT_ID
  if (!clientSecret) clientSecret = process.env.PAYPAL_CLIENT_SECRET
  if (process.env.PAYPAL_MODE === "live") mode = "live"

  if (!clientId || !clientSecret) {
    console.warn(`[PayPal Tracking] No credentials configured, skipping tracking for ${medusaOrderId}`)
    return
  }

  // 2. Create PayPal client
  const { PayPalApiClient } = await import("../../../modules/payment-paypal/api-client.js")
  const client = new PayPalApiClient({ client_id: clientId, client_secret: clientSecret, mode })

  // 3. Get capture_id — from metadata or by fetching from PayPal
  let resolvedCaptureId = captureId
  if (!resolvedCaptureId) {
    console.log(`[PayPal Tracking] No captureId in metadata, fetching from PayPal order ${paypalOrderId}`)
    try {
      const orderDetails = await client.getOrder(paypalOrderId)
      resolvedCaptureId = orderDetails.purchase_units?.[0]?.payments?.captures?.[0]?.id
      if (resolvedCaptureId) {
        console.log(`[PayPal Tracking] Found captureId: ${resolvedCaptureId}`)
        // Save it to metadata for future use
        const savePool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
        await savePool.query(
          `UPDATE "order" SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{paypalCaptureId}', $1::jsonb), updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(resolvedCaptureId), medusaOrderId]
        )
        await savePool.end()
      }
    } catch (fetchErr: any) {
      console.error(`[PayPal Tracking] Failed to fetch order: ${fetchErr.message}`)
    }
  }

  if (!resolvedCaptureId) {
    console.warn(`[PayPal Tracking] No capture_id found for PayPal order ${paypalOrderId} — payment may not be captured yet. Skipping tracking.`)
    return
  }

  // 4. Get country code for carrier mapping
  let countryCode = ""
  try {
    const addrPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    const addrResult = await addrPool.query(
      `SELECT oa.country_code FROM order_address oa
       JOIN "order" o ON o.shipping_address_id = oa.id
       WHERE o.id = $1 LIMIT 1`,
      [medusaOrderId]
    )
    await addrPool.end()
    countryCode = addrResult.rows[0]?.country_code || ""
  } catch { /* ok */ }

  // 5. Map carrier to PayPal enum
  const paypalCarrier = mapCarrierToPayPal(carrier, countryCode)

  // 6. Send tracking to PayPal
  console.log(`[PayPal Tracking] Sending tracking to PayPal: order=${paypalOrderId} capture=${resolvedCaptureId} tracking=${trackingNumber} carrier=${paypalCarrier.carrier}`)

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  // Use the client's addTracking, but we need carrier_name_other support
  // The existing addTracking doesn't support carrier_name_other, so we call the API directly
  // Actually let me check... the existing method just sends carrier uppercase.
  // For "OTHER" carrier, we need to also send carrier_name_other.
  await client.addTracking(
    paypalOrderId,
    resolvedCaptureId,
    trackingNumber,
    paypalCarrier.carrier,
    true,
    paypalCarrier.carrier_name_other
  )
}

// ═══════════════════════════════════════════
// KLARNA CAPTURE + TRACKING HELPER
// ═══════════════════════════════════════════

/**
 * Capture Klarna payment and send tracking info.
 * If already captured (captureId exists), just adds shipping info.
 * If not yet captured, captures with shipping_info in one call.
 */
async function captureAndTrackKlarnaFromWebhook(
  klarnaOrderId: string,
  existingCaptureId: string | undefined,
  trackingNumber: string,
  carrier: string,
  trackingUrl: string,
  medusaOrderId: string,
  scope: any,
  projectSlug?: string
): Promise<void> {
  // 1. Get Klarna credentials from gateway config or env vars
  // Match by project_slug so we pick the right merchant account when multiple
  // gateway_config rows exist (one per brand). Without this, we'd always pick
  // the first row and hit "NO_SUCH_ORDER" for orders placed on other merchants.
  let apiKey: string | undefined
  let secretKey: string | undefined
  let testMode = true

  try {
    const pgPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    const { rows } = await pgPool.query(
      `SELECT id, display_name, mode, live_keys, test_keys, project_slugs FROM gateway_config
       WHERE provider = 'klarna' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC`
    )
    await pgPool.end()
    let config: any = null
    if (rows.length > 0) {
      if (projectSlug) {
        config = rows.find((r: any) => Array.isArray(r.project_slugs) && r.project_slugs.includes(projectSlug)) || null
      }
      if (!config) {
        config = rows.find((r: any) => !r.project_slugs || r.project_slugs.length === 0) || rows[0]
        if (projectSlug) {
          console.warn(`[Klarna Tracking] No gateway_config matched project "${projectSlug}", falling back to "${config.display_name || config.id}"`)
        }
      } else {
        console.log(`[Klarna Tracking] Matched gateway_config "${config.display_name || config.id}" for project "${projectSlug}"`)
      }
    }
    if (config) {
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      apiKey = keys?.api_key
      secretKey = keys?.secret_key
      testMode = !isLive
    }
  } catch (e: any) {
    console.warn(`[Klarna Tracking] DB query failed: ${e.message}`)
  }

  if (!apiKey) apiKey = process.env.KLARNA_API_KEY
  if (!secretKey) secretKey = process.env.KLARNA_SECRET_KEY
  if (process.env.KLARNA_TEST_MODE === "false") testMode = false

  if (!apiKey || !secretKey) {
    console.warn(`[Klarna Tracking] No credentials configured, skipping for ${medusaOrderId}`)
    return
  }

  // 2. Create Klarna client
  const { KlarnaApiClient } = await import("../../../modules/payment-klarna/api-client.js")
  const client = new KlarnaApiClient(apiKey, secretKey, testMode)

  // Normalize carrier name for Klarna
  const klarnaCarrier = carrier || "GLS"

  // Build tracking URI
  const trackingUri = trackingUrl || undefined

  if (existingCaptureId) {
    // 3a. Already captured — just add shipping info
    console.log(`[Klarna Tracking] Adding shipping info to existing capture ${existingCaptureId} for order ${klarnaOrderId}`)
    const result = await client.addShippingInfo(klarnaOrderId, existingCaptureId, {
      shipping_company: klarnaCarrier,
      tracking_number: trackingNumber,
      tracking_uri: trackingUri,
    })
    if (!result.success) {
      throw new Error(result.error || "Failed to add shipping info to Klarna")
    }
    console.log(`[Klarna Tracking] ✅ Shipping info added to capture ${existingCaptureId}`)
  } else {
    // 3b. Not yet captured — get order from Klarna to determine amount, then capture with shipping_info
    console.log(`[Klarna Tracking] Fetching Klarna order ${klarnaOrderId} for capture...`)
    const orderDetails = await client.getOrder(klarnaOrderId)
    if (!orderDetails.success || !orderDetails.data) {
      throw new Error(orderDetails.error || `Failed to get Klarna order ${klarnaOrderId}`)
    }

    const klarnaOrder = orderDetails.data
    const remainingAmount = klarnaOrder.remaining_authorized_amount
    const orderAmount = klarnaOrder.order_amount

    // Check if already fully captured
    if (klarnaOrder.status === "CAPTURED" || remainingAmount === 0) {
      // Already captured, try to find capture_id and add shipping info
      const captures = klarnaOrder.captures || []
      const captureId = captures[0]?.capture_id
      if (captureId) {
        console.log(`[Klarna Tracking] Order already captured (${captureId}), adding shipping info`)
        const result = await client.addShippingInfo(klarnaOrderId, captureId, {
          shipping_company: klarnaCarrier,
          tracking_number: trackingNumber,
          tracking_uri: trackingUri,
        })
        if (!result.success) {
          throw new Error(result.error || "Failed to add shipping info")
        }
        // Save capture ID to metadata
        const savePool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
        await savePool.query(
          `UPDATE "order" SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{klarnaCaptureId}', $1::jsonb), updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(captureId), medusaOrderId]
        )
        await savePool.end()
        console.log(`[Klarna Tracking] ✅ Shipping info added to already-captured order`)
      } else {
        console.warn(`[Klarna Tracking] Order already captured but no capture_id found`)
      }
      return
    }

    // Capture the full remaining amount with shipping info
    const captureAmount = remainingAmount || orderAmount
    console.log(`[Klarna Tracking] Capturing ${captureAmount} (minor units) with tracking for order ${klarnaOrderId}`)

    const captureResult = await client.captureOrder(klarnaOrderId, {
      captured_amount: captureAmount,
      description: `Shipment dispatched — order ${medusaOrderId}`,
      shipping_info: [
        {
          shipping_company: klarnaCarrier,
          tracking_number: trackingNumber,
          tracking_uri: trackingUri,
        },
      ],
    })

    if (!captureResult.success) {
      throw new Error(captureResult.error || "Klarna capture failed")
    }

    const captureId = captureResult.data?.capture_id || "unknown"
    console.log(`[Klarna Tracking] ✅ Captured + tracking sent: capture_id=${captureId}`)

    // Save capture ID to metadata
    const savePool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    await savePool.query(
      `UPDATE "order" SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{klarnaCaptureId}', $1::jsonb), updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(captureId), medusaOrderId]
    )
    await savePool.end()
  }
}
