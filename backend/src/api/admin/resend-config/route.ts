import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RESEND_CONFIG_MODULE } from "../../../modules/resend-config"
import type ResendConfigModuleService from "../../../modules/resend-config/service"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(RESEND_CONFIG_MODULE) as unknown as ResendConfigModuleService
  const configs = await service.listResendConfigs()

  const masked = configs.map((c: any) => ({
    ...c,
    api_key: c.api_key ? c.api_key.slice(0, 8) + "****" : null,
  }))

  res.json({ resend_configs: masked })
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(RESEND_CONFIG_MODULE) as unknown as ResendConfigModuleService
    const data = req.body as Record<string, any>

    if (!data.project_id || !data.label || !data.api_key || !data.from_email) {
      res.status(400).json({
        error: "project_id, label, api_key, and from_email are required",
      })
      return
    }

    if (!data.use_for) data.use_for = ["all"]
    const config = await service.createResendConfigs(data)
    res.status(201).json({ resend_config: config })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
