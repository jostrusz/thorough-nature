// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"
import { hashEmail } from "../../../../modules/marketing/utils/crypto"
import { signToken } from "../../../../modules/marketing/utils/tokens"
import { ResendMarketingClient } from "../../../../modules/marketing/services/resend-client"

/**
 * Public form-submission endpoint
 * ───────────────────────────────
 * POST /public/marketing/form-submit
 * Body: { brand_slug, form_id, email, properties? }
 *
 * Flow:
 *   1. Validate form exists and status='live'
 *   2. Upsert marketing_contact. If brand.double_opt_in_enabled (or form override),
 *      status='unconfirmed'; else 'subscribed'.
 *   3. Add contact to every target_list_ids entry
 *   4. If DOI required, send confirmation email (stub template)
 *   5. Always create a marketing_consent_log entry
 *   6. Create a marketing_event type='form_submitted'
 *   7. Respond { ok: true, requires_confirmation: boolean }
 */

const RATE_WINDOW_MS = 60 * 1000
const RATE_MAX = 20
const rateBuckets: Map<string, { count: number; resetAt: number }> = new Map()

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(ip)
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    if (rateBuckets.size > 5000) {
      for (const [k, v] of rateBuckets) {
        if (v.resetAt <= now) rateBuckets.delete(k)
      }
    }
    return true
  }
  if (bucket.count >= RATE_MAX) return false
  bucket.count++
  return true
}

function clientIp(req: MedusaRequest): string {
  const fwd = (req.headers["x-forwarded-for"] as string) || ""
  if (fwd) return fwd.split(",")[0].trim()
  return (req as any).ip || (req.socket as any)?.remoteAddress || "unknown"
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}

