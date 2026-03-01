import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Resend } from "resend"
import { RESEND_CONFIG_MODULE } from "../../../../../modules/resend-config"
import type ResendConfigModuleService from "../../../../../modules/resend-config/service"

async function getResendClient(
  req: MedusaRequest,
  configId: string
): Promise<Resend> {
  const service = req.scope.resolve(RESEND_CONFIG_MODULE) as unknown as ResendConfigModuleService
  const config = (await service.retrieveResendConfig(configId)) as any
  if (!config?.api_key) {
    throw new Error("Resend config not found or missing API key")
  }
  return new Resend(config.api_key)
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const { domainId } = req.params
    const configId = req.query.configId as string
    if (!configId) {
      res.status(400).json({ error: "configId query param is required" })
      return
    }

    const resend = await getResendClient(req, configId)
    const { data, error } = await resend.domains.get(domainId)

    if (error) {
      res.status(400).json({ error: error.message })
      return
    }

    res.json({ domain: data })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const { domainId } = req.params
    const configId = req.query.configId as string
    if (!configId) {
      res.status(400).json({ error: "configId query param is required" })
      return
    }

    const resend = await getResendClient(req, configId)
    const { data, error } = await resend.domains.remove(domainId)

    if (error) {
      res.status(400).json({ error: error.message })
      return
    }

    res.json({ success: true, deleted: domainId })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
