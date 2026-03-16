import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DEXTRUM_MODULE } from "../../../modules/dextrum"
import { MyStockApiClient } from "../../../modules/dextrum/api-client"

/**
 * TEMPORARY endpoint to set up warehouse stock via mySTOCK API.
 * POST /dextrum-debug/warehouse-setup
 *
 * Steps:
 * 1. Update products to be linked to warehouse 1001
 * 2. Create a receipt to put products into stock
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
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

    const warehouseCode = config.default_warehouse_code || "1001"
    const partnerId = config.partner_id || "KONCOVY_U0123"
    const results: any = { steps: [] }

    // Products to set up (from mySTOCK sortiment)
    const products = [
      { code: "DH8672749223", name: "De Hondenbijbel", quantity: 1000 },
      { code: "LLWJK7824627392", name: "Laat Los Wat Je Kapotmaakt", quantity: 1000 },
    ]

    // Step 1: Try to update products with warehouseCode
    for (const product of products) {
      try {
        // Use ext. system code as productId (same as how products were created)
        const updateResult = await client.updateProduct(product.code, {
          warehouseCode,
        })
        results.steps.push({
          step: `updateProduct ${product.code}`,
          status: "ok",
          data: updateResult,
        })
      } catch (error: any) {
        results.steps.push({
          step: `updateProduct ${product.code}`,
          status: "error",
          error: error.message,
        })
      }
    }

    // Step 2: Create receipt to put products in stock
    try {
      const now = new Date()
      const receiptCode = `R-INIT-${now.toISOString().slice(0, 10).replace(/-/g, "")}`

      const receiptResult = await client.createReceipt({
        receiptCode,
        type: 1, // External receipt
        warehouseCode,
        partnerId,
        receiptDate: `${now.toISOString().slice(0, 10)} 00:00:00.000`,
        items: products.map((p) => ({
          productId: p.code, // ext. system code
          quantity: p.quantity,
        })),
      })

      results.steps.push({
        step: "createReceipt",
        status: "ok",
        data: receiptResult,
      })
    } catch (error: any) {
      results.steps.push({
        step: "createReceipt",
        status: "error",
        error: error.message,
      })
    }

    res.json(results)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
