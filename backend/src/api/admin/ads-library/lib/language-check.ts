// @ts-nocheck
/**
 * Language gate for text baked INTO a generated image.
 *
 * Why this exists: the image model does the translating as well as the
 * typesetting, and translating is not what it is good at. Two real failures we
 * shipped before this existed:
 *   - a Slovak ad reading "nedostatečná" (Czech ě — Slovak has no such letter)
 *   - a Slovak ad whose whole headline came out in SLOVENIAN
 *     ("Še vedno se utapljam v žalosti")
 * Nothing looked at the picture afterwards, so both went straight to the
 * library and would have gone to Meta.
 *
 * Two tiers, cheapest first:
 *   1. alphabetErrors() — pure regex, no API call. Each language has letters
 *      that simply do not occur in it, so a single character is proof. This
 *      alone catches the "nedostatečná" class with certainty and costs nothing.
 *   2. checkImageLanguage() — a vision model transcribes the image and judges
 *      whether the text is the target language and grammatically correct.
 *      Measured on the four real creatives above: 4/4 transcribed correctly
 *      including brush-script diacritics, both bad ones flagged, no false alarm.
 */

import Anthropic from "@anthropic-ai/sdk"

/**
 * Letters that do NOT occur in each language. One hit is decisive — this is
 * not a heuristic, `ě` in Slovak text is always wrong.
 *
 * Deliberately conservative for DE / FR / NL: those borrow accented vowels in
 * loanwords (Café, à la carte), so only unmistakably foreign letters are listed
 * — a false alarm that blocks a good ad is worse than a miss the vision tier
 * will catch anyway.
 *
 * Note SE vs NO: Swedish is ä/ö and has no æ/ø, Norwegian is the exact mirror.
 * Those two projects are the pair most likely to be crossed.
 */
/**
 * The prompt is written in English, so the language MUST be named in English.
 * Passing the Czech `langName` ("slovenština") made the model read it as
 * SLOVENIAN — it then passed a genuinely Slovenian headline in a Slovak ad and
 * rejected correct Slovak. Caught only because the gate was tested against
 * known-good and known-bad creatives before shipping.
 */
export const LANG_EN: Record<string, string> = {
  CZ: "Czech", SK: "Slovak", PL: "Polish", HU: "Hungarian", DE: "German",
  FR: "French", NL: "Dutch", SE: "Swedish", NO: "Norwegian (Bokmål)",
}

const SLAVIC_HU = "čšžřěůďťňĺľŕôőű"
const POLISH = "ąćęłńśźż"
const NORDIC = "åæø"

export const FOREIGN_LETTERS: Record<string, string> = {
  CZ: POLISH + "äĺľŕôőűßöüàâçèêëîïœùû" + NORDIC,
  SK: "ěřů" + POLISH + "őűßöüàâçèêëîïœùû" + NORDIC,
  PL: "áčďéěíňřšťúůýžäĺľŕôőűßöüàâçèêëîïœùû" + NORDIC,
  HU: "čšžřěůďťňĺľŕôä" + POLISH + "ßàâçèêëîïœùû" + NORDIC,
  DE: SLAVIC_HU + POLISH + NORDIC,
  FR: SLAVIC_HU + POLISH + "ß" + "åø",
  NL: SLAVIC_HU + POLISH + "ß" + NORDIC,
  SE: SLAVIC_HU + POLISH + "ßæø",
  NO: SLAVIC_HU + POLISH + "ßäö",
}

/**
 * Deterministic first pass. Returns one message per offending letter found,
 * naming the letter and the word it sits in so a retry prompt can quote it.
 */
export function alphabetErrors(text: string, lang: string): string[] {
  const forbidden = FOREIGN_LETTERS[String(lang || "").toUpperCase()]?.normalize("NFC")
  if (!forbidden || !text) return []
  const hits = new Map<string, Set<string>>()
  // NFC both sides: "ě" can arrive either precomposed (U+011B) or as "e" plus a
  // combining caron, and the two do not compare equal. Without this the whole
  // check silently passes everything.
  const words = String(text).normalize("NFC").split(/\s+/)
  for (const word of words) {
    for (const ch of word.toLowerCase()) {
      if (forbidden.includes(ch)) {
        if (!hits.has(ch)) hits.set(ch, new Set())
        hits.get(ch)!.add(word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""))
      }
    }
  }
  return [...hits.entries()].map(
    ([ch, ws]) => `písmeno "${ch}" v ${lang} neexistuje — je v: ${[...ws].slice(0, 3).join(", ")}`
  )
}

