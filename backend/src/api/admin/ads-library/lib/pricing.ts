// @ts-nocheck
/**
 * Official per-1M-token USD rates, verified 2026-07-20 against:
 * - ai.google.dev/gemini-api/docs/pricing (image output tokens; one 1K/2K
 *   image ≈ 1120 output tokens → ~$0.134 on Pro, ~$0.067 on Flash)
 * - claude.com/pricing#api (Sonnet 5 intro $2/$10 until 2026-08-31)
 * - openai.com/api/pricing
 *
 * Costs are indicative ("orientační") — Gemini thought/text output tokens are
 * billed here at the image-output rate, which slightly overestimates.
 */
type Rate = { input: number; output: number }

const RATES: Record<string, Rate> = {
  // Google — Nano Banana image models
  "gemini-3-pro-image": { input: 2.0, output: 120.0 },
  "gemini-3-pro-image-preview": { input: 2.0, output: 120.0 },
  "gemini-3.1-flash-image": { input: 0.5, output: 60.0 },
  "gemini-2.5-flash-image": { input: 0.5, output: 60.0 },
  // Anthropic
  "claude-opus-4-8": { input: 5.0, output: 25.0 },
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0 },
  // OpenAI
  "gpt-5.4": { input: 2.5, output: 15.0 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
}

export type Usage = { model: string; input: number; output: number }

/** USD cost of one call, or null when the model has no verified rate. */
export function costUSD(u: Usage | null | undefined): number | null {
  if (!u) return null
  let r = RATES[u.model]
  if (!r) return null
  if (u.model === "claude-sonnet-5" && Date.now() < Date.parse("2026-09-01T00:00:00Z")) {
    r = { input: 2.0, output: 10.0 } // intro pricing until 2026-08-31
  }
  return ((u.input || 0) * r.input + (u.output || 0) * r.output) / 1e6
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
