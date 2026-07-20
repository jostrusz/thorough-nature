// @ts-nocheck
/**
 * Official per-1M-token USD rates, verified 2026-07-20 against:
 * - ai.google.dev/gemini-api/docs/pricing
 * - claude.com/pricing#api (Sonnet 5 intro $2/$10 until 2026-08-31)
 * - openai.com/api/pricing
 *
 * Image models bill their output in TWO tiers: generated image tokens at the
 * expensive `imageOutput` rate, and the model's own text + thinking tokens at
 * the ordinary `output` rate (10× cheaper on Pro). Gemini reports the split in
 * usageMetadata.candidatesTokensDetails, so the cost is exact rather than
 * assumed.
 */
type Rate = { input: number; output: number; imageOutput?: number }

const RATES: Record<string, Rate> = {
  // Google — Nano Banana image models (text out / image out differ 10×)
  "gemini-3-pro-image": { input: 2.0, output: 12.0, imageOutput: 120.0 },
  "gemini-3-pro-image-preview": { input: 2.0, output: 12.0, imageOutput: 120.0 },
  "gemini-3.1-flash-image": { input: 0.5, output: 3.0, imageOutput: 60.0 },
  // 2.5 Flash Image is documented per-image ($0.039 / 1290 tok ≈ $30.23 per 1M)
  "gemini-2.5-flash-image": { input: 0.3, output: 3.0, imageOutput: 30.23 },
  // Anthropic
  "claude-fable-5": { input: 10.0, output: 50.0 },
  "claude-opus-4-8": { input: 5.0, output: 25.0 },
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0 },
  // OpenAI
  "gpt-5.6-sol": { input: 5.0, output: 30.0 },
  "gpt-5.6-terra": { input: 2.5, output: 15.0 },
  "gpt-5.6-luna": { input: 1.0, output: 6.0 },
  "gpt-5.4": { input: 2.5, output: 15.0 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
}

export type Usage = {
  model: string
  input: number
  /** total output tokens, image + text + thinking */
  output: number
  /** the image-modality slice of `output`, billed at the imageOutput rate */
  imageOutput?: number
}

/** USD cost of one call, or null when the model has no verified rate. */
export function costUSD(u: Usage | null | undefined): number | null {
  if (!u) return null
  let r = RATES[u.model]
  if (!r) return null
  if (u.model === "claude-sonnet-5" && Date.now() < Date.parse("2026-09-01T00:00:00Z")) {
    r = { ...r, input: 2.0, output: 10.0 } // intro pricing until 2026-08-31
  }
  const imgTok = Math.min(u.imageOutput || 0, u.output || 0)
  const txtTok = Math.max(0, (u.output || 0) - imgTok)
  return (
    (u.input || 0) * r.input +
    txtTok * r.output +
    imgTok * (r.imageOutput ?? r.output)
  ) / 1e6
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/**
 * Does this model have a verified rate? The wizard flags models without one so
 * a newly added model can't silently generate at an uncounted cost.
 */
export function hasRate(modelId: string): boolean {
  return !!RATES[modelId]
}

/** Human-readable rate for the wizard tooltip, e.g. "$10 / $50 za 1M". */
export function rateLabel(modelId: string): string | null {
  const r = RATES[modelId]
  if (!r) return null
  const img = r.imageOutput ? ` · obrázky $${r.imageOutput}` : ""
  return `$${r.input} in / $${r.output} out za 1M${img}`
}