export type LanguageVerdict = {
  /** true = image may ship; false = regenerate; null = check unavailable */
  ok: boolean | null
  /** everything the model read in the image, verbatim */
  text: string
  /** concrete, quotable problems — fed into the next attempt's prompt */
  errors: string[]
  usage: { model: string; input: number; output: number } | null
}

const VERIFY_MODEL = process.env.TEXT_VERIFY_MODEL || "claude-haiku-4-5-20251001"

function buildQuestion(opts: { langName: string; lang: string; expect?: string[]; mode?: string }): string {
  const code = String(opts.lang).toUpperCase()
  // English name only — see the note on LANG_EN.
  const langName = LANG_EN[code] || opts.langName

  // Wording matters more than model size here. Measured on four real Slovak
  // creatives (three of them genuinely defective): the first draft — "is the
  // text in {langName}?" — scored 2/4 even on Opus, because the model treats a
  // near-language as close enough. Naming the reviewer's role, warning that the
  // neighbouring language looks similar, and making a SINGLE foreign word
  // disqualifying took Haiku, Sonnet 5 and Opus 5 all to 4/4. Haiku is used
  // because it matched the big models at roughly a third of the tokens.
  const lines = [
    `You are a native ${langName} proofreader checking an advertisement before it goes live.`,
    ``,
    `Transcribe EVERY piece of text visible in the image, exactly as printed — character for character, including every diacritic. Do not translate it, do not correct it.`,
    ``,
    `Then decide, strictly:`,
    `1. Is ALL of the text in ${langName}? Not a neighbouring language, not the source language, not a mix. Related languages look alike — check the actual word forms and endings, not just the letters.`,
    `2. Is it correct, standard ${langName} that a native speaker would write — right declension, gender agreement and diacritics?`,
  ]
  // Deliberately NO list of forbidden letters here — that check is a regex and
  // lives in alphabetErrors(). Measured: including it in the prompt made the
  // model verify LETTERS instead of word forms, and it then waved through a
  // whole headline in a neighbouring language (which uses no foreign letters at
  // all). Without the list the same model catches it 5 times out of 5.
  if (opts.mode === "swap" && opts.expect?.length) {
    lines.push(`3. The book cover must read exactly: ${opts.expect.map((e) => `"${e}"`).join(" and ")}.`)
  } else if (opts.mode !== "swap") {
    lines.push(`3. There must be no book or book cover presented as the advertised product.`)
  }
  lines.push(
    ``,
    `If even a single word is from another language or misspelled, ok is false.`,
    `Reply with JSON only, no prose, no code fence:`,
    `{"text":"<everything you read>","ok":true|false,"errors":["<one concrete problem per entry, quoting the offending word>"]}`
  )
  return lines.join("\n")
}

/**
 * Read the generated image back and judge it. Never throws — on any transport
 * or parsing failure it returns ok:null, which the caller treats as "could not
 * check" and lets the image through rather than burning retries on our own
 * outage.
 */
