import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DEXTRUM_MODULE } from "../../../modules/dextrum"

// GET /admin/dextrum — Get Dextrum config
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any

    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
    const config = configs[0] || null

    res.json({ config })
  } catch (error: any) {
    console.error("Dextrum config GET error:", error)
    res.status(500).json({ error: error.message })
  }
}

// POST /admin/dextrum — Create or update Dextrum config
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any
    const body = req.body as any

    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })

    let config
    if (configs[0]) {
      // Update existing
      config = await dextrumService.updateDextrumConfigs({ id: configs[0].id, ...body })
    } else {
      // Create new
      config = await dextrumService.createDextrumConfigs(body)
    }

    res.json({ config })
  } catch (error: any) {
    console.error("Dextrum config POST error:", error)
    res.status(500).json({ error: error.message })
  }
}
