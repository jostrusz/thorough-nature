// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORT_COMMAND_MODULE } from "../../../../modules/support-command"
import { SUPPORTBOX_MODULE } from "../../../../modules/supportbox"

const ACTIVE_TICKET_STATUSES = ["new", "read"]

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const sc = req.scope.resolve(SUPPORT_COMMAND_MODULE) as any
  const sb = req.scope.resolve(SUPPORTBOX_MODULE) as any

  try {
    const [tickets, configs] = await Promise.all([
      sb.listSupportboxTickets(
        { status: ACTIVE_TICKET_STATUSES },
        { order: { created_at: "DESC" }, take: 200 }
      ),
      sb.listSupportboxConfigs({}, { take: 100 }),
    ])
    const configById: Record<string, any> = {}
    for (const c of configs) configById[c.id] = c

    // Lazy-create a conversation row for every active ticket that lacks one.
    const existing = await sc.listAgentConversations({}, { take: 1000 })
    const byTicket: Record<string, any> = {}
    const dms: any[] = []
    for (const c of existing) {
      if (c.kind === "dm") dms.push(c)
      else if (c.ticket_id) byTicket[c.ticket_id] = c
    }
    const missing = tickets.filter((t: any) => !byTicket[t.id])
    if (missing.length) {
      const created = await sc.createAgentConversations(
        missing.map((t: any) => ({
          kind: "ticket",
          ticket_id: t.id,
          project: configById[t.config_id]?.display_name || null,
          status: "idle",
          last_activity_at: new Date(t.created_at).toISOString(),
        }))
      )
      for (const c of Array.isArray(created) ? created : [created]) {
        byTicket[c.ticket_id] = c
      }
    }

    const convIds = [...Object.values(byTicket), ...dms].map((c: any) => c.id)
    const [allMsgs, allTasks] = await Promise.all([
      convIds.length
        ? sc.listAgentMessages({ conversation_id: convIds }, { order: { created_at: "DESC" }, take: 2000 })
        : [],
      convIds.length
        ? sc.listAgentTasks({ conversation_id: convIds }, { take: 1000 })
        : [],
    ])
    const lastMsgByConv: Record<string, any> = {}
    for (const m of allMsgs) {
      if (!lastMsgByConv[m.conversation_id]) lastMsgByConv[m.conversation_id] = m
    }
    const pendingByConv: Record<string, number> = {}
    for (const t of allTasks) {
      if (t.status === "pending") {
        pendingByConv[t.conversation_id] = (pendingByConv[t.conversation_id] || 0) + 1
      }
    }

    const rows = tickets.map((t: any) => {
      const conv = byTicket[t.id]
      const lastAgent = lastMsgByConv[conv.id]
      const lastActivity = [t.updated_at, lastAgent?.created_at, conv.last_activity_at]
        .filter(Boolean)
        .map((d: any) => new Date(d).getTime())
        .sort((a, b) => b - a)[0]
      const unread = !conv.last_owner_read_at ||
        new Date(conv.last_owner_read_at).getTime() < lastActivity
      return {
        conversation_id: conv.id,
        kind: "ticket",
        ticket_id: t.id,
        subject: t.subject,
        from_email: t.from_email,
        project: conv.project || configById[t.config_id]?.display_name || null,
        ticket_status: t.status,
        agent_status: conv.status,
        pending_tasks: pendingByConv[conv.id] || 0,
        unread,
        last_activity_at: new Date(lastActivity).toISOString(),
        created_at: t.created_at,
      }
    })
    const dmRows = dms.map((c: any) => ({
      conversation_id: c.id,
      kind: "dm",
      ticket_id: null,
      subject: c.title || "Agent",
      from_email: null,
      project: null,
      ticket_status: null,
      agent_status: c.status,
      pending_tasks: pendingByConv[c.id] || 0,
      unread: false,
      last_activity_at: c.last_activity_at || c.created_at,
      created_at: c.created_at,
    }))

    // Waiting-for-owner first (oldest pending on top), then by activity.
    const waiting = rows.filter((r) => r.pending_tasks > 0)
      .sort((a, b) => new Date(a.last_activity_at).getTime() - new Date(b.last_activity_at).getTime())
    const rest = rows.filter((r) => r.pending_tasks === 0)
      .sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime())

    // Solved today (collapsed section) + stats
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const solvedToday = await sb.listSupportboxTickets(
      { status: "solved" },
      { order: { updated_at: "DESC" }, take: 100 }
    )
    const solvedTodayRows = solvedToday
      .filter((t: any) => t.solved_at && new Date(t.solved_at) >= todayStart)
      .map((t: any) => ({ ticket_id: t.id, subject: t.subject, from_email: t.from_email, solved_at: t.solved_at }))

    const settings = await sc.listAgentSettings({ key: "agent_enabled" }, { take: 1 })
    const agentEnabled = settings.length ? settings[0].value?.enabled !== false : true

    res.json({
      waiting,
      conversations: rest,
      dms: dmRows,
      solved_today: solvedTodayRows,
      stats: {
        waiting: waiting.length,
        active: rest.length,
        solved_today: solvedTodayRows.length,
        oldest_waiting_minutes: waiting.length
          ? Math.round((Date.now() - new Date(waiting[0].last_activity_at).getTime()) / 60000)
          : 0,
      },
      agent_enabled: agentEnabled,
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
