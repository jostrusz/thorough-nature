// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORT_COMMAND_MODULE } from "../../../../../modules/support-command"
import { SUPPORTBOX_MODULE } from "../../../../../modules/supportbox"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const sc = req.scope.resolve(SUPPORT_COMMAND_MODULE) as any
  const sb = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const { id } = req.params

  try {
    const conv = await sc.retrieveAgentConversation(id)
    const [agentMsgs, tasks] = await Promise.all([
      sc.listAgentMessages({ conversation_id: id }, { order: { created_at: "ASC" }, take: 500 }),
      sc.listAgentTasks({ conversation_id: id }, { order: { created_at: "ASC" }, take: 100 }),
    ])

    const thread: any[] = []
    for (const m of agentMsgs) {
      thread.push({
        type: "agent_message",
        id: m.id,
        role: m.role, // owner | assistant | system
        kind: m.kind,
        body: m.body,
        metadata: m.metadata,
        created_at: m.created_at,
      })
    }
    for (const t of tasks) {
      thread.push({
        type: "task",
        id: t.id,
        title: t.title,
        description: t.description,
        action_type: t.action_type,
        // without payload the UI never sees summary and falls back to the bare
        // draft — no customer summary, no order, no timeline
        payload: t.payload,
        draft_reply: t.draft_reply,
        edited_draft: t.edited_draft,
        confidence: t.confidence,
        status: t.status,
        decision_note: t.decision_note,
        result: t.result,
        created_at: t.created_at,
        decided_at: t.decided_at,
        executed_at: t.executed_at,
      })
    }

    let ticket = null
    if (conv.kind === "ticket" && conv.ticket_id) {
      ticket = await sb.retrieveSupportboxTicket(conv.ticket_id)
      const sbMsgs = await sb.listSupportboxMessages(
        { ticket_id: conv.ticket_id },
        { order: { created_at: "ASC" }, take: 500 }
      )
      for (const m of sbMsgs) {
        thread.push({
          type: "email",
          id: m.id,
          role: m.direction === "inbound" ? "customer" : "outbound",
          from_email: m.from_email,
          from_name: m.from_name,
          body: m.body_text || m.body_html,
          delivery_status: m.delivery_status || m.metadata?.delivery_status || null,
          attachments: m.metadata?.attachments || [],
          created_at: m.created_at,
        })
      }
    }

    thread.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    res.json({ conversation: conv, ticket, thread })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