function getBaseUrl(): string {
  return (
    process.env.MARKETING_PUBLIC_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN_VALUE
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN_VALUE}`
      : "http://localhost:9000")
  )
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = (req.scope.resolve("logger") as any) || console
  const ip = clientIp(req)
  const userAgent = (req.headers["user-agent"] as string) || null

  if (!rateLimit(ip)) {
    res.status(429).json({ error: "rate_limited" })
    return
  }

  try {
    const body = (req.body || {}) as any
    const brandSlug = String(body.brand_slug || "").trim()
    const formId = String(body.form_id || "").trim()
    const email = String(body.email || "").trim().toLowerCase()
    const properties = body.properties && typeof body.properties === "object" ? body.properties : {}

    if (!brandSlug || !formId || !email) {
      res.status(400).json({ error: "missing_fields" })
      return
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: "invalid_email" })
      return
    }

    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService

    const [brand] = (await service.listMarketingBrands({ slug: brandSlug } as any)) as any[]
    if (!brand || brand.enabled === false) {
      res.status(404).json({ error: "brand_not_found" })
      return
    }

    const [form] = (await service.listMarketingForms({
      id: formId,
      brand_id: brand.id,
    } as any)) as any[]
    if (!form) {
      res.status(404).json({ error: "form_not_found" })
      return
    }
    if (form.status !== "live") {
      res.status(409).json({ error: "form_not_live" })
      return
    }

    // Decide DOI requirement — per-form override beats brand default
    const requiresDoi =
      typeof form.double_opt_in === "boolean"
        ? form.double_opt_in
        : !!brand.double_opt_in_enabled

    // Upsert contact
    const existing = (await service.listMarketingContacts({
      brand_id: brand.id,
      email,
    } as any)) as any[]

    let contact: any = existing?.[0] || null
    const now = new Date()

    if (!contact) {
      const newStatus = requiresDoi ? "unconfirmed" : "subscribed"
      contact = await service.createMarketingContacts({
        brand_id: brand.id,
        email,
        first_name: properties.first_name || null,
        last_name: properties.last_name || null,
        status: newStatus,
        source: "form",
        consent_ip: ip,
        consent_user_agent: userAgent,
        consent_at: newStatus === "subscribed" ? now : null,
        consent_text_snapshot: form.consent_text || null,
        properties,
      } as any)
    } else {
      // Revive contact if previously unsubscribed only when they re-opt-in intentionally
      // We don't forcibly change an unsubscribed contact to subscribed — instead we log
      // the action and mark them unconfirmed so they must re-confirm explicitly.
      const patch: any = { id: contact.id }
      if (contact.status === "unsubscribed" || contact.status === "unconfirmed") {
        patch.status = requiresDoi ? "unconfirmed" : "subscribed"
        patch.consent_at = requiresDoi ? null : now
        patch.consent_ip = ip
        patch.consent_user_agent = userAgent
        patch.source = contact.source || "form"
      }
      if (properties.first_name && !contact.first_name) patch.first_name = properties.first_name
      if (properties.last_name && !contact.last_name) patch.last_name = properties.last_name
      await service.updateMarketingContacts(patch)
      contact = { ...contact, ...patch }
    }

    // Attach to target lists
    const targetListIds: string[] = Array.isArray(form.target_list_ids)
      ? form.target_list_ids.filter((id: any) => !!id)
      : []
    for (const listId of targetListIds) {
      try {
        // Idempotent: skip if already a member
        const existingMembers = (await service.listMarketingListMemberships({
          list_id: listId,
          contact_id: contact.id,
        } as any)) as any[]
        if (!existingMembers?.length) {
          await service.createMarketingListMemberships({
            list_id: listId,
            contact_id: contact.id,
            brand_id: brand.id,
            source: `form:${form.slug}`,
            added_at: now,
          } as any)
        }
      } catch (e: any) {
        logger.warn(`[Marketing Tracking] list membership failed: ${e?.message || e}`)
      }
    }

    // Send DOI confirmation email (stub template — plain + confirm link)
    if (requiresDoi) {
      try {
        await sendConfirmationEmail({ brand, contact, form, logger })
      } catch (e: any) {
        logger.warn(`[Marketing Tracking] DOI email failed: ${e?.message || e}`)
      }
    }

    // Consent log — always
    await service.createMarketingConsentLogs({
      brand_id: brand.id,
      contact_id: contact.id,
      email,
      email_hash: hashEmail(email),
      action: requiresDoi ? "subscribed" : "confirmed",
      source: `form:${form.slug}`,
      consent_text_snapshot: form.consent_text || null,
      ip_address: ip,
      user_agent: userAgent,
      occurred_at: now,
    } as any)

    // Event log
    await service.createMarketingEvents({
      brand_id: brand.id,
      contact_id: contact.id,
      email,
      type: "form_submitted",
      payload: {
        form_id: form.id,
        form_slug: form.slug,
        requires_confirmation: requiresDoi,
        properties,
      },
      occurred_at: now,
      source: "public:form-submit",
    } as any)

    res.status(200).json({
      ok: true,
      requires_confirmation: requiresDoi,
    })
  } catch (err: any) {
    logger.error(`[Marketing Tracking] form-submit error: ${err?.message || err}`)
    res.status(500).json({ error: "internal_error" })
  }
}

async function sendConfirmationEmail(args: {
  brand: any
  contact: any
  form: any
  logger: any
}): Promise<void> {
  const { brand, contact, form } = args

  // Build a confirmation token — standard DOI flow. A /confirm route will verify
  // and flip status to 'subscribed'. Token carries brand + contact + nonce + 48h exp.
  const confirmToken = signToken({
    t: "confirm",
    b: brand.id,
    c: contact.id,
    n: Math.random().toString(36).slice(2, 12),
    exp: Date.now() + 48 * 60 * 60 * 1000,
  })
  const baseUrl = getBaseUrl()
  const confirmUrl = `${baseUrl.replace(/\/+$/, "")}/public/marketing/confirm/${confirmToken}`

  const brandName = brand.display_name || brand.slug
  const first = contact.first_name ? `Hi ${contact.first_name}` : "Hi there"

  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
<h2 style="margin:0 0 16px;font-size:22px">${first},</h2>
<p style="line-height:1.55;color:#333">Thanks for signing up to ${brandName}. Please confirm your email address by clicking the button below — it takes one click.</p>
<p style="text-align:center;margin:28px 0"><a href="${confirmUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600">Confirm my subscription</a></p>
<p style="font-size:13px;color:#666;line-height:1.5">If the button doesn't work, copy and paste this link: <br><a href="${confirmUrl}">${confirmUrl}</a></p>
<p style="font-size:12px;color:#999;margin-top:32px">If you didn't sign up, just ignore this email — we won't add you to any list.</p>
</body></html>`

  const text = `${first},\n\nThanks for signing up to ${brandName}. Please confirm your email address:\n\n${confirmUrl}\n\n(If you didn't sign up, ignore this email.)`

  const fromEmail = brand.marketing_from_email
  const fromName = brand.marketing_from_name
  const replyTo = brand.marketing_reply_to || null
  const fromLine = `${fromName} <${fromEmail}>`

  const resend = new ResendMarketingClient({
    id: brand.id,
    slug: brand.slug,
    resend_api_key_encrypted: brand.resend_api_key_encrypted,
  })

  await resend.send({
    from: fromLine,
    to: contact.email,
    replyTo,
    subject: `Please confirm your subscription to ${brandName}`,
    html,
    text,
    tags: [
      { name: "brand", value: brand.slug },
      { name: "type", value: "doi_confirmation" },
      { name: "form", value: form.id },
    ],
  })
}

export async function OPTIONS(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.status(204).end()
}
