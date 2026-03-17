import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PROFITABILITY_MODULE } from "../modules/profitability"
import { syncProjectDay } from "./sync-ad-spend"

/**
 * Nightly Stats Recalculation Job
 *
 * Runs daily at 00:05 UTC:
 * - Recalculates the last 30 days for all active projects
 * - Ensures data integrity for completed days (catches refunds, corrections, etc.)
 */
export default async function recalculateDailyStatsJob(container: MedusaContainer) {
  const logger = container.resolve("logger") as any
  const profitService = container.resolve(PROFITABILITY_MODULE) as any
  const queryService = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    // Generate last 30 days
    const dates: string[] = []
    const now = new Date()
    for (let i = 0; i < 30; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      dates.push(d.toISOString().split("T")[0])
    }

    logger.info(`[RecalcStats] Recalculating last 30 days (${dates[dates.length - 1]} → ${dates[0]})...`)

    // Get Meta Ads token
    const metaConfigs = await profitService.listMetaAdsConfigs({}, { take: 1 })
    const metaConfig = metaConfigs[0]
    const hasValidToken = metaConfig?.access_token && metaConfig?.token_status === "valid"

    // Get all active projects
    const projects = await profitService.listProjectConfigs(
      { is_active: true },
      { take: 100 }
    )

    let syncedCount = 0

    for (const project of projects) {
      const p = project as any

      for (const date of dates) {
        try {
          await syncProjectDay({
            project: p,
            date,
            hasValidToken,
            metaConfig,
            profitService,
            queryService,
            logger,
          })
          syncedCount++
        } catch (err: any) {
          logger.error(`[RecalcStats] Failed to recalc ${p.project_slug} for ${date}: ${err.message}`)
        }
      }
    }

    logger.info(`[RecalcStats] Recalculated ${syncedCount} project-days (${projects.length} projects × ${dates.length} days)`)
  } catch (error: any) {
    logger.error(`[RecalcStats] Job failed: ${error.message}`)
  }
}

export const config = {
  name: "recalculate-daily-stats",
  schedule: "5 0 * * *",
}
