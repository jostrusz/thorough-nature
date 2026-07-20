// @ts-nocheck
import { ADS_LIBRARY_MODULE } from "../../../../modules/ads-library"
import { describeImage } from "./imagegen"
import { generateStudioTexts } from "./textgen"
import { costUSD, round4 } from "./pricing"

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

    await svc.updateAdLocalizationJobs({
      id: jobId, status: "done",
      params: {
        ...p, cost_usd: round4(totalCost),
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
