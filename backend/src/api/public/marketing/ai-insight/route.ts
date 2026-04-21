// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import Anthropic from "@anthropic-ai/sdk"

/**
 * POST /public/marketing/ai-insight
 *
 * Used by the quiz popup on the 5th step: given the user's 4-step quiz path,
 * returns a short empathic insight in the brand author's voice — plus a
 * headline and CTA subtext for the email capture form.
 *
 * Body:
 *   {
 *     form_id: "popup_quiz_loslatenboek",
 *     path: ["relaties", "partner", "6-24m", "vast"],
 *     locale?: "nl" | "cs" | "de" | "pl" | "sv"
 *   }
 *
 * Response:
 *   {
 *     message: string,     // 2-3 sentence reframe with **bold** on 1-2 key phrases
 *     headline: string,    // short question hook for the opt-in form
 *     sub: string          // one-line incentive below headline
 *   }
 *
 * Model: Sonnet 4.6 (claude-sonnet-4-6). Chosen because the emotional
 * nuance of a 50-80 word reframe is worth ~$5/month extra over Haiku on
 * expected traffic, and output quality translates directly to opt-in rate.
 *
 * Basic in-memory cache (15m TTL) keyed by form_id + path + locale to
 * reduce cost on hot paths. Bounded to 500 entries, LRU-evicted.
 *
 * Rate-limit: 30 calls / minute / IP (popup bursts allowed).
 */

const MODEL = "claude-sonnet-4-6"
const CACHE_TTL_MS = 15 * 60 * 1000
const CACHE_MAX = 500
const RATE_WINDOW_MS = 60 * 1000
const RATE_MAX = 30

const cache: Map<string, { exp: number; data: any }> = new Map()
const rateBuckets: Map<string, { count: number; resetAt: number }> = new Map()

function clientIp(req: MedusaRequest): string {
  const fwd = (req.headers["x-forwarded-for"] as string) || ""
  if (fwd) return fwd.split(",")[0].trim()
  return (req as any).ip || (req.socket as any)?.remoteAddress || "unknown"
}

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const b = rateBuckets.get(ip)
  if (!b || b.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (b.count >= RATE_MAX) return false
  b.count++
  return true
}

function cacheGet(key: string): any | null {
  const e = cache.get(key)
  if (!e) return null
  if (e.exp <= Date.now()) { cache.delete(key); return null }
  return e.data
}

function cacheSet(key: string, data: any) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(key, { exp: Date.now() + CACHE_TTL_MS, data })
}

// ─── Prompt construction ──────────────────────────────────────────────
// Path → human-readable description + locale-aware persona.
const PERSONAS: Record<string, { name: string; book: string; brand: string }> = {
  nl: { name: "Joris de Vries", book: "Laat los wat je kapotmaakt",         brand: "loslatenboek" },
  cs: { name: "Joris de Vries", book: "Pusť to, co tě ničí",                brand: "psi-superzivot" },
  de: { name: "Joris de Vries", book: "Lass los, was dich kaputt macht",    brand: "lass-los" },
  pl: { name: "Joris de Vries", book: "Odpuść to, co cię niszczy",          brand: "odpusc-ksiazka" },
  sv: { name: "Joris de Vries", book: "Släpp taget om det som förstör dig", brand: "slapp-taget" },
}

const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  nl: {
    relaties: "relaties", verleden: "het verleden", gedachten: "je gedachten",
    emoties: "je emoties", zelfbeeld: "je zelfbeeld", toekomst: "de toekomst",
  },
  cs: {
    relaties: "vztahy", verleden: "minulost", gedachten: "myšlenky",
    emoties: "emoce", zelfbeeld: "pohled na sebe", toekomst: "budoucnost",
  },
  de: {
    relaties: "Beziehungen", verleden: "die Vergangenheit", gedachten: "deine Gedanken",
    emoties: "deine Gefühle", zelfbeeld: "dein Selbstbild", toekomst: "die Zukunft",
  },
  pl: {
    relaties: "relacje", verleden: "przeszłość", gedachten: "myśli",
    emoties: "emocje", zelfbeeld: "obraz siebie", toekomst: "przyszłość",
  },
  sv: {
    relaties: "relationer", verleden: "det förflutna", gedachten: "dina tankar",
    emoties: "dina känslor", zelfbeeld: "din självbild", toekomst: "framtiden",
  },
}

