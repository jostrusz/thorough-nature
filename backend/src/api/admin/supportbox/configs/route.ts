// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../modules/supportbox"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any

  try {
    const configs = await supportboxService.listSupportboxConfigs()
    res.json({ configs })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const body = req.body as any

  try {
    const data: any = {
      email_address: body.email_address,
      display_name: body.display_name,
      resend_api_key: body.resend_api_key,
      imap_tls: body.imap_tls ?? true,
      is_active: true,
    }

    // Only set optional fields if they have actual values (not empty strings)
    if (body.imap_host && body.imap_host.trim()) data.imap_host = body.imap_host.trim()
    if (body.imap_port) data.imap_port = parseInt(String(body.imap_port), 10) || null
    if (body.imap_user && body.imap_user.trim()) data.imap_user = body.imap_user.trim()
    if (body.imap_password && body.imap_password.trim()) data.imap_password = body.imap_password.trim()

    const config = await supportboxService.createSupportboxConfigs(data)
    res.status(201).json({ config })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
}
