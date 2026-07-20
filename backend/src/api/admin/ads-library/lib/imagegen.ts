// @ts-nocheck
/**
 * Image generation via Google Gemini API (Nano Banana models).
 * Requires env GEMINI_API_KEY. Model ids overridable via env in case Google
 * renames them — verified on first live run.
 */
const MODELS: Record<string, string> = {
  "nano-banana-pro": process.env.IMAGE_MODEL_NANO_PRO || "gemini-3-pro-image",
  "nano-banana": process.env.IMAGE_MODEL_NANO || "gemini-3.1-flash-image",
}

export function imageModels() {
  const hasKey = !!(process.env.GEMINI_API_KEY || "").trim()
  return [
    { id: "nano-banana-pro", label: "🍌 Nano Banana Pro (Google) — nejlepší text v obrázku", available: hasKey },
    { id: "nano-banana", label: "🍌 Nano Banana Flash (Google) — rychlý/levný", available: hasKey },
  ]
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
}): Promise<{ buffer: Buffer; mime: string }> {
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
            imageConfig: { aspectRatio: opts.aspectRatio },
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
  return { buffer: Buffer.from(inline.data, "base64"), mime: inline.mimeType || inline.mime_type || "image/png" }
}

/**
 * Ask a cheap vision model a yes/no question about a generated image —
 * used as a quality gate after a book-swap (did the cover actually change?).
 */
export async function askImageYesNo(imageB64: string, mime: string, question: string): Promise<boolean | null> {
  const key = (process.env.GEMINI_API_KEY || "").trim()
  if (!key) return null
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
    if (/\bYES\b/i.test(txt)) return true
    if (/\bNO\b/i.test(txt)) return false
    return null
  } catch {
    return null // verification is best-effort, never fails the job
  }
}
