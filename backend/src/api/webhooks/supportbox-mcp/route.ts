// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../modules/supportbox"
import { sendTicketReply } from "../../../modules/supportbox/utils/send-ticket-reply"
import { composeNewEmail } from "../../../modules/supportbox/utils/compose-new-email"

/**
 * SupportBox MCP write endpoint.
 *
 * Called by the read-only SupportBox MCP server (Python, Railway) to perform
 * the write actions it can't do directly: send a customer reply, solve a
 * ticket, and compose a brand-new outbound e-mail. Auth is a shared secret in
 * the `x-mcp-secret` header — this route intentionally lives under /webhooks
 * (no admin session), like other machine-to-machine endpoints.
 *
 * Body:
 *   { action: "reply", ticket_id, body_text, keep_open? }
 *   { action: "solve", ticket_id }
 *   { action: "compose", from_email | config_id, to_email, subject, body_text,
 *     to_name?, keep_open? }
 */

// MCP sends plain text. Convert blank-line-separated blocks into <p>
// paragraphs HERE (we know this path is always plain text), so the visual
// spacing between paragraphs survives. The pre-built <p> blocks pass through
// the send utils' normalizers untouched (no <div>, no raw \n between
// paragraphs), and the admin contenteditable path is unaffected.
const textToParagraphHtml = (text: string): string => {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return String(text)
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/) // blank line = paragraph separator
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p style="margin:0 0 12px 0;">${esc(block).replace(/\n/g, "<br>")}</p>`)
    .join("")
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const secret = process.env.SUPPORTBOX_MCP_SECRET
  if (!secret) {
    return res.status(500).json({ error: "SUPPORTBOX_MCP_SECRET not configured" })
  }
  if (req.headers["x-mcp-secret"] !== secret) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const body = (req.body as any) || {}
  const { action, ticket_id } = body

  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any

  try {
    if (action === "reply") {
      if (!ticket_id) {
        return res.status(400).json({ error: "ticket_id is required" })
      }
      if (!body.body_text || !String(body.body_text).trim()) {
        return res.status(400).json({ error: "body_text is required for reply" })
      }
      const result = await sendTicketReply(supportboxService, ticket_id, {
        body_html: textToParagraphHtml(body.body_text),
        body_text: body.body_text,
        keep_open: !!body.keep_open,
      })
      return res.json({ ok: true, action: "reply", ...result })
    }

    if (action === "solve") {
      if (!ticket_id) {
        return res.status(400).json({ error: "ticket_id is required" })
      }
      const ticket = await supportboxService.updateSupportboxTickets({
        id: ticket_id,
        status: "solved",
        solved_at: new Date().toISOString(),
      })
      return res.json({ ok: true, action: "solve", ticket })
    }

    if (action === "compose") {
      const { to_email, to_name, subject } = body
      if (!to_email || !subject) {
        return res.status(400).json({ error: "to_email and subject are required for compose" })
      }
      if (!body.body_text || !String(body.body_text).trim()) {
        return res.status(400).json({ error: "body_text is required for compose" })
      }

      // Resolve the sending account: explicit config_id, or look it up by the
      // mailbox address (the way the MCP identifies accounts).
      let configId = body.config_id
      if (!configId) {
        if (!body.from_email) {
          return res.status(400).json({ error: "from_email (or config_id) is required for compose" })
        }
        const configs = await supportboxService.listSupportboxConfigs({})
        const wanted = String(body.from_email).toLowerCase().trim()
        const match = configs.find(
          (c: any) => c.email_address?.toLowerCase() === wanted && c.is_active !== false
        )
        if (!match) {
          const available = configs
            .filter((c: any) => c.is_active !== false)
            .map((c: any) => c.email_address)
          return res.status(400).json({
            error: `No active SupportBox account with address '${body.from_email}'`,
            available_accounts: available,
          })
        }
        configId = match.id
      }

      const result = await composeNewEmail(supportboxService, {
        config_id: configId,
        to_email,
        to_name,
        subject,
        body_html: textToParagraphHtml(body.body_text),
        body_text: body.body_text,
        keep_open: !!body.keep_open,
      })
      return res.json({ ok: true, action: "compose", ...result })
    }

    return res.status(400).json({ error: `Unknown action '${action}' (expected 'reply', 'solve' or 'compose')` })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
}
