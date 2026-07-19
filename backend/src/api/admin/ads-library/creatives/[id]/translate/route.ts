// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import Anthropic from "@anthropic-ai/sdk"
import { ADS_LIBRARY_MODULE } from "../../../../../../modules/ads-library"
import { PROJECT_CONTEXT } from "../../../lib/project-context"

/**
 * POST /admin/ads-library/creatives/:id/translate
 * Body: { target_project, primary_indexes?: number[], headline_indexes?: number[],
 *         save?: boolean }
 * Adapts the selected texts into the target project's language using project
 * context (book, persona, form of address). With save=true stores the result
 * as a new linked creative; otherwise returns a preview only.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const { target_project, primary_indexes, headline_indexes, save = false, edited } = (req.body || {}) as any

  const ctx = PROJECT_CONTEXT[target_project]
  if (!ctx) return res.status(400).json({ error: `unknown target_project: ${target_project}` })

  const [src] = await svc.listAdCreatives({ id: req.params.id })
  if (!src) return res.status(404).json({ error: "not_found" })

  // Saving pre-edited texts (second step after a preview)
  if (save && edited) {
    const created = await saveTranslation(svc, src, target_project, ctx, edited)
    return res.json({ creative: created, saved: true })
  }

  const pick = (arr: string[], idx?: number[]) =>
    (idx?.length ? idx.map((i) => arr?.[i]).filter(Boolean) : (arr || []))
  const primaries = pick(src.primary_texts, primary_indexes)
  const headlines = pick(src.headlines, headline_indexes)
  if (!primaries.length && !headlines.length) {
    return res.status(400).json({ error: "nothing selected to translate" })
  }

  const prompt = buildPrompt(src, ctx, primaries, headlines)
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const msg = await client.messages.create({
    model: process.env.MARKETING_AI_MODEL || "claude-opus-4-20250514",
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  })
  const text = msg.content?.[0]?.text || ""
  let out: any
  try {
    out = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1))
  } catch {
    return res.status(502).json({ error: "AI returned unparseable output", raw: text })
  }

  if (save) {
    const created = await saveTranslation(svc, src, target_project, ctx, out)
    return res.json({ creative: created, saved: true, translation: out })
  }
  res.json({ translation: out, saved: false })
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

async function saveTranslation(svc: any, src: any, targetProject: string, ctx: any, out: any) {
  // ensure the source has a family id
  let familyId = src.family_id
  if (!familyId) {
    familyId = src.id
    await svc.updateAdCreatives({ id: src.id, family_id: familyId })
  }
  return svc.createAdCreatives({
    name: `${src.name}-${ctx.language}`,
    project_id: targetProject,
    language: ctx.language,
    tag: "test",
    primary_texts: (out.primaries || []).slice(0, 5),
    headlines: (out.headlines || []).slice(0, 5),
    description_text: src.description_text,
    cta_type: src.cta_type,
    link_url: `https://www.${ctx.domain}/`,
    media_type: src.media_type,
    image_1x1_url: src.image_1x1_url,
    image_9x16_url: src.image_9x16_url,
    video_thumb_url: src.video_thumb_url,
    source: "translation",
    family_id: familyId,
    translated_from_id: src.id,
  })
}
