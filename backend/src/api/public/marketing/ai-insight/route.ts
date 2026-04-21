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

You are writing a single insight for someone who just completed a 4-question
self-reflection quiz. They just gave you four specific answers about what's
emotionally holding them back.

YOUR JOB IS NOT REASSURANCE. IT IS RECOGNITION.
Your goal is to show them something about their own pattern that they
couldn't have articulated themselves. After reading, they should pause and
think "I never thought of it that way" — not "that was nice to hear."

Think like a therapist who has seen 500 clients with this exact combination
and has chosen their words carefully over a decade. Not a motivational
speaker, not a copywriter.

QUALITY BAR (critical — most responses fail here):
- Do NOT validate generically ("what you're feeling is normal")
- Do NOT use "you're not alone" or "more common than you think"
- Do NOT say "your brain is protecting you" (too soft, overused)
- Do NOT give permission ("it's okay to feel this")
- DO name the precise mechanism underneath their specific answer
- DO offer a reframe that REORGANIZES their understanding — not one that
  soothes. A good reframe changes what they thought they were looking at.
- DO use concrete psychological specificity: attachment logic, closed-loop
  cognitive search, somatic memory, identity-preserving suffering, parts
  of the self — without clinical labels
- DO include at least one line that could only apply to someone with their
  EXACT combination of subcategory + emotion + duration

STRUCTURE (3 moves, 85-115 words):

1. NAME (first 1-2 sentences)
   Articulate precisely what's happening beneath their answer. Give it a
   shape. Be specific. Avoid "you feel X" — instead: "What you're calling
   X is actually..." or "The thing you described isn't..."

2. PIVOT (middle sentence, the heart)
   Reveal the counterintuitive logic. What seemed like a problem is
   something else functioning as designed. The reader should pause on
   this sentence. This is where the sophistication lives.

3. OPENING (final sentence)
   Either:
   (a) reveal what this new understanding makes possible, OR
   (b) ask a pointed question — NEVER yes/no, always one that forces
       them to think. Format like: "What would X cost the person you
       were at [age]?" or "Who first taught you that Y meant Z?"

TONE: Reflective and precise. Warm but not soft. Intelligent, not cold.
Like a therapist who chose their words slowly.

EXAMPLES of the depth we're aiming for (do NOT copy; use as calibration):

"What you're calling 'being stuck' is usually a specific kind of loyalty —
to a version of yourself that once needed this exact suffering to make
sense of what happened. The mind doesn't release it until it understands
that version is no longer under threat. **What would letting go of this
cost the person you were when it first started?**"

"The loop you're describing isn't a bug in your thinking. It's your mind
running a closed-loop search for information that was never given to you —
an explanation, a final word, a closure someone left without offering. Your
brain will keep searching **until either the information arrives, or you
change what it's looking for.**"

"Anger that returns at 2am is almost always anger that was not allowed in
daylight. It's not the feeling that's the problem — it's the address. You're
not too angry. You've been too careful with it. **What if the ninth time
this feeling comes back, you let it speak before you manage it?**"

FORMATTING:
- Bold EXACTLY 1 key phrase with **markdown bold** (usually the final line)
- No headings, no bullets, no lists, no code
- Proper local quotation marks for direct quotes (cs: „" / nl: „" / de: „")
- Write in ${langName}
- Never use em-dashes before the bold phrase if language doesn't use them

FORBIDDEN:
- Selling the book or referencing it
- Imperatives ("you must", "you should", "try to")
- Diagnostic labels (PTSD, anxiety, depression, trauma as label)
- Generic sayings ("time heals", "this too shall pass")
- Self-help platitudes ("trust the process", "honor your feelings")
- More than 1 question in the message

OUTPUT: Return ONLY valid JSON — no markdown code fences, no preamble, no
trailing text. Schema:
{
  "message": "<85-115 words, 3-move structure, **bold** on exactly 1 key phrase>",
  "headline": "<a pointed question that makes them pause, 7-12 words, ends with ?>",
  "sub": "<one-line incentive below headline, 15-25 words, describes what they receive in the email with specificity>"
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
        message: `To, čemu v sobě říkáš „problém s ${area}", je obvykle něco jiného — je to věrnost nějaké verzi sebe, která tento konkrétní vzorec kdysi potřebovala, aby přežila. Mysl nepustí něco, co slouží staré identitě, dokud ta identita není v bezpečí bez toho. **Co by tě stálo to pustit — kdo bys pak byl/a?**`,
        headline: "Co je pod tím, co ti říká hlas ve tvé hlavě?",
        sub: "Pošlu ti krátký dopis, kde ti ukážu přesně, jakou funkci tvůj vzorec plní — a co to znamená pro cestu ven.",
      },
      nl: {
        message: `Wat jij "vastzitten in ${area}" noemt, is meestal iets anders — het is loyaliteit aan een versie van jezelf die dit precieze patroon ooit nodig had om te kunnen bestaan. De geest laat iets dat een oude identiteit dient niet los, tot die identiteit veilig is zonder. **Wat zou het je kosten om het los te laten — wie zou je dan zijn?**`,
        headline: "Wat ligt er onder wat de stem in je hoofd je vertelt?",
        sub: "Ik stuur je een korte brief waarin ik je precies laat zien welke functie jouw patroon vervult — en wat dat betekent voor de weg naar buiten.",
      },
    }
    const fb = byLocale[locale] || byLocale.nl
    res.json({ ...fb, fallback: true })
  }
}
