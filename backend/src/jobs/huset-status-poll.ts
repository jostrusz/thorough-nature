// @ts-nocheck
/**
 * Huset Status Poll
 * Runs every 5 minutes — Huset has no webhooks, so we pull dispatched
 * shipments via GetOutgoingDeliveryNotTrans, write tracking to the order,
 * fire downstream actions (shipment email, SMS, PayPal/Klarna tracking),
 * and acknowledge each delivery via UpdateOutgoingDeliveryIntegration so the
 * NotTrans queue stops returning it.
 *
 * The NotTrans queue is at-least-once: anything not acked comes back on the
 * next poll, so a crash mid-processing self-heals. Downstream actions are
 * individually deduplicated via order.metadata flags (same optimistic-lock
 * pattern as the mystock webhook).
 */
import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { Pool } from "pg"
import { HUSET_MODULE } from "../modules/huset"
import { getHusetConfig } from "../modules/huset/config"
import { buildHusetClient } from "../modules/huset/send-order"
import { sendTrackingToPayPal, captureAndTrackKlarna } from "../utils/gateway-tracking"
import { getProjectEmailConfig, getEmailSubject, buildDispatchSms } from "../utils/project-email-config"
import { sendSms, isGoSmsConfigured } from "../utils/gosms-client"
import { EmailTemplates, resolveTemplateKey } from "../modules/email-notifications/templates"
import { resolveBillingEntity } from "../utils/resolve-billing-entity"
import { logEmailActivity } from "../utils/email-logger"
import { renderEmailToHtml } from "../utils/render-email-html"
import { normalizePhone } from "../utils/normalize-phone"

// Verified live: https://sporing.bring.no/sporing/<number> is Bring's public
// tracking page. Used only when Huset doesn't return a TrackingUrl itself.
function bringTrackingUrl(trackingNumber: string): string {
  return trackingNumber ? `https://sporing.bring.no/sporing/${encodeURIComponent(trackingNumber)}` : ""
}

