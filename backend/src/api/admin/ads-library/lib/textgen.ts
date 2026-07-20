// @ts-nocheck
import Anthropic from "@anthropic-ai/sdk"
import { PROJECT_CONTEXT } from "./project-context"
import { PAGE_CONTEXT } from "./page-context"
import { hasRate, rateLabel, type Usage } from "./pricing"
import { HUMANIZER_RULES, buildHumanizerPrompt } from "./humanizer-rules"

/**
 * Text adaptation via Anthropic (default) or OpenAI (when OPENAI_API_KEY set).
 * Every translation runs two passes automatically:
 *   1) translate with the anti-AI rules baked into the prompt
 *   2) humanizer audit — a fresh look that lists AI tells and rewrites them
 * Pass 2 is best-effort: if it fails, the pass-1 result ships as-is.
 */
export function textModels() {
  const hasOpenAI = !!(process.env.OPENAI_API_KEY || "").trim()
  const list = [
    { id: "claude-fable-5", label: "Claude Fable 5 — nejsilnější model", provider: "anthropic", available: !!(process.env.ANTHROPIC_API_KEY || "").trim() },
    { id: "claude-opus-4-8", label: "Claude Opus 4.8 — nejlepší copy", provider: "anthropic", available: !!(process.env.ANTHROPIC_API_KEY || "").trim() },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5 — rychlý", provider: "anthropic", available: !!(process.env.ANTHROPIC_API_KEY || "").trim() },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — nejlevnější", provider: "anthropic", available: !!(process.env.ANTHROPIC_API_KEY || "").trim() },
    { id: "gpt-5.6-sol", label: "GPT-5.6 sol — nejsilnější", provider: "openai", available: hasOpenAI },
    { id: "gpt-5.6-terra", label: "GPT-5.6 terra — vyvážený", provider: "openai", available: hasOpenAI },
    { id: "gpt-5.6-luna", label: "GPT-5.6 luna — levný", provider: "openai", available: hasOpenAI },
    { id: "gpt-5.4", label: "GPT-5.4", provider: "openai", available: hasOpenAI },
    { id: "gpt-5.4-mini", label: "GPT-5.4 mini — nejlevnější", provider: "openai", available: hasOpenAI },
  ]
  return list.map((m) => ({ ...m, priced: hasRate(m.id), rate: rateLabel(m.id) }))
}

function buildPrompt(src: any, ctx: any, page: any, primaries: string[], headlines: string[]) {
  const pageBlock = page ? `
KONTEXT CÍLOVÉ PRODEJNÍ STRÁNKY (${page.url}):
- Hlavní claim: ${page.claim}
- Slib stránky: ${page.promise}
- Cena knihy: ${page.price}
- Klíčová témata: ${(page.sections || []).join(" · ")}
Texty musí ladit s tímto claimem a slibem. Pokud reklama zmiňuje cenu, použij ${page.price}.
` : ""
  return `Jsi senior copywriter pro přímý prodej knih na Facebooku. Adaptuj následující reklamní texty do jazyka: ${ctx.langName} (${ctx.language}).

CÍLOVÝ PROJEKT:
- Kniha: „${ctx.book}" — autor ${ctx.author}
- Oslovení: ${ctx.address}
- Web: ${ctx.domain}
- Poznámky: ${ctx.notes || "—"}
${pageBlock}
PRAVIDLA:
1. NE doslovný překlad — nativní adaptace, jak mluví rodilý mluvčí na Facebooku.
2. Zachovej prodejní strukturu, hooky a emoce originálu.
3. Název knihy, URL a fakta nahraď údaji cílového projektu.
4. Délka zhruba jako originál. Headliny max ~40 znaků.
5. Žádné anglicismy, žádné AI fráze.
6. JAZYKOVÁ SPRÁVNOST (${ctx.langName}): text musí být gramaticky bezchybný —
   správné skloňování a časování, pády, shoda podmětu s přísudkem, správné
   rody přídavných jmen a příčestí, přirozený slovosled a idiomatická
   stylistika cílového jazyka. Rod vypravěče drž konzistentně celým textem
   (viz Oslovení výše — např. žena mluví v ženském rodě). Před odevzdáním si
   každou větu přečti očima rodilého korektora.

${HUMANIZER_RULES}

ZDROJOVÉ TEXTY (${src.language}):
${primaries.map((p: string, i: number) => `PRIMARY_${i + 1}: ${p}`).join("\n")}
${headlines.map((h: string, i: number) => `HEADLINE_${i + 1}: ${h}`).join("\n")}

Odpověz POUZE validním JSON:
{"primaries": ["..."], "headlines": ["..."]}`
}

