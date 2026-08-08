// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORT_COMMAND_MODULE } from "../../../../modules/support-command"

/**
 * VPS agent loop endpoints (phase 3). Auth: standard Medusa admin auth — the
 * VPS calls these with a secret admin API key (Authorization: Basic <token>).
 *
 * GET  -> work queue: unconsumed owner messages + approved-but-unexecuted tasks
 * POST -> agent writes back: messages / new tasks / task results / status
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const sc = req.scope.resolve(SUPPORT_COMMAND_MODULE) as any
  try {
    const settings = await sc.listAgentSettings({ key: "agent_enabled" }, { take: 1 })
    const enabled = settings.length ? settings[0].value?.enabled !== false : true
    if (!enabled) return res.json({ enabled: false, owner_messages: [], approved_tasks: [] })

    const [ownerMsgs, approvedTasks] = await Promise.all([
      sc.listAgentMessages(
        { role: "owner", kind: "chat", consumed_at: null },
        { order: { created_at: "ASC" }, take: 50 }
      ),
      sc.listAgentTasks(
        { status: "approved" },
        { order: { decided_at: "ASC" }, take: 50 }
      ),
    ])
    res.json({ enabled: true, owner_messages: ownerMsgs, approved_tasks: approvedTasks })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const sc = req.scope.resolve(SUPPORT_COMMAND_MODULE) as any
  const { consume_message_ids, messages, tasks, task_updates, conversation_updates } = req.body as any
  const now = new Date().toISOString()

  try {
    if (Array.isArray(consume_message_ids)) {
      for (const mid of consume_message_ids) {
        await sc.updateAgentMessages({ id: mid, consumed_at: now })
      }
    }
    const createdMessages: any[] = []
    if (Array.isArray(messages)) {
      for (const m of messages) {
        const row = await sc.createAgentMessages({
          conversation_id: m.conversation_id,
          role: m.role || "assistant",
          kind: m.kind || "chat",
          body: m.body,
          metadata: m.metadata || null,
        })
        createdMessages.push(Array.isArray(row) ? row[0] : row)
      }
    }
    const createdTasks: any[] = []
    if (Array.isArray(tasks)) {
      for (const t of tasks) {
        const row = await sc.createAgentTasks({
          conversation_id: t.conversation_id || null,
          ticket_id: t.ticket_id || null,
          title: t.title,
          description: t.description || null,
          action_type: t.action_type || "other",
          payload: t.payload || null,
          draft_reply: t.draft_reply || null,
          confidence: t.confidence ?? null,
          status: "pending",
        })
        createdTasks.push(Array.isArray(row) ? row[0] : row)
      }
    }
    if (Array.isArray(task_updates)) {
      for (const u of task_updates) {
        await sc.updateAgentTasks({
          id: u.id,
          status: u.status,
          executed_at: u.status === "executed" || u.status === "failed" ? now : undefined,
          result: u.result || undefined,
        })
      }
    }
    if (Array.isArray(conversation_updates)) {
      for (const c of conversation_updates) {
        await sc.updateAgentConversations({
          id: c.id,
          status: c.status,
          session_id: c.session_id || undefined,
          last_activity_at: now,
        })
      }
    }
    res.json({ ok: true, messages: createdMessages, tasks: createdTasks })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
