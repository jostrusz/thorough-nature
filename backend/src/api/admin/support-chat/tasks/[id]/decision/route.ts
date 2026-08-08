// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORT_COMMAND_MODULE } from "../../../../../../modules/support-command"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const sc = req.scope.resolve(SUPPORT_COMMAND_MODULE) as any
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
    await sc.updateAgentTasks({
      id,
      status: decision === "approve" ? "approved" : "rejected",
      decision_note: note || null,
      edited_draft: edited_draft || null,
      decided_at: now,
    })
    if (task.conversation_id) {
      await sc.createAgentMessages({
        conversation_id: task.conversation_id,
        role: "system",
        kind: "event",
        body:
          decision === "approve"
            ? `Schváleno: ${task.title}${edited_draft ? " (s úpravou návrhu)" : ""}`
            : `Zamítnuto: ${task.title}${note ? ` — pokyn: ${note}` : ""}`,
      })
      await sc.updateAgentConversations({
        id: task.conversation_id,
        status: "agent_working",
        last_activity_at: now,
      })
    }
    res.json({ ok: true, status: decision === "approve" ? "approved" : "rejected" })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