function buildSystemPrompt(locale: string): string {
  const persona = PERSONAS[locale] || PERSONAS.nl
  const langName = { nl: "Dutch", cs: "Czech", de: "German", pl: "Polish", sv: "Swedish" }[locale] || "Dutch"

  return `You are ${persona.name}, author of the self-help book "${persona.book}".
You are writing an empathic personalized insight for a reader who just
completed a 4-question self-reflection quiz about what's emotionally
holding them back.

VOICE:
- Warm, reflective, vulnerable — speak as mentor, not copywriter.
- Use familiar "you" (tu/jij/du).
- Specific > vague. Sensory over abstract.
- Normalize ("That's more common than you think"), never diagnose.
- Never say "problem", "disorder", "illness".

LENGTH: Message exactly 2-3 sentences, 45-80 words total. Nothing longer.

STRUCTURE:
1. First sentence: validate their experience in 1-2 concrete words.
2. Second sentence: gentle reframe — "it's not weakness / your fault — it's
   an old pattern your mind learned".
3. Optional third sentence: open loop hint of change — "and that can shift".

FORMATTING:
- Bold ONLY 1-2 key words with **markdown bold**.
- No headings, no bullet points, no lists, no quotes.
- Use local quote marks for direct quotes (dutch/czech "" / nl „" / cz „").
- Write in ${langName}.

FORBIDDEN:
- Selling the book ("read my book...")
- Imperatives ("you must", "you should")
- Generic sayings ("everyone feels this", "time heals")
- Diagnostic labels
- More than 1 question in the message

OUTPUT: Return ONLY valid JSON — no markdown code fences, no preamble, no
trailing text. Schema:
{
  "message": "<the insight, 45-80 words, use **bold** on 1-2 key phrases>",
  "headline": "<a question hook, 6-12 words, ends with ?>",
  "sub": "<one-line incentive below headline, 12-22 words, describes what
           they'll receive in email>"
}`
}

function buildUserPrompt(path: string[], locale: string): string {
  const [cat, sub, intensity, emotion] = path
  const labels = CATEGORY_LABELS[locale] || CATEGORY_LABELS.nl
  const mainArea = labels[cat] || cat

  return `The reader answered:
- Primary struggle area: ${cat} (${mainArea})
- Specific focus: ${sub}
- Duration / intensity: ${intensity}
- Dominant feeling: ${emotion}

Write a personalized insight acknowledging their specific combination
of answers. The reader chose "${sub}" within "${cat}", lasting "${intensity}",
with a dominant feeling of "${emotion}". Reflect that specificity — not generic.`
}

// ─── Handler ──────────────────────────────────────────────────────────
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const ip = clientIp(req)
  if (!rateLimit(ip)) {
    res.status(429).json({ error: "rate_limited" })
    return
  }

  const body = (req.body as any) || {}
  const path = Array.isArray(body.path) ? body.path.filter((v: any) => typeof v === "string").slice(0, 4) : []
  if (path.length !== 4) {
    res.status(400).json({ error: "path must be array of 4 strings" })
    return
  }
  const locale = typeof body.locale === "string" ? body.locale.toLowerCase().slice(0, 2) : "nl"
  const formId = typeof body.form_id === "string" ? body.form_id : "popup"

  const cacheKey = `${formId}|${locale}|${path.join(".")}`
  const cached = cacheGet(cacheKey)
  if (cached) {
    res.json({ ...cached, cached: true })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: "anthropic_not_configured" })
    return
  }

  try {
    const client = new Anthropic({ apiKey })
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: buildSystemPrompt(locale),
      messages: [{ role: "user", content: buildUserPrompt(path, locale) }],
    })

    const raw = (resp.content?.[0] as any)?.text || ""
    // Strip any accidental markdown wrapping the model might emit.
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()
    const parsed = JSON.parse(cleaned)
    if (!parsed.message || !parsed.headline || !parsed.sub) {
      throw new Error("incomplete_response")
    }

    cacheSet(cacheKey, parsed)
    res.json({ ...parsed, cached: false })
  } catch (err: any) {
    // Graceful fallback — deterministic generic reframe if Sonnet errors
    // (e.g. API outage). Popup still renders something useful.
    const labels = CATEGORY_LABELS[locale] || CATEGORY_LABELS.nl
    const area = labels[path[0]] || path[0]
    const fallback = {
      message: `To, co cítíš kolem oblasti ${area}, není slabost. Je to starý vzorec, který se tvůj mozek naučil — a pro tvou kdysi situaci ti pomohl. Dobrá zpráva je: **ten vzorec se dá odemknout.**`,
      headline: "Chceš vědět, proč to přetrvává — a jak to pustit?",
      sub: "Pošlu ti osobní vhled na základě tvých odpovědí + první 3 dny mé reflexní série.",
      fallback: true,
    }
    res.json(fallback)
  }
}
