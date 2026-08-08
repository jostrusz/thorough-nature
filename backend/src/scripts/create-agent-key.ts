// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function createAgentKey({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const apiKeyModule = container.resolve(Modules.API_KEY)
  const existing = await apiKeyModule.listApiKeys({ title: "support-agent-vps" })
  if (existing.length) {
    logger.info(`[AgentKey] already exists: ${existing[0].id} (token je videt jen pri vytvoreni)`)
    return
  }
  const key = await apiKeyModule.createApiKeys({
    title: "support-agent-vps",
    type: "secret",
    created_by: "vps-setup",
  })
  logger.info(`[AgentKey] TOKEN:${key.token}`)
}
