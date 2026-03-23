/**
 * /V1/event — Alternative webhook endpoint for mySTOCK WMS
 *
 * mySTOCK documentation specifies that the receiver must accept POST
 * requests at URI /V1/event. This route ensures we handle webhooks
 * regardless of which URL format mySTOCK uses.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { POST as mystockWebhookHandler } from "../../webhooks/mystock/route"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  console.log(`[mySTOCK Webhook] Incoming POST /V1/event — forwarding to webhook handler`)
  return mystockWebhookHandler(req, res)
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ data: { status: "ok", endpoint: "/V1/event", description: "mySTOCK WMS webhook receiver" }, errors: [] })
}
