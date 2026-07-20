// @ts-nocheck
import Anthropic from "@anthropic-ai/sdk"
import { PROJECT_CONTEXT } from "./project-context"

/**
 * Text adaptation via Anthropic (default) or OpenAI (when OPENAI_API_KEY set).
 */
export function textModels() {
  const list = [
    { id: "claude-opus-4-8", label: "Claude Opus 4.8 — nejlepší copy", provider: "anthropic", available: !!(process.env.ANTHROPIC_API_KEY || "").trim() },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5 — rychlý", provider: "anthropic", available: !!(process.env.ANTHROPIC_API_KEY || "").trim() },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — nejlevnější", provider: "anthropic", available: !!(process.env.ANTHROPIC_API_KEY || "").trim() },
    { id: "gpt-4o", label: "GPT-4o (OpenAI)", provider: "openai", available: !!(process.env.OPENAI_API_KEY || "").trim() },
    { id: "gpt-4o-mini", label: "GPT-4o mini (OpenAI)", provider: "openai", available: !!(process.env.OPENAI_API_KEY || "").trim() },
  ]
  return list
}

function buildPrompt(src: any, ctx: any, primaries: string[], headlines: string[]) {
  return `Jsi senior copywriter pro přímý prodej knih na Facebooku. Adaptuj následující reklamní texty do jazyka: ${ctx.langName} (${ctx.language}).

CÍLOVÝ PROJEKT:
- Kniha: „${ctx.book}" — autor ${ctx.author}
- Oslovení: ${ctx.address}
- Web: ${ctx.domain}
- Poznámky: ${ctx.notes || "—"}

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

function parseJson(text: string) {
  const s = text.indexOf("{"), e = text.lastIndexOf("}")
  if (s < 0 || e < 0) throw new Error("AI nevrátila JSON")
  return JSON.parse(text.slice(s, e + 1))
}

export async function translateTexts(opts: {
  modelId: string
  src: any
  targetProject: string
  primaries: string[]
  headlines: string[]
}): Promise<{ primaries: string[]; headlines: string[] }> {
  const ctx = PROJECT_CONTEXT[opts.targetProject]
  if (!ctx) throw new Error(`neznámý projekt: ${opts.targetProject}`)
  const prompt = buildPrompt(opts.src, ctx, opts.primaries, opts.headlines)
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
    const out = parseJson(json.choices?.[0]?.message?.content || "")
    return { primaries: out.primaries || [], headlines: out.headlines || [] }
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const msg = await client.messages.create({
    model: opts.modelId,
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  })
  const out = parseJson(msg.content?.[0]?.text || "")
  return { primaries: out.primaries || [], headlines: out.headlines || [] }
}
