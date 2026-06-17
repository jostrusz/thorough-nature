// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../modules/supportbox"
import { sendTicketReply } from "../../../modules/supportbox/utils/send-ticket-reply"
import { composeNewEmail } from "../../../modules/supportbox/utils/compose-new-email"
import { fetchFakturoidInvoicePdf } from "../../../modules/supportbox/utils/fetch-fakturoid-invoice-pdf"
import { FAKTUROID_MODULE } from "../../../modules/fakturoid"

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
 *   { action: "reply", ticket_id, body_text, keep_open?, fakturoid_invoice_id?, attachments? }
 *   { action: "solve", ticket_id }
 *   { action: "compose", from_email | config_id, to_email, subject, body_text,
 *     to_name?, keep_open?, fakturoid_invoice_id?, attachments? }
 *
 * fakturoid_invoice_id: numeric Fakturoid invoice id — the backend downloads
 * the invoice PDF server-to-server and attaches it to the outgoing e-mail.
 * Optional fakturoid_slug narrows the account.
 *
 * attachments: optional array of extra files. Each item is either
 *   { url, filename?, content_type? }            — fetched server-to-server, or
 *   { content_base64, filename, content_type? }  — inline (small local files).
 * Raw bytes are capped at 25 MB total (Resend's ~40 MB encoded limit).
 *
 * Any attachment that can't be fetched/decoded FAILS the whole request — we
 * never send an e-mail missing a promised attachment.
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

  // Cap raw (pre-base64) attachment bytes per message. Resend's hard limit is
  // ~40 MB on the fully-encoded message; base64 inflates payload by ~33%, so we
  // keep raw bytes well under that to leave room for the body + encoding.
  const MAX_ATTACH_RAW_BYTES = 25 * 1024 * 1024

  // Fetch a file from a public URL server-to-server and return it as a Resend
  // attachment ({ filename, content (base64), content_type, size }). Light SSRF
  // guard: http(s) only, no loopback / private / *.internal hosts.
  const fetchUrlAttachment = async (item: any): Promise<any> => {
    const rawUrl = String(item.url)
    let parsed: URL
    try {
      parsed = new URL(rawUrl)
    } catch {
      throw new Error(`Invalid attachment url: ${rawUrl}`)
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      throw new Error(`Attachment url must be http(s): ${rawUrl}`)
    }
    const host = parsed.hostname.toLowerCase()
    const blocked =
      host === "localhost" ||
      host === "::1" ||
      host.endsWith(".internal") ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    if (blocked) {
      throw new Error(`Attachment url host not allowed: ${host}`)
    }
    const resp = await fetch(rawUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    })
    if (!resp.ok) {
      throw new Error(`Failed to fetch attachment ${rawUrl}: HTTP ${resp.status}`)
    }
    const buf = Buffer.from(await resp.arrayBuffer())
    if (buf.length === 0) {
      throw new Error(`Attachment ${rawUrl} is empty`)
    }
    if (buf.length > MAX_ATTACH_RAW_BYTES) {
      throw new Error(
        `Attachment ${rawUrl} is ${(buf.length / 1024 / 1024).toFixed(1)} MB, ` +
          `exceeds ${MAX_ATTACH_RAW_BYTES / 1024 / 1024} MB limit`
      )
    }
    const urlName = decodeURIComponent(parsed.pathname.split("/").pop() || "").trim()
    const filename = item.filename || urlName || "attachment"
    const content_type =
      item.content_type ||
      resp.headers.get("content-type")?.split(";")[0]?.trim() ||
      "application/octet-stream"
    return { filename, content: buf.toString("base64"), content_type, size: buf.length }
  }

  // Decode an inline base64 attachment (small local files the caller already
  // read + encoded). Validated here so a malformed payload fails loud.
  const decodeBase64Attachment = (item: any): any => {
    const b64 = String(item.content_base64 || "").replace(/\s+/g, "")
    if (!b64) {
      throw new Error("content_base64 attachment is empty")
    }
    const buf = Buffer.from(b64, "base64")
    if (buf.length === 0) {
      throw new Error("content_base64 did not decode to any bytes (invalid base64?)")
    }
    if (buf.length > MAX_ATTACH_RAW_BYTES) {
      throw new Error(
        `Inline attachment is ${(buf.length / 1024 / 1024).toFixed(1)} MB, ` +
          `exceeds ${MAX_ATTACH_RAW_BYTES / 1024 / 1024} MB limit — upload it and pass a url instead`
      )
    }
    return {
      filename: item.filename || "attachment",
      content: b64,
      content_type: item.content_type || "application/octet-stream",
      size: buf.length,
    }
  }

  // Build the outgoing attachment list from all sources. Resolved BEFORE
  // sending so any fetch/decode failure aborts the whole action (we never send
  // an e-mail missing a promised attachment).
  //   - fakturoid_invoice_id : Fakturoid invoice PDF (server-to-server)
  //   - attachments[]        : each item is { url } OR { content_base64 },
  //                            plus optional filename / content_type
  const loadAttachments = async (): Promise<any[] | undefined> => {
    const out: any[] = []

    if (body.fakturoid_invoice_id) {
      const invoiceId = Number(body.fakturoid_invoice_id)
      if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
        throw new Error("fakturoid_invoice_id must be a positive integer")
      }
      const fakturoidService = req.scope.resolve(FAKTUROID_MODULE) as any
      out.push(
        await fetchFakturoidInvoicePdf(
          fakturoidService,
          invoiceId,
          body.fakturoid_slug || undefined
        )
      )
    }

    if (body.attachments != null) {
      if (!Array.isArray(body.attachments)) {
        throw new Error("attachments must be an array of { url } or { content_base64 } objects")
      }
      for (const item of body.attachments) {
        if (item && item.url) {
          out.push(await fetchUrlAttachment(item))
        } else if (item && item.content_base64) {
          out.push(decodeBase64Attachment(item))
        } else {
          throw new Error("each attachment must have either 'url' or 'content_base64'")
        }
      }
    }

    if (out.length === 0) return undefined

    const total = out.reduce((sum, a) => sum + (a.size || 0), 0)
    if (total > MAX_ATTACH_RAW_BYTES) {
      throw new Error(
        `attachments total ${(total / 1024 / 1024).toFixed(1)} MB exceeds ` +
          `${MAX_ATTACH_RAW_BYTES / 1024 / 1024} MB limit`
      )
    }
    return out
  }

  try {
    if (action === "reply") {
      if (!ticket_id) {
        return res.status(400).json({ error: "ticket_id is required" })
      }
      if (!body.body_text || !String(body.body_text).trim()) {
        return res.status(400).json({ error: "body_text is required for reply" })
      }
      const attachments = await loadAttachments()
      const result = await sendTicketReply(supportboxService, ticket_id, {
        body_html: textToParagraphHtml(body.body_text),
        body_text: body.body_text,
        keep_open: !!body.keep_open,
        attachments,
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

      const attachments = await loadAttachments()
      const result = await composeNewEmail(supportboxService, {
        config_id: configId,
        to_email,
        to_name,
        subject,
        body_html: textToParagraphHtml(body.body_text),
        body_text: body.body_text,
        keep_open: !!body.keep_open,
        attachments,
      })
      return res.json({ ok: true, action: "compose", ...result })
    }

    return res.status(400).json({ error: `Unknown action '${action}' (expected 'reply', 'solve' or 'compose')` })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
}
