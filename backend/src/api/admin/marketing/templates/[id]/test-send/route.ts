// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../../modules/marketing/service"
import { compileTemplate } from "../../../../../../modules/marketing/utils/template-compiler"
import { ResendMarketingClient } from "../../../../../../modules/marketing/services/resend-client"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    const body = (req.body as any) || {}

    if (!body.to_email) {
      res.status(400).json({ error: "to_email is required" })
      return
    }
    if (!body.brand_id) {
      res.status(400).json({ error: "brand_id is required" })
      return
    }

    const [template] = await service.listMarketingTemplates({ id })
    if (!template) {
      res.status(404).json({ error: "template_not_found" })
      return
    }

    const [brand] = await service.listMarketingBrands({ id: body.brand_id })
    if (!brand) {
      res.status(404).json({ error: "brand_not_found" })
      return
    }

    const contactDummy = {
      first_name: "Test",
      last_name: "User",
      email: body.to_email,
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
        brand: {
          name: (brand as any).display_name,
          from_email: (brand as any).marketing_from_email,
        },
        unsubscribe_url: "https://example.com/unsubscribe/TEST",
        preferences_url: "https://example.com/preferences/TEST",
      }
    )

    const fromName = (template as any).from_name || (brand as any).marketing_from_name
    const fromEmail = (template as any).from_email || (brand as any).marketing_from_email
    const replyTo = (template as any).reply_to || (brand as any).marketing_reply_to

    const from = `${fromName} <${fromEmail}>`

    const client = new ResendMarketingClient(brand as any)
    const result = await client.send({
      from,
      to: body.to_email,
      subject: `[TEST] ${compiled.subject}`,
      html: compiled.html,
      text: compiled.text,
      replyTo: replyTo || undefined,
    })

    if (!result.ok) {
      res.status(500).json({ ok: false, error: result.error || "send_failed" })
      return
    }

    res.json({ ok: true, resend_id: result.resend_id })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
