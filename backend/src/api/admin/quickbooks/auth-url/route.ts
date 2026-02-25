import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { QUICKBOOKS_MODULE } from "../../../../modules/quickbooks"
import type QuickBooksModuleService from "../../../../modules/quickbooks/service"
import { generateAuthUrl } from "../../../../modules/quickbooks/api-client"

/**
 * POST /admin/quickbooks/auth-url
 *
 * Body: { config_id }
 *
 * Generates an OAuth authorization URL for the QuickBooks config.
 * State parameter carries config_id for the callback to look up.
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const service = req.scope.resolve(
      QUICKBOOKS_MODULE
    ) as unknown as QuickBooksModuleService
    const data = req.body as Record<string, any>

    if (!data.config_id) {
      res.status(400).json({ error: "config_id is required" })
      return
    }

    const config = await service.retrieveQuickBooksConfig(data.config_id)
    const c = config as any

    if (!c.redirect_uri) {
      res.status(400).json({
        error:
          "redirect_uri must be set on the config before connecting",
      })
      return
    }

    const authUrl = generateAuthUrl({
      client_id: c.client_id,
      redirect_uri: c.redirect_uri,
      state: c.id, // config_id as state for callback lookup
    })

    res.json({ auth_url: authUrl })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
