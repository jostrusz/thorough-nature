import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * GET /webhooks/server-ip
 * Returns the outbound IP of this server (for firewall whitelisting)
 * No authentication required — temporary utility endpoint
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const response = await fetch("https://api.ipify.org?format=json")
    const data = await response.json() as { ip: string }
    res.json({ ip: data.ip })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
