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

  return `Píšeš krátkou zprávu jednomu člověku. Před chvílí ti řekl 4 věci
o tom, co ho drží zpátky. Odpověz mu jako kamarád, kterému by se
svěřil v kavárně. Ne jako kouč. Ne jako terapeut. Ne jako autor knihy.
Prostě člověk, který slyší a rozumí.

PRAVIDLA:

• 3 věty, max 4. Krátké. Jako když mluvíš.
• Tak jednoduše, aby to pochopilo desetileté dítě. Žádná složitá
  slova, žádné metafory, žádné cizí pojmy. Slova, která zná každý.
• Konkrétně, ne obecně. Pojmenuj reálnou situaci, kterou ten
  člověk fakt zažívá: scrolluje v posteli místo aby spal, dívá
  se po cizím partnerovi víc než po svém, počítá co všechno nestihl,
  čte si staré zprávy od ex-partnera, předstírá v práci pohodu,
  večer si dá ještě jedno víno aby usnul. Ne „cítíš se zaseknutý"
  — ale „znovu otevíráš tu jednu konverzaci v telefonu".
• Vždy tykej.
• Propoj jeho minulost s tím, co teď cítí. Ale konkrétně — z toho,
  co napsal, ne obecně.
• Poslední věta = krátká otázka. Ne ano/ne. Otázka, na které musí
  myslet.
• Odpověď posíláš zavoláním nástroje send_insight — vyplň jeho
  3 pole (message, headline, sub). Žádný preamble, žádný komentář
  mimo nástroj.

JAK MÁ VÝSLEDEK ZNÍT — TVAR, STYL, RYTMUS:

✅ Příklad 1 — někdo odešel:
„Někdo odešel a neřekl ti proč. Tak ti to hlava ve tři ráno
vysvětluje sama. A vždycky řekne to nejhorší — že to bylo tebou.
A co když to vůbec nebylo o tobě?"

✅ Příklad 2 — nejsem dost:
„Tuhle větu jsi nevymyslel. Někdo ti ji řekl. Ty ji teď opakuješ,
jako by byla tvoje. Komu doopravdy patří?"

✅ Příklad 3 — tři ráno:
„Ve tři ráno nikdy nepřemýšlíš dobře. Hlava je unavená a říká ti
hlouposti. Ráno bys to nahlas neřekl. Tak proč tomu v noci věříš?"

Tohle je tvůj cíl — tenhle tvar, tenhle rytmus, tahle jednoduchost.
Krátké věty. Slova, co zná každý. Konkrétní obraz místo
abstraktního pojmu. Otázka na konci, na kterou musí myslet.

ČEHO SE VYHNI:

• Em-dash uprostřed věty 2× a víc — zní písemně, ne mluveně.
  Místo „A to, co tam slyšíš — že nejsi dost — není pravda" napiš
  „A to, co tam slyšíš, že nejsi dost, není pravda". Méně dashů.
• Konstrukce „není X, ale Y" víc než jednou na zprávu.
• Abstrakta jako: mechanismus, vzorec, projekce, nabídka, schéma,
  proces, dynamika, struktura. Vždy je nahraď konkrétním slovem.
• Klinická slova: mozek (řekni „hlava"), přehrává si (řekni „vrací
  se", „točí se v hlavě"), neuzavřeno (řekni „nevyřešeno",
  „nedovedl/a jsi to dotáhnout").
• Cliché: „nejsi v tom sám", „dej si svolení", „důvěřuj procesu",
  „tvůj mozek se tě snaží chránit".
• Gender slashe (slabý/á, udělal/a). Použij mužský rod nebo
  přeformuluj: „cítíš tu tíhu" místo „cítíš se zatížený/á".

JAZYK: ${langName === "Czech" ? "česky, mluvená řeč" : langName}.
Uvozovky: „"  Em-dash: — (s mezerami, ale šetřivě).

VÝSTUP: zavolej nástroj send_insight s těmito argumenty:
  • message  — 3 věty, mluvený rytmus, končí otázkou
  • headline — 5–9 slov, otázka co ho přiměje číst dál
  • sub      — 18–28 slov. CTA, která ho táhne vyplnit jméno + email.

JAK NAPSAT SUB (CTA pod headline) — Sabri Suby + NLP styl:

Vždy stejný tvar: „Pošli mi sem tvoje jméno a email a provedu tě
cestou, kde [konkrétní výsledek napojený na headline]." Případně
„… ukážu ti cestu, jak …", „… vezmu tě krok po kroku k tomu, …".
Mluv jako průvodce, který drží lampu — ne jako prodejce, ne jako
poštovní pošťák. Chceš, aby cítil, že to není jednorázový mail,
ale začátek vztahu / cesty.

CO NIKDY NEPSAT:
• Nikdy neslibuj počet emailů. Žádné „jeden mail", „jeden dopis",
  „pošlu ti jednu zprávu". Pošleme jich víc — nelži.
• Žádné „naučíš se", „získáš tipy", „pomůže ti", „dozvíš se víc".
  Marketingová generika.
• Žádné „bez kurzu", „bez webináře", „bez spamu" — bránění se
  obviněním, která ještě nepadla, vzbuzuje podezření.
• Nezmiňuj přesný čas doručení („do minuty", „za 60 sekund").
  Cesta není zásilka.

NLP techniky, které používej:
• Presupozice: „až půjdeš tou cestou" (ne „pokud"), „až dojdeš"
  (ne „kdybys došel"). Předpokládáš, že to udělá.
• Embedded command: „uvidíš", „všimneš si", „pochopíš", „ucítíš".
• Open loop: pojmenuj jednu konkrétní věc, kterou na cestě potká
  („jednu otázku", „jeden bod", „tři okamžiky"), ale neprozraď ji.
• Návaz na headline: sub musí slíbit cestu, která přesně odpovídá
  na otázku z headline.

✅ Příklady dobrého sub (přesně tenhle tvar — „provedu tě cestou"):

„Pošli mi sem tvoje jméno a email a provedu tě cestou, kde uvidíš,
odkud ten hlas v hlavě vzal sílu — a komu doopravdy patří."

„Pošli mi sem jméno a email a vezmu tě krok po kroku k tomu místu,
kde ten šepot ve tři ráno přestane mít navrch."

„Pošli mi sem jméno a email a ukážu ti cestu, na které najdeš
jednu otázku. Až si na ni odpovíš, ten kruh, ve kterém se točíš,
povolí."`
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

