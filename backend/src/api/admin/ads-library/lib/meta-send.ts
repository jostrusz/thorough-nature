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
    // 1487194 reads as "object not visible", but on ad/creative creation it
    // almost always means the token lacks the ADVERTISE task on the account
    if (json?.error?.error_subcode === 1487194) {
      const acc = path.split("/")[0]
      throw new Error(`[Meta ${path}] účtu ${acc} chybí pro tento token oprávnění ADVERTISE (Správa kampaní) — přidej ho v Business Settings → Reklamní účty → Lidé/System users. Meta hlásí: ${json?.error?.error_user_msg || ""}`)
    }
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
  // user_tasks = what THIS token may do on the account. Without ADVERTISE the
  // ad/creative POST fails with a misleading "object not visible" (1487194),
  // so it's surfaced here and checked before a batch starts.
  const acc = await graphGet(account, { fields: "name,user_tasks" }).catch(() => null)
  const tasks = acc?.user_tasks || []
  return {
    adset_id: info.id, name: info.name, status: info.status,
    campaign_name: info.campaign?.name, account, account_name: acc?.name || account,
    can_advertise: tasks.includes("ADVERTISE"), user_tasks: tasks,
  }
}

/**
 * Identity pairs {page_id, instagram_user_id} the account actually uses.
 * `/ads` first, `/adcreatives` only as a fallback: the creatives edge returns
 * the account's oldest rows, which name pages the token no longer has a role
 * on (act_686157092660670 → 116213644918821, act_1471528183462313 →
 * 339396955930970), while the live ads on those same accounts run under pages
 * we can publish as. Reading creatives first is what made auto-identity pick
 * an unusable page.
 */
async function recentSpecs(account: string) {
  const fromAds = await graphGet(`${account}/ads`, {
    fields: "creative{object_story_spec{page_id,instagram_user_id}}", limit: 25,
  }).catch(() => ({ data: [] }))
  const specs = (fromAds.data || [])
    .map((x: any) => x.creative?.object_story_spec)
    .filter((s: any) => s?.page_id)
  if (specs.length) return specs
  const last = await graphGet(`${account}/adcreatives`, {
    fields: "object_story_spec{page_id,instagram_user_id}", limit: 25,
  }).catch(() => ({ data: [] }))
  return (last.data || []).map((x: any) => x.object_story_spec).filter((s: any) => s?.page_id)
}

/** Pages the API token actually has an advertiser role on — the only ones we
 *  may publish as. Accounts do carry creatives posted from foreign pages (the
 *  NO account advertises as 339396955930970, which this token cannot use), so
 *  every candidate is checked against this set before it reaches an ad. */
async function usablePages() {
  const mine = await graphGet("me/accounts", { fields: "id,name", limit: 100 }).catch(() => ({ data: [] }))
  return (mine.data || []).map((p: any) => ({ id: String(p.id), name: p.name }))
}

/**
 * Pages offered by the picker for a given ad account: token-usable pages,
 * with the one the account already advertises under floated to the top and
 * flagged in_use. `promote_pages` alone is not enough (it misses pages an
 * account actively runs ads with) and creatives alone are not safe (they may
 * name a page we have no role on) — so the intersection is what's offered.
 */
export async function listAccountPages(account: string) {
  const [mine, promoted, specs] = await Promise.all([
    usablePages(),
    graphGet(`${account}/promote_pages`, { fields: "id,name", limit: 50 }).catch(() => ({ data: [] })),
    recentSpecs(account),
  ])
  const inUse = new Set(specs.map((s: any) => String(s.page_id)))
  const promotedIds = new Set((promoted.data || []).map((p: any) => String(p.id)))
  const igByPage = new Map<string, string>()
  for (const s of specs) {
    if (s.instagram_user_id && !igByPage.has(String(s.page_id))) igByPage.set(String(s.page_id), s.instagram_user_id)
  }
  return mine
    .map((p: any) => ({
      ...p,
      in_use: inUse.has(p.id),
      promoted: promotedIds.has(p.id),
      instagram_user_id: igByPage.get(p.id) || null,
    }))
    .sort((a: any, b: any) =>
      Number(b.in_use) - Number(a.in_use) ||
      Number(b.promoted) - Number(a.promoted) ||
      a.name.localeCompare(b.name))
}

/**
 * Page + IG identity for new ads. Preference order matches the single-send
 * route: explicit pick → identity of an existing ad in the TARGET ad set →
 * the account's recent creatives. Only token-usable pages qualify, and the IG
 * id is reused only when it came paired with the chosen page (IG identity is
 * mandatory for Stories/Reels).
 */
