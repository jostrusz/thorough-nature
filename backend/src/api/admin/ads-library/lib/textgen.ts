// @ts-nocheck
import Anthropic from "@anthropic-ai/sdk"
import { PROJECT_CONTEXT } from "./project-context"
import { PAGE_CONTEXT } from "./page-context"
import { hasRate, rateLabel, type Usage } from "./pricing"
import { HUMANIZER_RULES, buildHumanizerPrompt } from "./humanizer-rules"
import { AD_TEMPLATES } from "./ad-templates"
import { HEADLINE_FORMULAS, HEADLINE_HUMANIZER, HEADLINE_MAX } from "./headline-rules"

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
7. URL FORMÁT: každou adresu cílového projektu piš PŘESNĚ ve tvaru
   https://www.${ctx.domain} — vždy s https:// a vždy s www. Nikdy ne holé
   „${ctx.domain}" ani „www.${ctx.domain}" bez protokolu.

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
    return JSON.parse(repairJson(raw))
  }
}

/**
 * Models occasionally break JSON in two ways: literal newlines inside strings,
 * and unescaped double quotes inside the text itself (very common with ad copy
 * that quotes a thought or a book title). A quote only really closes a string
 * when the next non-space char is a structural one — otherwise it belongs to
 * the content and gets escaped.
 */
function repairJson(raw: string): string {
  let out = "", inStr = false, escaped = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (escaped) { out += ch; escaped = false; continue }
    if (ch === "\\") { out += ch; escaped = inStr; continue }
    if (ch === '"') {
      if (!inStr) { inStr = true; out += ch; continue }
      const next = raw.slice(i + 1).match(/^\s*(.)/)?.[1]
      if (next === undefined || next === "," || next === "]" || next === "}" || next === ":") {
        inStr = false; out += ch // genuinely closes the string
      } else {
        out += '\\"' // quote inside the content
      }
      continue
    }
    if (inStr && ch === "\n") { out += "\\n"; continue }
    if (inStr && ch === "\r") continue
    if (inStr && ch === "\t") { out += "\\t"; continue }
    out += ch
  }
  return out
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

/**
 * Ads must always link as https://www.<domain> — models occasionally emit the
 * bare domain or drop the protocol, so the format is enforced here too, not
 * just in the prompt. Only the project's own domain is touched (advertorial
 * and foreign domains stay as written).
 */
export function normalizeProjectUrls(text: string, domain: string): string {
  if (!text || !domain) return text
  const esc = domain.replace(/\./g, "\\.")
  return text.replace(new RegExp(`(?:https?://)?(?:www\\.)?${esc}`, "gi"), `https://www.${domain}`)
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

  primaries = primaries.map((t: string) => normalizeProjectUrls(t, ctx.domain))
  headlines = headlines.map((t: string) => normalizeProjectUrls(t, ctx.domain))
  return { primaries, headlines, usage, tells, prompt }
}

/**
 * Studio: write 5 primaries (one per proven template angle) + 5 viral
 * headlines for an uploaded image. Same two-pass shape as translateTexts —
 * generation with the anti-AI rules baked in, then the humanizer audit.
 */
