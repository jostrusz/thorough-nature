// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../../modules/marketing/service"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id

    const [form] = await service.listMarketingForms({ id })
    if (!form) {
      res.status(404).json({ error: "not_found" })
      return
    }

    const [brand] = await service.listMarketingBrands({ id: (form as any).brand_id })
    const brandSlug = brand ? (brand as any).slug : "unknown"

    const baseUrl =
      process.env.MARKETING_PUBLIC_BASE_URL ||
      "https://www.marketing-hq.eu"

    const script_snippet =
      `<script async src="${baseUrl}/public/marketing/marketing-forms.js" ` +
      `data-brand="${brandSlug}" data-form="${id}" data-api="${baseUrl}"></script>`

    const form_config = {
      id,
      brand_id: (form as any).brand_id,
      brand_slug: brandSlug,
      slug: (form as any).slug,
      name: (form as any).name,
      type: (form as any).type,
      fields: (form as any).fields,
      styling: (form as any).styling,
      config: (form as any).config,
      success_action: (form as any).success_action,
      consent_text: (form as any).consent_text,
      double_opt_in: (form as any).double_opt_in,
      target_list_ids: (form as any).target_list_ids,
      target_segment_id: (form as any).target_segment_id,
      status: (form as any).status,
    }

    res.json({ script_snippet, form_config })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
