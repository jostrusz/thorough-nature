// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADS_LIBRARY_MODULE } from "../../../../modules/ads-library"
import { resolveAdsetInput } from "../lib/meta-send"
import { runBulkSendJob } from "../lib/bulk-runner"

/**
 * POST /admin/ads-library/bulk-send-to-meta
 * Body: { adset: "<id nebo URL>", page_id?, items: [{ creative_id, variant_urls?: string[] }] }
 *   page_id — FB stránka pro celou dávku; bez ní se převezme z posledních kreativ účtu
 * Each selected 1:1 variant URL becomes its own PAUSED ad (suffix · v1/v2…);
 * with no variant_urls the card's official 1:1 makes a single ad. Runs as an
 * async job — poll /jobs for progress.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const b = (req.body || {}) as any
  const fail = (code: number, msg: string) => res.status(code).json({ error: msg, message: msg })
  if (!b.adset || !Array.isArray(b.items) || !b.items.length) {
    return fail(400, "adset a items jsou povinné")
  }
  if (b.items.length > 25) return fail(400, "max 25 karet na jednu dávku")

  let target: any
  try { target = await resolveAdsetInput(String(b.adset)) }
  catch (e: any) { return fail(400, e.message) }
  // stop before uploading anything — without ADVERTISE every ad would fail
  // with Meta's misleading "object not visible" error
  if (target.can_advertise === false) {
    return fail(400, `účet ${target.account_name} (${target.account}) nemá pro tento token oprávnění ADVERTISE — reklamy by selhaly. Přidej „Správa kampaní" v Business Settings → Reklamní účty → System users.`)
  }

  // build the flat plan: one entry per future ad
  const plan: any[] = []
  const steps: any[] = []
  const thumbs: string[] = []
  for (const item of b.items) {
    const [c] = await svc.listAdCreatives({ id: item.creative_id })
    if (!c) return fail(404, `kreativa ${item.creative_id} nenalezena`)
    if (c.image_1x1_url) thumbs.push(c.image_1x1_url)
    const urls: string[] = (item.variant_urls || []).filter(Boolean)
    if (urls.length > 1) {
      urls.forEach((u, i) => {
        const key = `${c.id.slice(-8)}-v${i + 1}`
        plan.push({ key, creative_id: c.id, image1x1: u, suffix: ` · v${i + 1}` })
        steps.push({ key, label: `${c.name} · v${i + 1}`, status: "queued" })
      })
    } else {
      const key = c.id.slice(-8)
      plan.push({ key, creative_id: c.id, image1x1: urls[0] || null, suffix: "" })
      steps.push({ key, label: c.name, status: "queued" })
    }
  }
  if (plan.length > 40) return fail(400, "max 40 reklam na jednu dávku")

  const job = await svc.createAdLocalizationJobs({
    source_creative_id: "bulk",
    target_project: target.account_name || target.account,
    status: "queued",
    steps,
    params: {
      bulk: true,
      account: target.account, adset_id: target.adset_id,
      page_id: b.page_id ? String(b.page_id).trim() : null,
      label: `🚀 ${plan.length} reklam → ${target.name}`,
      thumb: thumbs[0] || null,
      plan,
    },
  })
  const container = req.scope
  setImmediate(() => runBulkSendJob(container, job.id))
  res.json({ job_id: job.id, planned: plan.length, target })
}
