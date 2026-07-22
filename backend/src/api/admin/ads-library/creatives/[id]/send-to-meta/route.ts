// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADS_LIBRARY_MODULE } from "../../../../../../modules/ads-library"
import { graphGet } from "../../../lib/meta"
import { graphPost, normalizeAdsetId, resolveIdentity, createPausedAd } from "../../../lib/meta-send"

/**
 * POST /admin/ads-library/creatives/:id/send-to-meta
 * Body: { adset_id }                                      ← quick path: the account
 *        is resolved from the ad set itself, nothing else needed
 *    or { account_id, campaign_id, adset_id }
 *    or { account_id, campaign_id, new_adset: { name, daily_budget_eur, copy_from_adset_id } }
 * Creates a PAUSED ad via the shared createPausedAd (Ads Manager multi-text
 * shape: 1:1 in link_data + all bodies/titles, DEGREES_OF_FREEDOM).
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
    // explicit pick from the modal wins; otherwise the identity is taken from
    // an existing ad in the target ad set, then the account's creatives
    const spec = await resolveIdentity(
      account,
      b.page_id ? String(b.page_id).trim() : null,
      b.adset_id ? String(b.adset_id).trim() : null,
    )

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

    const r = await createPausedAd({ account, adsetId, spec, creative: c })

    await svc.updateAdCreatives({
      id: c.id,
      meta_ad_id: r.ad_id, meta_creative_id: r.creative_id, meta_account_id: account,
      metadata: { ...(c.metadata || {}), sent_to_meta_at: new Date().toISOString(), meta_adset_id: adsetId },
    })
    res.json({
      ad_id: r.ad_id, creative_id: r.creative_id, adset_id: adsetId, status: "PAUSED",
      adset_name: adsetInfo?.name, campaign_name: adsetInfo?.campaign?.name, account_id: account,
      images_sent: r.images_sent, texts_sent: r.texts_sent,
    })
  } catch (e: any) {
    fail(502, e.message)
  }
}
