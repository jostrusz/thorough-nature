import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../../../modules/dextrum"
import { generateTrackingUrl } from "../../../utils/tracking-url"
import { Pool } from "pg"
import { getProjectEmailConfig, getEmailSubject } from "../../../utils/project-email-config"
import { EmailTemplates, resolveTemplateKey } from "../../../modules/email-notifications/templates"
import { resolveBillingEntity } from "../../../utils/resolve-billing-entity"
import { logEmailActivity } from "../../../utils/email-logger"
import { renderEmailToHtml } from "../../../utils/render-email-html"

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
      const isDeliveryNote = eventNote.includes("zásilka je u vás")
        || eventNote.includes("doručen")
        || eventNote.includes("delivered")
        || eventNote.includes("převzat")
        || eventNote.includes("vyzvednut")
        || eventNote.includes("dodán")

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
      } else if (eventNote.includes("ostatní data") || eventNote.includes("data přijata")) {
        // "Ostatní data přijata" = tracking data assigned, NOT delivery
        newStatus = "DISPATCHED"
        console.log(`[mySTOCK Webhook] Event 29 tracking assigned (note: "${event.note || ""}") → DISPATCHED`)
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
    if (orderMap && newStatus && newStatus !== "CANCELLED" && newStatus !== "DELIVERED" && newRank <= prevRank) {
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

          // Auto-fulfill on DISPATCHED — mark order as fulfilled with tracking
          if (newStatus === "DISPATCHED") {
            try {
              const existingFulfillments = (order as any).fulfillments || []
              const alreadyFulfilled = existingFulfillments.length > 0

              if (!alreadyFulfilled) {
                const items = ((order as any).items || []).map((item: any) => ({
                  id: item.id,
                  quantity: item.quantity || 1,
                }))

                if (items.length > 0) {
                  // Create fulfillment via direct DB insert (orderModuleService not available in webhook context)
                  const fulfillPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
                  const fulfillmentId = `ful_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
                  await fulfillPool.query(
                    `INSERT INTO order_fulfillment (id, order_id, metadata, created_at, updated_at)
                     VALUES ($1, $2, $3::jsonb, NOW(), NOW())`,
                    [
                      fulfillmentId,
                      orderMap.medusa_order_id,
                      JSON.stringify({
                        tracking_number: updateData.tracking_number || null,
                        tracking_url: updateData.tracking_url || null,
                        carrier: updateData.carrier_name || null,
                        source: "dextrum_wms",
                      }),
                    ]
                  )
                  await fulfillPool.end()
                  console.log(`[Webhook] Auto-fulfilled order ${orderMap.medusa_order_id} on DISPATCHED`)
                }
              }
            } catch (fulfillErr: any) {
              console.error(`[Webhook] Auto-fulfill failed for ${orderMap.medusa_order_id}:`, fulfillErr.message)
            }
          }

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
                req.scope
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
  scope: any
): Promise<void> {
  // 1. Get PayPal credentials from gateway config or env vars
  let clientId: string | undefined
  let clientSecret: string | undefined
  let mode: "live" | "test" = "test"

  try {
    const pgPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    const { rows } = await pgPool.query(
      `SELECT mode, live_keys, test_keys FROM gateway_config
       WHERE provider = 'paypal' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC LIMIT 1`
    )
    await pgPool.end()
    if (rows[0]) {
      const isLive = rows[0].mode === "live"
      const keys = isLive ? rows[0].live_keys : rows[0].test_keys
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
