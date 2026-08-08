// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORT_COMMAND_MODULE } from "../../../../../../modules/support-command"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const sc = req.scope.resolve(SUPPORT_COMMAND_MODULE) as any
  const { id } = req.params
  const { body, kind } = req.body as any

  if (!body?.trim()) {
    return res.status(400).json({ error: "body is required" })
  }
  const messageKind = kind === "note" ? "note" : "chat"

  try {
    const msg = await sc.createAgentMessages({
      conversation_id: id,
      role: "owner",
      kind: messageKind,
      body: body.trim(),
    })
    // "chat" = instruction for the agent -> flag conversation as having work.
    await sc.updateAgentConversations({
      id,
      status: messageKind === "chat" ? "agent_working" : undefined,
      last_activity_at: new Date().toISOString(),
    })
    res.json({ message: Array.isArray(msg) ? msg[0] : msg })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
