// @ts-nocheck
import { ADS_LIBRARY_MODULE } from "../../../../modules/ads-library"
import { resolveIdentity, createPausedAd } from "./meta-send"

/**
 * Bulk send job: sequentially create one PAUSED ad per selected 1:1 variant
 * (or per card when no variants picked). One failing item never stops the
 * rest — its step goes red with the Meta error and the loop continues.
 * Progress lives in job.steps (one step per planned ad), visible in Fronta
 * and polled by the bulk modal.
 */
export async function runBulkSendJob(container: any, jobId: string) {
  const svc = container.resolve(ADS_LIBRARY_MODULE)
  const log = (msg: string) => console.log(`[Ads Library] bulk job ${jobId}: ${msg}`)

  const setStep = async (key: string, patch: any) => {
    const [job] = await svc.listAdLocalizationJobs({ id: jobId })
    const steps = (job.steps || []).map((s: any) => (s.key === key ? { ...s, ...patch } : s))
    await svc.updateAdLocalizationJobs({ id: jobId, steps })
  }

  try {
    const [job] = await svc.listAdLocalizationJobs({ id: jobId })
    const p = job.params || {}
    await svc.updateAdLocalizationJobs({ id: jobId, status: "running" })
    const spec = await resolveIdentity(p.account, p.page_id || null, p.adset_id)

    let ok = 0, failed = 0
    for (const plan of p.plan || []) {
      await setStep(plan.key, { status: "running" })
      try {
        const [c] = await svc.listAdCreatives({ id: plan.creative_id })
        if (!c) throw new Error("kreativa nenalezena")
        const r = await createPausedAd({
          account: p.account, adsetId: p.adset_id, spec, creative: c,
          image1x1: plan.image1x1 || undefined,
          nameSuffix: plan.suffix || "",
        })
        ok++
        await setStep(plan.key, { status: "done", detail: `ad ${r.ad_id} · ${r.images_sent === 2 ? "1:1+9:16" : "1:1"} · ${r.texts_sent}P/H` })
        // remember where the card went (bulk list under metadata)
        const sent = Array.isArray(c.metadata?.meta_bulk_ads) ? c.metadata.meta_bulk_ads : []
        await svc.updateAdCreatives({
          id: c.id,
          meta_ad_id: r.ad_id, meta_creative_id: r.creative_id, meta_account_id: p.account,
          metadata: {
            ...(c.metadata || {}),
            sent_to_meta_at: new Date().toISOString(), meta_adset_id: p.adset_id,
            meta_bulk_ads: [...sent, { ad_id: r.ad_id, adset_id: p.adset_id, at: new Date().toISOString() }].slice(-20),
          },
        })
      } catch (e: any) {
        failed++
        log(`${plan.key} FAILED: ${e.message}`)
        await setStep(plan.key, { status: "failed", detail: String(e.message).slice(0, 180) })
      }
    }
    await svc.updateAdLocalizationJobs({
      id: jobId,
      status: failed && !ok ? "failed" : "done",
      error: failed ? `${failed} z ${ok + failed} reklam selhalo` : null,
    })
    log(`done: ${ok} ok, ${failed} failed`)
  } catch (e: any) {
    console.error(`[Ads Library] bulk job ${jobId} FAILED: ${e.message}`)
    try {
      await svc.updateAdLocalizationJobs({ id: jobId, status: "failed", error: e.message.slice(0, 500) })
    } catch {}
  }
}
