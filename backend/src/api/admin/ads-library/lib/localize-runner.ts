// @ts-nocheck
import { ADS_LIBRARY_MODULE } from "../../../../modules/ads-library"
import { generateImage, askImageYesNo } from "./imagegen"
import { translateTexts } from "./textgen"
import { uploadBuffer } from "./media"
import { PROJECT_CONTEXT } from "./project-context"
import { PROJECT_COVERS } from "./project-assets"
import { costUSD, round4 } from "./pricing"

/**
 * Async localization job runner. Fire-and-forget from the route; progress is
 * written to ad_localization_job.steps so the admin UI can poll it.
 *
 * Steps:
 *  1) 1:1 images  — N variants (book swap w/ reference cover, or texts-only)
 *  2) 9:16 images — reframe of each 1:1 variant (image-to-image)
 *  3) texts       — M independent translations (variant 1 is stored on card)
 *  4) create target creative + variant rows, link family
 */
export async function runLocalizationJob(container: any, jobId: string) {
  const svc = container.resolve(ADS_LIBRARY_MODULE)
  const log = (msg: string) => console.log(`[Ads Library] job ${jobId}: ${msg}`)

  const setStep = async (key: string, patch: any) => {
    const [job] = await svc.listAdLocalizationJobs({ id: jobId })
    const steps = (job.steps || []).map((s: any) => (s.key === key ? { ...s, ...patch } : s))
    await svc.updateAdLocalizationJobs({ id: jobId, steps })
  }

  // running USD total across every AI call in this job (images, verify, texts)
  let totalCost = 0
  const stepCost: Record<string, number> = {}
  const addCost = (usage: any, stepKey: string): number | null => {
    const c = costUSD(usage)
    if (c != null) {
      totalCost += c
      stepCost[stepKey] = (stepCost[stepKey] || 0) + c
    }
    return c
  }

  try {
    const [job] = await svc.listAdLocalizationJobs({ id: jobId })
    const p = job.params || {}
    const [src] = await svc.listAdCreatives({ id: job.source_creative_id })
    if (!src) throw new Error("zdrojová kreativa nenalezena")
    const target = job.target_project
    const ctx = PROJECT_CONTEXT[target]
    if (!ctx) throw new Error(`neznámý cílový projekt: ${target}`)

    await svc.updateAdLocalizationJobs({ id: jobId, status: "running" })

    // ── pre-create target creative (so we have an id for MinIO paths) ──
    let familyId = src.family_id
    if (!familyId) {
      familyId = src.id
      await svc.updateAdCreatives({ id: src.id, family_id: familyId })
    }
    const created = await svc.createAdCreatives({
      name: `${src.name}-${ctx.language}`,
      project_id: target,
      language: ctx.language,
      tag: "test",
      primary_texts: [],
      headlines: [],
      description_text: src.description_text,
      cta_type: src.cta_type,
      link_url: `https://www.${ctx.domain}/`,
      media_type: "image",
      source: "translation",
      family_id: familyId,
      translated_from_id: src.id,
      metadata: { localization_job_id: jobId, generating: true },
    })
    await svc.updateAdLocalizationJobs({ id: jobId, result_creative_id: created.id })

    const imgCount = Math.min(Number(p.img_count) || 1, 4)
    const wants11 = p.formats?.includes("1:1")
    const wants916 = p.formats?.includes("9:16")
    const langPrompt = (tpl: string) => String(tpl || "")
      .replaceAll("{LANG}", ctx.langName)
      .replaceAll("{BOOK}", ctx.book)
      .replaceAll("{AUTHOR}", ctx.author)

    // ── 1) 1:1 variants ──
    const v11: any[] = []
    if (wants11) {
      await setStep("img11", { status: "running" })
      if (!src.image_1x1_url) throw new Error("zdrojová kreativa nemá obrázek")
      // cover first, ad second — labelled, so the model cannot mix them up.
      // The target-book cover is ALWAYS attached to 1:1 generation (both
      // modes) so the book shown in the ad is the right edition; the 9:16
      // reframe below works purely from the finished 1:1 and needs no cover.
      const cover = PROJECT_COVERS[target]
      const refs: any[] = []
      if (p.img_mode === "swap") {
        if (!cover) throw new Error(`chybí referenční cover pro projekt ${target}`)
        refs.push({ url: cover, label: "IMAGE 1 — the new book cover to use:" })
        refs.push({ url: src.image_1x1_url, label: "IMAGE 2 — the advertisement to edit:" })
      } else {
        if (cover) refs.push({ url: cover, label: "IMAGE 1 — reference: the target edition's book cover (if a book appears in the ad, it must look like this):" })
        refs.push({ url: src.image_1x1_url, label: cover ? "IMAGE 2 — the advertisement to edit:" : "The advertisement to edit:" })
      }
      await setStep("img11", { status: "running", prompt: langPrompt(p.img_prompt), refs: refs.map((r: any) => r.url) })
      let swapFails = 0
      for (let i = 0; i < imgCount; i++) {
        let buffer: any, mime = "image/jpeg", swapOk: boolean | null = null
        let vCost = 0, vIn = 0, vOut = 0
        // book swap gets one automatic retry when the verifier says the cover
        // did not actually change (the model loves to keep the original title)
        const maxTries = p.img_mode === "swap" ? 2 : 1
        for (let attempt = 1; attempt <= maxTries; attempt++) {
          const addendum = attempt > 1
            ? `\n\nATTENTION: your previous attempt kept the ORIGINAL book title. That is wrong. The cover must show "${ctx.book}" by ${ctx.author} — nothing else.`
            : ""
          const gen = await generateImage({
            modelId: p.img_model, prompt: langPrompt(p.img_prompt) + addendum, refs, aspectRatio: "1:1",
          })
          buffer = gen.buffer; mime = gen.mime
          vCost += addCost(gen.usage, "img11") || 0
          vIn += gen.usage?.input || 0; vOut += gen.usage?.output || 0
          if (p.img_mode !== "swap") break
          const verify = await askImageYesNo(
            buffer.toString("base64"), mime,
            `Does the book cover in this image show the title "${ctx.book}"?`
          )
          swapOk = verify.answer
          vCost += addCost(verify.usage, "img11") || 0
          if (swapOk !== false) break
          log(`1:1 v${i + 1} pokus ${attempt}: obálka se nezměnila${attempt < maxTries ? " → retry" : ""}`)
        }
        if (swapOk === false) swapFails++
        const ext = mime.includes("png") ? "png" : "jpg"
        const url = await uploadBuffer(buffer, `ads-library/${created.id}/1x1/v${i + 1}.${ext}`, mime)
        const row = await svc.createAdVariants({
          creative_id: created.id, format: "1:1", variant_no: i + 1, url,
          model_id: p.img_model, mode: p.img_mode, prompt: langPrompt(p.img_prompt),
          is_official: false,
          metadata: { swap_ok: swapOk, cost_usd: round4(vCost), tokens_in: vIn, tokens_out: vOut },
        })
        v11.push(row)
        await setStep("img11", { status: "running", detail: `${i + 1}/${imgCount}` })
      }
      // official = first variant that passed the swap check, else the first one
      const bestIdx = Math.max(0, v11.findIndex((v: any) => v.metadata?.swap_ok !== false))
      await svc.updateAdVariants({ id: v11[bestIdx].id, is_official: true })
      await svc.updateAdCreatives({ id: created.id, image_1x1_url: v11[bestIdx].url })
      const failNote = swapFails ? ` (${swapFails}⚠️ obálka nezměněna)` : ""
      await setStep("img11", { status: "done", detail: `${v11.length} variant${failNote}`, cost_usd: round4(stepCost.img11 || 0) })
      log(`1:1 done (${v11.length}, swap fails: ${swapFails}, ~$${round4(stepCost.img11 || 0)})`)
    }

    // ── 2) 9:16 reframe from each 1:1 ──
    if (wants916) {
      await setStep("img916", { status: "running" })
      const good = v11.filter((v: any) => v.metadata?.swap_ok !== false)
      const sources = (good.length ? good : v11).map((v) => v.url)
      if (!sources.length && src.image_1x1_url) sources.push(src.image_1x1_url)
      if (!sources.length) throw new Error("9:16 reframe nemá zdrojový obrázek")
      await setStep("img916", { status: "running", prompt: p.p916, refs: sources.slice(0, imgCount) })
      let n = 0
      for (const srcUrl of sources.slice(0, imgCount)) {
        const { buffer, mime, usage } = await generateImage({
          modelId: p.img_model, prompt: p.p916, refs: [srcUrl], aspectRatio: "9:16",
        })
        const c916 = addCost(usage, "img916")
        const ext = mime.includes("png") ? "png" : "jpg"
        n++
        const url = await uploadBuffer(buffer, `ads-library/${created.id}/9x16/v${n}.${ext}`, mime)
        await svc.createAdVariants({
          creative_id: created.id, format: "9:16", variant_no: n, url,
          model_id: p.img_model, mode: "reframe", prompt: p.p916,
          is_official: n === 1,
          metadata: { cost_usd: c916 != null ? round4(c916) : null, tokens_in: usage?.input || 0, tokens_out: usage?.output || 0 },
        })
        await setStep("img916", { status: "running", detail: `${n}/${Math.min(sources.length, imgCount)}` })
      }
      const [firstOff] = await svc.listAdVariants({ creative_id: created.id, format: "9:16", is_official: true })
      if (firstOff) await svc.updateAdCreatives({ id: created.id, image_9x16_url: firstOff.url })
      await setStep("img916", { status: "done", detail: `${n} variant`, cost_usd: round4(stepCost.img916 || 0) })
      log(`9:16 done (${n}, ~$${round4(stepCost.img916 || 0)})`)
    }

    // ── 3) texts — translate + automatic humanizer pass (2 calls per variant) ──
    await setStep("texts", { status: "running", prompt: `model ${p.txt_model} · kontext projektu ${target}` })
    const pick = (arr: string[], idx?: number[]) =>
      (idx?.length ? idx.map((i) => arr?.[i]).filter(Boolean) : (arr || []))
    const primaries = pick(src.primary_texts, p.primary_indexes)
    const headlines = pick(src.headlines, p.headline_indexes)
    const txtCount = Math.min(Number(p.txt_count) || 1, 3)
    const txtVariants: any[] = []
    const allTells: string[] = []
    for (let v = 0; v < txtCount; v++) {
      const out = await translateTexts({
        modelId: p.txt_model, src, targetProject: target, primaries, headlines,
      })
      addCost(out.usage, "texts")
      txtVariants.push({ primaries: out.primaries, headlines: out.headlines })
      allTells.push(...(out.tells || []).map((t: string) => txtCount > 1 ? `v${v + 1}: ${t}` : t))
      if (v === 0) {
        // the full rendered prompt, visible in "Zobrazit zadání"
        await setStep("texts", { status: "running", detail: `${v + 1}/${txtCount}`, prompt: out.prompt })
      } else {
        await setStep("texts", { status: "running", detail: `${v + 1}/${txtCount}` })
      }
    }
    // metadata updates MERGE in Medusa — generating:false must be explicit,
    // otherwise the initial `generating: true` sticks forever
    await svc.updateAdCreatives({
      id: created.id,
      primary_texts: (txtVariants[0]?.primaries || []).slice(0, 5),
      headlines: (txtVariants[0]?.headlines || []).slice(0, 5),
      metadata: { localization_job_id: jobId, text_variants: txtVariants, official_text_variant: 0, generating: false },
    })
    const tellNote = allTells.length ? ` · 🧬 ${allTells.length} oprav` : " · 🧬 čisté"
    await setStep("texts", {
      status: "done", detail: `${txtCount} variant${tellNote}`,
      cost_usd: round4(stepCost.texts || 0), tells: allTells.slice(0, 20),
    })

    // ── 4) finalize ──
    await svc.updateAdLocalizationJobs({
      id: jobId, status: "done",
      params: { ...p, cost_usd: round4(totalCost) },
    })
    log(`done → creative ${created.id} (~$${round4(totalCost)})`)
  } catch (e: any) {
    console.error(`[Ads Library] job ${jobId} FAILED: ${e.message}`)
    try {
      const [job] = await svc.listAdLocalizationJobs({ id: jobId })
      const steps = (job.steps || []).map((s: any) =>
        s.status === "running" ? { ...s, status: "failed", detail: e.message.slice(0, 200) } : s)
      await svc.updateAdLocalizationJobs({
        id: jobId, status: "failed", error: e.message.slice(0, 500), steps,
        // partial spend up to the failure still gets recorded
        params: { ...(job.params || {}), cost_usd: round4(totalCost) },
      })
      if (job.result_creative_id) {
        await svc.updateAdCreatives({ id: job.result_creative_id, metadata: { localization_job_id: jobId, generating: false, failed: e.message.slice(0, 200) } })
      }
    } catch {}
  }
}