export default async function husetStatusPoll(container: MedusaContainer) {
  const config = getHusetConfig()
  if (!config.enabled || !config.hashKey) return

  const husetService = container.resolve(HUSET_MODULE) as any

  let deliveries: any[] = []
  try {
    const client = buildHusetClient(config)
    deliveries = await client.getOutgoingDeliveryNotTrans()
  } catch (err: any) {
    console.error("[Huset Poll] GetOutgoingDeliveryNotTrans failed:", err.message)
    return
  }

  if (deliveries.length === 0) return
  console.log(`[Huset Poll] ${deliveries.length} dispatched delivery(ies) in NotTrans queue`)

  const client = buildHusetClient(config)

  for (const delivery of deliveries) {
    const ref = delivery.outgoingDeliveryOrderRef
    try {
      // 1. Match to our order map — by order ref, fallback by Huset order id
      let maps = ref
        ? await husetService.listHusetOrderMaps({ order_ref: ref }, { take: 1 })
        : []
      if (!maps[0] && delivery.outgoingDeliveryOrderId) {
        maps = await husetService.listHusetOrderMaps(
          { outgoing_delivery_order_id: String(delivery.outgoingDeliveryOrderId) },
          { take: 1 }
        )
      }
      const orderMap = maps[0]

      if (!orderMap) {
        // Not a Medusa-originated order (e.g. created manually in Huset admin).
        // Ack it anyway — otherwise it blocks the queue forever.
        console.warn(`[Huset Poll] No order map for delivery ref="${ref}" (OutgoingDeliveryId ${delivery.outgoingDeliveryId}) — acking without processing`)
        await client.ackOutgoingDelivery(delivery.outgoingDeliveryId)
        continue
      }

      // 2. Extract tracking from the first freight booking
      const fb = delivery.freightBookings[0] || {}
      const trackingNumber = fb.trackcode1 || fb.trackcode2 || ""
      const trackingUrl = fb.trackingUrl || bringTrackingUrl(trackingNumber)
      const carrier = fb.logisticsProviderDescription || "Bring"
      const dispatchedAt = delivery.actualDeliveryTimestamp
        ? new Date(delivery.actualDeliveryTimestamp).toISOString()
        : new Date().toISOString()
      const now = new Date().toISOString()

      const alreadyDispatched = orderMap.delivery_status === "DISPATCHED"
        && orderMap.tracking_number === trackingNumber

      if (!alreadyDispatched) {
        // 3. Update huset_order_map
        await husetService.updateHusetOrderMaps({ id: orderMap.id,
          delivery_status: "DISPATCHED",
          delivery_status_updated_at: now,
          outgoing_delivery_id: String(delivery.outgoingDeliveryId),
          outgoing_delivery_order_id: orderMap.outgoing_delivery_order_id || String(delivery.outgoingDeliveryOrderId || ""),
          tracking_number: trackingNumber || orderMap.tracking_number,
          tracking_url: trackingUrl || orderMap.tracking_url,
          carrier_name: carrier,
          dispatched_at: dispatchedAt,
          last_error: null,
        })

        // 4. Update order metadata (JSONB merge + timeline append).
        // huset_* = source of truth; dextrum_* mirrored for the admin UI.
        const timelineEntry = {
          type: "huset",
          status: "DISPATCHED",
          date: dispatchedAt,
          detail: `Dispatched from Huset WMS via ${carrier}`,
          tracking_number: trackingNumber,
        }
        const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
        try {
          await pool.query(
            `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
               || jsonb_build_object(
                    'dextrum_timeline',
                    COALESCE(metadata->'dextrum_timeline', '[]'::jsonb) || $2::jsonb
                  ),
               updated_at = NOW()
             WHERE id = $3`,
            [
              JSON.stringify({
                huset_status: "DISPATCHED",
                huset_status_updated_at: now,
                huset_tracking_number: trackingNumber,
                huset_tracking_url: trackingUrl,
                huset_carrier: carrier,
                huset_dispatched_at: dispatchedAt,
                dextrum_status: "DISPATCHED",
                dextrum_status_updated_at: now,
                dextrum_tracking_number: trackingNumber,
                dextrum_tracking_url: trackingUrl,
                dextrum_carrier: carrier,
              }),
              JSON.stringify([timelineEntry]),
              orderMap.medusa_order_id,
            ]
          )
        } finally {
          await pool.end().catch(() => {})
        }
        console.log(`[Huset Poll] ${ref} DISPATCHED — tracking ${trackingNumber} (${carrier})`)
      }

      // 5. Downstream actions (each deduplicated via metadata flags).
      // Failures here must NOT block the ack — tracking data is persisted and
      // each action retries on the next poll only if the delivery isn't acked,
      // so we log-and-continue instead.
      try {
        await runDownstreamActions(container, orderMap.medusa_order_id, trackingNumber, trackingUrl, carrier)
      } catch (dsErr: any) {
        console.error(`[Huset Poll] Downstream actions failed for ${ref}: ${dsErr.message}`)
      }

      // 6. Acknowledge — clears the delivery from the NotTrans queue
      await client.ackOutgoingDelivery(delivery.outgoingDeliveryId)
      console.log(`[Huset Poll] Acked OutgoingDeliveryId ${delivery.outgoingDeliveryId} (${ref})`)
    } catch (err: any) {
      // Not acked — comes back on next poll
      console.error(`[Huset Poll] Failed processing delivery ref="${ref}": ${err.message}`)
    }
  }
}

/**
 * Shipment email + SMS + PayPal/Klarna tracking for a dispatched order.
 * Mirrors the mystock webhook downstream block; no settle-delay needed because
 * polling already delivers status + tracking together.
 */
