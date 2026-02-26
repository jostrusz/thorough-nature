// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../../modules/supportbox"

export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const { id } = req.params
  const body = req.body as any

  try {
    const data: any = { id }
    if (body.display_name !== undefined) data.display_name = body.display_name
    if (body.resend_api_key !== undefined) data.resend_api_key = body.resend_api_key
    if (body.imap_host !== undefined) data.imap_host = body.imap_host?.trim() || null
    if (body.imap_port !== undefined) data.imap_port = body.imap_port ? parseInt(String(body.imap_port), 10) || null : null
    if (body.imap_user !== undefined) data.imap_user = body.imap_user?.trim() || null
    if (body.imap_password !== undefined) data.imap_password = body.imap_password?.trim() || null
    if (body.imap_tls !== undefined) data.imap_tls = body.imap_tls
    if (body.is_active !== undefined) data.is_active = body.is_active

    const config = await supportboxService.updateSupportboxConfigs(data)
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
