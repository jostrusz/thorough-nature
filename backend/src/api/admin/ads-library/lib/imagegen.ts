// @ts-nocheck
import { hasRate, rateLabel } from "./pricing"
/**
 * Image generation via Google Gemini API (Nano Banana models).
 * Requires env GEMINI_API_KEY. Model ids overridable via env in case Google
 * renames them — verified on first live run.
 */
const MODELS: Record<string, string> = {
  "nano-banana-pro": process.env.IMAGE_MODEL_NANO_PRO || "gemini-3-pro-image",
  "nano-banana": process.env.IMAGE_MODEL_NANO || "gemini-3.1-flash-image",
}

/** 1K | 2K | 4K — 2K is the default, see the note at the generationConfig. */
const IMAGE_SIZE = process.env.IMAGE_SIZE || "2K"

export function imageModels() {
  const hasKey = !!(process.env.GEMINI_API_KEY || "").trim()
  return [
    { id: "nano-banana-pro", label: `🍌 Nano Banana Pro (Google) — nejlepší text v obrázku, ${IMAGE_SIZE}`, available: hasKey },
    { id: "nano-banana", label: `🍌 Nano Banana Flash (Google) — rychlý/levný, ${IMAGE_SIZE}`, available: hasKey },
  ].map((m) => {
    // rates are keyed by the resolved Gemini name, not the UI id
    const resolved = MODELS[m.id]
    return { ...m, resolved, priced: hasRate(resolved), rate: rateLabel(resolved) }
  })
}

/**
 * Token usage split by modality. Image tokens bill ~10× the rate of the
 * model's own text and thinking tokens, so they must be counted separately —
 * candidatesTokensDetails carries the exact IMAGE slice.
 */
function readUsage(json: any, model: string) {
  const um = json?.usageMetadata || {}
  const details = um.candidatesTokensDetails || um.candidatesTokenDetails || []
  const imageOutput = details
    .filter((d: any) => String(d.modality).toUpperCase() === "IMAGE")
    .reduce((n: number, d: any) => n + (d.tokenCount || 0), 0)
  return {
    model,
    input: um.promptTokenCount || 0,
    output: (um.candidatesTokenCount || 0) + (um.thoughtsTokenCount || 0),
    imageOutput,
  }
}

