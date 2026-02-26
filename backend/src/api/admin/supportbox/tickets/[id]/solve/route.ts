// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../../../modules/supportbox"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const { id } = req.params

  try {
    const ticket = await supportboxService.updateSupportboxTickets({
      id,
      status: "solved",
      solved_at: new Date(),
    })
    res.json({ ticket })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
}
