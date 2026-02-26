// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../modules/supportbox"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const { config_id, status, q } = req.query as any

  try {
    const filters: any = {}
    if (config_id) filters.config_id = config_id
    if (status && status !== "all") filters.status = status

    let tickets = await supportboxService.listSupportboxTickets(filters, {
      order: { created_at: "DESC" },
      relations: ["messages"],
    })

    // Client-side search filter (subject/from_email)
    if (q) {
      const query = (q as string).toLowerCase()
      tickets = tickets.filter(
        (t: any) =>
          t.subject?.toLowerCase().includes(query) ||
          t.from_email?.toLowerCase().includes(query)
      )
    }

    res.json({ tickets })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
