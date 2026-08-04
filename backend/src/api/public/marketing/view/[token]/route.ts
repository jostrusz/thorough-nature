// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"
import { verifyToken } from "../../../../../modules/marketing/utils/tokens"
import { compileTemplate } from "../../../../../modules/marketing/utils/template-compiler"
import { buildUnsubscribeUrl } from "../../../../../modules/marketing/utils/tracking-injector"
import { getViewInBrowserStrings } from "../../../../../modules/marketing/utils/view-in-browser-i18n"
import { pickGenderVariant } from "../../../../../modules/marketing/utils/gender-resolver"

/**
 * GET /public/marketing/view/:token
 *
 * "View email in browser" fallback. Re-renders a message's source HTML and
 * serves it as a standalone page, so Gmail-clipped or image-stripped recipients
 * can still read the whole email.
 *
 * Token payload: { t:"view", m:message_id, b:brand_id, exp }.
 * We fetch the message row → locate the source HTML on its campaign or flow
 * node → compile placeholders with contact + brand context → inject compliance
 * footer → return HTML. No link tracking / open pixel rewrite (already fired
 * when the email was delivered).
 *
 * For "preview" messages (created by the test-send endpoint), the compiled
 * HTML is stored inline in message.metadata.preview_html and served verbatim.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const token = String((req.params as any).token || "")
  const payload = verifyToken(token, "view")
  res.setHeader("Content-Type", "text/html; charset=utf-8")

  if (!payload?.m || !payload?.b) {
    res.status(400).send(minimalPage("This preview link is invalid or expired."))
    return
  }

  const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const [msg] = await service.listMarketingMessages({ id: payload.m })
    if (!msg || (msg as any).brand_id !== payload.b) {
      res.status(404).send(minimalPage("This email no longer exists."))
      return
    }

    // 1. Preview shortcut — test-send stored compiled HTML directly.
    const previewHtml = ((msg as any).metadata || {}).preview_html
    if (previewHtml && typeof previewHtml === "string") {
      res.status(200).send(previewHtml)
      return
    }

    const [brand] = await service.listMarketingBrands({ id: payload.b })

    // Contact is needed before the HTML lookup: gender-aware flows store
    // subject / preheader / html as a { m, f } map, and we have to pick the
    // same variant the executor sent. Fetched here, reused in step 4.
    const [contactRow] = (msg as any).contact_id
      ? await service.listMarketingContacts({ id: (msg as any).contact_id })
      : [null]
    const contactGender = (contactRow as any)?.gender

    // 2. Locate source HTML + subject from campaign OR flow node.
    let sourceHtml: string | null = null
    let subject = (msg as any).subject_snapshot || ""
    let preheader = ""
    if ((msg as any).campaign_id) {
      const [camp] = await service.listMarketingCampaigns({ id: (msg as any).campaign_id })
      if (camp) {
        sourceHtml = pickGenderVariant((camp as any).custom_html, contactGender) || null
        subject = pickGenderVariant((camp as any).subject, contactGender) || subject
        preheader = pickGenderVariant((camp as any).preheader, contactGender) || ""
      }
    } else if ((msg as any).flow_id && (msg as any).flow_node_id) {
      const { rows } = await pool.query(
        `SELECT definition FROM marketing_flow WHERE id = $1 LIMIT 1`,
        [(msg as any).flow_id]
      )
      const def = rows[0]?.definition || {}
      const node = Array.isArray(def.nodes) ? def.nodes.find((n: any) => n.id === (msg as any).flow_node_id) : null
      if (node?.config) {
        sourceHtml = pickGenderVariant(node.config.html, contactGender) || null
        preheader = pickGenderVariant(node.config.preheader, contactGender) || ""
        const nodeSubject = pickGenderVariant(node.config.subject, contactGender)
        if (nodeSubject) subject = nodeSubject
      }
    }

    if (!sourceHtml) {
      res.status(404).send(minimalPage("The email content could not be restored."))
      return
    }

    // 3. Auto-inject compliance footer when HTML has no unsub marker.
    const hasUnsubMarker = /\{\{\s*unsubscribe_url\s*\}\}|\{\$\s*unsubscribe(_url)?\s*\}|\$\{\s*unsubscribe_url\s*\}|<%=\s*unsubscribe_url\s*%>|\/public\/marketing\/u\//.test(sourceHtml)
    const footerTpl = (brand as any)?.compliance_footer_html as string | null | undefined
    if (!hasUnsubMarker && footerTpl) {
      if (/<\/body>/i.test(sourceHtml)) {
        sourceHtml = sourceHtml.replace(/<\/body>/i, `${footerTpl}\n</body>`)
      } else {
        sourceHtml = sourceHtml + "\n" + footerTpl
      }
    }

    // 4. Compile placeholders. Use contact from the message if still present.
    let contact: any = {}
    if (contactRow) {
      contact = {
        first_name: (contactRow as any).first_name || "",
        last_name: (contactRow as any).last_name || "",
        email: (contactRow as any).email || "",
        locale: (contactRow as any).locale || "",
        country_code: (contactRow as any).country_code || "",
        gender: (contactRow as any).gender || "",
        vocative: (contactRow as any).vocative || "",
      }
    }

    const baseUrl = getBaseUrl()
    const unsubscribe_url = (msg as any).contact_id
      ? buildUnsubscribeUrl({ contactId: (msg as any).contact_id, brandId: payload.b, baseUrl })
      : "#"

    const vib = getViewInBrowserStrings((brand as any)?.locale)
    const domain = (brand as any)?.storefront_domain
    const storefrontUrl = domain ? `https://${String(domain).replace(/^https?:\/\//, "")}` : "#"

    const compiled = compileTemplate(
      {
        subject,
        preheader,
        editor_type: "html",
        custom_html: sourceHtml,
      },
      {
        contact,
        brand: {
          name: (brand as any)?.display_name,
          from_email: (brand as any)?.marketing_from_email,
        },
        unsubscribe_url,
        view_in_browser_text: vib.text,
        view_in_browser_label: vib.label,
        view_in_browser_url: storefrontUrl,
      }
    )

    res.status(200).send(compiled.html)
  } catch (err: any) {
    res.status(500).send(minimalPage("Something went wrong loading this email."))
  } finally {
    await pool.end()
  }
}

function getBaseUrl(): string {
  return (
    process.env.MARKETING_PUBLIC_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN_VALUE
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN_VALUE.replace(/^https?:\/\//, "")}`
      : "http://localhost:9000")
  )
}

function minimalPage(text: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Email</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:80px auto;padding:24px;color:#111}</style>
  </head><body><p>${text}</p></body></html>`
}
