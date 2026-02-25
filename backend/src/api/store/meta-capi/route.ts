import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { META_PIXEL_MODULE } from "../../../modules/meta-pixel"
import type MetaPixelModuleService from "../../../modules/meta-pixel/service"
import {
  sendCAPIEvents,
  type CAPIEvent,
  type CAPIUserData,
  type CAPICustomData,
  type CAPIConfig,
} from "../../../modules/meta-pixel/capi"

/**
 * POST /store/meta-capi
 *
 * Receives a tracking event from the storefront, enriches it with
 * server-side data (IP, user-agent), hashes PII, and forwards to
 * Facebook Conversions API.
 *
 * This endpoint runs IN PARALLEL with the browser pixel (fbq) call.
 * The event_id MUST be identical to enable Facebook deduplication.
 *
 * Body: {
 *   project_id: string,
 *   event_name: string,       // EXACTLY matching browser pixel (case-sensitive)
 *   event_id: string,         // UUID v4, IDENTICAL to fbq eventID
 *   event_time: number,       // Unix seconds
 *   event_source_url: string, // window.location.href
 *   user_data: { em?, ph?, fn?, ln?, ct?, st?, zp?, country?, external_id?, fbc?, fbp? },
 *   custom_data?: { content_type?, content_ids?, value?, currency?, num_items?, contents? }
 * }
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const body = req.body as Record<string, any>

    // ── Validate required fields ──
    const { project_id, event_name, event_id } = body
    if (!project_id || !event_name || !event_id) {
      res.status(400).json({
        error: "project_id, event_name, and event_id are required",
      })
      return
    }

    // ── Look up pixel configuration ──
    const service = req.scope.resolve(META_PIXEL_MODULE) as MetaPixelModuleService
    const configs = await service.listMetaPixelConfigs({ project_id })

    if (!configs.length) {
      res.status(404).json({ error: `No Meta Pixel config for project "${project_id}"` })
      return
    }

    const pixelConfig = configs[0]
    if (!pixelConfig.enabled) {
      res.json({ success: false, error: "Pixel tracking disabled for this project" })
      return
    }

    // ── Extract server-side data ──
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (req as any).ip ||
      ""
    const clientUserAgent = (req.headers["user-agent"] as string) || ""

    // ── Build user_data ──
    const rawUserData: CAPIUserData = {
      ...(body.user_data || {}),
      client_ip_address: clientIp,
      client_user_agent: clientUserAgent,
    }

    // ── Build custom_data ──
    const customData: CAPICustomData | undefined = body.custom_data || undefined

    // ── Build event ──
    const event: CAPIEvent = {
      event_name,
      event_id,
      event_time: body.event_time || Math.floor(Date.now() / 1000),
      event_source_url: body.event_source_url || undefined,
      action_source: "website",
      user_data: rawUserData,
      custom_data: customData,
    }

    // ── Send to Facebook CAPI ──
    const capiConfig: CAPIConfig = {
      pixel_id: pixelConfig.pixel_id,
      access_token: pixelConfig.access_token,
      test_event_code: pixelConfig.test_event_code || undefined,
    }

    const result = await sendCAPIEvents(capiConfig, [event])

    res.json({
      success: result.success,
      fbtrace_id: result.fbtrace_id || null,
      events_received: result.events_received || null,
      error: result.error || null,
    })
  } catch (error: any) {
    console.error("[META CAPI] ✗ Unhandled error:", error)
    res.status(500).json({ success: false, error: error.message })
  }
}
