// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORT_COMMAND_MODULE } from "../../../../../modules/support-command"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const sc = req.scope.resolve(SUPPORT_COMMAND_MODULE) as any
  try {
    const existing = await sc.listAgentConversations({ kind: "dm" }, { take: 1 })
    if (existing.length) return res.json({ conversation: existing[0] })
    const conv = await sc.createAgentConversations({
      kind: "dm",
      title: "Agent",
      status: "idle",
      last_activity_at: new Date().toISOString(),
    })
    res.json({ conversation: Array.isArray(conv) ? conv[0] : conv })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
