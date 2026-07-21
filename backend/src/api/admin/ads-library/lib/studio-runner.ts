// @ts-nocheck
import { ADS_LIBRARY_MODULE } from "../../../../modules/ads-library"
import { describeImage } from "./imagegen"
import { generateStudioTexts } from "./textgen"
import { costUSD, round4 } from "./pricing"
import { PROJECT_CONTEXT } from "./project-context"
import { PAGE_CONTEXT } from "./page-context"

/**
 * Studio "Vytvořit reklamy" job: vision-describe the uploaded 1:1, then write
 * 5 primaries (one per template angle) + 5 viral headlines. The result lands
 * in job.params.result for the UI to review — the library card is created
 * only when the user approves (studio/save route).
 */
export async function runStudioTextsJob(container: any, jobId: string) {
  const svc = container.resolve(ADS_LIBRARY_MODULE)
  const log = (msg: string) => console.log(`[Ads Library] studio job ${jobId}: ${msg}`)

  const setStep = async (key: string, patch: any) => {
    const [job] = await svc.listAdLocalizationJobs({ id: jobId })
    const steps = (job.steps || []).map((s: any) => (s.key === key ? { ...s, ...patch } : s))
    await svc.updateAdLocalizationJobs({ id: jobId, steps })
  }

  let totalCost = 0
  const addCost = (usage: any) => {
    const c = costUSD(usage)
    if (c != null) totalCost += c
    return c
  }

  try {
    const [job] = await svc.listAdLocalizationJobs({ id: jobId })
    const p = job.params || {}
    await svc.updateAdLocalizationJobs({ id: jobId, status: "running" })

    // 1) vision description
    await setStep("describe", { status: "running" })
    const desc = await describeImage(p.image_url)
    addCost(desc.usage)
    await setStep("describe", { status: "done", detail: desc.description.slice(0, 120), prompt: desc.description })
    log(`popis hotový (${desc.description.length} znaků)`)

    // 2) texts from templates
    await setStep("texts", { status: "running" })
    const out = await generateStudioTexts({
      modelId: p.txt_model, targetProject: job.target_project, imageDescription: desc.description,
    })
    addCost(out.usage)
    if (out.primaries.length < 5 || out.headlines.length < 5) {
      throw new Error(`model vrátil ${out.primaries.length}P/${out.headlines.length}H místo 5/5 — zkus přegenerovat`)
    }
    const tellNote = out.tells.length ? ` · 🧬 ${out.tells.length} oprav` : " · 🧬 čisté"
    await setStep("texts", {
      status: "done", detail: `5P/5H${tellNote}`, prompt: out.prompt,
      tells: out.tells, cost_usd: round4(totalCost),
    })

    // ── auto-save into the library — the card is what you localize and send
    // onwards, so it must exist right after generation, no manual step ──
    const ctx = PROJECT_CONTEXT[job.target_project]
    let savedName = p.saved_name || null
    let resultCreativeId = job.result_creative_id || null
    if (ctx) {
      const base = String(p.file_name || "studio").replace(/\.[a-z0-9]+$/i, "")
      if (resultCreativeId) {
        // regeneration → refresh the existing card's texts
        const [existing] = await svc.listAdCreatives({ id: resultCreativeId })
        if (existing) {
          await svc.updateAdCreatives({
            id: resultCreativeId,
            primary_texts: out.primaries.slice(0, 5),
            headlines: out.headlines.slice(0, 5),
            metadata: { ...(existing.metadata || {}), studio_job_id: jobId, generating: false },
          })
          savedName = existing.name
        } else {
          resultCreativeId = null
        }
      }
      if (!resultCreativeId) {
        const created = await svc.createAdCreatives({
          name: `${base}-${ctx.language}`,
          project_id: job.target_project,
          language: ctx.language,
          tag: "test",
          primary_texts: out.primaries.slice(0, 5),
          headlines: out.headlines.slice(0, 5),
          cta_type: "LEARN_MORE",
          link_url: PAGE_CONTEXT[job.target_project]?.url || `https://www.${ctx.domain}/`,
          media_type: "image",
          image_1x1_url: p.image_url,
          image_9x16_url: p.result916?.url || null,
          source: "studio",
          metadata: { studio_job_id: jobId, generating: false },
        })
        resultCreativeId = created.id
        savedName = created.name
        log(`auto-saved to library as ${created.name}`)
      }
    }

    await svc.updateAdLocalizationJobs({
      id: jobId, status: "done",
      result_creative_id: resultCreativeId,
      params: {
        ...p, cost_usd: round4(totalCost), saved_name: savedName,
        result: {
          primaries: out.primaries, headlines: out.headlines,
          tells: out.tells, image_description: desc.description,
        },
      },
    })
    log(`done (~$${round4(totalCost)})`)
  } catch (e: any) {
    console.error(`[Ads Library] studio job ${jobId} FAILED: ${e.message}`)
    try {
      const [job] = await svc.listAdLocalizationJobs({ id: jobId })
      const steps = (job.steps || []).map((s: any) =>
        s.status === "running" ? { ...s, status: "failed", detail: e.message.slice(0, 200) } : s)
      await svc.updateAdLocalizationJobs({
        id: jobId, status: "failed", error: e.message.slice(0, 500), steps,
        params: { ...(job.params || {}), cost_usd: round4(totalCost) },
      })
    } catch {}
  }
}
