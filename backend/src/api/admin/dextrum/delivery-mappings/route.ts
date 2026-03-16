import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DEXTRUM_MODULE } from "../../../../modules/dextrum"

// GET /admin/dextrum/delivery-mappings — List all delivery mappings
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any

    const mappings = await dextrumService.listDextrumDeliveryMappings(
      {},
      { take: 200, order: { sales_channel_name: "ASC", shipping_option_name: "ASC" } }
    )

    res.json({ mappings })
  } catch (error: any) {
    console.error("Delivery mappings GET error:", error)
    res.status(500).json({ error: error.message })
  }
}

// POST /admin/dextrum/delivery-mappings — Create or update a delivery mapping
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any
    const body = req.body as any

    // Check for existing mapping with same key
    const existing = await dextrumService.listDextrumDeliveryMappings({
      sales_channel_id: body.sales_channel_id,
      shipping_option_id: body.shipping_option_id,
      is_cod: body.is_cod ?? false,
    }, { take: 1 })

    let mapping
    if (body.id) {
      // Update by explicit ID
      mapping = await dextrumService.updateDextrumDeliveryMappings({ id: body.id, ...body })
    } else if (existing[0]) {
      // Update existing mapping with same key
      mapping = await dextrumService.updateDextrumDeliveryMappings({ id: existing[0].id, ...body })
    } else {
      // Create new
      mapping = await dextrumService.createDextrumDeliveryMappings(body)
    }

    res.json({ mapping })
  } catch (error: any) {
    console.error("Delivery mapping POST error:", error)
    res.status(500).json({ error: error.message })
  }
}

// DELETE /admin/dextrum/delivery-mappings — Delete a delivery mapping by id (passed in body)
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any
    const { id } = req.body as any

    if (!id) {
      res.status(400).json({ error: "Missing mapping id" })
      return
    }

    await dextrumService.deleteDextrumDeliveryMappings(id)

    res.json({ success: true })
  } catch (error: any) {
    console.error("Delivery mapping DELETE error:", error)
    res.status(500).json({ error: error.message })
  }
}
