// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { graphGet, purchasesFrom, roasFrom, rangeParams } from "../lib/meta"
import { normalizeAdsetId } from "../lib/meta-send"
import { ADS_LIBRARY_MODULE } from "../../../../modules/ads-library"

/**
 * GET /admin/ads-library/performance
 *   ?accounts=act_1,act_2&range=7d&sort=roas&limit=40
 *   ?adset=<id | Ads Manager URL>&range=7d
 * Live Meta insights at ad level, enriched with creative thumbnails (batched)
 * and an in-library flag.
 *
 * `adset` narrows to a single ad set. An ad set id is globally unique in Meta,
 * so it is asked directly instead of sweeping every ad account — one Graph call
 * rather than 19. It also lists ads that never delivered (freshly uploaded,
 * paused), which the insights edge alone omits entirely.
 *
 * Response is cached in-process for 10 minutes per (accounts|adset, range).
 */
const cache = new Map<string, { at: number; data: any }>()
const TTL = 10 * 60 * 1000

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { accounts = "", adset = "", range = "7d", sort = "roas", limit = "40" } = req.query as any
  const adsetId = adset ? normalizeAdsetId(String(adset)) : null
  const accIds = String(accounts).split(",").map((s) => s.trim()).filter(Boolean)

  if (adset && !adsetId) {
    return res.status(400).json({ error: `z „${adset}" se nedá vyčíst ID reklamní sady` })
  }
  if (!adsetId && !accIds.length) {
    return res.status(400).json({ error: "accounts is required" })
  }

  const key = adsetId ? `adset:${adsetId}::${range}` : `${accIds.sort().join("|")}::${range}`
  const hit = cache.get(key)
  let rows: any[]
  try {
    if (hit && Date.now() - hit.at < TTL) {
      rows = hit.data
    } else {
      rows = adsetId
        ? await fetchAdsetRows(adsetId, String(range))
        : await fetchInsights(accIds, String(range))
      cache.set(key, { at: Date.now(), data: rows })
    }
  } catch (e: any) {
    return res.status(502).json({ error: e.message })
  }

  const sorted = [...rows].sort((a, b) => {
    if (sort === "sales") return b.sales - a.sales
    if (sort === "ctr") return b.ctr - a.ctr
    if (sort === "spend") return b.spend - a.spend
    return b.roas - a.roas
  }).slice(0, Number(limit))

  // in-library flags
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const inLib = await svc.listAdCreatives(
    { meta_ad_id: sorted.map((r) => r.ad_id) }, { take: 500 }
  )
  const libSet = new Set(inLib.map((r: any) => r.meta_ad_id))

  res.json({
    rows: sorted.map((r) => ({ ...r, in_library: libSet.has(r.ad_id) })),
    adset_id: adsetId || undefined,
    adset_name: adsetId ? rows[0]?.adset_name : undefined,
    cached_at: hit && rows === hit.data ? new Date(hit.at).toISOString() : new Date().toISOString(),
  })
}

/** Every ad in one ad set, with metrics where the ad actually delivered. */
async function fetchAdsetRows(adsetId: string, range: string) {
  const [roster, stats] = await Promise.all([
    graphGet(`${adsetId}/ads`, {
      fields: "id,name,effective_status,account_id,adset{name},campaign{name},creative{id}",
      limit: 200,
    }),
    graphGet(`${adsetId}/insights`, {
      level: "ad",
      fields: "ad_id,spend,impressions,clicks,ctr,actions,purchase_roas,account_name",
      ...rangeParams(range),
      limit: 200,
    }).catch(() => ({ data: [] })),
  ])

  const byAd = new Map<string, any>()
  for (const s of stats.data || []) byAd.set(String(s.ad_id), s)

  const rows = (roster.data || []).map((a: any) => {
    const s = byAd.get(String(a.id)) || {}
    const spend = Number(s.spend) || 0
    const sales = purchasesFrom(s.actions)
    return {
      account_id: `act_${a.account_id}`,
      account_name: s.account_name || `act_${a.account_id}`,
      ad_id: a.id,
      ad_name: a.name,
      adset_name: a.adset?.name || null,
      campaign_name: a.campaign?.name || null,
      effective_status: a.effective_status || null,
      creative_id: a.creative?.id || null,
      spend,
      sales,
      cpa: sales ? +(spend / sales).toFixed(2) : 0,
      roas: roasFrom(s.purchase_roas),
      ctr: Number(s.ctr) || 0,
      // an ad with no delivery has no insights row at all
      no_delivery: !byAd.has(String(a.id)),
    }
  })
  return await attachPreviews(rows)
}

async function fetchInsights(accIds: string[], range: string) {
  const rp = rangeParams(range)
  const all: any[] = []

  // sequential per account (12 max) — keeps rate limits comfortable
  for (const acc of accIds) {
    const json = await graphGet(`${acc}/insights`, {
      level: "ad",
      fields: "ad_id,ad_name,campaign_name,adset_name,spend,impressions,clicks,ctr,actions,purchase_roas,account_name",
      ...rp,
      limit: 200,
    })
    for (const r of json.data || []) {
      const spend = Number(r.spend) || 0
      const sales = purchasesFrom(r.actions)
      all.push({
        account_id: acc,
        account_name: r.account_name || acc,
        ad_id: r.ad_id,
        ad_name: r.ad_name,
        campaign_name: r.campaign_name,
        adset_name: r.adset_name,
        spend,
        sales,
        cpa: sales ? +(spend / sales).toFixed(2) : 0,
        roas: roasFrom(r.purchase_roas),
        ctr: Number(r.ctr) || 0,
      })
    }
  }

  return await attachPreviews(all.filter((r) => r.spend > 0))
}

/**
 * Previews in two passes. `thumbnail_width` is ignored on a nested creative{}
 * field (always returns 64px), but honoured when the creative is queried
 * directly — so pass 1 collects creative ids, pass 2 asks those ids for a
 * 1080px render. `image_url` (the untouched original) wins when present.
 */
async function attachPreviews(rows: any[]) {
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50)
    try {
      if (chunk.some((r) => !r.creative_id)) {
        const json = await graphGet("", {
          ids: chunk.map((r) => r.ad_id).join(","),
          fields: "creative{id}",
        })
        for (const r of chunk) r.creative_id = r.creative_id || json[r.ad_id]?.creative?.id || null
      }

      const cids = chunk.map((r) => r.creative_id).filter(Boolean)
      if (cids.length) {
        const cJson = await graphGet("", {
          ids: cids.join(","),
          fields: "thumbnail_url,image_url",
          thumbnail_width: 1080, thumbnail_height: 1080,
        })
        for (const r of chunk) {
          const c = r.creative_id ? cJson[r.creative_id] : null
          // full-size for the hover zoom, same source for the 38px table cell
          r.thumb = c?.image_url || c?.thumbnail_url || null
          r.full = r.thumb
        }
      }
    } catch (e) {
      console.warn(`[Ads Library] preview batch failed: ${e.message}`)
    }
  }
  return rows
}
