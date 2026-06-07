// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../../../modules/supportbox"
import { sendTicketReply } from "../../../../../../modules/supportbox/utils/send-ticket-reply"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const { id } = req.params
  const body = req.body as any

  try {
    const result = await sendTicketReply(supportboxService, id, {
      body_html: body.body_html,
      body_text: body.body_text,
      keep_open: body.keep_open,
      attachments: body.attachments,
    })
    res.json(result)
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
}
