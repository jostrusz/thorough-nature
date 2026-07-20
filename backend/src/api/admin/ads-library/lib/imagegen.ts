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

async function fetchAsInline(url: string): Promise<any> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`reference image fetch failed (${res.status}): ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
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
  refs: string[]
  aspectRatio: "1:1" | "9:16"
}): Promise<{ buffer: Buffer; mime: string }> {
  const key = (process.env.GEMINI_API_KEY || "").trim()
  if (!key) throw new Error("GEMINI_API_KEY není nastaven — dodej klíč z aistudio.google.com")
  const model = MODELS[opts.modelId] || MODELS["nano-banana-pro"]

  const parts: any[] = [{ text: opts.prompt }]
  for (const url of opts.refs) parts.push(await fetchAsInline(url))

  const res = await fetch(
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
    }
  )
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
