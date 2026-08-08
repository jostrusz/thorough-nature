// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORT_COMMAND_MODULE } from "../../../../../../modules/support-command"
import { SUPPORTBOX_MODULE } from "../../../../../../modules/supportbox"
import { sendTicketReply } from "../../../../../../modules/supportbox/utils/send-ticket-reply"

// Same paragraph rendering as the SupportBox MCP webhook (see
// webhooks/supportbox-mcp/route.ts) so replies sent from the Command Center
// look identical to replies sent via MCP.
const textToParagraphHtml = (text: string): string => {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return String(text)
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p style="margin:0 0 12px 0;">${esc(block).replace(/\n/g, "<br>")}</p>`)
    .join("")
}

/**
 * Owner decision on an approval card.
 *  - reject           -> status=rejected (+instruction note for the agent)
 *  - approve          -> reply tasks are EXECUTED immediately (e-mail goes out
 *                        via sendTicketReply); other action types stay
 *                        "approved" for the VPS agent to execute.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const sc = req.scope.resolve(SUPPORT_COMMAND_MODULE) as any
  const sb = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const { id } = req.params
  const { decision, note, edited_draft } = req.body as any

  if (!["approve", "reject"].includes(decision)) {
    return res.status(400).json({ error: "decision must be approve|reject" })
  }

  try {
    const task = await sc.retrieveAgentTask(id)
    if (task.status !== "pending") {
      return res.status(409).json({ error: `task is ${task.status}, not pending` })
    }
    const now = new Date().toISOString()

    if (decision === "reject") {
      await sc.updateAgentTasks({
        id, status: "rejected", decision_note: note || null, decided_at: now,
      })
      if (task.conversation_id) {
        await sc.createAgentMessages({
          conversation_id: task.conversation_id,
          role: "system", kind: "event",
          body: `Rejected: ${task.title}`,
        })
        // The agent queue only picks up role:"owner"/kind:"chat" messages, so a
        // rejection must also be written as an owner instruction — otherwise the
        // agent never learns it was rejected and the ticket stalls in "working".
        await sc.createAgentMessages({
          conversation_id: task.conversation_id,
          role: "owner", kind: "chat",
          body: note?.trim()
            ? `I rejected your proposal "${task.title}". Do this instead: ${note.trim()}`
            : `I rejected your proposal "${task.title}". Rethink it and propose something different.`,
        })
        await sc.updateAgentConversations({
          id: task.conversation_id, status: "agent_working", last_activity_at: now,
        })
      }
      return res.json({ ok: true, status: "rejected" })
    }

    // approve
    const finalDraft = (edited_draft || task.draft_reply || "").trim()
    const isReply = task.action_type === "reply" && task.ticket_id && finalDraft

    if (!isReply) {
      // Non-reply actions wait for the VPS agent to execute.
      await sc.updateAgentTasks({
        id, status: "approved", decision_note: note || null,
        edited_draft: edited_draft || null, decided_at: now,
      })
      if (task.conversation_id) {
        await sc.createAgentMessages({
          conversation_id: task.conversation_id, role: "system", kind: "event",
          body: `Approved: ${task.title}${edited_draft ? " (with edits)" : ""} — queued for execution`,
        })
        await sc.updateAgentConversations({
          id: task.conversation_id, status: "agent_working", last_activity_at: now,
        })
      }
      return res.json({ ok: true, status: "approved" })
    }

    // Reply task: send the e-mail right now.
    try {
      const keepOpen = task.payload?.keep_open === true
      const result = await sendTicketReply(sb, task.ticket_id, {
        body_html: textToParagraphHtml(finalDraft),
        body_text: finalDraft,
        keep_open: keepOpen,
      })
      await sc.updateAgentTasks({
        id, status: "executed", decision_note: note || null,
        edited_draft: edited_draft || null, decided_at: now, executed_at: now,
        result: {
          summary: "Reply sent to customer",
          resend_message_id: result?.message?.resend_message_id || null,
          kept_open: result?.kept_open ?? !keepOpen ? false : true,
        },
      })
      if (task.conversation_id) {
        await sc.createAgentMessages({
          conversation_id: task.conversation_id, role: "system", kind: "event",
          body: `Reply sent to customer${edited_draft ? " (with your edits)" : ""}${keepOpen ? "" : " · ticket solved"}`,
        })
        await sc.updateAgentConversations({
          id: task.conversation_id, status: "idle", last_activity_at: now,
        })
      }
      return res.json({ ok: true, status: "executed" })
    } catch (sendErr: any) {
      await sc.updateAgentTasks({
        id, status: "failed", decision_note: note || null,
        edited_draft: edited_draft || null, decided_at: now, executed_at: now,
        result: { summary: `Send failed: ${sendErr.message}` },
      })
      if (task.conversation_id) {
        await sc.createAgentMessages({
          conversation_id: task.conversation_id, role: "system", kind: "event",
          body: `⚠️ Send FAILED: ${sendErr.message}`,
        })
      }
      return res.status(502).json({ error: `send failed: ${sendErr.message}` })
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
