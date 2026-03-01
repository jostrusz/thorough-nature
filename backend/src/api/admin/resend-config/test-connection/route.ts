import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Resend } from "resend"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const data = req.body as Record<string, any>

    if (!data.api_key) {
      res.status(400).json({ error: "api_key is required" })
      return
    }

    const resend = new Resend(data.api_key)
    const { data: domains, error } = await resend.domains.list()

    if (error) {
      res.json({ success: false, error: error.message })
      return
    }

    res.json({
      success: true,
      domains_count: domains?.data?.length ?? 0,
    })
  } catch (error: any) {
    res.json({ success: false, error: error.message })
  }
}
