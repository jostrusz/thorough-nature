// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADS_LIBRARY_MODULE } from "../../../../../../modules/ads-library"
import { metaToken, graphGet } from "../../../lib/meta"

const GRAPH = "https://graph.facebook.com/v23.0"

async function graphPost(path: string, body: Record<string, any>) {
  const form = new URLSearchParams({ access_token: metaToken() })
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && v !== null) form.set(k, typeof v === "object" ? JSON.stringify(v) : String(v))
  }
  const res = await fetch(`${GRAPH}/${path}`, { method: "POST", body: form })
  const json = await res.json()
  if (!res.ok || json.error) {
    throw new Error(`[Meta ${path}] ${json?.error?.error_user_msg || json?.error?.message || res.status}`)
  }
  return json
}

/** Upload an image from URL into the ad account's image library → image_hash. */
async function uploadImage(account: string, url: string): Promise<string> {
  const img = await fetch(url)
  if (!img.ok) throw new Error(`stažení obrázku selhalo (${img.status})`)
  const b64 = Buffer.from(await img.arrayBuffer()).toString("base64")
  const json = await graphPost(`${account}/adimages`, { bytes: b64 })
  const first = Object.values(json.images || {})[0] as any
  if (!first?.hash) throw new Error("adimages nevrátil hash")
  return first.hash
}

/**
 * Accepts a bare ad set id OR a full Ads Manager URL and returns the id.
 * URL shapes seen in the wild: ...&selected_adset_ids=120210000000000000...,
 * ...&adset_ids=[%22120210...%22]..., or the id embedded in the path.
 */
