import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"
import { encryptSecret } from "../../../../modules/marketing/utils/crypto"

function mask(b: any) {
  const { resend_api_key_encrypted, ...rest } = b
  return {
    ...rest,
    resend_api_key_configured: !!resend_api_key_encrypted,
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
  const brands = await service.listMarketingBrands({})
  res.json({ brands: brands.map(mask) })
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const body = (req.body as any) || {}

    const required = ["slug", "display_name", "project_id", "marketing_from_email", "marketing_from_name"]
    for (const key of required) {
      if (!body[key]) {
        res.status(400).json({ error: `${key} is required` })
        return
      }
    }

    const data: any = {
      slug: String(body.slug).toLowerCase().trim(),
      display_name: body.display_name,
      project_id: body.project_id,
      storefront_domain: body.storefront_domain ?? null,
      marketing_from_email: body.marketing_from_email,
      marketing_from_name: body.marketing_from_name,
      marketing_reply_to: body.marketing_reply_to ?? null,
      primary_color: body.primary_color ?? null,
      logo_url: body.logo_url ?? null,
      locale: body.locale ?? "nl",
      timezone: body.timezone ?? "Europe/Amsterdam",
      double_opt_in_enabled: body.double_opt_in_enabled ?? false,
      tracking_enabled: body.tracking_enabled ?? true,
      abandoned_cart_owner: body.abandoned_cart_owner ?? "transactional_legacy",
      enabled: body.enabled ?? true,
      metadata: body.metadata ?? null,
    }

    if (body.resend_api_key) {
      data.resend_api_key_encrypted = encryptSecret(body.resend_api_key)
    }

    const brand = await service.createMarketingBrands(data)
    res.status(201).json({ brand: mask(brand) })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
