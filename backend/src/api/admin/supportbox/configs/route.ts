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
    const config = await supportboxService.createSupportboxConfigs({
      email_address: body.email_address,
      display_name: body.display_name,
      resend_api_key: body.resend_api_key,
      imap_host: body.imap_host,
      imap_port: body.imap_port,
      imap_user: body.imap_user,
      imap_password: body.imap_password,
      imap_tls: body.imap_tls ?? true,
      is_active: true,
    })
    res.status(201).json({ config })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
}
