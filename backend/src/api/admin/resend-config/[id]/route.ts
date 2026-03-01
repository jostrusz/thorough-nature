import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RESEND_CONFIG_MODULE } from "../../../../modules/resend-config"
import type ResendConfigModuleService from "../../../../modules/resend-config/service"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(RESEND_CONFIG_MODULE) as unknown as ResendConfigModuleService
  try {
    const config = await service.retrieveResendConfig(id)
    res.json({
      resend_config: {
        ...config,
        api_key: (config as any).api_key
          ? (config as any).api_key.slice(0, 8) + "****"
          : null,
      },
    })
  } catch (error: any) {
    res.status(404).json({ error: "Resend config not found" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(RESEND_CONFIG_MODULE) as unknown as ResendConfigModuleService
  try {
    const data = req.body as Record<string, any>
    const config = await service.updateResendConfigs({ id, ...data })
    res.json({ resend_config: config })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(RESEND_CONFIG_MODULE) as unknown as ResendConfigModuleService
  try {
    await service.deleteResendConfigs(id)
    res.json({ success: true, deleted: id })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
