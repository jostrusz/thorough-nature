// @ts-nocheck
import {
  getAccessToken,
  getInvoice,
  downloadInvoicePdf,
} from "../../fakturoid/api-client"

/**
 * Fetch a Fakturoid invoice PDF server-to-server and return it as a
 * SupportBox e-mail attachment ({ filename, content (base64), content_type,
 * size }). Used by the MCP webhook route (/webhooks/supportbox-mcp) so an
 * invoice can be attached to an outgoing e-mail without the file ever
 * touching the caller's machine or the model context.
 *
 * Throws with a descriptive message when the invoice or PDF can't be
 * fetched — callers should fail loud rather than send the e-mail without
 * the promised attachment.
 *
 * @param fakturoidService  resolved FAKTUROID_MODULE service
 * @param invoiceId         Fakturoid invoice id (numeric)
 * @param slug              optional Fakturoid account slug filter (all
 *                          current configs share one account, so usually
 *                          omitted)
 */
export async function fetchFakturoidInvoicePdf(
  fakturoidService: any,
  invoiceId: number,
  slug?: string
) {
  const configs = await fakturoidService.listFakturoidConfigs({ enabled: true })
  const config = slug
    ? configs.find((c: any) => c.slug === slug)
    : configs[0]

  if (!config) {
    throw new Error(
      slug
        ? `No enabled Fakturoid config with slug '${slug}'`
        : "No enabled Fakturoid config found"
    )
  }

  const tokenResult = await getAccessToken({
    slug: config.slug,
    client_id: config.client_id,
    client_secret: config.client_secret,
    user_agent_email: config.user_agent_email,
    access_token: config.access_token,
    token_expires_at: config.token_expires_at,
  })

  // Persist refreshed token (same pattern as admin fakturoid routes)
  if (tokenResult.access_token !== config.access_token) {
    await fakturoidService.updateFakturoidConfigs({
      id: config.id,
      access_token: tokenResult.access_token,
      token_expires_at: tokenResult.expires_at,
    })
  }

  const creds = {
    slug: config.slug,
    client_id: config.client_id,
    client_secret: config.client_secret,
    user_agent_email: config.user_agent_email,
  }
  const token = tokenResult.access_token

  const invoice = await getInvoice(creds, token, invoiceId)
  if (!invoice) {
    throw new Error(`Fakturoid invoice ${invoiceId} not found in account '${config.slug}'`)
  }

  const pdf = await downloadInvoicePdf(creds, token, invoiceId)
  if (!pdf) {
    throw new Error(
      `Fakturoid invoice ${invoiceId} PDF is not ready yet — try again in a few seconds`
    )
  }

  const safeNumber = String(invoice.number || invoiceId).replace(/[^\w.-]+/g, "-")

  return {
    filename: `faktura-${safeNumber}.pdf`,
    content: pdf.toString("base64"),
    content_type: "application/pdf",
    size: pdf.length,
  }
}