export async function generateStudioTexts(opts: {
  modelId: string
  targetProject: string
  imageDescription: string
}): Promise<{ primaries: string[]; headlines: string[]; usage: Usage; tells: string[]; prompt: string; formulas: string[] }> {
  const ctx = PROJECT_CONTEXT[opts.targetProject]
  if (!ctx) throw new Error(`neznámý projekt: ${opts.targetProject}`)
  const page = PAGE_CONTEXT[opts.targetProject]
  const pageBlock = page ? `
KONTEXT CÍLOVÉ PRODEJNÍ STRÁNKY (${page.url}):
- Hlavní claim: ${page.claim}
- Slib stránky: ${page.promise}
- Cena knihy: ${page.price}
- Klíčová témata: ${(page.sections || []).join(" · ")}
` : ""
  const prompt = `Jsi senior copywriter pro přímý prodej knih na Facebooku. Napiš kompletní sadu reklamních textů v jazyce: ${ctx.langName} (${ctx.language}) k obrázku popsanému níže.

CÍLOVÝ PROJEKT:
- Kniha: „${ctx.book}" — autor ${ctx.author}
- Oslovení: ${ctx.address}
- Web: ${ctx.domain} (CTA odkaz: ${page?.url || `https://www.${ctx.domain}/`})
- Poznámky: ${ctx.notes || "—"}
${pageBlock}
OBRÁZEK REKLAMY (podle něj laď scénu, vypravěče i téma textů):
${opts.imageDescription}

VYPRAVĚČ — NEJDŮLEŽITĚJŠÍ PRAVIDLO:
- Pokud je na obrázku člověk (řádek PERSON výše), VŠECH 5 primaries i headlinů je psáno Z JEHO POHLEDU — jeho pohlaví, věk, jazyk a starosti. Muž ~25 mluví jako mladý chlap (rozchod, křivda, tlak okolí, přetlak v hlavě), žena ~55 svým hlasem (minulost, rodina, „takhle už to zůstane"). Vzory níže jsou psané ženou 50+ — vypravěče PŘEOBSAĎ na osobu z obrázku, strukturu a prodejní beats vzoru zachovej.
- Pokud člověk na obrázku není (PERSON: none), ponech vypravěče ze vzoru.

TÉMATA (vyber 1–2 na každý primary tak, aby seděla k osobě a scéně; žádné obecné „najdi klid"):
minulost, kterou člověk vleče · rozchod · nefunkční vztah s partnerem · úzkosti a přetlak myšlenek · křivda · pomluvy · rozbité vztahy v rodině · pocit, že „takhle už to zůstane".

HOOK (první 1–2 věty každého primary):
- Napiš NOVÝ, unikátní scroll-stopper na míru vypravěči a tématu — trochu kontroverzní, virální, vyvolá touhu dočíst. Neber úvod ze vzoru.
- Hook je VŽDY zpověď/přiznání vypravěče („Dva roky jsem všem lhal, že jsem v pohodě."), NIKDY výrok o čtenáři („Tvoje manželství je v troskách") — to Meta zamítá.
- Každý z 5 hooků jiný.

ZADÁNÍ:
1. Napiš PŘESNĚ 5 primary textů — každý podle JEDNOHO z pěti vzorů níže, ve stejném pořadí. Zachovej úhel, strukturu, rytmus a prodejní prvky vzoru, ale příběh přepiš do jazyka ${ctx.langName}, do perspektivy vypravěče z obrázku, do kontextu scény a do faktů cílového projektu (kniha, autor, cena, odkaz). Nekopíruj nizozemské reálie doslova.
2. Napiš PŘESNĚ 5 headlinů podle pravidel v sekci HEADLINY níže — z pohledu téhož vypravěče a k tématu obrázku.
3. Každý primary konči CTA s odkazem ${page?.url || `https://www.${ctx.domain}/`}.
4. Texty musí být spisovné a gramaticky bezchybné: správné skloňování, časování, pády, shoda, rody příčestí, konzistentní rod vypravěče, idiomatická stylistika jazyka ${ctx.langName}. Piš, jak se lidé mezi sebou reálně baví — žádná AI uhlazenost.

${HEADLINE_FORMULAS}

${HUMANIZER_RULES}

VZORY (NL originály — přebíráš úhel a styl, ne doslovný text):
${AD_TEMPLATES.map((t, i) => `━━━ VZOR ${i + 1} — ${t.name} ━━━\n${t.text}`).join("\n\n")}

Odpověz POUZE validním JSON. U každého headlinu uveď použitou formuli (how-to, otazka, socialni-dukaz, negativni-uhel, if-then, cena, srovnani):
{"primaries": ["...5 textů v pořadí vzorů..."], "headlines": ["...5 headlinů..."], "headline_formulas": ["...5 názvů formulí ve stejném pořadí..."]}`

  const p1 = await callLLM(opts.modelId, prompt)
  const out = parseJson(p1.text, p1.truncated)
  let primaries: string[] = out.primaries || []
  let headlines: string[] = out.headlines || []
  const formulas: string[] = out.headline_formulas || []
  let usage = p1.usage
  let tells: string[] = []

  try {
    const p2 = await callLLM(opts.modelId, buildHumanizerPrompt(
      ctx.langName, primaries, headlines, { headlineRules: HEADLINE_HUMANIZER }
    ))
    const fixed = parseJson(p2.text, p2.truncated)
    usage = sumUsage(usage, p2.usage)
    tells = Array.isArray(fixed.tells) ? fixed.tells.map(String).slice(0, 12) : []
    if ((fixed.primaries || []).length === primaries.length && (fixed.headlines || []).length === headlines.length) {
      primaries = fixed.primaries
      // a rewrite that busts the mobile truncation limit is worse than the
      // original AI-ish wording — keep whichever fits
      headlines = headlines.map((orig: string, i: number) => {
        const rewritten = String(fixed.headlines[i] ?? orig)
        if (rewritten.length <= HEADLINE_MAX || rewritten.length <= orig.length) return rewritten
        tells.push(`H${i + 1}: přepis měl ${rewritten.length} znaků (limit ${HEADLINE_MAX}) — ponechán původní`)
        return orig
      })
    }
  } catch (e: any) {
    console.warn(`[Ads Library] studio humanizer pass failed: ${e.message}`)
    tells = [`humanizer pass selhal: ${String(e.message).slice(0, 120)}`]
  }

  // report anything still over the limit so it is visible in the queue detail
  headlines.forEach((h: string, i: number) => {
    if (h.length > HEADLINE_MAX) tells.push(`H${i + 1} má ${h.length} znaků — na mobilu se ořízne`)
  })

  primaries = primaries.map((t: string) => normalizeProjectUrls(t, ctx.domain))
  headlines = headlines.map((t: string) => normalizeProjectUrls(t, ctx.domain))
  return { primaries, headlines, usage, tells, prompt, formulas }
}
