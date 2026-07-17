import { MedusaContainer } from "@medusajs/framework/types"
import { DEXTRUM_MODULE } from "../modules/dextrum"
import { MyStockApiClient } from "../modules/dextrum/api-client"
import { BriteApiClient } from "../modules/payment-brite/api-client"
import { normalizePhone } from "../utils/normalize-phone"
import { normalizePostalCode } from "../utils/normalize-postal-code"

// Brite ships-on-CREDIT gate: how long we keep an order queued while waiting
// for transaction state 5 (CREDIT) before giving up, and how often we re-check.
// CREDIT normally arrives seconds after COMPLETED; days-long waits mean the
// bank transfer is at risk of ending DEBIT (7) = funds never arrive.
const BRITE_CREDIT_MAX_WAIT_MS = 3 * 24 * 60 * 60 * 1000
const BRITE_CREDIT_RECHECK_MINUTES = 15

/**
 * Poll Brite for the live TRANSACTION state behind an order (fallback for a
 * missed state-5 callback — Brite retries callbacks only for ~1 hour).
 * Returns the numeric transaction state, or null when it cannot be determined.
 */
async function pollBriteTransactionState(orderMeta: any): Promise<number | null> {
  const sessionId = orderMeta?.briteSessionId || orderMeta?.brite_session_id
  if (!sessionId) return null

  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  let keys: any = null
  let baseUrl: string | undefined
  let isLive = false
  try {
    const { rows } = await pool.query(
      `SELECT mode, live_keys, test_keys, metadata
       FROM gateway_config
       WHERE provider = 'brite' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC LIMIT 1`
    )
    if (!rows[0]) return null
    isLive = rows[0].mode === "live"
    keys = isLive ? rows[0].live_keys : rows[0].test_keys
    baseUrl = rows[0].metadata?.base_url || undefined
  } finally {
    await pool.end().catch(() => {})
  }
  if (!keys?.api_key || !keys?.secret_key) return null

  const client = new BriteApiClient(keys.api_key, keys.secret_key, !isLive, console as any, baseUrl)
  await client.authenticate()
  const session = await client.getSession(String(sessionId))
  const txId = session?.transaction_id || session?.session?.transaction_id
  if (!txId) return null
  const tx: any = await client.getTransaction(String(txId))
  const state = tx?.state ?? tx?.transaction?.state
  if (state === null || state === undefined) return null
  const n = Number(state)
  if (!Number.isNaN(n)) return n
  // transaction.get may return textual state names — normalize to numbers
  const named: Record<string, number> = {
    CREATED: 0, PENDING: 1, PENDING_PROCESSING: 1, ABORTED: 2, FAILED: 3,
    COMPLETED: 4, CREDIT: 5, SETTLED: 6, DEBIT: 7,
  }
  return named[String(state).trim().toUpperCase()] ?? null
}

/**
 * Dextrum Order Hold Processor
 * Runs every minute — checks for orders past their hold_until time
 * and sends them to the warehouse.
 *
 * All orders (CZ/PL/NL/BE/DE/AT/SK/HU/SE) route through Dextrum mySTOCK.
 * Carrier per project is configured in dextrum_delivery_mapping table.
 */
