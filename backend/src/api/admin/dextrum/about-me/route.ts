import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DEXTRUM_MODULE } from "../../../../modules/dextrum"
import { MyStockApiClient } from "../../../../modules/dextrum/api-client"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any
    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
    const config = configs[0]

    if (!config) {
      res.status(400).json({ error: "No Dextrum configuration found" })
      return
    }

    const client = new MyStockApiClient({
      apiUrl: config.api_url,
      username: config.api_username,
      password: config.api_password,
    })

    const aboutMe = await client.aboutMe()
    res.json({ aboutMe })
  } catch (error: any) {
    console.error("Dextrum aboutMe error:", error)
    res.status(500).json({ error: error.message })
  }
}
