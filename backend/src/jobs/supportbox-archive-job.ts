// @ts-nocheck
/**
 * Scheduled Job: runs daily at 3:00 AM to archive old solved tickets
 * Moves tickets with status "solved" that were solved more than 30 days ago to status "old"
 */
import { MedusaContainer } from "@medusajs/framework/types"
import { SUPPORTBOX_MODULE } from "../modules/supportbox"

export default async function supportboxArchiveJob(container: MedusaContainer) {
  const supportboxService = container.resolve(SUPPORTBOX_MODULE) as any

  try {
    // Get all solved tickets
    const solvedTickets = await supportboxService.listSupportboxTickets({
      status: "solved",
    })

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    let archived = 0
    for (const ticket of solvedTickets) {
      if (ticket.solved_at && new Date(ticket.solved_at) < thirtyDaysAgo) {
        await supportboxService.updateSupportboxTickets({
          id: ticket.id,
          status: "old",
        })
        archived++
      }
    }

    console.log(`[SupportBox] Daily archive: ${archived} tickets archived`)
  } catch (error: any) {
    console.error("[SupportBox] Archive job failed:", error.message)
  }
}

export const config = {
  name: "supportbox-auto-archive",
  schedule: "0 3 * * *", // Every day at 3:00 AM
}
