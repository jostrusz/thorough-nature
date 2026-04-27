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
 * Model: Opus 4.7 (claude-opus-4-7). Chosen for top-tier emotional nuance
 * on the 70-95 word reframe — this short paragraph is the entire pitch
 * for the email opt-in, so output quality translates directly into
 * opt-in rate. Opus is ~5× the cost of Sonnet ($15/$75 vs $3/$15 per
 * MTok) so the in-memory + Anthropic prompt cache layers matter more.
 *
 * Basic in-memory cache (15m TTL) keyed by form_id + path + locale to
 * reduce cost on hot paths. Bounded to 500 entries, LRU-evicted.
 *
 * Rate-limit: 30 calls / minute / IP (popup bursts allowed).
 */

const MODEL = "claude-opus-4-7"
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

  return `Posílám ti 4 odpovědi z dotazníku. Čtenář v něm říká, co ho drží
zpátky a co se mu vrací do hlavy.

Tvůj úkol: napiš mu krátkou odpověď ve 3 větách. Mluv přímo k němu,
tykej. Z jeho odpovědí ukaž, že to, co teď cítí, má kořeny v jeho
minulosti — a propoj to konkrétně s tím, co napsal. Ne obecně.

Třetí věta ať je krátká otázka, na kterou si může v duchu odpovědět.

Piš obyčejnou mluvenou ${langName === "Czech" ? "češtinou" : langName}. Žádný terapeutický slang.
Žádné fráze typu „nejsi v tom sám" nebo „dej si svolení".
Vyhni se gender slashům (slabý/á, udělal/a) — použij mužský rod nebo
přeformuluj přes přítomný čas a podstatná jména.

Vrať POUZE validní JSON, žádné markdown fence, žádný úvod:

{
  "message":  "<3 věty pro čtenáře, končí otázkou>",
  "headline": "<5–9 slov, otázka která ho přiměje číst dál>",
  "sub":      "<12–20 slov: co konkrétně dostane v emailu>"
}`
}