export async function checkImageLanguage(opts: {
  imageB64: string
  mime: string
  lang: string
  langName: string
  /** book swap: the exact strings that must appear on the cover */
  expect?: string[]
  mode?: string
}): Promise<LanguageVerdict> {
  const key = (process.env.ANTHROPIC_API_KEY || "").trim()
  if (!key) return { ok: null, text: "", errors: [], usage: null }

  // Two independent judgements, and ONE "no" is enough to reject.
  //
  // The borderline case — a whole headline in a neighbouring language — is not
  // stable on a single call: the same image and wording came back rejected in
  // one run and accepted in the next. The two failure modes are not equally
  // expensive, though. A false alarm costs one extra image generation; a miss
  // ships a foreign-language ad to Meta. So the gate is deliberately biased
  // towards rejecting.
  const votes = await Promise.all([runOne(key, opts), runOne(key, opts), runOne(key, opts)])

  const usage = votes.some((v) => v.usage)
    ? {
        model: VERIFY_MODEL,
        input: votes.reduce((n, v) => n + (v.usage?.input || 0), 0),
        output: votes.reduce((n, v) => n + (v.usage?.output || 0), 0),
      }
    : null
  const text = votes.find((v) => v.text)?.text || ""

  const rejected = votes.filter((v) => v.ok === false)
  const passed = votes.filter((v) => v.ok === true)
  // no usable verdict at all → "could not check"; letting it through beats
  // burning two more generations on our own outage
  if (!rejected.length && !passed.length) return { ok: null, text, errors: [], usage }
  // A null vote (unparseable answer) is NOT a pass — it is a missing vote.
  // Counting it as one used to let a rejected image through whenever the other
  // call happened to return malformed JSON.
  const ok = rejected.length === 0
  return { ok, text, errors: ok ? [] : dedupe(rejected.flatMap((v) => v.errors)).slice(0, 6), usage }
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>()
  return list.filter((e) => {
    const k = e.toLowerCase().slice(0, 40)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** One judgement. Never throws — ok:null means "this call could not decide". */
async function runOne(key: string, opts: any): Promise<LanguageVerdict> {
  try {
    const client = new Anthropic({ apiKey: key, timeout: 120_000, maxRetries: 2 })
    const msg = await client.messages.create({
      model: VERIFY_MODEL,
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: String(opts.mime).includes("png") ? "image/png" : "image/jpeg", data: opts.imageB64 } },
          { type: "text", text: buildQuestion(opts) },
        ],
      }],
    })
    const raw = msg.content.map((c: any) => c.text || "").join("").trim()
    const usage = { model: VERIFY_MODEL, input: msg.usage?.input_tokens || 0, output: msg.usage?.output_tokens || 0 }

    const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim()
    let parsed: any
    try {
      parsed = JSON.parse(json)
    } catch {
      return { ok: null, text: raw.slice(0, 500), errors: [], usage }
    }

    const text = String(parsed.text || "")
    const errors = Array.isArray(parsed.errors) ? parsed.errors.map(String).slice(0, 8) : []
    // deterministic pass over what was read — overrides an ok:true
    const alpha = alphabetErrors(text, opts.lang)
    const ok = parsed.ok === true && alpha.length === 0
    return { ok, text, errors: ok ? [] : [...alpha, ...errors], usage }
  } catch (e: any) {
    return { ok: null, text: "", errors: [`kontrola jazyka selhala: ${String(e?.message).slice(0, 120)}`], usage: null }
  }
}

/**
 * Last-resort helper for the final attempt: hand the wrong text to a language
 * model and get back what it should have said. The image model is then told to
 * copy that string verbatim instead of translating anything itself — which is
 * the whole point, since translating is the part it gets wrong.
 *
 * Returns null when unavailable, so the caller just skips the escalation.
 */
export async function correctText(opts: {
  text: string
  langName: string
  errors: string[]
  /** model to use — defaults to the same cheap one as the check */
  modelId?: string
}): Promise<string | null> {
  const key = (process.env.ANTHROPIC_API_KEY || "").trim()
  if (!key || !opts.text.trim()) return null
  try {
    const client = new Anthropic({ apiKey: key, timeout: 60_000, maxRetries: 1 })
    const msg = await client.messages.create({
      model: opts.modelId || VERIFY_MODEL,
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `This text was printed on an advertisement that must be in ${opts.langName}, but it is wrong:

${opts.text}

${opts.errors.length ? `Problems found:\n- ${opts.errors.join("\n- ")}\n\n` : ""}Rewrite it in correct, natural, standard ${opts.langName}. Keep the same meaning, the same tone and roughly the same length — it has to fit the same space on the image. Keep the line breaks where they are.

Reply with the corrected text and nothing else. No explanation, no quotes around it.`,
      }],
    })
    const out = msg.content.map((c: any) => c.text || "").join("").trim()
    return out || null
  } catch {
    return null
  }
}

/** Human-readable one-liner for the job log / the library warning badge. */
export function verdictLabel(v: LanguageVerdict, langName: string): string {
  if (v.ok === null) return "jazyk neověřen"
  if (v.ok) return `jazyk ✅ ${langName}`
  return `jazyk ❌ ${v.errors[0] || "nesouhlasí"}`
}
