// @ts-nocheck
import { MedusaContainer } from "@medusajs/framework/types"
import Anthropic from "@anthropic-ai/sdk"
import { MARKETING_MODULE } from "../modules/marketing"
import type MarketingModuleService from "../modules/marketing/service"

/**
 * Marketing AI Worker
 * ───────────────────
 * Runs every minute. Picks up to 3 marketing_ai_job rows in status='queued',
 * marks them 'running', processes them against the Anthropic API, then writes
 * the result back as 'completed' or 'failed'.
 *
 * Job types:
 *   - subject_generation      → { template_id?, brand_voice?, brief? }  → [5 subject lines]
 *   - body_generation         → { brief, brand_voice? }                 → HTML body
 *   - segment_from_prompt     → { natural_language }                    → segment DSL JSON
 *   - brand_voice_training    → { samples: string[] }                   → voice profile JSON
 *
 * Model ID: "claude-opus-4-5" (alias — resolves to the latest 4.5 snapshot).
 * Never hardcoded into persisted state — we store the exact ID on the job
 * row so historical jobs remain reproducible.
 */

const MAX_JOBS_PER_TICK = 3
const ANTHROPIC_MODEL = process.env.MARKETING_AI_MODEL || "claude-opus-4-5"

export default async function marketingAiWorker(container: MedusaContainer) {
  const logger = (container.resolve("logger") as any) || console
  const service = container.resolve(MARKETING_MODULE) as unknown as MarketingModuleService

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    logger.warn("[Marketing AI] ANTHROPIC_API_KEY not set; skipping tick")
    return
  }

  const client = new Anthropic({ apiKey })

  try {
    const queuedRaw = await service.listMarketingAiJobs(
      { status: "queued" } as any,
      { take: MAX_JOBS_PER_TICK, order: { created_at: "ASC" } } as any
    )
    const queued = (queuedRaw as any[]) || []
    if (!queued.length) return

    logger.info(`[Marketing AI] Processing ${queued.length} job(s)`)

    for (const job of queued) {
      try {
        // Claim the job — mark as running
        await service.updateMarketingAiJobs({
          id: job.id,
          status: "running",
        } as any)

        const { output, tokens_in, tokens_out } = await processJob(job, client)

        await service.updateMarketingAiJobs({
          id: job.id,
          status: "completed",
          output,
          tokens_in,
          tokens_out,
          model: ANTHROPIC_MODEL,
        } as any)

        logger.info(`[Marketing AI] Job ${job.id} (${job.type}) completed`)
      } catch (err: any) {
        const msg = err?.message || String(err)
        logger.error(`[Marketing AI] Job ${job.id} failed: ${msg}`)
        try {
          await service.updateMarketingAiJobs({
            id: job.id,
            status: "failed",
            error: msg.slice(0, 2000),
            model: ANTHROPIC_MODEL,
          } as any)
        } catch {}
      }
    }
  } catch (err: any) {
    logger.error(`[Marketing AI] Fatal: ${err?.message || err}`)
  }
}

type JobResult = {
  output: any
  tokens_in: number
  tokens_out: number
}

async function processJob(job: any, client: Anthropic): Promise<JobResult> {
  const input = job.input || {}
  switch (job.type) {
    case "subject_generation":
      return runSubjectGeneration(input, client)
    case "body_generation":
      return runBodyGeneration(input, client)
    case "segment_from_prompt":
      return runSegmentFromPrompt(input, client)
    case "brand_voice_training":
      return runBrandVoiceTraining(input, client)
    default:
      throw new Error(`Unknown AI job type: ${job.type}`)
  }
}

function extractText(response: any): string {
  const blocks = response?.content || []
  return blocks
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text || "")
    .join("\n")
    .trim()
}

function countTokens(response: any): { in: number; out: number } {
  return {
    in: response?.usage?.input_tokens || 0,
    out: response?.usage?.output_tokens || 0,
  }
}

