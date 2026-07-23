// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADS_LIBRARY_MODULE } from "../../../../../../modules/ads-library"
import { generateImage, askImageYesNo } from "../../../lib/imagegen"
import { uploadBuffer } from "../../../lib/media"
import { PROJECT_CONTEXT } from "../../../lib/project-context"
import { PROJECT_COVERS } from "../../../lib/project-assets"
import { costUSD, round4 } from "../../../lib/pricing"

/**
 * POST /admin/ads-library/jobs/:id/retry-images
 * Re-runs ONLY the image step(s) that failed on a job whose target creative
 * already exists — the common case after a Gemini 429 (per-model 20 rpm limit)
 * killed the 9:16 reframe while the 1:1 already landed. Reuses the existing
 * result creative and its finished 1:1 variants as the reframe source, so a
 * retry never re-does work that succeeded or duplicates the target creative.
 *
 * Default: retry whichever of img11 / img916 is currently `failed`.
 * Body: { img_model?, formats?: ['1:1','9:16'] } — formats forces which image
 * steps to redo (e.g. re-run 9:16 even though it isn't marked failed); img_model
 * switches the image model for the retry. Texts and their cost are untouched.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const b = (req.body || {}) as any
  const fail = (code: number, msg: string) => res.status(code).json({ error: msg, message: msg })

  const [job] = await svc.listAdLocalizationJobs({ id: req.params.id })
  if (!job) return fail(404, "job nenalezen")
  if (job.status === "running" || job.status === "queued") return fail(409, "job právě běží")
  if (!job.result_creative_id) return fail(409, "job nemá cílovou kreativu — spusť lokalizaci znovu")

  const p = job.params || {}
  const model = b.img_model || p.img_model || "nano-banana-pro"
  const target = job.target_project
  const ctx = PROJECT_CONTEXT[target]
  if (!ctx) return fail(400, `neznámý cílový projekt: ${target}`)

  const [src] = await svc.listAdCreatives({ id: job.source_creative_id })
  if (!src) return fail(404, "zdrojová kreativa nenalezena")
  const [created] = await svc.listAdCreatives({ id: job.result_creative_id })
  if (!created) return fail(404, "cílová kreativa nenalezena")

  const steps0 = job.steps || []
  const has = (k: string) => steps0.some((s: any) => s.key === k)
  const statusOf = (k: string) => steps0.find((s: any) => s.key === k)?.status
  const forced: string[] | null = Array.isArray(b.formats) && b.formats.length ? b.formats : null
  const retry11 = has("img11") && (forced ? forced.includes("1:1") : statusOf("img11") === "failed")
  const retry916 = has("img916") && (forced ? forced.includes("9:16") : statusOf("img916") === "failed")
  if (!retry11 && !retry916) return fail(400, "žádný obrázkový krok k opakování")

  const imgCount = Math.min(Number(p.img_count) || 1, 4)
  const langPrompt = (tpl: string) => String(tpl || "")
    .replaceAll("{LANG}", ctx.langName).replaceAll("{BOOK}", ctx.book).replaceAll("{AUTHOR}", ctx.author)

  // running spend across this retry only; folded into the job's total at the end
  let addCost = 0
  const stepCost: Record<string, number> = {}
  const cost = (usage: any, key: string): number => {
    const c = costUSD(usage)
    if (c != null) { addCost += c; stepCost[key] = (stepCost[key] || 0) + c }
    return c || 0
  }
  const setStep = async (key: string, patch: any) => {
    const [f] = await svc.listAdLocalizationJobs({ id: job.id })
    const steps = (f.steps || []).map((s: any) => (s.key === key ? { ...s, ...patch } : s))
    await svc.updateAdLocalizationJobs({ id: job.id, steps })
  }
  const wipeVariants = async (format: string) => {
    const olds = await svc.listAdVariants({ creative_id: created.id, format })
    const ids = olds.map((v: any) => v.id)
    if (ids.length) { try { await svc.deleteAdVariants(ids) } catch {} }
  }

  try {
    await svc.updateAdLocalizationJobs({ id: job.id, status: "running", error: null })

    // ── 1:1 retry (only if it failed / forced) ──
    if (retry11) {
      if (!src.image_1x1_url) throw new Error("zdrojová kreativa nemá obrázek")
      const cover = PROJECT_COVERS[target]
      const refs: any[] = []
      if (p.img_mode === "swap") {
        if (!cover) throw new Error(`chybí referenční cover pro projekt ${target}`)
        refs.push({ url: cover, label: "IMAGE 1 — the new book cover to use:" })
        refs.push({ url: src.image_1x1_url, label: "IMAGE 2 — the advertisement to edit:" })
      } else {
        refs.push({ url: src.image_1x1_url, label: "The advertisement to edit:" })
      }
      await setStep("img11", { status: "running", detail: "opakování", prompt: langPrompt(p.img_prompt), refs: refs.map((r: any) => r.url) })
      await wipeVariants("1:1")
      const v11: any[] = []
      let swapFails = 0
      for (let i = 0; i < imgCount; i++) {
        let buffer: any, mime = "image/jpeg", swapOk: boolean | null = null
        let vCost = 0, vIn = 0, vOut = 0
        const maxTries = p.img_mode === "swap" ? 2 : 1
        for (let attempt = 1; attempt <= maxTries; attempt++) {
          const addendum = attempt > 1
            ? `\n\nATTENTION: your previous attempt kept the ORIGINAL book title. That is wrong. The cover must show "${ctx.book}" by ${ctx.author} — nothing else.`
            : ""
          const gen = await generateImage({ modelId: model, prompt: langPrompt(p.img_prompt) + addendum, refs, aspectRatio: "1:1" })
          buffer = gen.buffer; mime = gen.mime
          vCost += cost(gen.usage, "img11"); vIn += gen.usage?.input || 0; vOut += gen.usage?.output || 0
          if (p.img_mode !== "swap") break
          const verify = await askImageYesNo(buffer.toString("base64"), mime, `Does the book cover in this image show the title "${ctx.book}"?`)
          swapOk = verify.answer; vCost += cost(verify.usage, "img11")
          if (swapOk !== false) break
        }
        if (swapOk === false) swapFails++
        const ext = mime.includes("png") ? "png" : "jpg"
        const url = await uploadBuffer(buffer, `ads-library/${created.id}/1x1/v${i + 1}.${ext}`, mime)
        const row = await svc.createAdVariants({
          creative_id: created.id, format: "1:1", variant_no: i + 1, url,
          model_id: model, mode: p.img_mode, prompt: langPrompt(p.img_prompt), is_official: false,
          metadata: { swap_ok: swapOk, cost_usd: round4(vCost), tokens_in: vIn, tokens_out: vOut },
        })
        v11.push(row)
        await setStep("img11", { status: "running", detail: `${i + 1}/${imgCount}` })
      }
      const bestIdx = Math.max(0, v11.findIndex((v: any) => v.metadata?.swap_ok !== false))
      await svc.updateAdVariants({ id: v11[bestIdx].id, is_official: true })
      await svc.updateAdCreatives({ id: created.id, image_1x1_url: v11[bestIdx].url })
      await setStep("img11", { status: "done", detail: `${v11.length} variant${swapFails ? ` (${swapFails}⚠️ obálka nezměněna)` : ""}`, cost_usd: round4(stepCost.img11 || 0) })
    }

    // ── 9:16 retry — reframe from the target creative's finished 1:1 variants ──
    if (retry916) {
      await setStep("img916", { status: "running", detail: "opakování" })
      const v11now = await svc.listAdVariants({ creative_id: created.id, format: "1:1" })
      const good = v11now.filter((v: any) => v.metadata?.swap_ok !== false)
      let sources = (good.length ? good : v11now).map((v: any) => v.url)
      if (!sources.length && created.image_1x1_url) sources = [created.image_1x1_url]
      if (!sources.length && src.image_1x1_url) sources = [src.image_1x1_url]
      if (!sources.length) throw new Error("9:16 reframe nemá zdrojový obrázek")
      await setStep("img916", { status: "running", detail: "opakování", prompt: p.p916, refs: sources.slice(0, imgCount) })
      await wipeVariants("9:16")
      let n = 0
      for (const srcUrl of sources.slice(0, imgCount)) {
        const { buffer, mime, usage } = await generateImage({ modelId: model, prompt: p.p916, refs: [srcUrl], aspectRatio: "9:16" })
        const c916 = cost(usage, "img916")
        const ext = mime.includes("png") ? "png" : "jpg"
        n++
        const url = await uploadBuffer(buffer, `ads-library/${created.id}/9x16/v${n}.${ext}`, mime)
        await svc.createAdVariants({
          creative_id: created.id, format: "9:16", variant_no: n, url,
          model_id: model, mode: "reframe", prompt: p.p916, is_official: n === 1,
          metadata: { cost_usd: c916 != null ? round4(c916) : null, tokens_in: usage?.input || 0, tokens_out: usage?.output || 0 },
        })
        await setStep("img916", { status: "running", detail: `${n}/${Math.min(sources.length, imgCount)}` })
      }
      const [firstOff] = await svc.listAdVariants({ creative_id: created.id, format: "9:16", is_official: true })
      if (firstOff) await svc.updateAdCreatives({ id: created.id, image_9x16_url: firstOff.url })
      await setStep("img916", { status: "done", detail: `${n} variant`, cost_usd: round4(stepCost.img916 || 0) })
    }

    // ── final status: done only when NOTHING is left failed (texts etc.) ──
    const [fresh] = await svc.listAdLocalizationJobs({ id: job.id })
    const broken = (fresh.steps || []).filter((s: any) => s.status === "failed")
    const finalCost = round4(Number(p.cost_usd || 0) + addCost)
    await svc.updateAdLocalizationJobs({
      id: job.id,
      status: broken.length ? "failed" : "done",
      error: broken.length ? `nedokončené kroky: ${broken.map((s: any) => s.label || s.key).join(", ")}` : null,
      params: { ...p, img_model: model, cost_usd: finalCost },
    })
    if (!broken.length) {
      const [c] = await svc.listAdCreatives({ id: created.id })
      await svc.updateAdCreatives({ id: created.id, metadata: { ...(c?.metadata || {}), generating: false, failed: null } })
    }
    res.json({ ok: true, retried: { "1:1": retry11, "9:16": retry916 }, cost_usd: finalCost })
  } catch (e: any) {
    const [f] = await svc.listAdLocalizationJobs({ id: job.id })
    const steps = (f.steps || []).map((s: any) => (s.status === "running" ? { ...s, status: "failed", detail: e.message.slice(0, 200) } : s))
    await svc.updateAdLocalizationJobs({
      id: job.id, status: "failed", error: e.message.slice(0, 500), steps,
      params: { ...p, cost_usd: round4(Number(p.cost_usd || 0) + addCost) },
    })
    fail(502, e.message)
  }
}
