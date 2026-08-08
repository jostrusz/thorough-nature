// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORT_COMMAND_MODULE } from "../../../../modules/support-command"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const sc = req.scope.resolve(SUPPORT_COMMAND_MODULE) as any
  const rows = await sc.listAgentSettings({ key: "agent_enabled" }, { take: 1 })
  res.json({ agent_enabled: rows.length ? rows[0].value?.enabled !== false : true })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const sc = req.scope.resolve(SUPPORT_COMMAND_MODULE) as any
  const { agent_enabled } = req.body as any
  const rows = await sc.listAgentSettings({ key: "agent_enabled" }, { take: 1 })
  if (rows.length) {
    await sc.updateAgentSettings({ id: rows[0].id, value: { enabled: !!agent_enabled } })
  } else {
    await sc.createAgentSettings({ key: "agent_enabled", value: { enabled: !!agent_enabled } })
  }
  res.json({ agent_enabled: !!agent_enabled })
}
