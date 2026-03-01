import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Resend } from "resend"
import { RESEND_CONFIG_MODULE } from "../../../../../../modules/resend-config"
import type ResendConfigModuleService from "../../../../../../modules/resend-config/service"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const { domainId } = req.params
    const body = req.body as Record<string, any>
    const configId = body.configId as string

    if (!configId) {
      res.status(400).json({ error: "configId is required" })
      return
    }

    const service = req.scope.resolve(RESEND_CONFIG_MODULE) as unknown as ResendConfigModuleService
    const config = (await service.retrieveResendConfig(configId)) as any
    if (!config?.api_key) {
      res.status(404).json({ error: "Resend config not found or missing API key" })
      return
    }

    const resend = new Resend(config.api_key)
    const { data, error } = await resend.domains.verify(domainId)

    if (error) {
      res.status(400).json({ error: error.message })
      return
    }

    res.json({ success: true, domain: data })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
