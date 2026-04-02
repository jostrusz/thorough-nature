// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../../../modules/supportbox"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const { id } = req.params

  try {
    const existing = await supportboxService.retrieveSupportboxTicket(id)
    if (existing.status !== "new") {
      return res.json({ ticket: existing, changed: false })
    }

    const ticket = await supportboxService.updateSupportboxTickets({
      id,
      status: "read",
    })
    res.json({ ticket, changed: true })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
}
