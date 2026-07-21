// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADS_LIBRARY_MODULE } from "../../../../../../modules/ads-library"
import { translateTexts, generateStudioTexts } from "../../../lib/textgen"
import { describeImage } from "../../../lib/imagegen"
import { costUSD, round4 } from "../../../lib/pricing"

/**
 * POST /admin/ads-library/jobs/:id/retry-texts
 * Re-runs ONLY the text step of a job whose images already exist — the common
 * case after a transient model/JSON failure. Keeps the same prompt, project
 * and model; images and their cost are untouched.
 * Body: { txt_model? } to switch the model for the retry.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const b = (req.body || {}) as any
  const fail = (code: number, msg: string) => res.status(code).json({ error: msg, message: msg })

  const [job] = await svc.listAdLocalizationJobs({ id: req.params.id })
  if (!job) return fail(404, "job nenalezen")
  if (job.status === "running" || job.status === "queued") return fail(409, "job právě běží")

  const p = job.params || {}
  const model = b.txt_model || p.txt_model || "claude-opus-4-8"
  const setTexts = async (patch: any) => {
    const [fresh] = await svc.listAdLocalizationJobs({ id: job.id })
    const steps = (fresh.steps || []).map((s: any) => (s.key === "texts" ? { ...s, ...patch } : s))
    await svc.updateAdLocalizationJobs({ id: job.id, steps })
  }

  try {
    await svc.updateAdLocalizationJobs({ id: job.id, status: "running", error: null })
    await setTexts({ status: "running", detail: "opakování" })

    let out: any
    if (p.studio) {
      // Studio item — texts come from the templates + the image description
      const desc = p.result?.image_description
        ? { description: p.result.image_description, usage: null }
        : await describeImage(p.image_url)
      out = await generateStudioTexts({
        modelId: model, targetProject: job.target_project, imageDescription: desc.description,
      })
      const cost = round4(Number(p.cost_usd || 0) + (costUSD(out.usage) || 0) + (costUSD(desc.usage) || 0))
      await svc.updateAdLocalizationJobs({
        id: job.id, status: "done", error: null,
        params: { ...p, txt_model: model, cost_usd: cost,
          result: { primaries: out.primaries, headlines: out.headlines, tells: out.tells, image_description: desc.description } },
      })
    } else {
      const [src] = await svc.listAdCreatives({ id: job.source_creative_id })
      if (!src) return fail(404, "zdrojová kreativa nenalezena")
      const pick = (arr: any[], idx?: number[]) =>
        (idx?.length ? idx.map((i) => arr?.[i]).filter(Boolean) : (arr || []))
      out = await translateTexts({
        modelId: model, src, targetProject: job.target_project,
        primaries: pick(src.primary_texts, p.primary_indexes),
        headlines: pick(src.headlines, p.headline_indexes),
      })
      if (job.result_creative_id) {
        const [c] = await svc.listAdCreatives({ id: job.result_creative_id })
        await svc.updateAdCreatives({
          id: job.result_creative_id,
          primary_texts: out.primaries.slice(0, 5),
          headlines: out.headlines.slice(0, 5),
          metadata: { ...(c?.metadata || {}), generating: false, failed: null,
            text_variants: [{ primaries: out.primaries, headlines: out.headlines }], official_text_variant: 0 },
        })
      }
      const cost = round4(Number(p.cost_usd || 0) + (costUSD(out.usage) || 0))
      await svc.updateAdLocalizationJobs({
        id: job.id, status: "done", error: null, params: { ...p, txt_model: model, cost_usd: cost },
      })
    }

    const tellNote = out.tells?.length ? ` · 🧬 ${out.tells.length} oprav` : " · 🧬 čisté"
    await setTexts({ status: "done", detail: `1 variant${tellNote}`, tells: out.tells || [], prompt: out.prompt })
    res.json({ ok: true, primaries: out.primaries.length, headlines: out.headlines.length, tells: out.tells || [] })
  } catch (e: any) {
    await setTexts({ status: "failed", detail: e.message.slice(0, 200) })
    await svc.updateAdLocalizationJobs({ id: job.id, status: "failed", error: e.message.slice(0, 500) })
    fail(502, e.message)
  }
}
