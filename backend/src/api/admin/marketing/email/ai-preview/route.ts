// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"
import { generateAiEmail } from "../../../../../modules/marketing/utils/ai-email-generator"

/**
 * POST /admin/marketing/email/ai-preview
 *
 * Dev / lab endpoint — generate one AI nurture email on-demand for a
 * fictional contact, without writing anything to DB and without sending
 * via Resend. Used by the "AI Email Lab" admin page so a marketer can
 * test how Sonnet (or Opus) would write an email for a given quiz
 * answer combination, without going through the full popup → flow run.
 *
 * Body:
 *   {
 *     brand_slug: "loslatenboek",
 *     first_name: "Anna",
 *     email: "anna@example.nl",                  // not used for sending, only personalization
 *     locale: "nl",                              // optional, falls back to brand.locale
 *     properties: {
 *       quiz_area: "relaties",                   // K1
 *       quiz_target: "parent",                   // K2
 *       quiz_trigger: "3am",                     // K3
 *       quiz_own_sentence: "Měla jsem být lepší dcera."  // K4 (no "custom:" prefix needed)
 *     },
 *     day_template: "day1" | "day2" | "day3",
 *     model?: "claude-sonnet-4-6" | "claude-opus-4-7" | "claude-haiku-4-5-20251001"
 *   }
 *
 * Response: { subject, preheader, html, blocks, model_used, generated_at }
 *
 * Returns 400 on missing fields, 500 on Anthropic / parsing errors.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const body = (req.body || {}) as any
    const brandSlug = String(body.brand_slug || "").trim()
    const dayTemplate = String(body.day_template || "day1") as "day1" | "day2" | "day3"
    const model = body.model ? String(body.model) : undefined

    if (!brandSlug) {
      return res.status(400).json({ error: "brand_slug is required" })
    }
    if (!["day1", "day2", "day3"].includes(dayTemplate)) {
      return res.status(400).json({ error: "day_template must be day1 | day2 | day3" })
    }

    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const [brand] = (await service.listMarketingBrands({ slug: brandSlug } as any)) as any[]
    if (!brand) {
      return res.status(404).json({ error: `brand "${brandSlug}" not found` })
    }

    const result = await generateAiEmail({
      contact: {
        first_name: body.first_name || "Anna",
        email: body.email || "preview@example.com",
        locale: body.locale || brand.locale || "nl",
        properties: body.properties || {},
      },
      brand: {
        id: brand.id,
        slug: brand.slug,
        display_name: brand.display_name,
        locale: brand.locale,
        brand_voice_profile: brand.brand_voice_profile,
        marketing_from_name: brand.marketing_from_name,
      },
      dayTemplate,
      model: model as any,
    })

    res.json(result)
  } catch (err: any) {
    res.status(500).json({
      error: err?.message || "ai_preview_failed",
      stack: process.env.NODE_ENV === "production" ? undefined : err?.stack,
    })
  }
}
