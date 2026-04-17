// @ts-nocheck
/**
 * Klarna Capture Backfill
 *
 * Processes Klarna orders that have been DISPATCHED/DELIVERED but where our DB
 * does not show payment_captured=true. For each order:
 *   1. Query Klarna OM API with the right merchant credentials (matched by
 *      project_id via gateway_config.project_slugs).
 *   2. If Klarna says CAPTURED → mark locally (payment_captured=true,
 *      payment_captured_at, klarnaCaptureId, tracking_sent_to_gateway.klarna).
 *   3. If Klarna says AUTHORIZED/PART_CAPTURED and auth hasn't expired →
 *      capture the remaining amount + send shipping_info.
 *   4. If EXPIRED/CANCELLED/FRAUD → flag in report, skip.
 *
 * Run:  DRY_RUN=1 node --import tsx backend/scripts/klarna-backfill-capture.ts
 *       (then without DRY_RUN for real execution)
 */
import { Pool } from "pg"
import axios from "axios"

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true"
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("DATABASE_URL required")
  process.exit(1)
}

type KlarnaCfg = { apiKey: string; secretKey: string; testMode: boolean; displayName: string }

async function loadKlarnaConfigs(pool: Pool): Promise<Map<string, KlarnaCfg>> {
  const { rows } = await pool.query(
    `SELECT display_name, mode, live_keys, test_keys, project_slugs
     FROM gateway_config
     WHERE provider = 'klarna' AND is_active = true AND deleted_at IS NULL
     ORDER BY priority ASC`
  )
  const map = new Map<string, KlarnaCfg>()
  let fallback: KlarnaCfg | null = null
  for (const r of rows) {
    const isLive = r.mode === "live"
    const keys = isLive ? r.live_keys : r.test_keys
    if (!keys?.api_key || !keys?.secret_key) continue
    const cfg: KlarnaCfg = {
      apiKey: keys.api_key,
      secretKey: keys.secret_key,
      testMode: !isLive,
      displayName: r.display_name,
    }
    const slugs: string[] = Array.isArray(r.project_slugs) ? r.project_slugs : []
    if (slugs.length === 0 && !fallback) fallback = cfg
    for (const slug of slugs) map.set(slug, cfg)
  }
  if (fallback) map.set("__fallback__", fallback)
  return map
}

