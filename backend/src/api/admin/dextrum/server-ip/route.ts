import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * GET /admin/dextrum/server-ip
 * Returns the outbound IP address of this server (useful for firewall whitelisting)
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
