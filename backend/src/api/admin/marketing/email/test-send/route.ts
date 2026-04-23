// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"
import { compileTemplate } from "../../../../../modules/marketing/utils/template-compiler"
import { ResendMarketingClient } from "../../../../../modules/marketing/services/resend-client"
import { getViewInBrowserStrings } from "../../../../../modules/marketing/utils/view-in-browser-i18n"
import { buildViewInBrowserUrl } from "../../../../../modules/marketing/utils/tracking-injector"
import { injectLegalFooter } from "../../../../../modules/marketing/utils/legal-footer"

/**
 * POST /admin/marketing/email/test-send
 *
 * Generic "send test email" endpoint used by:
 *   - campaign editor (single send draft)
 *   - flow email-node editor (per-node inline email)
 *
 * Body:
 *   {
 *     brand_id: string,
 *     to_email: string,
 *     subject: string,
 *     preheader?: string,
 *     from_name?: string,
 *     from_email?: string,
 *     reply_to?: string,
 *     html: string,            // already-authored HTML (editor_type=html)
 *   }
 *
 * Placeholders (first_name, unsubscribe_url, view_in_browser_*) are merged
 * using safe dummy values so the test render looks realistic.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const body = (req.body as any) || {}
    const toEmail = String(body.to_email || "").trim()
    const brandId = String(body.brand_id || "").trim()
    const subject = String(body.subject || "").trim()
    const html = String(body.html || "")

    if (!toEmail) { res.status(400).json({ error: "to_email is required" }); return }
    if (!brandId) { res.status(400).json({ error: "brand_id is required" }); return }
    if (!subject) { res.status(400).json({ error: "subject is required" }); return }
    if (!html)    { res.status(400).json({ error: "html is required" }); return }

    const [brand] = await service.listMarketingBrands({ id: brandId })
    if (!brand) { res.status(404).json({ error: "brand_not_found" }); return }

    const vib = getViewInBrowserStrings((brand as any).locale)
    // Create a preview marketing_message up-front so the test email has a
    // real web-view URL (re-renders via /public/marketing/view/:token).
    // HTML is stored in metadata.preview_html for the view endpoint shortcut.
    const previewMsg = await service.createMarketingMessages({
      brand_id: brandId,
      to_email: toEmail,
      from_email: body.from_email || (brand as any).marketing_from_email,
      subject_snapshot: `[TEST] ${subject}`,
      status: "preview",
      metadata: { preview: true, created_via: "test-send" },
    } as any)
    const previewMessageId = (previewMsg as any).id
    const baseUrl =
      process.env.MARKETING_PUBLIC_URL ||
      process.env.BACKEND_PUBLIC_URL ||
      (process.env.RAILWAY_PUBLIC_DOMAIN_VALUE
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN_VALUE.replace(/^https?:\/\//, "")}`
        : "http://localhost:9000")
    const viewInBrowserUrl = buildViewInBrowserUrl({
      messageId: previewMessageId,
      brandId,
      baseUrl,
    })

    // Auto-inject brand's compliance_footer_html (legal identity, IČO, BTW,
    // address, unsubscribe). Skipped only if the body already contains the
    // brand's company-name fingerprint. See utils/legal-footer.ts.
    const htmlToCompile = injectLegalFooter(html, (brand as any).compliance_footer_html)

    const compiled = compileTemplate(
      {
        subject,
        preheader: body.preheader || "",
        editor_type: "html",
        custom_html: htmlToCompile,
      },
      {
        contact: { first_name: "Test", last_name: "User", email: toEmail },
        brand: {
          name: (brand as any).display_name,
          from_email: (brand as any).marketing_from_email,
        },
        unsubscribe_url: "https://example.com/unsubscribe/TEST",
        preferences_url: "https://example.com/preferences/TEST",
        view_in_browser_text: vib.text,
        view_in_browser_label: vib.label,
        view_in_browser_url: viewInBrowserUrl,
      }
    )

    const fromName = body.from_name || (brand as any).marketing_from_name
    const fromEmail = body.from_email || (brand as any).marketing_from_email
    const replyTo = body.reply_to || (brand as any).marketing_reply_to
    const from = `${fromName} <${fromEmail}>`

    const client = new ResendMarketingClient(brand as any)
    const result = await client.send({
      from,
      to: toEmail,
      subject: `[TEST] ${compiled.subject}`,
      html: compiled.html,
      text: compiled.text,
      replyTo: replyTo || undefined,
    })

    // Store compiled HTML in the preview message so web-view can serve it
    // verbatim. Fire-and-forget — a failure here should not break the test.
    try {
      await service.updateMarketingMessages({
        id: previewMessageId,
        metadata: { preview: true, created_via: "test-send", preview_html: compiled.html },
      } as any)
    } catch { /* swallow */ }

    if (!result.ok) {
      res.status(500).json({ ok: false, error: result.error || "send_failed" })
      return
    }
    res.json({ ok: true, resend_id: result.resend_id, preview_url: viewInBrowserUrl })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
