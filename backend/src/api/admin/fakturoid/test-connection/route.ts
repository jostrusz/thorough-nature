import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { testConnection } from "../../../../modules/fakturoid/api-client"

/**
 * POST /admin/fakturoid/test-connection
 *
 * Body: { slug, client_id, client_secret, user_agent_email }
 *
 * Tests the Fakturoid OAuth credentials by attempting to get an access token.
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const data = req.body as Record<string, any>

    if (
      !data.slug ||
      !data.client_id ||
      !data.client_secret ||
      !data.user_agent_email
    ) {
      res.status(400).json({
        error:
          "slug, client_id, client_secret, and user_agent_email are required",
      })
      return
    }

    const result = await testConnection({
      slug: data.slug,
      client_id: data.client_id,
      client_secret: data.client_secret,
      user_agent_email: data.user_agent_email,
    })

    res.json(result)
  } catch (error: any) {
    res.json({ success: false, error: error.message })
  }
}
