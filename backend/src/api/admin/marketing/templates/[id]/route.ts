// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"

const UPDATABLE_FIELDS = [
  "name",
  "subject",
  "preheader",
  "from_name",
  "from_email",
  "reply_to",
  "block_json",
  "custom_html",
  "editor_type",
  "status",
  "metadata",
]

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    const [template] = await service.listMarketingTemplates({ id })
    if (!template) {
      res.status(404).json({ error: "not_found" })
      return
    }
    res.json({ template })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    const body = (req.body as any) || {}

    const [existing] = await service.listMarketingTemplates({ id })
    if (!existing) {
      res.status(404).json({ error: "not_found" })
      return
    }

    const update: any = { id }
    for (const key of UPDATABLE_FIELDS) {
      if (key in body) update[key] = body[key]
    }

    const nextVersion = ((existing as any).version || 1) + 1
    update.version = nextVersion

    const template = await service.updateMarketingTemplates(update)

    // snapshot version
    try {
      await service.createMarketingTemplateVersions({
        template_id: id,
        brand_id: (existing as any).brand_id,
        version: nextVersion,
        subject: (template as any).subject,
        preheader: (template as any).preheader ?? "",
        from_name: (template as any).from_name ?? null,
        from_email: (template as any).from_email ?? null,
        reply_to: (template as any).reply_to ?? null,
        block_json: (template as any).block_json ?? null,
        custom_html: (template as any).custom_html ?? null,
        compiled_html: (template as any).compiled_html ?? null,
        compiled_text: (template as any).compiled_text ?? null,
        editor_type: (template as any).editor_type ?? "blocks",
        created_by: body.created_by ?? null,
        changelog: body.changelog ?? null,
      })
    } catch (e) {
      // version snapshot failure should not break the update
    }

    res.json({ template })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    await service.deleteMarketingTemplates(id)
    res.status(200).json({ id, deleted: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