export default async function dextrumOrderHold(container: MedusaContainer) {
  const dextrumService = container.resolve(DEXTRUM_MODULE) as any
  const query = container.resolve("query") as any

  try {
    // 1. Get config
    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
    const config = configs[0]
    if (!config?.enabled || !config.api_url) return

    // 2. Find orders in WAITING status past their hold time
    // Oldest-due first: rows whose hold was pushed to the future (e.g. Brite
    // orders waiting on CREDIT) must never page out due-now orders.
    const allWaiting = await dextrumService.listDextrumOrderMaps(
      { delivery_status: "WAITING" },
      { take: 50, order: { hold_until: "ASC" } }
    )

    const now = new Date()
    const readyToSend = allWaiting.filter((o: any) => {
      if (!o.hold_until) return true
      return new Date(o.hold_until) <= now
    })

    if (readyToSend.length === 0) return

    const client = new MyStockApiClient({
      apiUrl: config.api_url,
      username: config.api_username,
      password: config.api_password,
    })

    for (const orderMap of readyToSend) {
      try {
        // 3. RE-FETCH fresh order data from Medusa (CRITICAL — catches modifications)
        const { data: [order] } = await query.graph({
          entity: "order",
          fields: [
            "id", "display_id", "email", "currency_code", "total", "sales_channel_id",
            "metadata", "items.*", "items.variant.*", "items.variant.product.*",
            "shipping_address.*", "shipping_methods.*",
            "payment_collections.*", "payment_collections.payments.*",
          ],
          filters: { id: orderMap.medusa_order_id },
        })

        if (!order) {
          // Order was deleted — mark as FAILED to stop retrying
          await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
            delivery_status: "FAILED",
            delivery_status_updated_at: now.toISOString(),
            last_error: "Medusa order not found (deleted?)",
          })
          console.error(`[Dextrum Hold] Order ${orderMap.medusa_order_id} not found — marked FAILED`)
          continue
        }

        // 4. Check payment — check ALL payment collections (first may be canceled after upsell)
        const paidStatuses = ["captured", "completed", "authorized"]
        const isPaid = ((order as any).payment_collections || []).some(
          (pc: any) => paidStatuses.includes(pc.status)
        )
        const isCOD = (order as any).metadata?.payment_method === "cod"

        // Bank Transfer (SEPA QR) gate: the bank_transfer provider returns
        // AUTHORIZED at checkout so the order can be created, but the money only
        // arrives later — never ship on that authorized-but-unpaid state. Hold
        // until the FIO reconcile cron matches the transfer (sets
        // payment_captured / bank_transfer_reconciled). Scoped to bank_transfer
        // orders only; does NOT touch retry_count (transfers can take days).
        const btMeta = (order as any).metadata || {}
        // Bank transfer expired (5 days unpaid → canceled by the reconcile cron) — never ship.
        if (btMeta.bank_transfer_expired === true) {
          await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
            delivery_status: "FAILED",
            delivery_status_updated_at: now.toISOString(),
            last_error: "Bank transfer expired (5 days) — order canceled",
          })
          console.log(`[Dextrum Hold] Order ${orderMap.medusa_order_id}: bank transfer expired — blocked from WMS`)
          continue
        }
        const isAwaitingBankTransfer =
          btMeta.awaiting_bank_payment === true &&
          btMeta.payment_captured !== true &&
          btMeta.bank_transfer_reconciled !== true
        if (isAwaitingBankTransfer) {
          const queuedAt = new Date(orderMap.created_at || now).getTime()
          const BT_MAX_WAIT_MS = 21 * 24 * 60 * 60 * 1000
          if (now.getTime() - queuedAt > BT_MAX_WAIT_MS) {
            await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
              delivery_status: "FAILED",
              delivery_status_updated_at: now.toISOString(),
              last_error: "Bank transfer not received within 21 days",
            })
            const { Pool } = require("pg")
            const p = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
            await p.query(
              `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
              [JSON.stringify({ dextrum_status: "FAILED", dextrum_error: "Bank transfer timeout (21 days)" }), orderMap.medusa_order_id]
            ).catch(() => {})
            await p.end().catch(() => {})
            console.error(`[Dextrum Hold] Order ${orderMap.medusa_order_id}: bank transfer not received within 21 days — marked FAILED`)
          } else {
            const nextCheck = new Date(now.getTime() + 15 * 60 * 1000)
            await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
              hold_until: nextCheck.toISOString(),
              last_error: "Waiting for bank transfer (SEPA)",
            })
          }
          continue
        }

        if (!isPaid && !isCOD) {
          // Not paid yet — increment retry
          const retries = (orderMap.retry_count || 0) + 1
          if (retries > config.retry_max_attempts) {
            await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
              delivery_status: "FAILED",
              delivery_status_updated_at: now.toISOString(),
              last_error: "Payment timeout — order not paid within time limit",
              retry_count: retries,
            })
            // JSONB merge — a full replace from the stale in-memory snapshot
            // clobbers fields written concurrently by webhooks/subscribers.
            const { Pool } = require("pg")
            const p = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
            try {
              await p.query(
                `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
                [JSON.stringify({ dextrum_status: "FAILED", dextrum_error: "Payment timeout" }), orderMap.medusa_order_id]
              )
            } finally {
              await p.end().catch(() => {})
            }
          } else {
            const nextRetry = new Date(now.getTime() + config.retry_interval_minutes * 60 * 1000)
            await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
              hold_until: nextRetry.toISOString(),
              retry_count: retries,
              last_error: `Waiting for payment (retry ${retries}/${config.retry_max_attempts})`,
            })
          }
          continue
        }

        // 4b. Brite ships-on-CREDIT gate (Brite integration requirement):
        // goods may only ship once the TRANSACTION reaches CREDIT (5) —
        // COMPLETED (4) does not guarantee funds (transfer can end DEBIT/lost).
        // The Brite webhook sets brite_credit_received on tx 5/6; if the
        // callback was missed we poll Brite directly. This gate is scoped to
        // Brite orders only — all other providers are unaffected.
        const briteMeta = (order as any).metadata || {}
        // Authoritative check: the order's ACTUAL payment rows, not metadata.
        // Loose webhook matching can stamp Brite metadata onto an order whose
        // covering payment is another provider (abandoned Brite session) —
        // such orders must NOT be held by this gate.
        const isBrite = ((order as any).payment_collections || []).some((pc: any) =>
          (pc.payments || []).some((p: any) => String(p?.provider_id || "").startsWith("pp_brite"))
        )
        if (isBrite && !isCOD && briteMeta.brite_credit_received !== true) {
          if (briteMeta.brite_payment_lost === true) {
            await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
              delivery_status: "FAILED",
              delivery_status_updated_at: now.toISOString(),
              last_error: "Brite DEBIT: payment lost — funds never arrived",
            })
            console.error(`[Dextrum Hold] Order ${orderMap.medusa_order_id}: Brite payment LOST (DEBIT) — blocked from WMS`)
            continue
          }

          // Fallback poll (webhook may have been missed)
          let polledState: number | null = null
          try {
            polledState = await pollBriteTransactionState(briteMeta)
          } catch (e: any) {
            console.warn(`[Dextrum Hold] Brite poll failed for ${orderMap.medusa_order_id}: ${e?.message}`)
          }

          if (polledState !== null && [5, 6].includes(polledState)) {
            const { Pool } = require("pg")
            const p = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
            await p.query(
              `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
              [JSON.stringify({
                brite_credit_received: true,
                brite_credit_received_at: now.toISOString(),
                brite_credit_source: "hold_job_poll",
              }), orderMap.medusa_order_id]
            ).catch(() => {})
            await p.end().catch(() => {})
            console.log(`[Dextrum Hold] Order ${orderMap.medusa_order_id}: Brite CREDIT confirmed via poll (state ${polledState}) — releasing`)
            // fall through to send
          } else if (polledState === 7) {
            await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
              delivery_status: "FAILED",
              delivery_status_updated_at: now.toISOString(),
              last_error: "Brite DEBIT (state 7): payment lost — funds never arrived",
            })
            const { Pool } = require("pg")
            const p = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
            await p.query(
              `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
              [JSON.stringify({
                brite_payment_lost: true,
                brite_payment_lost_at: now.toISOString(),
                dextrum_status: "FAILED",
                dextrum_error: "Brite payment lost (DEBIT)",
              }), orderMap.medusa_order_id]
            ).catch(() => {})
            await p.end().catch(() => {})
            console.error(`[Dextrum Hold] Order ${orderMap.medusa_order_id}: Brite DEBIT detected via poll — blocked from WMS`)
            continue
          } else {
            // Still waiting for CREDIT (state 0/1/4 or poll unavailable).
            // Re-check periodically; give up after BRITE_CREDIT_MAX_WAIT_MS.
            // Deliberately does NOT touch retry_count (that's the unpaid-order
            // counter with a much shorter window).
            const queuedAt = new Date(orderMap.created_at || now).getTime()
            if (now.getTime() - queuedAt > BRITE_CREDIT_MAX_WAIT_MS) {
              await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
                delivery_status: "FAILED",
                delivery_status_updated_at: now.toISOString(),
                last_error: "Brite CREDIT timeout — state 5 not reached within 3 days",
              })
              const { Pool } = require("pg")
              const p = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
              await p.query(
                `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
                [JSON.stringify({ dextrum_status: "FAILED", dextrum_error: "Brite CREDIT timeout (3 days)" }), orderMap.medusa_order_id]
              ).catch(() => {})
              await p.end().catch(() => {})
              console.error(`[Dextrum Hold] Order ${orderMap.medusa_order_id}: Brite CREDIT not received within 3 days — marked FAILED, manual review required`)
            } else {
              const nextCheck = new Date(now.getTime() + BRITE_CREDIT_RECHECK_MINUTES * 60 * 1000)
              await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
                hold_until: nextCheck.toISOString(),
                last_error: `Waiting for Brite CREDIT (tx state 5)${polledState !== null ? ` — current state ${polledState}` : ""}`,
              })
              console.log(`[Dextrum Hold] Order ${orderMap.medusa_order_id}: waiting for Brite CREDIT (state ${polledState ?? "unknown"}) — next check ${nextCheck.toISOString()}`)
            }
            continue
          }
        }

        // 5. Detect country (SE orders now go through Dextrum mySTOCK like all others)
        const addr = (order as any).shipping_address || {}
        const countryCode = (addr.country_code || (order as any).billing_address?.country_code || "").toUpperCase()
        if (!countryCode) console.error(`[Dextrum Hold] Order ${orderMap.medusa_order_id} missing country_code!`)

        // NOTE: SE orders previously routed to PostNord/Linker (deprecated 2026-05).
        // SE now ships from Dextrum WMS via GLS. Carrier mapping configured per
        // sales_channel + shipping_option in the dextrum_delivery_mapping table
        // (set up in Dextrum admin UI).

        // Defensive guard: legacy SE orders that were already shipped via
        // PostNord must NEVER be re-sent to Dextrum. We mark them IMPORTED
        // and skip permanently. (Belt-and-suspenders — cron filter already
        // excludes non-WAITING, but in case someone resets status manually.)
        const _orderMetaEarly = (order as any).metadata || {}
        if (_orderMetaEarly.postnord_sent === true || _orderMetaEarly.postnord_sent === "true") {
          console.log(`[Dextrum Hold] ${orderMap.mystock_order_code}: already sent to PostNord, skipping`)
          await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
            delivery_status: "IMPORTED",
            delivery_status_updated_at: now.toISOString(),
            last_error: null,
          })
          continue
        }

        const prefixMap: Record<string, string> = {
          NL: "NL", BE: "BE", DE: "DE", AT: "AT", LU: "LU",
          PL: "PL", CZ: "CZ", SK: "SK", SE: "SE", HU: "HU",
        }
        const year = new Date().getFullYear()
        const orderCode = orderMap.mystock_order_code || `${prefixMap[countryCode] || countryCode}${year}-${(order as any).display_id}`

        const rawItems = (order as any).items || []
        console.log(`[Dextrum Hold] Order ${orderCode} items count: ${(order as any).items?.length ?? 'undefined'}, keys: ${Object.keys(order as any).join(', ')}`)

        /**
         * SKU mapping for bundle variants → physical warehouse SKU.
         *
         * Loslatenboek uses per-bundle variants (LLWJK-1 to LLWJK-4) where the suffix
         * encodes the number of physical books. The warehouse needs the real product SKU
         * (LLWJK7824627392) with the correct quantity.
         *
         * Het-leven follows the same pattern with HLDV-{N} bundles → HLDV62786284629
         * (the official barcode SKU for the physical book at Dextrum).
         */
        const BUNDLE_SKU_MAP: Record<string, { physicalSku: string; quantity: number }> = {
          "LLWJK-1": { physicalSku: "LLWJK7824627392", quantity: 1 },
          "LLWJK-2": { physicalSku: "LLWJK7824627392", quantity: 2 },
          "LLWJK-3": { physicalSku: "LLWJK7824627392", quantity: 3 },
          "LLWJK-4": { physicalSku: "LLWJK7824627392", quantity: 4 },
          "HLDV-1": { physicalSku: "HLDV62786284629", quantity: 1 },
          "HLDV-2": { physicalSku: "HLDV62786284629", quantity: 2 },
          "HLDV-3": { physicalSku: "HLDV62786284629", quantity: 3 },
          "HLDV-4": { physicalSku: "HLDV62786284629", quantity: 4 },
          // Order-bump upsell variant (Loslatenboek → Het Leven cross-sell).
          // Admin SKU has -2 suffix to distinguish from the main het-leven 1-book
          // SKU, but Dextrum holds only the parent barcode HLDV62786284629.
          "HLDV62786284629-2": { physicalSku: "HLDV62786284629", quantity: 1 },
          // Order-bump upsell variant (Het Leven → Laat Los cross-sell).
          // Admin SKU has -2 suffix; Dextrum holds the parent barcode LLWJK7824627392.
          "LLWJK7824627392-2": { physicalSku: "LLWJK7824627392", quantity: 1 },
          // ─── Polish: Życie, jakiego nigdy sobie nie pozwoliłaś (zycie-zaslugy) ───
          // Per-bundle variants ZJN-{N} → physical book SKU ZJNS827837491 ×N.
          "ZJN-1": { physicalSku: "ZJNS827837491", quantity: 1 },
          "ZJN-2": { physicalSku: "ZJNS827837491", quantity: 2 },
          "ZJN-3": { physicalSku: "ZJNS827837491", quantity: 3 },
          "ZJN-4": { physicalSku: "ZJNS827837491", quantity: 4 },
          // Order-bump upsell variant (ZJN-1-1) → same physical book barcode.
          // Admin SKU has the extra -1 suffix; Dextrum holds only ZJNS827837491.
          "ZJN-1-1": { physicalSku: "ZJNS827837491", quantity: 1 },
          // Order-bump upsell (Życie → Odpuść cross-sell). Admin SKU has -2 suffix;
          // Dextrum holds only the parent barcode OTCCN64787237.
          "OTCCN64787237-2": { physicalSku: "OTCCN64787237", quantity: 1 },
          // Order-bump upsell (Život → Pusť to cross-sell). Admin SKU has -3 suffix;
          // Dextrum holds only the parent barcode OTCCN64787237.
          "OTCCN64787237-3": { physicalSku: "OTCCN64787237", quantity: 1 },
          // ─── Czech: Život, jaký si zasloužíš (zivot-zaslugy) ───
          // Dextrum zná jediný fyzický kód knihy: ZJSZ9827982789.
          // Varianta "1 kniha" nese rovnou fyzické SKU, bundly 2–4 mají ZKZ-{N}.
          // Bez tohoto mapování by se do WMS poslal neexistující kód "ZKZ-2" v počtu 1 ks.
          "ZJSZ9827982789": { physicalSku: "ZJSZ9827982789", quantity: 1 },
          "ZKZ-1": { physicalSku: "ZJSZ9827982789", quantity: 1 },
          "ZKZ-2": { physicalSku: "ZJSZ9827982789", quantity: 2 },
          "ZKZ-3": { physicalSku: "ZJSZ9827982789", quantity: 3 },
          "ZKZ-4": { physicalSku: "ZJSZ9827982789", quantity: 4 },
          // ─── Hungarian: Engedd el, ami tönkretesz (engedd-el) ───
          // Jediná varianta "Puhakötés" (ENGEDD-EL-PB), bundle 1–4 jede přes množství
          // na řádku — proto quantity: 1, route ho násobí line quantity.
          // Dextrum zná knihu pod kódem EEAT89789272462 (sortiment 00512375), ne pod
          // medusím SKU "ENGEDD-EL-PB".
          "ENGEDD-EL-PB": { physicalSku: "EEAT89789272462", quantity: 1 },
          // Kočičí bible — samostatný funnel (kocicibible.cz). Single-variant bundle
          // (quantity=N na variantě); Dextrum zná fyzický kód 363682.
          "KOCICI-BIBLE-OFICIAL-PB": { physicalSku: "363682", quantity: 1 },
          // Kočičí bible order bumpy — admin SKU má suffix -2, Dextrum drží rodičovský kód.
          "PTCTN2876287672-2": { physicalSku: "PTCTN2876287672", quantity: 1 },
          "ZJSZ9827982789-2": { physicalSku: "ZJSZ9827982789", quantity: 1 },
          "PZ7874294876-2": { physicalSku: "PZ7874294876", quantity: 1 },
        }

        // Filter out non-physical items (e.g. COD fee) that don't exist in the warehouse
        const SKIP_SKUS = new Set(["FEE-COD"])
        const physicalItems = rawItems.filter((item: any) => {
          const sku = item.variant?.sku || "UNKNOWN"
          if (SKIP_SKUS.has(sku)) {
            console.log(`[Dextrum Hold] Skipping non-physical item: ${sku} (${item.title || item.variant?.product?.title})`)
            return false
          }
          return true
        })

        const orderItems = physicalItems.map((item: any) => {
          const sku = item.variant?.sku || "UNKNOWN"
          const bundleMapping = BUNDLE_SKU_MAP[sku]

          if (bundleMapping) {
            // Bundle variant → map to physical warehouse SKU with correct quantity
            // Bundle/upsell variant → physical SKU. Multiply the per-unit bundle
            // count by the line quantity so order-bump pickers (qty>1) ship correctly.
            console.log(`[Dextrum Hold] SKU mapping: ${sku} → ${bundleMapping.quantity * (item.quantity || 1)}× ${bundleMapping.physicalSku}`)
            return {
              productCode: bundleMapping.physicalSku,
              quantity: bundleMapping.quantity * (item.quantity || 1),
              unitPrice: Number(item.unit_price) || 0,
              productName: item.variant?.product?.title || item.title || "",
            }
          }

          return {
            productCode: sku,
            quantity: item.quantity || 1,
            unitPrice: Number(item.unit_price) || 0,
            productName: item.variant?.product?.title || item.title || "",
          }
        })

        // 5b. Safety: do not send empty orders — retry later
        if (orderItems.length === 0) {
          console.warn(`[Dextrum Hold] Order ${orderCode} has no items (raw items: ${rawItems.length}), retrying later`)
          const retries = (orderMap.retry_count || 0) + 1
          if (retries > (config.retry_max_attempts || 10)) {
            await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
              delivery_status: "FAILED",
              delivery_status_updated_at: now.toISOString(),
              last_error: "Order has no items after max retries",
              retry_count: retries,
            })
          } else {
            await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
              hold_until: new Date(now.getTime() + 2 * 60 * 1000).toISOString(),
              retry_count: retries,
              last_error: `Order has no items (retry ${retries})`,
            })
          }
          continue
        }

        // 6. Safety: skip if already sent (e.g., by manual send route)
        if (orderMap.mystock_order_id) {
          console.log(`[Dextrum Hold] Order ${orderCode} already sent (${orderMap.mystock_order_id}), skipping`)
          continue
        }

        // 7. Send to mySTOCK
        const orderMeta = (order as any).metadata || {}
        const deliveryFee = Number(orderMeta.shipping_fee) || 0
        const isPickup = orderMeta.shipping_method === "zasilkovna_pickup"

        // Build note with Zásilkovna pickup point info
        let orderNote = ""
        if (isPickup && orderMeta.packeta_point_id) {
          orderNote = `Zásilkovna pickup: ${orderMeta.packeta_point_name || ""} (ID: ${orderMeta.packeta_point_id})`
        }

        // Resolve delivery & payment via delivery mappings
        const shippingOptionId = (order as any).shipping_methods?.[0]?.shipping_option_id || ""
        const salesChannelId = (order as any).sales_channel_id || orderMeta.sales_channel_id || ""

        // Look up mapping: sales_channel + shipping_option + is_cod
        let mapping: any = null
        if (salesChannelId && shippingOptionId) {
          const mappings = await dextrumService.listDextrumDeliveryMappings({
            sales_channel_id: salesChannelId,
            shipping_option_id: shippingOptionId,
            is_cod: isCOD,
          }, { take: 1 })
          mapping = mappings[0] || null
        }

        let deliveryMethodId = ""
        let paymentMethodId = ""
        let externalCarrierCode = ""

        if (mapping) {
          // Use mapping values
          deliveryMethodId = (mapping.delivery_method_id || "").trim()
          paymentMethodId = (mapping.payment_method_id || "").trim()
          externalCarrierCode = (mapping.external_carrier_code || "").trim()
          console.log(`[Dextrum Hold] Mapping found for ${orderCode}: delivery=${deliveryMethodId}, payment=${paymentMethodId}, carrier=${externalCarrierCode}`)
        } else {
          // Fallback to config defaults (shipping_option metadata not available via cross-module query)
          const soMeta: Record<string, any> = {}
          deliveryMethodId = soMeta.mystock_delivery_method_id || ""
          if (!deliveryMethodId) {
            deliveryMethodId = isPickup
              ? (config.default_pickup_delivery_method_id || config.default_delivery_method_id || "")
              : (config.default_delivery_method_id || "")
          }
          if (isCOD) {
            paymentMethodId = soMeta.mystock_payment_method_cod || config.default_payment_method_cod || ""
          } else {
            paymentMethodId = soMeta.mystock_payment_method_paid || config.default_payment_method_paid || ""
          }
          externalCarrierCode = soMeta.mystock_external_carrier_code || ""
          console.log(`[Dextrum Hold] No mapping for ${orderCode} (sc=${salesChannelId}, so=${shippingOptionId}, cod=${isCOD}), using defaults`)
        }

        // Build delivery address
        const phoneResult = normalizePhone(addr.phone, countryCode)
        if (phoneResult.warning) {
          console.log(`[Dextrum Hold] ${orderCode}: ${phoneResult.warning}`)
        }
        const postalResult = normalizePostalCode(addr.postal_code, countryCode)
        if (postalResult.warning) {
          console.log(`[Dextrum Hold] ${orderCode}: ${postalResult.warning}`)
        }
        const deliveryAddress: any = {
          firstName: addr.first_name || "",
          lastName: addr.last_name || "",
          street: [addr.address_1, addr.address_2].filter(Boolean).join(", "),
          city: addr.city || "",
          zip: postalResult.normalized,
          country: countryCode,
          phone: phoneResult.normalized,
          email: (order as any).email || "",
        }
        // Log normalizations in order timeline (ONLY ONCE — skip if already logged)
        const existingMeta = (order as any).metadata || {}
        const alreadyLoggedPhone = !!existingMeta.phone_normalization
        const alreadyLoggedPostal = !!existingMeta.postal_normalization
        const needsPhoneLog = (phoneResult.changed || phoneResult.warning) && !alreadyLoggedPhone
        const needsPostalLog = postalResult.changed && !alreadyLoggedPostal

        if (needsPhoneLog || needsPostalLog) {
          try {
            const orderService = container.resolve("order") as any
            const dextrumTimeline = Array.isArray(existingMeta.dextrum_timeline) ? [...existingMeta.dextrum_timeline] : []
            if (needsPhoneLog) {
              dextrumTimeline.push({
                status: phoneResult.changed ? "PHONE_NORMALIZED" : "PHONE_MISSING",
                date: new Date().toISOString(),
                detail: phoneResult.warning || `Phone normalized: "${phoneResult.original}" → "${phoneResult.normalized}"`,
              })
            }
            if (needsPostalLog) {
              dextrumTimeline.push({
                status: "POSTAL_NORMALIZED",
                date: new Date().toISOString(),
                detail: postalResult.warning || `Postal: ${postalResult.normalized}`,
              })
            }
            await orderService.updateOrders([{
              id: (order as any).id,
              metadata: {
                ...existingMeta,
                phone_normalization: needsPhoneLog ? {
                  original: phoneResult.original,
                  normalized: phoneResult.normalized,
                  changed: phoneResult.changed,
                  warning: phoneResult.warning || null,
                  timestamp: new Date().toISOString(),
                } : existingMeta.phone_normalization,
                postal_normalization: needsPostalLog ? {
                  original: postalResult.original,
                  normalized: postalResult.normalized,
                  changed: postalResult.changed,
                  timestamp: new Date().toISOString(),
                } : existingMeta.postal_normalization,
                dextrum_timeline: dextrumTimeline,
              },
            }])
          } catch { /* non-critical */ }
        }
        if (addr.company) deliveryAddress.company = addr.company
        // Set pickupPlaceCode from any available metadata source.
        // Home-delivery orders must NEVER carry a pickupPlaceCode: mySTOCK
        // rejects them ("delivery method does not support pickup places").
        // The checkout can leave a stray packeta_point_id behind when the
        // customer first picks a parcel locker, then switches to home delivery —
        // so we hard-guard here regardless of what metadata still holds.
        const isHomeDelivery = orderMeta.shipping_method === "home_delivery"
        const pickupCode = isHomeDelivery
          ? ""
          : (orderMeta.packeta_point_id || orderMeta.paczkomat_id || orderMeta.pickup_place_code || "")
        if (pickupCode) {
          deliveryAddress.pickupPlaceCode = pickupCode
        }
        if (externalCarrierCode) {
          deliveryAddress.externalCarrierCode = externalCarrierCode
          // If carrier requires pickup place code but none available, log warning
          if (!pickupCode) {
            console.warn(`[Dextrum Hold] ${orderCode}: Carrier ${externalCarrierCode} set but no pickupPlaceCode found in metadata`)
          }
        }

        const wmsResult = await client.createOrder({
          orderCode,
          warehouseCode: (config.default_warehouse_code || "").trim() || undefined,
          partnerId: (config.partner_id || "").trim(),
          orderItems,
          deliveryAddress,
          deliveryMethodId: (deliveryMethodId || "").trim() || undefined,
          paymentMethodId: (paymentMethodId || "").trim() || undefined,
          cashAmount: isCOD ? (() => {
            // New orders have fees as line items (in order.total).
            // Old orders have fees only in metadata — add them manually.
            const orderItems = (order as any).items || []
            const hasFeeItems = orderItems.some((i: any) =>
              i.product_handle === "doprava-na-adresu" || i.product_handle === "priplatek-za-dobirku"
              || (i.variant_sku && (i.variant_sku === "FEE-DELIVERY-HOME" || i.variant_sku === "FEE-COD"))
            )
            const total = Number((order as any).total) || 0
            if (hasFeeItems) return total
            return total + (Number(orderMeta.cod_fee) || 0) + deliveryFee
          })() : undefined,
          cashCurrencyCode: ((order as any).currency_code || "EUR").toUpperCase(),
          note: orderNote || undefined,
        })

        // mySTOCK umí odpovědět 200 OK, a přesto objednávku nevytvořit — typicky když
        // nezná kód zboží nebo chybí metoda dopravy. Bez téhle kontroly se níž zapíše
        // IMPORTED s mystock_order_id = null: v adminu svítí „odesláno", ve skladu nic.
        // Přesně tak zmizely HU2026-27404 a HU2026-27429. Throw spadne do catchu níž,
        // který zapíše last_error a naplánuje retry (zastropovaný retry_max_attempts).
        if (!wmsResult.id) {
          throw new Error(
            `mySTOCK nevrátil ID objednávky pro ${orderCode} — objednávka NEBYLA vytvořena. ` +
            `Zkontroluj kódy zboží (${orderItems.map((i: any) => `${i.productCode}×${i.quantity}`).join(", ")}) ` +
            `a metodu dopravy (deliveryMethodId=${deliveryMethodId || "CHYBÍ"}, paymentMethodId=${paymentMethodId || "CHYBÍ"}).`
          )
        }

        // 7. Update dextrum_order_map
        const sentAt = new Date().toISOString()
        await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
          mystock_order_id: wmsResult.id,
          delivery_status: "IMPORTED",
          delivery_status_updated_at: sentAt,
          sent_to_wms_at: sentAt,
          last_error: null,
          retry_count: 0,
        })

        // 8. Update order metadata via direct DB query.
        // JSONB merge — a full replace from the snapshot fetched at step 3
        // wipes fields written mid-iteration (e.g. brite_credit_received from
        // this very run's poll, or a webhook's payment_activity_log entry).
        const updatedMeta = {
          dextrum_status: "IMPORTED",
          dextrum_order_code: orderCode,
          dextrum_mystock_id: wmsResult.id,
          dextrum_sent_at: sentAt,
        }
        const { Pool: PgPool } = require("pg")
        const pgPool = new PgPool({ connectionString: process.env.DATABASE_URL, max: 2 })
        try {
          await pgPool.query(
            `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(updatedMeta), orderMap.medusa_order_id]
          )
        } finally {
          await pgPool.end().catch(() => {})
        }

        console.log(`[Dextrum Hold] Order ${orderCode} sent to WMS → ${wmsResult.id}`)
      } catch (err: any) {
        console.error(`[Dextrum Hold] Failed to send ${orderMap.mystock_order_code}:`, err.message)
        await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
          retry_count: (orderMap.retry_count || 0) + 1,
          last_error: err.message,
          hold_until: new Date(now.getTime() + (config.retry_interval_minutes || 5) * 60 * 1000).toISOString(),
        })
      }
    }
  } catch (error: any) {
    console.error("[Dextrum Hold] Job failed:", error.message)
  }
}

export const config = {
  name: "dextrum-order-hold",
  schedule: "* * * * *",
}
