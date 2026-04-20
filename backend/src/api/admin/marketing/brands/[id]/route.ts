import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"
import { encryptSecret } from "../../../../../modules/marketing/utils/crypto"

function mask(b: any) {
  const { resend_api_key_encrypted, ...rest } = b
  return { ...rest, resend_api_key_configured: !!resend_api_key_encrypted }
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
  const id = (req.params as any).id
  const [brand] = await service.listMarketingBrands({ id })
  if (!brand) {
    res.status(404).json({ error: "not_found" })
    return
  }
  res.json({ brand: mask(brand) })
}

const UPDATABLE_FIELDS = [
  "display_name",
  "storefront_domain",
  "marketing_from_email",
  "marketing_from_name",
  "marketing_reply_to",
  "primary_color",
  "logo_url",
  "locale",
  "timezone",
  "double_opt_in_enabled",
  "tracking_enabled",
  "brand_voice_profile",
  "abandoned_cart_owner",
  "enabled",
  "compliance_footer_html",
  "metadata",
  "resend_domain_id",
  "resend_audience_id",
]

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    const body = (req.body as any) || {}

    const update: any = { id }
    for (const key of UPDATABLE_FIELDS) {
      if (key in body) update[key] = body[key]
    }
    if (body.resend_api_key) {
      update.resend_api_key_encrypted = encryptSecret(body.resend_api_key)
    }
    if (body.resend_api_key === null) {
      // explicit null means "remove override"
      update.resend_api_key_encrypted = null
    }

    const brand = await service.updateMarketingBrands(update)
    res.json({ brand: mask(brand) })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    await service.deleteMarketingBrands(id)
    res.status(200).json({ id, deleted: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