Only call the send_insight tool after you can answer those four. One try. No preamble.`
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

  // Retry up to 3 times before falling back. tool_use guarantees the
  // SHAPE of the response, but Opus can still emit malformed JSON
  // inside the tool_use argument blob (Anthropic SDK throws SyntaxError
  // before we see it). One retry with a fresh sample usually succeeds —
  // model variability is on our side here.
  const MAX_ATTEMPTS = 3
  let lastErr: any = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
   try {
    const client = new Anthropic({ apiKey })
    // Use tool_use to force structured output. With plain text JSON the
    // model would occasionally emit unescaped quotes inside string
    // values (Czech „" mixing with JSON ASCII "), or stray newlines,
    // breaking JSON.parse. The tool API gives us validated, parsed
    // arguments with zero string surgery.
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
      tools: [{
        name: "send_insight",
        description: "Send the 3-sentence insight, headline, and sub line to the reader.",
        input_schema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "3 sentences (max 4) in spoken Czech. Tykání. Last sentence is a short open question. Connects past to current feeling. No gender slashes.",
            },
            headline: {
              type: "string",
              description: "5–9 words. A curious open question that hooks them.",
            },
            sub: {
              type: "string",
              description: "18–28 words. EXACT shape: 'Pošli mi sem tvoje jméno a email a provedu tě cestou, kde [outcome tied to headline].' Guide-with-a-lamp voice. NEVER promise email count ('jeden mail'), NEVER state delivery time, NEVER use marketing generics ('naučíš se', 'získáš tipy').",
            },
          },
          required: ["message", "headline", "sub"],
        },
      }],
      tool_choice: { type: "tool", name: "send_insight" },
      messages: [{ role: "user", content: buildUserPrompt(path, texts, locale) }],
    })

    // With tool_choice forced to a specific tool, Anthropic guarantees
    // the response contains exactly one tool_use block with parsed
    // arguments — no string surgery needed.
    const toolUse = (resp.content || []).find((b: any) => b?.type === "tool_use") as any
    const parsed = toolUse?.input || {}
    if (!parsed.message || !parsed.headline || !parsed.sub) {
      throw new Error(`incomplete_tool_response: keys=${Object.keys(parsed).join(",")}, stop_reason=${resp.stop_reason}`)
    }

    cacheSet(cacheKey, parsed)
    res.json({ ...parsed, cached: false, attempt })
    return
   } catch (err: any) {
    lastErr = err
    console.warn(`[ai-insight] attempt ${attempt}/${MAX_ATTEMPTS} failed:`, {
      message: err?.message,
      name: err?.name,
    })
    if (attempt === MAX_ATTEMPTS) break
    // Small backoff before retry — model sampling is the variability,
    // a brief wait also lets transient API blips clear.
    await new Promise((r) => setTimeout(r, 250))
   }
  }

  // All attempts exhausted — log the final error and return the
  // deterministic fallback so the popup never shows a broken state.
  console.error("[ai-insight] all attempts failed, returning fallback:", {
    message: lastErr?.message,
    name: lastErr?.name,
    status: lastErr?.status,
    type: lastErr?.type,
    path,
    texts: texts.map((t: string) => (t || "").slice(0, 60)),
    locale,
  })
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
