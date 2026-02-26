// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../../modules/supportbox"

export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const { id } = req.params
  const body = req.body as any

  try {
    const config = await supportboxService.updateSupportboxConfigs({ id, ...body })
    res.json({ config })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const { id } = req.params

  try {
    await supportboxService.deleteSupportboxConfigs(id)
    res.json({ success: true })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
}