export async function resolveIdentity(account: string, pageId?: string | null, adsetId?: string | null) {
  const mine = await usablePages()
  const usable = new Set(mine.map((p: any) => p.id))
  let chosen: string | null = null

  if (pageId) {
    chosen = String(pageId)
    if (!usable.has(chosen)) {
      throw new Error(`na stránku ${chosen} nemá API token roli inzerenta — přidej system usera k té stránce v Business settings`)
    }
  }

  const pools: any[][] = []
  if (adsetId) {
    const inSet = await graphGet(`${String(adsetId).trim()}/ads`, {
      fields: "creative{object_story_spec{page_id,instagram_user_id}}", limit: 10,
    }).catch(() => ({ data: [] }))
    pools.push((inSet.data || []).map((x: any) => x.creative?.object_story_spec).filter((s: any) => s?.page_id))
  }
  pools.push(await recentSpecs(account))

  for (const specs of pools) {
    if (!chosen) chosen = specs.find((s: any) => usable.has(String(s.page_id)))?.page_id || null
    if (chosen) {
      const ig = specs.find((s: any) => String(s.page_id) === String(chosen) && s.instagram_user_id)?.instagram_user_id
      if (ig) return { page_id: String(chosen), instagram_user_id: ig }
    }
  }

  if (!chosen) {
    const names = mine.length ? mine.map((p: any) => p.name).join(", ") : "token nevidí žádné stránky"
    throw new Error(`nenašel jsem stránku použitelnou tímto tokenem (${names}) — vyber ji ručně v poli FB stránka`)
  }
  // no IG paired with this page — Meta falls back to the page-backed IG account
  return { page_id: String(chosen) }
}

/**
 * Creative enhancements enabled on every ad we create — the full set behind
 * the Advantage+ creative toggles in Ads Manager's Advanced preview. Each
 * name was probed live against the API; `standard_enhancements` (retired) and
 * `text_generation` ("Obsah není platný") are the only ones that don't work.
 */
const CREATIVE_FEATURES = [
  // Visual touch-ups + Add animation
  "cv_transformation",              // recompose the image per placement
  "image_animation",                // subtle motion on a still image
  "image_touchups",                 // straighten / sharpen
  "image_brightness_and_contrast",  // light auto-grading
  "enhance_cta",                    // smarter CTA wording
  // Add overlays
  "add_text_overlay",
  // Add music
  "music_generation",
  "audio",
  // Text improvements — Meta may reshuffle/rephrase the copy
  "text_optimizations",
  "text_formatting_optimization",
  // Flex media (media_type_automation is catalog-only — ad creation fails)
  "media_liquidity_animated_image",
  "adapt_to_placement",
]

/**
 * Create one PAUSED ad from a library creative.
 *
 * Shape (verified live): per-placement media AND all 5 bodies/titles at once.
 * The trick is a SHARED adlabel — every body carries the same label and both
 * customization rules point at it, so a rule matches the whole text pool
 * instead of one asset. Rules must cover every placement (the second rule has
 * an empty customization_spec = catch-all), otherwise delivery fails with
 * "0 target rules for format X".
 */
export async function createPausedAd(opts: {
  account: string
  adsetId: string
  spec: any // { page_id, instagram_user_id? }
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
  const bodies = (c.primary_texts || []).slice(0, 5)
  const titles = (c.headlines || []).slice(0, 5)

  const assetFeed: any = {
    images: hash916
      ? [{ hash: hash11, adlabels: [{ name: "sq" }] }, { hash: hash916, adlabels: [{ name: "vert" }] }]
      : [{ hash: hash11 }],
    // shared label keeps ALL texts available inside a placement rule
    bodies: bodies.map((t: string) => hash916 ? { text: t, adlabels: [{ name: "allB" }] } : { text: t }),
    titles: titles.map((t: string) => hash916 ? { text: t, adlabels: [{ name: "allT" }] } : { text: t }),
    descriptions: c.description_text ? [{ text: c.description_text }] : undefined,
    ad_formats: ["SINGLE_IMAGE"],
    call_to_action_types: [c.cta_type || "LEARN_MORE"],
    link_urls: hash916 ? [{ website_url: link, adlabels: [{ name: "allL" }] }] : [{ website_url: link }],
    optimization_type: hash916 ? "PLACEMENT" : "DEGREES_OF_FREEDOM",
  }
  if (hash916) {
    const labels = { body_label: { name: "allB" }, title_label: { name: "allT" }, link_url_label: { name: "allL" } }
    assetFeed.asset_customization_rules = [
      { customization_spec: { publisher_platforms: ["facebook", "instagram"], facebook_positions: ["story", "facebook_reels"], instagram_positions: ["story", "reels"] },
        image_label: { name: "vert" }, ...labels, priority: 1 },
      { customization_spec: {}, image_label: { name: "sq" }, ...labels, priority: 2 },
    ]
  }

  const name = `[LIB-${c.id.slice(-8)}] ${c.name}${opts.nameSuffix || ""}`
  const creative = await graphPost(`${opts.account}/adcreatives`, {
    name,
    object_story_spec: hash916
      ? opts.spec
      : { ...opts.spec, link_data: { link, image_hash: hash11, call_to_action: { type: c.cta_type || "LEARN_MORE" } } },
    asset_feed_spec: assetFeed,
    degrees_of_freedom_spec: {
      creative_features_spec: Object.fromEntries(
        CREATIVE_FEATURES.map((k) => [k, { enroll_status: "OPT_IN" }])
      ),
    },
    url_tags: "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&fbadid={{ad.id}}&fbadsetid={{adset.id}}",
  })
  const ad = await graphPost(`${opts.account}/ads`, {
    name, adset_id: opts.adsetId, creative: { creative_id: creative.id }, status: "PAUSED",
  })
  return {
    ad_id: ad.id, creative_id: creative.id,
    images_sent: hash916 ? 2 : 1, texts_sent: bodies.length,
  }
}