function tryParseJson(text: string): any {
  // Strip triple-backtick fences if present
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```\s*$/i, "")
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    // Try to find a JSON object/array in the response
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        return null
      }
    }
    return null
  }
}

async function runSubjectGeneration(input: any, client: Anthropic): Promise<JobResult> {
  const brief = String(input.brief || input.prompt || "")
  const brandVoice = input.brand_voice ? JSON.stringify(input.brand_voice) : "(not specified)"
  const templateContext = input.template_id ? `Template ID: ${input.template_id}` : ""

  const userMessage = [
    "Generate 5 compelling email subject line variants.",
    `Brief: ${brief || "(none provided — produce engaging generic marketing subjects)"}`,
    `Brand voice: ${brandVoice}`,
    templateContext,
    "",
    "Requirements:",
    "- Each subject must be 40-60 characters",
    "- Vary tone: one urgent, one curiosity-driven, one benefit-led, one personal, one playful",
    "- Return ONLY a JSON array of 5 strings, no commentary.",
  ].join("\n")

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1000,
    messages: [{ role: "user", content: userMessage }],
  })

  const text = extractText(response)
  const parsed = tryParseJson(text)
  const variants = Array.isArray(parsed)
    ? parsed.map((s) => String(s)).slice(0, 5)
    : text.split("\n").filter(Boolean).slice(0, 5)

  const { in: tIn, out: tOut } = countTokens(response)
  return {
    output: { variants },
    tokens_in: tIn,
    tokens_out: tOut,
  }
}

async function runBodyGeneration(input: any, client: Anthropic): Promise<JobResult> {
  const brief = String(input.brief || input.prompt || "")
  const brandVoice = input.brand_voice ? JSON.stringify(input.brand_voice) : "(not specified)"

  const userMessage = [
    "Write the HTML body for a marketing email.",
    `Brief: ${brief}`,
    `Brand voice: ${brandVoice}`,
    "",
    "Requirements:",
    "- Inline styles only (email clients strip <style>)",
    "- No <html>, <head>, or <body> wrappers — just the inner content blocks",
    "- Keep it scannable: 2-4 short paragraphs, at most one CTA button",
    "- Use {{ contact.first_name }} for personalization where appropriate",
    "- Include {{ unsubscribe_url }} at the bottom inside a small footer",
    "- Return ONLY the HTML, no explanations or markdown fences.",
  ].join("\n")

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2500,
    messages: [{ role: "user", content: userMessage }],
  })

  const text = extractText(response)
  const html = text
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```\s*$/i, "")
    .trim()

  const { in: tIn, out: tOut } = countTokens(response)
  return {
    output: { html },
    tokens_in: tIn,
    tokens_out: tOut,
  }
}

async function runSegmentFromPrompt(input: any, client: Anthropic): Promise<JobResult> {
  const prompt = String(input.natural_language || input.prompt || "")

  const userMessage = [
    "Convert the following natural-language audience description into a segment DSL JSON object.",
    `Description: ${prompt}`,
    "",
    "DSL schema:",
    `{
  "type": "and" | "or",
  "conditions": [
    { "field": "status" | "tag" | "country_code" | "has_ordered" | "last_order_days_ago" | "total_spent", "op": "eq" | "neq" | "in" | "not_in" | "gt" | "lt" | "contains", "value": ... }
  ]
}`,
    "",
    "Return ONLY the JSON object, no prose.",
  ].join("\n")

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1500,
    messages: [{ role: "user", content: userMessage }],
  })

  const text = extractText(response)
  const parsed = tryParseJson(text) || {
    type: "and",
    conditions: [],
    raw_response: text.slice(0, 500),
  }

  const { in: tIn, out: tOut } = countTokens(response)
  return {
    output: { query: parsed },
    tokens_in: tIn,
    tokens_out: tOut,
  }
}

async function runBrandVoiceTraining(input: any, client: Anthropic): Promise<JobResult> {
  const samples: string[] = Array.isArray(input.samples) ? input.samples : []
  if (!samples.length) {
    throw new Error("brand_voice_training requires at least one sample")
  }
  const joinedSamples = samples
    .map((s, i) => `--- sample ${i + 1} ---\n${String(s).slice(0, 4000)}`)
    .join("\n\n")

  const userMessage = [
    "Analyze the following writing samples and extract a reusable brand voice profile.",
    "Return ONLY a JSON object with these keys:",
    `{
  "tone": string,
  "style_descriptors": string[],
  "vocabulary_preferences": { "prefer": string[], "avoid": string[] },
  "sentence_length": "short" | "medium" | "long" | "mixed",
  "formality": "casual" | "conversational" | "neutral" | "formal",
  "typical_ctas": string[],
  "notes": string
}`,
    "",
    "Samples:",
    joinedSamples,
  ].join("\n")

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: userMessage }],
  })

  const text = extractText(response)
  const parsed = tryParseJson(text) || { raw_response: text.slice(0, 2000) }

  const { in: tIn, out: tOut } = countTokens(response)
  return {
    output: { profile: parsed },
    tokens_in: tIn,
    tokens_out: tOut,
  }
}

export const config = {
  name: "marketing-ai-worker",
  schedule: "* * * * *", // every minute (cron is 5-field — sub-minute not supported)
}
