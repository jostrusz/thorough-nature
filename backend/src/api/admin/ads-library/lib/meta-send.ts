// @ts-nocheck
import { metaToken, graphGet } from "./meta"

/**
 * Shared Meta ad-creation building blocks, used by the single send-to-meta
 * route and the bulk sender. One place for the hard-earned rules:
 *  - flexible asset_feed_spec (multi image + multi text, NO customization
 *    rules — those can't combine with multiple bodies on a regular ad set)
 *  - IG identity resolved across the account's recent creatives (IG positions
 *    hard-require instagram_user_id)
 *  - ads always created PAUSED
 */
const GRAPH = "https://graph.facebook.com/v23.0"

export async function graphPost(path: string, body: Record<string, any>) {
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
export async function uploadImage(account: string, url: string): Promise<string> {
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
export function normalizeAdsetId(input: string): string | null {
  const s = decodeURIComponent(String(input || "").trim())
  if (/^\d{10,}$/.test(s)) return s
  const named = s.match(/(?:selected_adset_ids|adset_ids?)[=%[\]"':\s]*(\d{10,})/)
  if (named) return named[1]
  const runs = s.match(/\d{10,}/g) || []
  runs.sort((a, b) => b.length - a.length)
  return runs[0] || null
}

/**
 * Resolve an adset id/URL (or an ad id — falls back to its parent ad set)
 * into { adset_id, name, campaign_name, account, account_name }.
 */
export async function resolveAdsetInput(input: string) {
  const normalized = normalizeAdsetId(input)
  if (!normalized) throw new Error(`v "${String(input).slice(0, 80)}" nevidím žádné ad set ID (dlouhé číslo)`)
  let info: any = null
  try {
    info = await graphGet(normalized, { fields: "account_id,name,status,campaign{name}" })
    if (!info.campaign) throw new Error("není to ad set")
    info.id = normalized
  } catch {
    const ad = await graphGet(normalized, { fields: "adset{id,name,status,account_id,campaign{name}}" }).catch(() => null)
    if (!ad?.adset?.id) {
      throw new Error(`ID ${normalized} není ad set ani reklama dostupná tímto tokenem — zkopíruj ID/URL ad setu z Ads Manageru`)
    }
    info = ad.adset
  }
  const account = `act_${info.account_id}`
  const acc = await graphGet(account, { fields: "name" }).catch(() => null)
  return {
    adset_id: info.id, name: info.name, status: info.status,
    campaign_name: info.campaign?.name, account, account_name: acc?.name || account,
  }
}

/** Page + IG identity from the account's latest creatives (may live on different rows). */
export async function resolveIdentity(account: string) {
  const last = await graphGet(`${account}/adcreatives`, {
    fields: "object_story_spec{page_id,instagram_user_id}", limit: 10,
  })
  const specs = (last.data || []).map((x: any) => x.object_story_spec).filter(Boolean)
  const pageId = specs.find((s: any) => s.page_id)?.page_id
  const igId = specs.find((s: any) => s.instagram_user_id)?.instagram_user_id
  if (!pageId) throw new Error("v účtu není žádná kreativa, ze které jde převzít FB stránku")
  const spec: any = { page_id: pageId }
  if (igId) spec.instagram_user_id = igId
  return spec
}

/**
 * Create one PAUSED ad from a library creative. `image1x1`/`image916` default
 * to the card's official images; pass a variant URL to A/B a specific visual.
 */
export async function createPausedAd(opts: {
  account: string
  adsetId: string
  spec: any // object_story_spec identity
  creative: any // ad_creative row
  image1x1?: string
  image916?: string | null
  nameSuffix?: string
}) {
  const c = opts.creative
  const img11 = opts.image1x1 || c.image_1x1_url
  const img916 = opts.image916 === undefined ? c.image_9x16_url : opts.image916
  if (!img11) throw new Error("kreativa nemá 1:1 obrázek")
  if (!c.primary_texts?.length || !c.headlines?.length) throw new Error("kreativa potřebuje aspoň 1 primary text a 1 headline")

  const hash11 = await uploadImage(opts.account, img11)
  const hash916 = img916 ? await uploadImage(opts.account, img916) : null
  const link = c.link_url || "https://www.marketing-hq.eu/"
  // Two images REQUIRE asset_customization_rules with full placement coverage
  // (a catch-all rule) — without them the ad is created but delivery fails
  // with "0 target rules for format X". Rules must reference exactly one
  // body/title/link via labels; the remaining texts stay in the feed as the
  // optimization pool (this mirrors what Ads Manager builds manually).
  const assetFeed: any = {
    images: hash916
      ? [{ hash: hash11, adlabels: [{ name: "sq" }] }, { hash: hash916, adlabels: [{ name: "vert" }] }]
      : [{ hash: hash11 }],
    bodies: (c.primary_texts || []).slice(0, 5).map((t: string, i: number) =>
      hash916 && i === 0 ? { text: t, adlabels: [{ name: "b1" }] } : { text: t }),
    titles: (c.headlines || []).slice(0, 5).map((t: string, i: number) =>
      hash916 && i === 0 ? { text: t, adlabels: [{ name: "t1" }] } : { text: t }),
    descriptions: c.description_text ? [{ text: c.description_text }] : undefined,
    ad_formats: ["SINGLE_IMAGE"],
    call_to_action_types: [c.cta_type || "LEARN_MORE"],
    link_urls: hash916 ? [{ website_url: link, adlabels: [{ name: "l1" }] }] : [{ website_url: link }],
    optimization_type: "PLACEMENT",
  }
  if (hash916) {
    assetFeed.asset_customization_rules = [
      { customization_spec: { publisher_platforms: ["facebook", "instagram"], facebook_positions: ["story", "facebook_reels"], instagram_positions: ["story", "reels"] },
        image_label: { name: "vert" }, body_label: { name: "b1" }, title_label: { name: "t1" }, link_url_label: { name: "l1" }, priority: 1 },
      { customization_spec: {},
        image_label: { name: "sq" }, body_label: { name: "b1" }, title_label: { name: "t1" }, link_url_label: { name: "l1" }, priority: 2 },
    ]
  }
  const name = `[LIB-${c.id.slice(-8)}] ${c.name}${opts.nameSuffix || ""}`
  const creative = await graphPost(`${opts.account}/adcreatives`, {
    name,
    object_story_spec: opts.spec,
    asset_feed_spec: assetFeed,
    url_tags: "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&fbadid={{ad.id}}&fbadsetid={{adset.id}}",
  })
  const ad = await graphPost(`${opts.account}/ads`, {
    name, adset_id: opts.adsetId, creative: { creative_id: creative.id }, status: "PAUSED",
  })
  return { ad_id: ad.id, creative_id: creative.id, images_sent: hash916 ? 2 : 1 }
}
