import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DEXTRUM_MODULE } from "../../../../modules/dextrum"
import { MyStockApiClient } from "../../../../modules/dextrum/api-client"

/**
 * Temporary debug endpoint to explore mySTOCK API.
 * GET /admin/dextrum/debug?path=/aboutMe/
 * GET /admin/dextrum/debug?path=/stockCard/1001/
 * GET /admin/dextrum/debug?path=/partner/
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any
    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
    const config = configs[0]

    if (!config) {
      res.status(400).json({ error: "No Dextrum configuration found" })
      return
    }

    const apiPath = (req.query.path as string) || "/aboutMe/"

    const client = new MyStockApiClient({
      apiUrl: config.api_url,
      username: config.api_username,
      password: config.api_password,
    })

    const result = await client.request("GET", apiPath)
    res.json({ path: apiPath, result })
  } catch (error: any) {
    console.error("Dextrum debug error:", error)
    res.status(500).json({ error: error.message, path: req.query.path })
  }
}
