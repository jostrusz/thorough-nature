// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { graphGet, purchasesFrom, roasFrom, rangeParams } from "../lib/meta"
import { mirrorImage } from "../lib/media"
import { ADS_LIBRARY_MODULE } from "../../../../modules/ads-library"

/**
 * POST /admin/ads-library/import
 * Body: { meta_ad_id, account_id, project_id, language, range? }
 * Pulls the ad's creative (image + all texts incl. asset_feed_spec variants),
 * mirrors the image into MinIO and stores everything as a library row with a
 * performance snapshot.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { meta_ad_id, account_id, project_id, language, range = "30d" } = (req.body || {}) as any
  if (!meta_ad_id || !project_id || !language) {
    return res.status(400).json({ error: "meta_ad_id, project_id and language are required" })
  }
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)

  const [existing] = await svc.listAdCreatives({ meta_ad_id })
  if (existing) return res.json({ creative: existing, already_existed: true })

  try {
    // 1) creative + texts
    const ad = await graphGet(meta_ad_id, {
      fields: "name,creative{id,title,body,image_url,thumbnail_url,video_id,object_story_spec,asset_feed_spec,call_to_action_type}",
    })
    const c = ad.creative || {}
    const feed = c.asset_feed_spec || {}
    const link = c.object_story_spec?.link_data || {}

    const primaries = [
      ...(feed.bodies || []).map((b: any) => b.text),
      ...(c.body ? [c.body] : []),
      ...(link.message ? [link.message] : []),
    ].filter(Boolean)
    const headlines = [
      ...(feed.titles || []).map((t: any) => t.text),
      ...(c.title ? [c.title] : []),
      ...(link.name ? [link.name] : []),
    ].filter(Boolean)
    const dedup = (arr: string[]) => [...new Set(arr)].slice(0, 5)

    // 2) mirror image to MinIO (Meta URLs expire)
    const src = c.image_url || c.thumbnail_url
    let imageUrl: string | null = null
    if (src) {
      imageUrl = await mirrorImage(src, `ads-library/${meta_ad_id}.jpg`)
    }

    // 3) performance snapshot
    let perf: any = null
    try {
      const ins = await graphGet(`${meta_ad_id}/insights`, {
        fields: "spend,ctr,actions,purchase_roas", ...rangeParams(String(range)),
      })
      const r = ins.data?.[0]
      if (r) {
        const spend = Number(r.spend) || 0
        const sales = purchasesFrom(r.actions)
        perf = {
          spend, sales,
          cpa: sales ? +(spend / sales).toFixed(2) : 0,
          roas: roasFrom(r.purchase_roas),
          ctr: Number(r.ctr) || 0,
          range, synced_at: new Date().toISOString(),
        }
      }
    } catch (e) { /* snapshot is best-effort */ }

    const created = await svc.createAdCreatives({
      name: ad.name || meta_ad_id,
      project_id, language: String(language).toUpperCase(),
      tag: perf && perf.roas >= 2 ? "winner" : "test",
      primary_texts: dedup(primaries),
      headlines: dedup(headlines),
      description_text: link.description || (feed.descriptions?.[0]?.text) || null,
      cta_type: c.call_to_action_type || null,
      link_url: link.link || null,
      media_type: c.video_id ? "video" : "image",
      image_1x1_url: imageUrl,
      video_thumb_url: c.video_id ? (c.thumbnail_url || null) : null,
      source: "meta_import",
      meta_ad_id, meta_creative_id: c.id || null, meta_account_id: account_id || null,
      perf,
    })
    res.json({ creative: created })
  } catch (e: any) {
    res.status(502).json({ error: e.message })
  }
}
