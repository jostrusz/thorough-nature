// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORT_COMMAND_MODULE } from "../../../../modules/support-command"
import { SUPPORTBOX_MODULE } from "../../../../modules/supportbox"

/**
 * VPS agent loop endpoints (phase 3). Auth: standard Medusa admin auth — the
 * VPS calls these with a secret admin API key (Authorization: Basic <token>).
 *
 * GET  -> work queue: unconsumed owner messages + approved-but-unexecuted tasks
 * POST -> agent writes back: messages / new tasks / task results / status
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const sc = req.scope.resolve(SUPPORT_COMMAND_MODULE) as any
  const sb = req.scope.resolve(SUPPORTBOX_MODULE) as any
  try {
    const settings = await sc.listAgentSettings({ key: "agent_enabled" }, { take: 1 })
    const enabled = settings.length ? settings[0].value?.enabled !== false : true
    if (!enabled) return res.json({ enabled: false, owner_messages: [], approved_tasks: [] })

    // Lazy-create conversations for active tickets that lack one — the agent
    // must not depend on the Command Center UI being open in a browser.
    const activeTickets = await sb.listSupportboxTickets(
      { status: ["new", "read"] },
      { order: { created_at: "ASC" }, take: 200 }
    )
    let allConvs = await sc.listAgentConversations(
      { kind: "ticket" },
      { order: { created_at: "ASC" }, take: 1000 }
    )
    const haveConv = new Set(allConvs.map((c: any) => c.ticket_id))
    const missing = activeTickets.filter((tk: any) => !haveConv.has(tk.id))
    if (missing.length) {
      await sc.createAgentConversations(
        missing.map((tk: any) => ({
          kind: "ticket",
          ticket_id: tk.id,
          status: "idle",
          last_activity_at: new Date(tk.created_at).toISOString(),
        }))
      )
      allConvs = await sc.listAgentConversations(
        { kind: "ticket" },
        { order: { created_at: "ASC" }, take: 1000 }
      )
    }

    const [ownerMsgs, approvedTasks, assistantMsgs, inboundMsgs] = await Promise.all([
      sc.listAgentMessages(
        { role: "owner", kind: "chat", consumed_at: null },
        { order: { created_at: "ASC" }, take: 50 }
      ),
      sc.listAgentTasks(
        { status: "approved" },
        { order: { decided_at: "ASC" }, take: 50 }
      ),
      sc.listAgentMessages(
        { role: "assistant" },
        { select: ["conversation_id", "created_at"], order: { created_at: "DESC" }, take: 2000 }
      ),
      sb.listSupportboxMessages(
        { direction: "inbound" },
        { select: ["ticket_id", "created_at"], order: { created_at: "DESC" }, take: 500 }
      ),
    ])

    // Latest assistant touch per conversation
    const lastTouch: Record<string, number> = {}
    for (const m of assistantMsgs) {
      const ts = new Date(m.created_at).getTime()
      if (!lastTouch[m.conversation_id] || ts > lastTouch[m.conversation_id]) {
        lastTouch[m.conversation_id] = ts
      }
    }
    // Latest inbound customer message per ticket
    const lastInbound: Record<string, number> = {}
    for (const m of inboundMsgs) {
      const ts = new Date(m.created_at).getTime()
      if (!lastInbound[m.ticket_id] || ts > lastInbound[m.ticket_id]) {
        lastInbound[m.ticket_id] = ts
      }
    }
    const activeIds = new Set(activeTickets.map((tk: any) => tk.id))

    // never touched + ticket still active
    const newConversations = allConvs
      .filter((c: any) => !lastTouch[c.id] && c.status !== "closed" && activeIds.has(c.ticket_id))
      .slice(0, 20)
      .map((c: any) => ({ conversation_id: c.id, ticket_id: c.ticket_id, project: c.project }))

    // customer replied AFTER the agent's last touch and ticket is active again
    const customerFollowups = allConvs
      .filter((c: any) =>
        lastTouch[c.id] &&
        c.status !== "closed" &&
        activeIds.has(c.ticket_id) &&
        lastInbound[c.ticket_id] &&
        lastInbound[c.ticket_id] > lastTouch[c.id]
      )
      .slice(0, 20)
      .map((c: any) => ({ conversation_id: c.id, ticket_id: c.ticket_id, project: c.project }))

    res.json({
      enabled: true,
      owner_messages: ownerMsgs,
      approved_tasks: approvedTasks,
      new_conversations: newConversations,
      customer_followups: customerFollowups,
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const sc = req.scope.resolve(SUPPORT_COMMAND_MODULE) as any
  const { consume_message_ids, messages, tasks, task_updates, conversation_updates } = req.body as any
  const now = new Date().toISOString()

  // One bad id must never discard a whole agent run — the drafts and tasks in
  // the same payload are the expensive part. Each section fails on its own.
  const warnings: string[] = []
  const attempt = async (label: string, fn: () => Promise<any>) => {
    try {
      return await fn()
    } catch (e: any) {
      warnings.push(`${label}: ${e.message}`)
      return null
    }
  }

  try {
    if (Array.isArray(consume_message_ids)) {
      for (const mid of consume_message_ids) {
        // agent sometimes echoes SupportBox message ids, which are not AgentMessage ids
        await attempt(`consume ${mid}`, () => sc.updateAgentMessages({ id: mid, consumed_at: now }))
      }
    }
    const createdMessages: any[] = []
    if (Array.isArray(messages)) {
      for (const m of messages) {
        const row = await attempt(`message ${m.conversation_id}`, () => sc.createAgentMessages({
          conversation_id: m.conversation_id,
          role: m.role || "assistant",
          kind: m.kind || "chat",
          body: m.body,
          metadata: m.metadata || null,
        }))
        if (row) createdMessages.push(Array.isArray(row) ? row[0] : row)
      }
    }
    const createdTasks: any[] = []
    if (Array.isArray(tasks)) {
      for (const t of tasks) {
        const row = await attempt(`task ${t.title}`, () => sc.createAgentTasks({
          conversation_id: t.conversation_id || null,
          ticket_id: t.ticket_id || null,
          title: t.title,
          description: t.description || null,
          action_type: t.action_type || "other",
          payload: t.payload || null,
          draft_reply: t.draft_reply || null,
          confidence: t.confidence ?? null,
          status: "pending",
        }))
        if (row) createdTasks.push(Array.isArray(row) ? row[0] : row)
      }
    }
    if (Array.isArray(task_updates)) {
      for (const u of task_updates) {
        await attempt(`task_update ${u.id}`, () => sc.updateAgentTasks({
          id: u.id,
          status: u.status,
          executed_at: u.status === "executed" || u.status === "failed" ? now : undefined,
          result: u.result || undefined,
        }))
      }
    }
    if (Array.isArray(conversation_updates)) {
      for (const c of conversation_updates) {
        await attempt(`conversation_update ${c.id}`, () => sc.updateAgentConversations({
          id: c.id,
          status: c.status,
          session_id: c.session_id || undefined,
          last_activity_at: now,
        }))
      }
    }
    res.json({ ok: true, messages: createdMessages, tasks: createdTasks, warnings })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
