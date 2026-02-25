import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DEXTRUM_MODULE } from "../../../../modules/dextrum"
import { MyStockApiClient } from "../../../../modules/dextrum/api-client"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any

    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
    const config = configs[0]

    if (!config) {
      res.status(400).json({ ok: false, message: "No Dextrum configuration found. Please save your API credentials first." })
      return
    }

    const client = new MyStockApiClient({
      apiUrl: config.api_url,
      username: config.api_username,
      password: config.api_password,
    })

    const result = await client.testConnection()

    // Update connection status
    await dextrumService.updateDextrumConfigs(config.id, {
      connection_status: result.ok ? "connected" : "error",
      last_connection_test: new Date().toISOString(),
    })

    res.json(result)
  } catch (error: any) {
    console.error("Dextrum test connection error:", error)
    res.status(500).json({ ok: false, message: error.message })
  }
}