function buildUserPrompt(path: string[], texts: string[], locale: string): string {
  const [cat, sub, trigger, sentence] = path
  const [tArea, tSpecific, tTrigger, tSentence] = texts
  const labels = CATEGORY_LABELS[locale] || CATEGORY_LABELS.nl
  const mainArea = labels[cat] || cat

  // Each slot now carries TWO things: a short slug (stable identifier) and
  // the full sentence the reader actually clicked on (or typed). The full
  // sentences are the highest-signal input — they're literally the
  // reader's inner voice. Slugs stay for category-level reasoning.
  const line = (label: string, slug: string, text: string) =>
    text && text.trim() ? `  ${label.padEnd(18)}: "${text}"  [${slug}]`
                        : `  ${label.padEnd(18)}: ${slug}`

  return `The reader just finished a 4-step quiz. Each answer is a sentence
they recognized as their own thought (or wrote themselves). Treat the
quoted sentences as the reader's own words — your insight should feel
like you actually heard what they said.

  ${line("Area",          `${cat} (${mainArea})`, tArea)}
  ${line("Specific",      sub,                    tSpecific)}
  ${line("When it returns", trigger,              tTrigger)}
  ${line("Inner sentence", sentence,              tSentence)}

The most important slot is the inner sentence — that's the voice that
runs in their head when they're alone. Your reframe must speak directly
to it without quoting it back verbatim.

Before you write, ask yourself silently:
  1. What is the precise mechanism beneath "${tSpecific || sub}" inside "${tArea || mainArea}"?
  2. What does the moment "${tTrigger || trigger}" reveal about the function of this pattern?
  3. Why has the inner sentence "${tSentence || sentence}" lasted this long — what was it protecting?
  4. What question would reorient them without offering false comfort?

Only write the JSON after you can answer those four. One try. No preamble.`
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
  // texts[] is optional — full sentence the user saw/typed for each step.
  // Truncate each to 240 chars defensively (UI cap is 200) to bound prompt.
  const texts: string[] = Array.isArray(body.texts)
    ? body.texts.slice(0, 4).map((t: any) => (typeof t === "string" ? t.slice(0, 240) : ""))
    : []
  const locale = typeof body.locale === "string" ? body.locale.toLowerCase().slice(0, 2) : "nl"
  const formId = typeof body.form_id === "string" ? body.form_id : "popup"

  // Cache key includes texts so custom answers don't collide with same slugs.
  const cacheKey = `${formId}|${locale}|${path.join(".")}|${texts.join("§")}`
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
      // NOTE: temperature and top_p are DEPRECATED on Opus 4.7 — passing
      // them returns 400 invalid_request_error. The model handles
      // sampling internally with its extended-thinking pipeline.
      // System prompt is identical for every reader of a given locale —
      // mark it cache_control: ephemeral so Anthropic caches the input
      // tokens for 5 min. After the first call in a window, subsequent
      // calls pay 10% input cost (cache read) instead of 100%. With Opus
      // this saves ~60% per request during burst traffic.
      system: [{
        type: "text",
        text: buildSystemPrompt(locale),
        cache_control: { type: "ephemeral" },
      }],
      messages: [{ role: "user", content: buildUserPrompt(path, texts, locale) }],
    })

    const raw = (resp.content?.[0] as any)?.text || ""
    // Robust JSON extraction — Opus/Sonnet sometimes wrap the JSON with
    // a preamble ("Here is the…"), trailing commentary, or markdown
    // fences. Strip fences first, then extract the first balanced
    // {...} block. Naive .trim() + JSON.parse was the silent failure
    // mode that pushed every call into the fallback branch.
    const stripFences = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim()
    const start = stripFences.indexOf("{")
    const end = stripFences.lastIndexOf("}")
    if (start === -1 || end === -1 || end <= start) {
      throw new Error(`no_json_object_in_response: ${stripFences.slice(0, 200)}`)
    }
    const cleaned = stripFences.slice(start, end + 1)
    const parsed = JSON.parse(cleaned)
    if (!parsed.message || !parsed.headline || !parsed.sub) {
      throw new Error(`incomplete_response: keys=${Object.keys(parsed).join(",")}`)
    }

    cacheSet(cacheKey, parsed)
    res.json({ ...parsed, cached: false })
  } catch (err: any) {
    // Log the actual error so future failures show up in Railway logs.
    // The previous version silently swallowed it, which made debugging
    // the "everyone gets the same fallback" symptom impossible.
    console.error("[ai-insight] Anthropic call failed, returning fallback:", {
      message: err?.message,
      name: err?.name,
      status: err?.status,
      type: err?.type,
      path,
      texts: texts.map((t: string) => (t || "").slice(0, 60)),
      locale,
    })
    // Graceful fallback — deterministic but still sophisticated reframe
    // if Sonnet errors (e.g. API outage or network). Structured so the
    // popup still delivers a recognition-quality experience, not a
    // generic validation.
    const labels = CATEGORY_LABELS[locale] || CATEGORY_LABELS.nl
    const area = labels[path[0]] || path[0]
    const byLocale: Record<string, { message: string; headline: string; sub: string }> = {
      cs: {
        message: `To, co v sobě neseš kolem ${area}, není slabost. Je to jako taška, kterou sis zabalil/a, když jsi ji potřeboval/a. Problém není ta taška. Je v tom, že ses do ní dlouho nepodíval/a. **Kdy ses do ní naposledy opravdu podíval/a?**`,
        headline: "Co v sobě nosíš a ani o tom nevíš?",
        sub: "Pošlu ti krátký dopis. Ukážu ti jednu věc o tobě, kterou ještě nikdo nepojmenoval.",
      },
      nl: {
        message: `Wat jij draagt rond ${area} is geen zwakte. Het is als een tas die je ooit inpakte toen je hem nodig had. De tas is niet het probleem. Je hebt er alleen al heel lang niet meer in gekeken. **Wanneer keek je er voor het laatst echt in?**`,
        headline: "Wat draag je in jezelf zonder het te weten?",
        sub: "Ik stuur je een korte brief. Ik laat je één ding over jezelf zien dat nog niemand benoemde.",
      },
    }
    const fb = byLocale[locale] || byLocale.nl
    res.json({ ...fb, fallback: true })
  }
}
