// @ts-nocheck
/**
 * GET /admin/huset/status — Huset WMS connection test + queue overview.
 * TestConnection validates the HashKey without side effects.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { HUSET_MODULE } from "../../../../modules/huset"
import { getHusetConfig } from "../../../../modules/huset/config"
import { buildHusetClient } from "../../../../modules/huset/send-order"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const config = getHusetConfig()
    const husetService = req.scope.resolve(HUSET_MODULE) as any

    let connection: { ok: boolean; error?: string } = { ok: false }
    if (!config.hashKey) {
      connection.error = "HUSET_HASHKEY not configured"
    } else {
      try {
        const client = buildHusetClient(config)
        connection.ok = await client.testConnection()
        if (!connection.ok) connection.error = "TestConnection returned false (check HashKey / CompanyId)"
      } catch (e: any) {
        connection.error = e.message
      }
    }

    const statuses = ["WAITING", "IMPORTED", "DISPATCHED", "FAILED", "CANCELLED"]
    const queue: Record<string, number> = {}
    for (const status of statuses) {
      const [, count] = await husetService.listAndCountHusetOrderMaps(
        { delivery_status: status },
        { take: 1 }
      )
      queue[status] = count
    }

    res.json({
      enabled: config.enabled,
      endpoint: config.endpoint,
      company_id: config.companyId,
      sales_org_id: config.salesOrgId,
      integration_id: config.integrationId,
      logistics_method_id: config.logisticsMethodId,
      article_ref: config.articleRef || null,
      project_slugs: config.projectSlugs,
      hash_key_configured: !!config.hashKey,
      connection,
      queue,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
