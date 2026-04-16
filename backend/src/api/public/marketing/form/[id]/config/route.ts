// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../../modules/marketing/service"

/**
 * GET /public/marketing/form/:id/config
 *
 * Public endpoint used by the marketing-forms.js snippet (loaded from any
 * storefront origin) to fetch the config of a form for rendering.
 *
 * Returns only fields needed for client rendering — strips internal metrics,
 * timestamps and any admin-only data.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = String((req.params as any).id || "")
  if (!id) {
    res.status(400).json({ error: "missing_form_id" })
    return
  }

  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const [form] = await service.listMarketingForms({ id } as any)
    if (!form) {
      res.status(404).json({ error: "not_found" })
      return
    }

    // Load the brand for styling hints (logo, primary_color)
    const [brand] = await service.listMarketingBrands({ id: (form as any).brand_id } as any)

    // Return a safe subset for public consumption
    res.setHeader("Cache-Control", "public, max-age=60")
    res.json({
      form: {
        id: (form as any).id,
        brand_id: (form as any).brand_id,
        brand_slug: (brand as any)?.slug || null,
        slug: (form as any).slug,
        name: (form as any).name,
        type: (form as any).type,
        status: (form as any).status,
        config: (form as any).config || {},
        styling: (form as any).styling || {},
        custom_html: (form as any).custom_html || null,
        custom_css: (form as any).custom_css || null,
        fields: (form as any).fields || [{ name: "email", label: "Email", type: "email", required: true }],
        success_action: (form as any).success_action || { type: "message", value: "Thanks for subscribing!" },
        consent_text: (form as any).consent_text || null,
      },
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