function parseJson(text: string, truncated: boolean) {
  if (truncated) {
    throw new Error("odpověď AI byla oříznuta limitem tokenů — vyber méně textů, nebo to zkus znovu")
  }
  const s = text.indexOf("{"), e = text.lastIndexOf("}")
  if (s < 0 || e < 0) {
    throw new Error(`AI nevrátila JSON — začátek odpovědi: "${text.slice(0, 160)}"`)
  }
  const raw = text.slice(s, e + 1)
  try {
    return JSON.parse(raw)
  } catch {
    // models occasionally emit literal newlines inside JSON strings — escape
    // control chars that sit inside a string literal and retry once
    let out = "", inStr = false, escaped = false
    for (const ch of raw) {
      if (escaped) { out += ch; escaped = false; continue }
      if (ch === "\\") { out += ch; escaped = inStr; continue }
      if (ch === '"') { inStr = !inStr; out += ch; continue }
      if (inStr && ch === "\n") { out += "\\n"; continue }
      if (inStr && ch === "\r") { continue }
      if (inStr && ch === "\t") { out += "\\t"; continue }
      out += ch
    }
    return JSON.parse(out)
  }
}

/** One LLM call, provider-agnostic. Returns raw text + billed usage. */
async function callLLM(modelId: string, prompt: string): Promise<{ text: string; truncated: boolean; usage: Usage }> {
  const model = textModels().find((m) => m.id === modelId)
  const provider = model?.provider || "anthropic"

  if (provider === "openai") {
    const key = (process.env.OPENAI_API_KEY || "").trim()
    if (!key) throw new Error("OPENAI_API_KEY není nastaven")
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(`[OpenAI] ${json?.error?.message || res.status}`)
    const choice = json.choices?.[0]
    return {
      text: choice?.message?.content || "",
      truncated: choice?.finish_reason === "length",
      usage: {
        model: modelId,
        input: json.usage?.prompt_tokens || 0,
        output: json.usage?.completion_tokens || 0,
        cachedInput: json.usage?.prompt_tokens_details?.cached_tokens || 0,
      },
    }
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  // streaming, because the SDK refuses non-streaming requests whose max_tokens
  // implies a >10min worst case (Fable's 24k budget trips that check)
  const stream = client.messages.stream({
    model: modelId,
    // 5 long primaries + 5 headlines can easily exceed 2500 output tokens —
    // a truncated response has no closing brace and used to surface as the
    // confusing "AI nevrátila JSON". Fable 5 always thinks, and those tokens
    // count against max_tokens too, so it gets a bigger budget.
    max_tokens: modelId === "claude-fable-5" ? 24000 : 8000,
    messages: [{ role: "user", content: prompt }],
  })
  const msg = await stream.finalMessage()
  return {
    text: (msg.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n"),
    truncated: msg.stop_reason === "max_tokens",
    usage: { model: modelId, input: msg.usage?.input_tokens || 0, output: msg.usage?.output_tokens || 0 },
  }
}

const sumUsage = (a: Usage, b: Usage): Usage => ({
  model: a.model,
  input: (a.input || 0) + (b.input || 0),
  output: (a.output || 0) + (b.output || 0),
  cachedInput: (a.cachedInput || 0) + (b.cachedInput || 0),
})

export async function translateTexts(opts: {
  modelId: string
  src: any
  targetProject: string
  primaries: string[]
  headlines: string[]
}): Promise<{ primaries: string[]; headlines: string[]; usage: Usage; tells: string[]; prompt: string }> {
  const ctx = PROJECT_CONTEXT[opts.targetProject]
  if (!ctx) throw new Error(`neznámý projekt: ${opts.targetProject}`)
  const prompt = buildPrompt(opts.src, ctx, PAGE_CONTEXT[opts.targetProject], opts.primaries, opts.headlines)

  // ── pass 1: translate (rules are part of the prompt) ──
  const p1 = await callLLM(opts.modelId, prompt)
  const out = parseJson(p1.text, p1.truncated)
  let primaries: string[] = out.primaries || []
  let headlines: string[] = out.headlines || []
  let usage = p1.usage
  let tells: string[] = []

  // ── pass 2: automatic humanizer audit + rewrite (best-effort) ──
  try {
    const p2 = await callLLM(opts.modelId, buildHumanizerPrompt(ctx.langName, primaries, headlines))
    const fixed = parseJson(p2.text, p2.truncated)
    usage = sumUsage(usage, p2.usage)
    tells = Array.isArray(fixed.tells) ? fixed.tells.map(String).slice(0, 12) : []
    // only adopt the rewrite when it kept the shape — a dropped text would be
    // worse than a leftover AI-ism
    if ((fixed.primaries || []).length === primaries.length && (fixed.headlines || []).length === headlines.length) {
      primaries = fixed.primaries
      headlines = fixed.headlines
    } else if (tells.length) {
      tells.push("(přepis zahodil část textů — ponechána verze z 1. průchodu)")
    }
  } catch (e: any) {
    console.warn(`[Ads Library] humanizer pass failed (using pass-1 result): ${e.message}`)
    tells = [`humanizer pass selhal: ${String(e.message).slice(0, 120)}`]
  }

  return { primaries, headlines, usage, tells, prompt }
}
