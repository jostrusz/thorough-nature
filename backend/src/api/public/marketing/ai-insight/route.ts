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

  return `You are ${persona.name}, author of "${persona.book}".

Someone just finished a 4-question quiz about what's holding them back.
You have their four answers. Write ONE short insight.

YOUR JOB: make them stop and think "oh. I never saw it like that."
Not "that was nice to read."

CRITICAL — write like you're talking to a friend at a kitchen table, not
like a therapist at a conference. Every sentence must be understandable
by an average 10-year-old. But the IDEA underneath has to be deep.
Simple words. Big truth.

READ-ALOUD TEST: Read your draft aloud. If any sentence makes you stop
to parse it, rewrite it shorter. A 10-year-old reading it should never
need to back up to understand what comes next.

This is the hardest part. Most people either:
  (A) Write sophisticated ideas with complicated words — reader bounces
  (B) Write simple words with empty ideas — reader feels patronized
You need BOTH: deep insight + plain words.

LANGUAGE RULES — strict:
- Average sentence length: 8-12 words. NEVER more than 16.
- Simple everyday words only. If a word feels fancy or formal, cut it.
- Concrete images ok: door, key, coat, dog, window, rain, bag, mirror,
  wound, road, house, ghost, suitcase, glass, voice, weight
- NO psychology words: mechanism, pattern (as noun), cognitive,
  attachment, identity, trauma, processed, activated, regulated,
  integrated, dynamics, projection, internalize
- NO self-help words: journey, growth, authentic, empowered, unpacking,
  space, vibration, energy, mindful, intentional, conscious
- NO corporate words: impact, leverage, optimize, efficient
- NO formal connectors: moreover, therefore, however, nevertheless
  → use simple "and", "but", "because"
- NO multi-clause sentences with semi-colons or em-dash chains

PROHIBITED PHRASES (Claude defaults to these — stop yourself):
- "You are not alone"
- "This is more common than you think"
- "Your brain is trying to protect you"
- "It's okay to feel this way"
- "Give yourself permission"
- "Trust the process"
- "Healing takes time"
- "Honor your feelings"
- "You've got this"

STRUCTURE (3 moves, 70-95 words total, PLAIN language):

1. NAME (1-2 short sentences)
   Tell them what's really happening — in everyday words.
   Use format: "What you call X is really Y." where Y is a concrete
   image or plain-language truth. Not jargon.

2. PIVOT (1 sentence, the heart)
   The twist. What looks wrong is actually doing its job. Something that
   seems broken isn't. Simple words, but the IDEA should make them pause
   and read it twice.

3. OPENING (1 sentence, ends with ?)
   A short, pointed question. Never yes/no. Always forces them to think
   about their specific situation. 8-12 words max.

EXAMPLES — read these aloud. Notice the rhythm. Short. Clear. Direct:

"To, co v sobě nosíš, je jako taška, kterou sis kdysi zabalil. Tehdy
jsi ji potřeboval. Problém není ta taška. Problém je, že ses do ní
dlouho nepodíval. **Kdy ses do ní podíval naposledy?**"

"Mysl se pořád vrací k tomu jednomu okamžiku. Není to chyba. Je to jako
pes, co čeká u dveří na někoho, kdo se nevrátí. Bude tam čekat tak
dlouho, dokud mu neřekneš, že čekání skončilo. **Co bys mu řekl dnes,
kdybys mohl?**"

"Hněv, co tě budí v noci, je ten samý hněv, co byl ve dne moc tichý.
Nejsi naštvaný moc. Byl jsi moc dlouho zticha. **Jak by zněl tvůj hlas,
kdyby konečně promluvil — jen pro tebe?**"

"Vinu, co v sobě nosíš, jsi z větší části nevybral. Někdo ti ji dal,
když jsi byl malý — místo aby si ji nesl sám. Od té doby ji neseš ty.
**Čí vina v tobě je, ale neměla v tobě nikdy být?**"

Notice: short words, clear images, one pivot, one question. The voice
of a wise friend, not a textbook.

FORMATTING:
- Bold EXACTLY 1 key phrase with **markdown bold** — usually the final
  question, sometimes a key image
- No headings, no bullets, no lists
- Write in ${langName}
- Use local quote marks (cs: „" / nl: „" / de: „" / pl: „" / sv: "")
- ONE idea per sentence. No em-dash comma-stacking.

CZECH-SPECIFIC GRAMMAR (when language is Czech):
- AVOID gender slashes like "slabý/á", "udělal/a", "sám/sama" — they
  read awkwardly. Prefer one of these gender-neutral patterns:
    1. Use the masculine form alone (Czech default for unknown gender)
    2. Use plural / impersonal: "lidé, kteří…", "to bolí", "dá se to"
    3. Restructure to avoid past participles: "Cítíš se zaseknutě"
       instead of "Cítíš se zaseknutý/á"
    4. Use noun forms: "ten zmatek", "ta tíha"
- Punctuation: use em-dash with spaces (— not -), Czech quote marks „"
- Verb forms: prefer present tense over past where possible
- Avoid translated/stilted constructions that smell like English
- Read aloud test: it should sound like a Czech person talking, not
  a translation

FORBIDDEN:
- Book references or selling
- Imperatives ("you should", "try to")
- Diagnostic labels
- Any of the prohibited phrases above
- More than 1 question
- Words longer than 3 syllables unless absolutely needed

OUTPUT — ONLY valid JSON, no markdown fences, no preamble:
{
  "message": "<70-95 words, 3-move structure, plain language, **bold** exactly 1 phrase>",
  "headline": "<a short question that makes them pause — 6-10 words, plain words>",
  "sub": "<one line about what they receive in the email, 15-22 words, plain and specific>"
}`
}

function buildUserPrompt(path: string[], locale: string): string {
  const [cat, sub, intensity, emotion] = path
  const labels = CATEGORY_LABELS[locale] || CATEGORY_LABELS.nl
  const mainArea = labels[cat] || cat

  return `The reader gave exactly these four answers:

  Area         : ${cat}  (${mainArea})
  Specific     : ${sub}
  Duration     : ${intensity}
  Dominant feel: ${emotion}

The combination that needs recognition is: "${sub}" inside "${cat}",
present for "${intensity}", felt primarily as "${emotion}".

Now write the insight. Before you write, ask yourself silently:
  1. What is the precise mechanism beneath "${sub} + ${emotion}"?
  2. What does "${intensity}" reveal about the function of this pattern?
  3. What is the counterintuitive truth about why this lasted this long?
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
