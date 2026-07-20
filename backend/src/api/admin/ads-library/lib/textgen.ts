// @ts-nocheck
import Anthropic from "@anthropic-ai/sdk"
import { PROJECT_CONTEXT } from "./project-context"
import { PAGE_CONTEXT } from "./page-context"
import { hasRate, rateLabel, type Usage } from "./pricing"

/**
 * Text adaptation via Anthropic (default) or OpenAI (when OPENAI_API_KEY set).
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
  return JSON.parse(text.slice(s, e + 1))
}

export async function translateTexts(opts: {
  modelId: string
  src: any
  targetProject: string
  primaries: string[]
  headlines: string[]
}): Promise<{ primaries: string[]; headlines: string[]; usage: Usage }> {
  const ctx = PROJECT_CONTEXT[opts.targetProject]
  if (!ctx) throw new Error(`neznámý projekt: ${opts.targetProject}`)
  const prompt = buildPrompt(opts.src, ctx, PAGE_CONTEXT[opts.targetProject], opts.primaries, opts.headlines)
  const model = textModels().find((m) => m.id === opts.modelId)
  const provider = model?.provider || "anthropic"

  if (provider === "openai") {
    const key = (process.env.OPENAI_API_KEY || "").trim()
    if (!key) throw new Error("OPENAI_API_KEY není nastaven")
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: opts.modelId,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(`[OpenAI] ${json?.error?.message || res.status}`)
    const choice = json.choices?.[0]
    const out = parseJson(choice?.message?.content || "", choice?.finish_reason === "length")
    return {
      primaries: out.primaries || [], headlines: out.headlines || [],
      usage: { model: opts.modelId, input: json.usage?.prompt_tokens || 0, output: json.usage?.completion_tokens || 0 },
    }
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const msg = await client.messages.create({
    model: opts.modelId,
    // 5 long primaries + 5 headlines can easily exceed 2500 output tokens —
    // a truncated response has no closing brace and used to surface as the
    // confusing "AI nevrátila JSON". Fable 5 always thinks, and those tokens
    // count against max_tokens too, so it gets a bigger budget.
    max_tokens: opts.modelId === "claude-fable-5" ? 24000 : 8000,
    messages: [{ role: "user", content: prompt }],
  })
  const text = (msg.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n")
  const out = parseJson(text, msg.stop_reason === "max_tokens")
  return {
    primaries: out.primaries || [], headlines: out.headlines || [],
    usage: { model: opts.modelId, input: msg.usage?.input_tokens || 0, output: msg.usage?.output_tokens || 0 },
  }
}
