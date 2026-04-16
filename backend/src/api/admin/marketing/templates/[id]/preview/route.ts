// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../../modules/marketing/service"
import { compileTemplate } from "../../../../../../modules/marketing/utils/template-compiler"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    const body = (req.body as any) || {}

    const [template] = await service.listMarketingTemplates({ id })
    if (!template) {
      res.status(404).json({ error: "not_found" })
      return
    }

    const [brand] = await service.listMarketingBrands({ id: (template as any).brand_id })

    const contactDummy = {
      first_name: "Jane",
      last_name: "Doe",
      email: "preview@example.com",
      ...(body.contact || {}),
    }

    const brandDummy = {
      name: brand ? (brand as any).display_name : "Preview Brand",
      from_email: brand ? (brand as any).marketing_from_email : "preview@example.com",
      ...(brand || {}),
    }

    const compiled = compileTemplate(
      {
        subject: (template as any).subject,
        preheader: (template as any).preheader,
        editor_type: (template as any).editor_type,
        block_json: (template as any).block_json,
        custom_html: (template as any).custom_html,
      },
      {
        contact: contactDummy,
        brand: brandDummy,
        unsubscribe_url: "https://example.com/unsubscribe/PREVIEW",
        preferences_url: "https://example.com/preferences/PREVIEW",
      }
    )

    res.json({
      subject: compiled.subject,
      html: compiled.html,
      text: compiled.text,
      preheader: compiled.preheader,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
