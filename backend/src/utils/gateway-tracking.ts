// @ts-nocheck
/**
 * Payment-gateway tracking helpers — send dispatch tracking info to
 * PayPal / Klarna so the customer sees it in their app and disputes are
 * defensible.
 *
 * Extracted from /api/webhooks/mystock/route.ts (which keeps its own private
 * copies — untouched to avoid any risk to the live Dextrum flow). Used by the
 * Huset status-poll job. Credentials load from gateway_config matched by
 * project_slugs (JSON array — must be filtered in JS).
 */
import { Pool } from "pg"

/**
 * Map internal carrier code to PayPal carrier enum.
 * Falls back to OTHER + carrier_name_other for unknown carriers.
 */
export function mapCarrierToPayPal(carrier: string, countryCode?: string): { carrier: string; carrier_name_other?: string } {
  const cc = (countryCode || "").toLowerCase()
  const c = (carrier || "").toLowerCase()

  if (c.includes("gls")) {
    const glsMap: Record<string, string> = {
      cz: "GLS_CZ", nl: "NLD_GLS", de: "GLS_DE", hu: "GLS_HUN", sk: "GLS_SLOV",
    }
    return { carrier: glsMap[cc] || "GLS" }
  }
  if (c.includes("packeta") || c.includes("zasilkovna") || c.includes("zásilkovna")) {
    return { carrier: "PACKETA" }
  }
  if (c.includes("inpost")) {
    return { carrier: "INPOST_PACZKOMATY" }
  }
  if (c.includes("ppl")) {
    return { carrier: "PPL" }
  }
  if (c.includes("postnl")) {
    return { carrier: "NLD_POSTNL" }
  }
  if (c.includes("postnord")) {
    return { carrier: "OTHER", carrier_name_other: "PostNord" }
  }
  if (c.includes("bring") || c.includes("posten")) {
    return { carrier: "OTHER", carrier_name_other: "Bring" }
  }
  if (c.includes("dhl")) {
    const dhlMap: Record<string, string> = {
      de: "DE_DHL", nl: "NLD_DHL", pl: "DHL_PL",
    }
    return { carrier: dhlMap[cc] || "DHL" }
  }
  if (c.includes("dpd")) {
    const dpdMap: Record<string, string> = {
      pl: "DPD_POLAND", de: "DPD_DE", nl: "DPD_NL", hu: "DPD_HGRY", sk: "DPD_SK_SFTP",
    }
    return { carrier: dpdMap[cc] || "DPD" }
  }
  if (c.includes("ceska") || c.includes("česká") || c.includes("cpost")) {
    return { carrier: "CESKA_CZ" }
  }
  if (c.includes("poczta")) {
    return { carrier: "PL_POCZTA_POLSKA" }
  }
  if (carrier) {
    return { carrier: "OTHER", carrier_name_other: carrier }
  }
  return { carrier: "OTHER", carrier_name_other: "Unknown" }
}

/**
 * Send tracking info to PayPal for a dispatched order.
 * If captureId is missing, fetches it from PayPal order details.
 */
export async function sendTrackingToPayPal(
  paypalOrderId: string,
  captureId: string | undefined,
  trackingNumber: string,
  carrier: string,
  medusaOrderId: string,
  projectSlug?: string
): Promise<void> {
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

  const { PayPalApiClient } = await import("../modules/payment-paypal/api-client.js")
  const client = new PayPalApiClient({ client_id: clientId, client_secret: clientSecret, mode })

  let resolvedCaptureId = captureId
  if (!resolvedCaptureId) {
    try {
      const orderDetails = await client.getOrder(paypalOrderId)
      resolvedCaptureId = orderDetails.purchase_units?.[0]?.payments?.captures?.[0]?.id
      if (resolvedCaptureId) {
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
    console.warn(`[PayPal Tracking] No capture_id found for PayPal order ${paypalOrderId} — skipping tracking.`)
    return
  }

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

  const paypalCarrier = mapCarrierToPayPal(carrier, countryCode)
  console.log(`[PayPal Tracking] Sending tracking: order=${paypalOrderId} capture=${resolvedCaptureId} tracking=${trackingNumber} carrier=${paypalCarrier.carrier}`)

  await client.addTracking(
    paypalOrderId,
    resolvedCaptureId,
    trackingNumber,
    paypalCarrier.carrier,
    true,
    paypalCarrier.carrier_name_other
  )
}

/**
 * Capture Klarna payment and send tracking info.
 * If already captured, just adds shipping info; otherwise captures with
 * shipping_info in one call.
 */
export async function captureAndTrackKlarna(
  klarnaOrderId: string,
  existingCaptureId: string | undefined,
  trackingNumber: string,
  carrier: string,
  trackingUrl: string,
  medusaOrderId: string,
  projectSlug?: string
): Promise<void> {
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

  const { KlarnaApiClient } = await import("../modules/payment-klarna/api-client.js")
  const client = new KlarnaApiClient(apiKey, secretKey, testMode)

  const klarnaCarrier = (carrier || "GLS").toUpperCase()
  const trackingUri = trackingUrl || undefined

  if (existingCaptureId) {
    const result = await client.addShippingInfo(klarnaOrderId, existingCaptureId, {
      shipping_company: klarnaCarrier,
      tracking_number: trackingNumber,
      tracking_uri: trackingUri,
    })
    if (!result.success) {
      throw new Error(result.error || "Failed to add shipping info to Klarna")
    }
    console.log(`[Klarna Tracking] ✅ Shipping info added to capture ${existingCaptureId}`)
    return
  }

  const orderDetails = await client.getOrder(klarnaOrderId)
  if (!orderDetails.success || !orderDetails.data) {
    throw new Error(orderDetails.error || `Failed to get Klarna order ${klarnaOrderId}`)
  }

  const klarnaOrder = orderDetails.data
  const remainingAmount = klarnaOrder.remaining_authorized_amount
  const orderAmount = klarnaOrder.order_amount

  if (klarnaOrder.status === "CAPTURED" || remainingAmount === 0) {
    const captures = klarnaOrder.captures || []
    const captureId = captures[0]?.capture_id
    if (captureId) {
      const result = await client.addShippingInfo(klarnaOrderId, captureId, {
        shipping_company: klarnaCarrier,
        tracking_number: trackingNumber,
        tracking_uri: trackingUri,
      })
      if (!result.success) {
        throw new Error(result.error || "Failed to add shipping info")
      }
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

  const captureAmount = remainingAmount || orderAmount
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

  const savePool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  await savePool.query(
    `UPDATE "order" SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{klarnaCaptureId}', $1::jsonb), updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(captureId), medusaOrderId]
  )
  await savePool.end()
}