function normalizeAdsetId(input: string): string | null {
  const s = decodeURIComponent(String(input || "").trim())
  if (/^\d{10,}$/.test(s)) return s
  const named = s.match(/(?:selected_adset_ids|adset_ids?)[=%[\]"':\s]*(\d{10,})/)
  if (named) return named[1]
  // fall back to the longest digit run — adset ids are 15+ digits
  const runs = s.match(/\d{10,}/g) || []
  runs.sort((a, b) => b.length - a.length)
  return runs[0] || null
}

/**
 * POST /admin/ads-library/creatives/:id/send-to-meta
 * Body: { adset_id }                                      ← quick path: the account
 *        is resolved from the ad set itself, nothing else needed
 *    or { account_id, campaign_id, adset_id }
 *    or { account_id, campaign_id, new_adset: { name, daily_budget_eur, copy_from_adset_id } }
 * Creates an ad in PAUSED state. page_id/IG identity is taken from the
 * account's most recent creative (data-driven, nothing hardcoded).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const b = (req.body || {}) as any
  const fail = (code: number, msg: string) => res.status(code).json({ error: msg, message: msg })

  let account = b.account_id
  let adsetInfo: any = null
  // quick path — a bare adset id (or a pasted Ads Manager URL) carries its account
  if (!account && b.adset_id) {
    const normalized = normalizeAdsetId(b.adset_id)
    if (!normalized) {
      return fail(400, `v "${String(b.adset_id).slice(0, 80)}" nevidím žádné ad set ID (dlouhé číslo) — zkopíruj ID nebo URL ad setu z Ads Manageru`)
    }
    try {
      adsetInfo = await graphGet(normalized, { fields: "account_id,name,status,campaign{name}" })
      if (!adsetInfo.campaign) throw new Error("není to ad set")
      b.adset_id = normalized
    } catch {
      // maybe the pasted id is an AD id — resolve its parent ad set
      try {
        const ad = await graphGet(normalized, { fields: "adset{id,name,status,account_id,campaign{name}}" })
        if (!ad.adset?.id) throw new Error("nemá ad set")
        adsetInfo = ad.adset
        b.adset_id = ad.adset.id
      } catch {
        return fail(400, `ID ${normalized} není ad set ani reklama dostupná tímto tokenem — zkopíruj ID/URL ad setu z Ads Manageru (sloupec ID, nebo selected_adset_ids v adrese)`)
      }
    }
    account = `act_${adsetInfo.account_id}`
  }
  if (!account?.startsWith("act_")) return fail(400, "account_id (act_…) nebo platný adset_id je povinný")

  const [c] = await svc.listAdCreatives({ id: req.params.id })
  if (!c) return fail(404, "kreativa nenalezena")
  if (!c.image_1x1_url) return fail(400, "kreativa nemá 1:1 obrázek")
  if (!c.primary_texts?.length || !c.headlines?.length) {
    return fail(400, "kreativa potřebuje aspoň 1 primary text a 1 headline")
  }

  try {
    // ── identity from the account's latest creative ──
    const last = await graphGet(`${account}/adcreatives`, {
      fields: "object_story_spec{page_id,instagram_user_id}", limit: 5,
    })
    const spec = (last.data || []).map((x: any) => x.object_story_spec).find((s: any) => s?.page_id)
    if (!spec?.page_id) return fail(400, "v účtu není žádná kreativa, ze které jde převzít FB stránku")

    // ── ad set (existing or new) ──
    let adsetId = b.adset_id ? String(b.adset_id).trim() : null
    if (!adsetId && b.new_adset) {
      const na = b.new_adset
      if (!na.copy_from_adset_id) return fail(400, "new_adset.copy_from_adset_id (vzorový ad set) je povinný")
      const tmpl = await graphGet(na.copy_from_adset_id, {
        fields: "targeting,optimization_goal,billing_event,promoted_object,campaign_id",
      })
      const created = await graphPost(`${account}/adsets`, {
        name: na.name || `${c.name} — new`,
        campaign_id: b.campaign_id || tmpl.campaign_id,
        // Meta expects minor units (cents) — conversion happens only here, at the API boundary
        daily_budget: Math.round((Number(na.daily_budget_eur) || 20) * 100),
        billing_event: tmpl.billing_event || "IMPRESSIONS",
        optimization_goal: tmpl.optimization_goal || "OFFSITE_CONVERSIONS",
        promoted_object: tmpl.promoted_object,
        targeting: tmpl.targeting,
        status: "PAUSED",
      })
      adsetId = created.id
    }
    if (!adsetId) return fail(400, "adset_id nebo new_adset je povinný")

    // ── images ──
    const hash11 = await uploadImage(account, c.image_1x1_url)
    const hash916 = c.image_9x16_url ? await uploadImage(account, c.image_9x16_url) : null

    // ── creative: all primaries + headlines via asset_feed_spec ──
    const link = c.link_url || "https://www.marketing-hq.eu/"
    const assetFeed: any = {
      images: [{ hash: hash11, adlabels: [{ name: "sq" }] }],
      bodies: (c.primary_texts || []).slice(0, 5).map((t: string) => ({ text: t })),
      titles: (c.headlines || []).slice(0, 5).map((t: string) => ({ text: t })),
      descriptions: c.description_text ? [{ text: c.description_text }] : undefined,
      ad_formats: ["SINGLE_IMAGE"],
      call_to_action_types: [c.cta_type || "LEARN_MORE"],
      link_urls: [{ website_url: link }],
      optimization_type: "PLACEMENT",
    }
    if (hash916) {
      assetFeed.images.push({ hash: hash916, adlabels: [{ name: "vert" }] })
      assetFeed.asset_customization_rules = [
        { customization_spec: { publisher_platforms: ["facebook", "instagram"], facebook_positions: ["story", "facebook_reels"], instagram_positions: ["story", "reels"] }, image_label: { name: "vert" }, priority: 1 },
        { customization_spec: {}, image_label: { name: "sq" }, priority: 2 },
      ]
    }
    const creative = await graphPost(`${account}/adcreatives`, {
      name: `[LIB-${c.id.slice(-8)}] ${c.name}`,
      object_story_spec: { page_id: spec.page_id, instagram_user_id: spec.instagram_user_id },
      asset_feed_spec: assetFeed,
      url_tags: "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&fbadid={{ad.id}}&fbadsetid={{adset.id}}",
    })

    // ── ad, always PAUSED ──
    const ad = await graphPost(`${account}/ads`, {
      name: `[LIB-${c.id.slice(-8)}] ${c.name}`,
      adset_id: adsetId,
      creative: { creative_id: creative.id },
      status: "PAUSED",
    })

    await svc.updateAdCreatives({
      id: c.id,
      meta_ad_id: ad.id, meta_creative_id: creative.id, meta_account_id: account,
      metadata: { ...(c.metadata || {}), sent_to_meta_at: new Date().toISOString(), meta_adset_id: adsetId },
    })
    res.json({
      ad_id: ad.id, creative_id: creative.id, adset_id: adsetId, status: "PAUSED",
      adset_name: adsetInfo?.name, campaign_name: adsetInfo?.campaign?.name, account_id: account,
    })
  } catch (e: any) {
    fail(502, e.message)
  }
}