async function runDownstreamActions(
  container: MedusaContainer,
  orderId: string,
  trackingNumber: string,
  trackingUrl: string,
  carrier: string
): Promise<void> {
  // Fresh metadata
  const metaPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  const metaResult = await metaPool.query(`SELECT metadata FROM "order" WHERE id = $1 LIMIT 1`, [orderId])
  await metaPool.end()
  const meta = metaResult.rows[0]?.metadata || {}

  // ── PayPal tracking ──────────────────────────────────────────
  if (trackingNumber && meta.paypalOrderId && !meta.tracking_sent_to_gateway?.paypal) {
    try {
      await sendTrackingToPayPal(
        meta.paypalOrderId, meta.paypalCaptureId, trackingNumber, carrier, orderId, meta.project_id
      )
      const ppPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
      await ppPool.query(
        `UPDATE "order" SET metadata = metadata || jsonb_build_object(
           'tracking_sent_to_gateway',
           COALESCE(metadata->'tracking_sent_to_gateway', '{}'::jsonb)
             || jsonb_build_object('paypal', true, 'paypal_timestamp', $1::text)
         ), updated_at = NOW() WHERE id = $2`,
        [new Date().toISOString(), orderId]
      )
      await ppPool.end()
      console.log(`[Huset Poll] ✅ PayPal tracking sent for order ${orderId}`)
    } catch (ppErr: any) {
      console.error(`[Huset Poll] ❌ PayPal tracking failed for order ${orderId}:`, ppErr.message)
    }
  }

  // ── Klarna capture + tracking ─────────────────────────────────
  if (trackingNumber && meta.klarnaOrderId
      && meta.payment_provider === "klarna"
      && !meta.tracking_sent_to_gateway?.klarna) {
    try {
      await captureAndTrackKlarna(
        meta.klarnaOrderId, meta.klarnaCaptureId, trackingNumber, carrier, trackingUrl, orderId, meta.project_id
      )
      const nowIso = new Date().toISOString()
      const klarnaPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
      await klarnaPool.query(
        `UPDATE "order" SET metadata = metadata
           || jsonb_build_object(
                'payment_captured', true,
                'payment_captured_at', COALESCE(metadata->>'payment_captured_at', $1::text),
                'tracking_sent_to_gateway',
                  COALESCE(metadata->'tracking_sent_to_gateway', '{}'::jsonb)
                  || jsonb_build_object('klarna', true, 'klarna_timestamp', $1::text)
              ),
           updated_at = NOW()
         WHERE id = $2`,
        [nowIso, orderId]
      )
      await klarnaPool.end()
      console.log(`[Huset Poll] ✅ Klarna captured + tracking sent for order ${orderId}`)
    } catch (klarnaErr: any) {
      console.error(`[Huset Poll] ❌ Klarna capture/tracking failed for order ${orderId}:`, klarnaErr.message)
    }
  }

  // ── Shipment notification email ──────────────────────────────
  if (trackingNumber && meta.shipment_email_sent !== true) {
    try {
      // Optimistic lock first — prevents duplicates across overlapping polls
      const markPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
      const markResult = await markPool.query(
        `UPDATE "order" SET metadata = metadata || $1::jsonb, updated_at = NOW()
         WHERE id = $2 AND (metadata->>'shipment_email_sent' IS NULL OR metadata->>'shipment_email_sent' = 'false')
         RETURNING id`,
        [JSON.stringify({ shipment_email_sent: true, shipment_email_sent_at: new Date().toISOString() }), orderId]
      )
      await markPool.end()

      if (markResult.rowCount > 0) {
        const orderModuleSvc = container.resolve(Modules.ORDER) as any
        const notificationSvc = container.resolve(Modules.NOTIFICATION) as any
        const freshOrder = await orderModuleSvc.retrieveOrder(orderId, {
          relations: ["items", "shipping_address"],
        })

        if (freshOrder?.email) {
          let shipAddr: any = freshOrder.shipping_address
          try {
            if (shipAddr?.id) {
              shipAddr = await (orderModuleSvc as any).orderAddressService_.retrieve(shipAddr.id)
            }
          } catch { /* keep existing */ }

          const projectConfig = getProjectEmailConfig(freshOrder)
          const templateKey = resolveTemplateKey(EmailTemplates.SHIPMENT_NOTIFICATION, projectConfig.project)
          const displayId = meta.custom_order_number || freshOrder.display_id || freshOrder.id
          const emailSubject = getEmailSubject(projectConfig, "shipmentSent", { id: String(displayId) })
          const emailPreview = getEmailSubject(projectConfig, "shipmentPreview")

          let billingEntity: any = null
          try { billingEntity = await resolveBillingEntity(container, orderId) } catch { /* ok */ }

          const emailData = {
            emailOptions: { replyTo: projectConfig.replyTo, subject: emailSubject },
            order: freshOrder,
            shippingAddress: shipAddr,
            trackingNumber,
            trackingUrl,
            trackingCompany: carrier,
            billingEntity,
            preview: emailPreview,
          }

          await notificationSvc.createNotifications({
            to: freshOrder.email,
            channel: "email",
            template: templateKey,
            ...(projectConfig.fromEmail ? { from: projectConfig.fromEmail } : {}),
            data: emailData,
          })

          const htmlBody = await renderEmailToHtml(templateKey, emailData).catch(() => "")
          await logEmailActivity(orderModuleSvc, orderId, {
            template: "shipment_notification",
            subject: emailSubject,
            to: freshOrder.email,
            status: "sent",
            ...(htmlBody ? { html_body: htmlBody } : {}),
          }).catch(() => {})

          const tlPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
          await tlPool.query(
            `UPDATE "order" SET metadata = jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{dextrum_timeline}',
              COALESCE(metadata->'dextrum_timeline', '[]'::jsonb) || $1::jsonb
            ), updated_at = NOW() WHERE id = $2`,
            [JSON.stringify([{ type: "email", status: "shipment_email_sent", date: new Date().toISOString(), detail: "Shipment notification sent" }]), orderId]
          )
          await tlPool.end()

          console.log(`[Huset Poll] Shipment email sent to ${freshOrder.email} for order ${displayId} (tracking: ${trackingNumber})`)
        }
      }
    } catch (emailErr: any) {
      console.error(`[Huset Poll] Failed to send shipment email for order ${orderId}:`, emailErr.message)
    }
  }

  // ── SMS dispatch notification (GoSMS) ─────────────────────────
  if (isGoSmsConfigured() && trackingUrl && meta.sms_dispatch_sent !== true) {
    try {
      const markSmsPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
      const markSmsResult = await markSmsPool.query(
        `UPDATE "order" SET metadata = metadata || $1::jsonb, updated_at = NOW()
         WHERE id = $2 AND (metadata->>'sms_dispatch_sent' IS NULL OR metadata->>'sms_dispatch_sent' = 'false')
           AND (metadata->>'sms_dispatch_attempting' IS NULL OR metadata->>'sms_dispatch_attempting' = 'false')
         RETURNING id`,
        [JSON.stringify({ sms_dispatch_attempting: true }), orderId]
      )
      await markSmsPool.end()

      if (markSmsResult.rowCount > 0) {
        const orderModSvc = container.resolve(Modules.ORDER) as any
        const smsOrder = await orderModSvc.retrieveOrder(orderId, { relations: ["shipping_address"] })

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

        const releaseLock = async () => {
          const relPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
          await relPool.query(`UPDATE "order" SET metadata = metadata - 'sms_dispatch_attempting', updated_at = NOW() WHERE id = $1`, [orderId])
          await relPool.end()
        }

        const phoneResult = phone ? normalizePhone(phone, countryCode) : { normalized: "000" }
        if (!phone || phoneResult.normalized === "000") {
          console.log(`[Huset Poll] No valid phone for order ${orderId}, skipping SMS`)
          await releaseLock()
        } else {
          const smsProjectConfig = getProjectEmailConfig(smsOrder)
          const smsText = buildDispatchSms(smsProjectConfig, trackingUrl)
          if (!smsText) {
            console.log(`[Huset Poll] No SMS template for project ${smsProjectConfig.project}, skipping`)
            await releaseLock()
          } else {
            const sent = await sendSms(phoneResult.normalized, smsText)
            const smsTimestamp = new Date().toISOString()
            const logEntry = {
              timestamp: smsTimestamp,
              to: phoneResult.normalized,
              text: smsText,
              status: sent ? "sent" : "failed",
              gateway: "gosms",
              ...(sent ? {} : { error_message: "sendSms returned false" }),
            }
            const donePool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
            await donePool.query(
              `UPDATE "order" SET
                 metadata = (metadata || $1::jsonb) || jsonb_build_object(
                   'sms_activity_log',
                   COALESCE(metadata->'sms_activity_log', '[]'::jsonb) || $2::jsonb
                 ),
                 updated_at = NOW()
               WHERE id = $3`,
              [
                JSON.stringify(sent
                  ? { sms_dispatch_sent: true, sms_dispatch_sent_at: smsTimestamp, sms_dispatch_attempting: false }
                  : { sms_dispatch_attempting: false, sms_dispatch_last_error: "sendSms returned false" }),
                JSON.stringify([logEntry]),
                orderId,
              ]
            )
            await donePool.end()
            console.log(`[Huset Poll] ${sent ? "✅ SMS sent" : "❌ SMS failed"} to ${phoneResult.normalized} for order ${orderId}`)
          }
        }
      }
    } catch (smsErr: any) {
      console.error(`[Huset Poll] SMS failed for order ${orderId}:`, smsErr.message)
    }
  }
}

export const config = {
  name: "huset-status-poll",
  schedule: "*/5 * * * *",
}