async function fetchAsInline(url: string, label: string): Promise<any> {
  // node's fetch throws a bare "fetch failed" on DNS/TLS problems — wrap it so
  // the job log says which reference could not be downloaded
  let res: Response
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  } catch (e: any) {
    throw new Error(`nelze stáhnout ${label} (${e?.cause?.code || e.message}): ${url}`)
  }
  if (!res.ok) throw new Error(`nelze stáhnout ${label} — HTTP ${res.status}: ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (!buf.length) throw new Error(`${label} je prázdný soubor: ${url}`)
  const mime = res.headers.get("content-type")?.split(";")[0] || "image/jpeg"
  return { inline_data: { mime_type: mime, data: buf.toString("base64") } }
}

/**
 * Generate one image. `refs` = image URLs passed as reference inputs
 * (source creative, target book cover). Returns a JPEG/PNG Buffer.
 */
export async function generateImage(opts: {
  modelId: string
  prompt: string
  /** URL, or {url,label} — the label is sent as a text part right before the
   *  image so the model can tell the source ad from the target book cover. */
  refs: Array<string | { url: string; label: string }>
  aspectRatio: "1:1" | "9:16"
}): Promise<{ buffer: Buffer; mime: string; usage: { model: string; input: number; output: number } }> {
  const key = (process.env.GEMINI_API_KEY || "").trim()
  if (!key) throw new Error("GEMINI_API_KEY není nastaven — dodej klíč z aistudio.google.com")
  const model = MODELS[opts.modelId] || MODELS["nano-banana-pro"]

  const parts: any[] = []
  for (const ref of opts.refs) {
    const url = typeof ref === "string" ? ref : ref.url
    const label = typeof ref === "string" ? "" : ref.label
    if (label) parts.push({ text: label })
    parts.push(await fetchAsInline(url, label || "referenční obrázek"))
  }
  parts.push({ text: opts.prompt })

  let res: Response
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            // 2K = 2048px. On gemini-3-pro-image it bills the SAME as the 1K
            // default (verified live: 1199 vs 1211 output tokens) while giving
            // 4× the pixels — and 1024px sits just under Meta's recommended
            // 1080px feed minimum. On the Flash model 2K does cost ~1.85×.
            imageConfig: { aspectRatio: opts.aspectRatio, imageSize: IMAGE_SIZE },
          },
        }),
        signal: AbortSignal.timeout(180000),
      }
    )
  } catch (e: any) {
    throw new Error(`Gemini API nedostupné (${e?.cause?.code || e.message})`)
  }
  const json = await res.json()
  if (!res.ok) {
    throw new Error(`[Gemini ${model}] ${json?.error?.message || res.status}`)
  }
  const imgPart = json?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData || p.inline_data)
  const inline = imgPart?.inlineData || imgPart?.inline_data
  if (!inline?.data) {
    const block = json?.candidates?.[0]?.finishReason || json?.promptFeedback?.blockReason
    throw new Error(`[Gemini ${model}] nevrátil obrázek${block ? ` (${block})` : ""}`)
  }
  const usage = readUsage(json, model)
  return { buffer: Buffer.from(inline.data, "base64"), mime: inline.mimeType || inline.mime_type || "image/png", usage }
}

/**
 * Describe an image for the Studio text generation — scene, mood, people,
 * objects, any visible text. The description anchors the generated ad copy to
 * what the creative actually shows.
 */
export async function describeImage(url: string): Promise<{ description: string; usage: any }> {
  const key = (process.env.GEMINI_API_KEY || "").trim()
  if (!key) throw new Error("GEMINI_API_KEY není nastaven")
  const model = process.env.IMAGE_VERIFY_MODEL || "gemini-3.1-flash-image"
  const inline = await fetchAsInline(url, "obrázek pro popis")
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [
          inline,
          { text: "Describe this advertising image in 4-6 sentences: the scene and setting, the person (age, gender, what they are doing), the mood, notable objects, and any visible text. Be concrete and factual." },
        ]}],
        generationConfig: { responseModalities: ["TEXT"] },
      }),
      signal: AbortSignal.timeout(60000),
    }
  )
  const json = await res.json()
  if (!res.ok) throw new Error(`[Gemini ${model}] ${json?.error?.message || res.status}`)
  const description = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join(" ").trim()
  if (!description) throw new Error("vision model nevrátil popis obrázku")
  return { description, usage: readUsage(json, model) }
}

/**
 * Ask a cheap vision model a yes/no question about a generated image —
 * used as a quality gate after a book-swap (did the cover actually change?).
 */
export async function askImageYesNo(imageB64: string, mime: string, question: string): Promise<{
  answer: boolean | null; usage: { model: string; input: number; output: number } | null
}> {
  const key = (process.env.GEMINI_API_KEY || "").trim()
  if (!key) return { answer: null, usage: null }
  try {
    const model = process.env.IMAGE_VERIFY_MODEL || "gemini-3.1-flash-image"
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: mime, data: imageB64 } },
            { text: `${question}\nAnswer with a single word: YES or NO.` },
          ]}],
          generationConfig: { responseModalities: ["TEXT"] },
        }),
        signal: AbortSignal.timeout(60000),
      }
    )
    const json = await res.json()
    const txt = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join(" ") || ""
    const usage = readUsage(json, model)
    if (/\bYES\b/i.test(txt)) return { answer: true, usage }
    if (/\bNO\b/i.test(txt)) return { answer: false, usage }
    return { answer: null, usage }
  } catch {
    return { answer: null, usage: null } // verification is best-effort, never fails the job
  }
}
