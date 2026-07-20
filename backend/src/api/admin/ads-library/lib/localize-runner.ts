// @ts-nocheck
import { ADS_LIBRARY_MODULE } from "../../../../modules/ads-library"
import { generateImage } from "./imagegen"
import { translateTexts } from "./textgen"
import { uploadBuffer } from "./media"
import { PROJECT_CONTEXT } from "./project-context"
import { PROJECT_COVERS } from "./project-assets"

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

    const imgCount = Math.min(Number(p.img_count) || 2, 4)
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
      // cover first, ad second — labelled, so the model cannot mix them up
      const refs: any[] = []
      if (p.img_mode === "swap") {
        const cover = PROJECT_COVERS[target]
        if (!cover) throw new Error(`chybí referenční cover pro projekt ${target}`)
        refs.push({ url: cover, label: "IMAGE 1 — the new book cover to use:" })
        refs.push({ url: src.image_1x1_url, label: "IMAGE 2 — the advertisement to edit:" })
      } else {
        refs.push({ url: src.image_1x1_url, label: "The advertisement to edit:" })
      }
      await setStep("img11", { status: "running", prompt: langPrompt(p.img_prompt), refs: refs.map((r: any) => r.url) })
      for (let i = 0; i < imgCount; i++) {
        const { buffer, mime } = await generateImage({
          modelId: p.img_model, prompt: langPrompt(p.img_prompt), refs, aspectRatio: "1:1",
        })
        const ext = mime.includes("png") ? "png" : "jpg"
        const url = await uploadBuffer(buffer, `ads-library/${created.id}/1x1/v${i + 1}.${ext}`, mime)
        const row = await svc.createAdVariants({
          creative_id: created.id, format: "1:1", variant_no: i + 1, url,
          model_id: p.img_model, mode: p.img_mode, prompt: langPrompt(p.img_prompt),
          is_official: i === 0,
        })
        v11.push(row)
        await setStep("img11", { status: "running", detail: `${i + 1}/${imgCount}` })
      }
      await svc.updateAdCreatives({ id: created.id, image_1x1_url: v11[0].url })
      await setStep("img11", { status: "done", detail: `${v11.length} variant` })
      log(`1:1 done (${v11.length})`)
    }

    // ── 2) 9:16 reframe from each 1:1 ──
    if (wants916) {
      await setStep("img916", { status: "running" })
      const sources = v11.length ? v11.map((v) => v.url) : [src.image_1x1_url].filter(Boolean)
      if (!sources.length) throw new Error("9:16 reframe nemá zdrojový obrázek")
      await setStep("img916", { status: "running", prompt: p.p916, refs: sources.slice(0, imgCount) })
      let n = 0
      for (const srcUrl of sources.slice(0, imgCount)) {
        const { buffer, mime } = await generateImage({
          modelId: p.img_model, prompt: p.p916, refs: [srcUrl], aspectRatio: "9:16",
        })
        const ext = mime.includes("png") ? "png" : "jpg"
        n++
        const url = await uploadBuffer(buffer, `ads-library/${created.id}/9x16/v${n}.${ext}`, mime)
        await svc.createAdVariants({
          creative_id: created.id, format: "9:16", variant_no: n, url,
          model_id: p.img_model, mode: "reframe", prompt: p.p916,
          is_official: n === 1,
        })
        await setStep("img916", { status: "running", detail: `${n}/${Math.min(sources.length, imgCount)}` })
      }
      const [firstOff] = await svc.listAdVariants({ creative_id: created.id, format: "9:16", is_official: true })
      if (firstOff) await svc.updateAdCreatives({ id: created.id, image_9x16_url: firstOff.url })
      await setStep("img916", { status: "done", detail: `${n} variant` })
      log(`9:16 done (${n})`)
    }

    // ── 3) texts ──
    await setStep("texts", { status: "running", prompt: `model ${p.txt_model} · kontext projektu ${target}` })
    const pick = (arr: string[], idx?: number[]) =>
      (idx?.length ? idx.map((i) => arr?.[i]).filter(Boolean) : (arr || []))
    const primaries = pick(src.primary_texts, p.primary_indexes)
    const headlines = pick(src.headlines, p.headline_indexes)
    const txtCount = Math.min(Number(p.txt_count) || 1, 3)
    const txtVariants: any[] = []
    for (let v = 0; v < txtCount; v++) {
      const out = await translateTexts({
        modelId: p.txt_model, src, targetProject: target, primaries, headlines,
      })
      txtVariants.push(out)
      await setStep("texts", { status: "running", detail: `${v + 1}/${txtCount}` })
    }
    await svc.updateAdCreatives({
      id: created.id,
      primary_texts: (txtVariants[0]?.primaries || []).slice(0, 5),
      headlines: (txtVariants[0]?.headlines || []).slice(0, 5),
      metadata: { localization_job_id: jobId, text_variants: txtVariants, official_text_variant: 0 },
    })
    await setStep("texts", { status: "done", detail: `${txtCount} variant` })

    // ── 4) finalize ──
    await svc.updateAdLocalizationJobs({ id: jobId, status: "done" })
    log(`done → creative ${created.id}`)
  } catch (e: any) {
    console.error(`[Ads Library] job ${jobId} FAILED: ${e.message}`)
    try {
      const [job] = await svc.listAdLocalizationJobs({ id: jobId })
      const steps = (job.steps || []).map((s: any) =>
        s.status === "running" ? { ...s, status: "failed", detail: e.message.slice(0, 200) } : s)
      await svc.updateAdLocalizationJobs({ id: jobId, status: "failed", error: e.message.slice(0, 500), steps })
      if (job.result_creative_id) {
        await svc.updateAdCreatives({ id: job.result_creative_id, metadata: { localization_job_id: jobId, generating: false, failed: e.message.slice(0, 200) } })
      }
    } catch {}
  }
}
