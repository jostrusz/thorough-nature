// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ComgateApiClient } from "../../../modules/payment-comgate/api-client"
import { Client } from "pg"

/**
 * GET /admin/comgate-methods
 * Diagnostic endpoint: queries Comgate API for all available payment methods.
 * Shows which methods are actually enabled for this merchant.
 *
 * Usage: https://your-backend/admin/comgate-methods?curr=CZK&country=CZ
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const curr = (req.query?.curr as string) || "CZK"
    const country = (req.query?.country as string) || "CZ"

    // Load Comgate config from DB
    const config = await loadConfig()
    if (!config) {
      res.status(404).json({ error: "No active Comgate gateway config found" })
      return
    }

    const isLive = config.mode === "live"
    let keys = isLive ? config.live_keys : config.test_keys
    if (typeof keys === "string") {
      try { keys = JSON.parse(keys) } catch { keys = null }
    }

    if (!keys?.api_key || !keys?.secret_key) {
      res.status(400).json({ error: "Invalid Comgate credentials" })
      return
    }

    const client = new ComgateApiClient(keys.api_key, keys.secret_key)
    const result = await client.getMethods({ curr, country })

    res.json({
      mode: isLive ? "live" : "test",
      query: { curr, country },
      methods: result.data,
      success: result.success,
      error: result.error,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

async function loadConfig(): Promise<any> {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return null

  let pgClient: Client | null = null
  try {
    pgClient = new Client({
      connectionString: dbUrl,
      ssl: dbUrl.includes("railway") ? { rejectUnauthorized: false } : undefined,
    })
    await pgClient.connect()
    const result = await pgClient.query(
      "SELECT * FROM gateway_config WHERE provider = $1 AND is_active = true AND deleted_at IS NULL LIMIT 1",
      ["comgate"]
    )
    return result.rows[0] || null
  } catch (e: any) {
    console.warn(`[Comgate Methods] DB query failed: ${e.message}`)
    return null
  } finally {
    if (pgClient) {
      try { await pgClient.end() } catch {}
    }
  }
}
