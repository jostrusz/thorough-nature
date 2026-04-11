import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../../modules/marketing/service"
import { ResendMarketingClient } from "../../../../../../modules/marketing/services/resend-client"

/**
 * POST /admin/marketing/brands/:id/test-send
 * Body: { to: "email@example.com" }
 *
 * Sends a minimal test email from the brand's marketing-from address via
 * the ResendMarketingClient. This verifies that:
 *   - the brand row is configured correctly
 *   - the marketing Resend API key resolves
 *   - the marketing subdomain is verified
 *   - the send flow is independent of the transactional email module
 *
 * It does NOT create a contact or a campaign — it just records the send
 * as a marketing_message for audit visibility.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    const body = (req.body as any) || {}
    const to = String(body.to || "").trim().toLowerCase()

    if (!to || !/^.+@.+\..+$/.test(to)) {
      res.status(400).json({ error: "valid 'to' email is required" })
      return
    }

    const [brand] = await service.listMarketingBrands({ id })
    if (!brand) {
      res.status(404).json({ error: "brand not found" })
      return
    }

    const client = new ResendMarketingClient({
      id: brand.id,
      slug: (brand as any).slug,
      resend_api_key_encrypted: (brand as any).resend_api_key_encrypted,
    })

    const from = `${(brand as any).marketing_from_name} <${(brand as any).marketing_from_email}>`
    const subject = `Test email from ${(brand as any).display_name}`
    const html = `
      <!doctype html><html><body style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 40px auto; color: #111;">
        <h1 style="font-size:20px">Test email from ${(brand as any).display_name}</h1>
        <p style="line-height:1.55;color:#444">
          This is a Phase 0 smoke test of the marketing module. If you are reading this,
          the marketing Resend client can send from <strong>${(brand as any).marketing_from_email}</strong>
          without going through the transactional Medusa notification provider.
        </p>
        <p style="color:#888;font-size:12px">brand_id: ${brand.id}</p>
      </body></html>
    `.trim()

    const sendResult = await client.send({
      to,
      from,
      replyTo: (brand as any).marketing_reply_to ?? undefined,
      subject,
      html,
      text: `Test email from ${(brand as any).display_name}`,
      tags: [
        { name: "brand", value: (brand as any).slug },
        { name: "source", value: "admin-test-send" },
      ],
    })

    // Record the send in marketing_message (without a contact row — this is an ad-hoc test)
    const recorded = await service.createMarketingMessages({
      brand_id: brand.id,
      contact_id: null, // ad-hoc test send — no contact row
      to_email: to,
      from_email: (brand as any).marketing_from_email,
      subject_snapshot: subject,
      resend_email_id: sendResult.resend_id,
      status: sendResult.ok ? "sent" : "failed",
      sent_at: sendResult.ok ? new Date() : null,
      error: sendResult.ok ? null : sendResult.error,
      metadata: { source: "admin_test_send" },
    } as any)

    res.status(sendResult.ok ? 200 : 500).json({
      ok: sendResult.ok,
      message_id: (recorded as any).id,
      resend_id: sendResult.resend_id,
      error: sendResult.error,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
