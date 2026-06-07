// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../modules/supportbox"
import { sendTicketReply } from "../../../modules/supportbox/utils/send-ticket-reply"

/**
 * SupportBox MCP write endpoint.
 *
 * Called by the read-only SupportBox MCP server (Python, Railway) to perform
 * the two write actions it can't do directly: send a customer reply and solve
 * a ticket. Auth is a shared secret in the `x-mcp-secret` header — this route
 * intentionally lives under /webhooks (no admin session), like other
 * machine-to-machine endpoints.
 *
 * Body:
 *   { action: "reply", ticket_id, body_text, keep_open? }
 *   { action: "solve", ticket_id }
 */
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

  if (!ticket_id) {
    return res.status(400).json({ error: "ticket_id is required" })
  }

  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any

  try {
    if (action === "reply") {
      if (!body.body_text || !String(body.body_text).trim()) {
        return res.status(400).json({ error: "body_text is required for reply" })
      }
      // MCP sends plain text — pass it as body_html too so the shared
      // normalizer turns \n into <br> and wraps it in <p>. body_text is kept
      // for the stored message record.
      const result = await sendTicketReply(supportboxService, ticket_id, {
        body_html: body.body_text,
        body_text: body.body_text,
        keep_open: !!body.keep_open,
      })
      return res.json({ ok: true, action: "reply", ...result })
    }

    if (action === "solve") {
      const ticket = await supportboxService.updateSupportboxTickets({
        id: ticket_id,
        status: "solved",
        solved_at: new Date().toISOString(),
      })
      return res.json({ ok: true, action: "solve", ticket })
    }

    return res.status(400).json({ error: `Unknown action '${action}' (expected 'reply' or 'solve')` })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
}
