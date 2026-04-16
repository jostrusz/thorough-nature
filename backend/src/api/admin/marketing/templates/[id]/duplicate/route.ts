// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../../modules/marketing/service"

/**
 * POST /admin/marketing/templates/:id/duplicate
 * Creates a draft copy of the template with "(copy)" suffix. Does not copy
 * the version history.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = String((req.params as any).id || "")
  if (!id) {
    res.status(400).json({ error: "missing_id" })
    return
  }
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const [src] = await service.listMarketingTemplates({ id } as any)
    if (!src) {
      res.status(404).json({ error: "not_found" })
      return
    }
    const copy = await service.createMarketingTemplates({
      brand_id: (src as any).brand_id,
      name: `${(src as any).name} (copy)`,
      subject: (src as any).subject,
      preheader: (src as any).preheader,
      from_name: (src as any).from_name,
      from_email: (src as any).from_email,
      reply_to: (src as any).reply_to,
      block_json: (src as any).block_json,
      custom_html: (src as any).custom_html,
      compiled_html: null,
      compiled_text: null,
      editor_type: (src as any).editor_type,
      version: 1,
      status: "draft",
    } as any)
    res.json({ template: copy })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