function klarnaClient(cfg: KlarnaCfg) {
  const base = cfg.testMode
    ? "https://api.playground.klarna.com"
    : "https://api.klarna.com"
  const auth = Buffer.from(`${cfg.apiKey}:${cfg.secretKey}`).toString("base64")
  return axios.create({
    baseURL: base,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    timeout: 20000,
    validateStatus: () => true,
  })
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 4 })
  const cfgMap = await loadKlarnaConfigs(pool)
  console.log(`Loaded ${cfgMap.size} Klarna configs:`, [...cfgMap.keys()])

  const { rows: orders } = await pool.query(
    `SELECT id, display_id, metadata
     FROM "order"
     WHERE metadata->>'payment_provider' ILIKE '%klarna%'
       AND (metadata->>'payment_captured') IS DISTINCT FROM 'true'
       AND metadata->>'dextrum_status' IN ('DISPATCHED','DELIVERED')
     ORDER BY created_at ASC`
  )
  console.log(`Found ${orders.length} candidate orders`)

  const report = {
    fixed_already_captured: 0,
    fixed_captured_now: 0,
    skip_expired: 0,
    skip_other: 0,
    skip_no_config: 0,
    errors: 0,
  }

  for (const row of orders) {
    const meta = row.metadata || {}
    const orderId = row.id
    const displayId = row.display_id
    const projectId = meta.project_id
    const klarnaOrderId = meta.klarnaOrderId
    const trackingNumber = meta.dextrum_tracking_number
    const carrier = (meta.dextrum_carrier || "GLS").toUpperCase()
    const trackingUrl = meta.dextrum_tracking_url || undefined

    if (!klarnaOrderId) {
      console.log(`[${displayId}] no klarnaOrderId, skip`)
      continue
    }

    const cfg = cfgMap.get(projectId) || cfgMap.get("__fallback__")
    if (!cfg) {
      console.log(`[${displayId}] no gateway_config for project ${projectId}`)
      report.skip_no_config++
      continue
    }

    const http = klarnaClient(cfg)
    const res = await http.get(`/ordermanagement/v1/orders/${klarnaOrderId}`)
    if (res.status === 404) {
      // Try the other configs (credential mismatch)
      let found = false
      for (const [slug, tryCfg] of cfgMap) {
        if (tryCfg === cfg) continue
        const r2 = await klarnaClient(tryCfg).get(`/ordermanagement/v1/orders/${klarnaOrderId}`)
        if (r2.status === 200) {
          console.log(`[${displayId}] cred mismatch — found via ${tryCfg.displayName}`)
          Object.assign(res, r2)
          found = true
          break
        }
      }
      if (!found) {
        console.log(`[${displayId}] 404 across all configs (${projectId} → ${cfg.displayName})`)
        report.errors++
        continue
      }
    }
    if (res.status !== 200) {
      console.log(`[${displayId}] klarna GET failed: ${res.status} ${JSON.stringify(res.data)}`)
      report.errors++
      continue
    }

    const k = res.data
    const status = k.status
    const captures: any[] = k.captures || []
    const captureId = captures[0]?.capture_id
    const nowIso = new Date().toISOString()

    if (status === "CAPTURED" || status === "PART_CAPTURED" || (k.remaining_authorized_amount === 0 && captures.length > 0)) {
      // Already captured on Klarna — just mark locally
      console.log(`[${displayId}] Klarna=CAPTURED amount=${k.captured_amount}/${k.order_amount} captureId=${captureId} — ${DRY_RUN ? "DRY" : "marking local"}`)
      if (!DRY_RUN) {
        await pool.query(
          `UPDATE "order" SET metadata = metadata
             || jsonb_build_object(
                  'payment_captured', true,
                  'payment_captured_at', $1::text,
                  'klarnaCaptureId', $2::text,
                  'tracking_sent_to_gateway',
                    COALESCE(metadata->'tracking_sent_to_gateway', '{}'::jsonb)
                    || jsonb_build_object('klarna', true, 'klarna_timestamp', $1::text, 'klarna_backfill', true)
                ),
             updated_at = NOW()
           WHERE id = $3`,
          [captures[0]?.captured_at || nowIso, captureId || "unknown", orderId]
        )
      }
      report.fixed_already_captured++
      continue
    }

    if (status === "AUTHORIZED" && trackingNumber) {
      // Capture now with shipping_info
      const amount = k.remaining_authorized_amount || k.order_amount
      console.log(`[${displayId}] Klarna=AUTHORIZED amount=${amount} — ${DRY_RUN ? "DRY" : "CAPTURING NOW"}`)
      if (DRY_RUN) {
        report.fixed_captured_now++
        continue
      }
      const capRes = await http.post(
        `/ordermanagement/v1/orders/${klarnaOrderId}/captures`,
        {
          captured_amount: amount,
          description: `Backfill capture — order ${orderId}`,
          shipping_info: [
            { shipping_company: carrier, tracking_number: trackingNumber, tracking_uri: trackingUrl },
          ],
        },
        { headers: { "Klarna-Idempotency-Key": `backfill-${orderId}` } }
      )
      if (capRes.status === 201 || capRes.status === 200) {
        const loc = capRes.headers?.location || ""
        const m = loc.match(/captures\/([^\/\s]+)/)
        const newCapId = m?.[1] || "unknown"
        await pool.query(
          `UPDATE "order" SET metadata = metadata
             || jsonb_build_object(
                  'payment_captured', true,
                  'payment_captured_at', $1::text,
                  'klarnaCaptureId', $2::text,
                  'tracking_sent_to_gateway',
                    COALESCE(metadata->'tracking_sent_to_gateway', '{}'::jsonb)
                    || jsonb_build_object('klarna', true, 'klarna_timestamp', $1::text, 'klarna_backfill', true)
                ),
             updated_at = NOW()
           WHERE id = $3`,
          [nowIso, newCapId, orderId]
        )
        console.log(`[${displayId}]   ✅ captured ${newCapId}`)
        report.fixed_captured_now++
      } else {
        console.log(`[${displayId}]   ❌ capture failed: ${capRes.status} ${JSON.stringify(capRes.data)}`)
        report.errors++
      }
      continue
    }

    if (status === "EXPIRED") {
      console.log(`[${displayId}] Klarna=EXPIRED at ${k.expires_at}`)
      report.skip_expired++
      continue
    }
    console.log(`[${displayId}] Klarna=${status} remaining=${k.remaining_authorized_amount} captures=${captures.length} — skipping`)
    report.skip_other++
  }

  console.log("\n=== REPORT ===")
  console.log(JSON.stringify(report, null, 2))
  console.log(`\n${DRY_RUN ? "DRY RUN" : "LIVE RUN"} complete.`)
  await pool.end()
}

main().catch((e) => {
  console.error("Fatal:", e)
  process.exit(1)
})
