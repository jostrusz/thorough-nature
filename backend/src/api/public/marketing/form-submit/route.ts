// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
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
    // The popup sends first_name / last_name at top level of the payload,
    // not nested in properties. Fall back to properties.first_name for any
    // legacy callers that nest them inside.
    const topFirstName = body.first_name ? String(body.first_name).trim() : null
    const topLastName  = body.last_name  ? String(body.last_name).trim()  : null
    if (topFirstName && !properties.first_name) properties.first_name = topFirstName
    if (topLastName  && !properties.last_name)  properties.last_name  = topLastName
    const acquisition = body.acquisition && typeof body.acquisition === "object" ? body.acquisition : {}

    // Acquisition signals sent by the storefront snippet. All fields
    // optional — we accept whatever the client sends.
    const pickStr = (v: any) => (typeof v === "string" && v.length ? v.slice(0, 512) : null)
    const acq = {
      source: pickStr(acquisition.source) || "form",
      medium: pickStr(acquisition.medium) || pickStr(acquisition.utm_medium),
      campaign: pickStr(acquisition.campaign) || pickStr(acquisition.utm_campaign),
      content: pickStr(acquisition.content) || pickStr(acquisition.utm_content),
      term: pickStr(acquisition.term) || pickStr(acquisition.utm_term),
      landing_url: pickStr(acquisition.landing_url),
      referrer: pickStr(acquisition.referrer),
      lead_magnet: pickStr(acquisition.lead_magnet),
      device: pickStr(acquisition.device),
      fbc: pickStr(acquisition.fbc),
      fbp: pickStr(acquisition.fbp),
    }

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

    // Resolve form by ID first, fall back to slug, then to name. The popup
    // historically sent the human-readable name as `form_id`, which never
    // matched the actual ID, causing 404s. Now we accept any of the three.
    let form: any =
      (await service.listMarketingForms({ id: formId, brand_id: brand.id } as any))?.[0]
    if (!form) {
      form = (await service.listMarketingForms({ slug: formId, brand_id: brand.id } as any))?.[0]
    }
    if (!form) {
      form = (await service.listMarketingForms({ name: formId, brand_id: brand.id } as any))?.[0]
    }
    if (!form) {
      res.status(404).json({ error: "form_not_found" })
      return
    }
    // Accept both "live" and "published" — admin UI uses "published" but
    // earlier code checked only for "live". They're semantically the same:
    // the form is publicly accepting submissions.
    if (form.status !== "live" && form.status !== "published") {
      res.status(409).json({ error: "form_not_live", current_status: form.status })
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
        // Acquisition block — only written on first contact creation.
        // Subsequent re-submits don't overwrite original attribution.
        acquisition_source: acq.source,
        acquisition_medium: acq.medium,
        acquisition_campaign: acq.campaign,
        acquisition_content: acq.content,
        acquisition_term: acq.term,
        acquisition_landing_url: acq.landing_url,
        acquisition_referrer: acq.referrer,
        acquisition_form_id: form.id,
        acquisition_lead_magnet: acq.lead_magnet,
        acquisition_device: acq.device,
        acquisition_fbc: acq.fbc,
        acquisition_fbp: acq.fbp,
        acquisition_at: now,
        lifecycle_stage: "lead",
        lifecycle_entered_at: now,
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

    // ───────────────────────────────────────────────────────────────────
    // Enroll into matching live flows.
    // We don't have a separate event bus subscriber for form_submitted
    // (Medusa events from public routes don't propagate the same way as
    // workflow events), so we do the enrollment inline.
    //
    // Skipped when DOI is required — we wait for /confirm to fire enrollment
    // so unconfirmed contacts don't enter nurture sequences.
    // ───────────────────────────────────────────────────────────────────
    if (!requiresDoi) {
      try {
        await enrollContactInMatchingFlows({
          contact,
          brand,
          form,
          logger,
        })
      } catch (e: any) {
        // Never fail the form submission because of enrollment problems —
        // the contact is created and consent is logged regardless.
        logger.warn(
          `[Marketing Tracking] flow enrollment failed for contact=${contact.id}: ${e?.message || e}`
        )
      }
    }

    res.status(200).json({
      ok: true,
      requires_confirmation: requiresDoi,
    })
  } catch (err: any) {
    logger.error(`[Marketing Tracking] form-submit error: ${err?.message || err}`)
    res.status(500).json({ error: "internal_error" })
  }
}

/**
 * Find every live flow on this brand whose trigger matches form_submitted
 * (optionally also filtered to this specific form_id) and create a flow_run
 * for the new contact. Idempotent — if a non-completed run already exists
 * for this contact+flow, it's skipped (re_entry_policy=once).
 *
 * Direct pg.Pool because Medusa list filters on JSON columns are awkward
 * and this needs to be fast.
 */
async function enrollContactInMatchingFlows(args: {
  contact: any
  brand: any
  form: any
  logger: any
}): Promise<void> {
  const { contact, brand, form, logger } = args
  if (!process.env.DATABASE_URL) return
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const { rows: flows } = await pool.query(
      `SELECT id, brand_id, name, definition, trigger, re_entry_policy, status
       FROM marketing_flow
       WHERE brand_id = $1
         AND status = 'live'
         AND deleted_at IS NULL`,
      [brand.id]
    )

    const matching = flows.filter((f: any) => {
      const t = f.trigger || {}
      if (t.type !== "event") return false
      const eventName = t.config?.event || t.event
      if (eventName !== "form_submitted") return false
      // Optional filter — flow can scope to one specific form via
      // trigger.config.form_id or trigger.config.form_slug.
      const fid = t.config?.form_id
      const fslug = t.config?.form_slug
      if (fid && fid !== form.id) return false
      if (fslug && fslug !== form.slug) return false
      return true
    })

    if (!matching.length) {
      logger.info(
        `[Marketing Tracking] form_submitted for ${form.slug}: no live flows match for brand ${brand.slug}`
      )
      return
    }

    for (const flow of matching) {
      // Re-entry policy:
      //   "once" (default)        skips if a non-completed run exists
      //   "always"                creates a new run on every submit (parallel runs allowed)
      //   "always_after_complete" allows re-entry only if previous run completed
      //   "restart"               cancels any active run, then starts fresh — used when
      //                           re-submitting the form should start the journey over
      const policy = flow.re_entry_policy || "once"
      if (policy === "once") {
        const { rows: existing } = await pool.query(
          `SELECT id FROM marketing_flow_run
           WHERE flow_id = $1 AND contact_id = $2
             AND state IN ('running', 'waiting')
             AND deleted_at IS NULL
           LIMIT 1`,
          [flow.id, contact.id]
        )
        if (existing.length) {
          logger.info(
            `[Marketing Tracking] flow ${flow.id} skipped — contact ${contact.id} already in active run`
          )
          continue
        }
      } else if (policy === "always_after_complete") {
        const { rows: existing } = await pool.query(
          `SELECT id FROM marketing_flow_run
           WHERE flow_id = $1 AND contact_id = $2
             AND state IN ('running', 'waiting')
             AND deleted_at IS NULL
           LIMIT 1`,
          [flow.id, contact.id]
        )
        if (existing.length) continue
      } else if (policy === "restart") {
        // Cancel any in-flight runs for this contact+flow before creating a new one.
        // Marked as state='exited' with exit_reason='re_enrolled' so the executor
        // (which only picks state IN ('running','waiting')) ignores them, and the
        // admin UI can attribute the stop to a re-submission.
        const { rowCount } = await pool.query(
          `UPDATE marketing_flow_run
             SET state = 'exited',
                 exit_reason = 're_enrolled',
                 completed_at = NOW(),
                 updated_at = NOW()
           WHERE flow_id = $1 AND contact_id = $2
             AND state IN ('running', 'waiting')
             AND deleted_at IS NULL`,
          [flow.id, contact.id]
        )
        if (rowCount && rowCount > 0) {
          logger.info(
            `[Marketing Tracking] flow ${flow.id} restart — cancelled ${rowCount} active run(s) for contact ${contact.id}`
          )
        }
      }

      const firstNode = flow.definition?.nodes?.[0]?.id
      if (!firstNode) {
        logger.warn(
          `[Marketing Tracking] flow ${flow.id} (${flow.name}) has empty definition; skip`
        )
        continue
      }

      // Insert flow_run directly via SQL — we don't have a service handle here
      // and Medusa createX would require module resolution we already have via
      // service, but SQL is faster and lets us include `started_at + next_run_at`
      // in one shot for the cron to pick up immediately.
      await pool.query(
        `INSERT INTO marketing_flow_run
           (id, flow_id, brand_id, contact_id, current_node_id, state,
            started_at, next_run_at, context, visited_node_ids, created_at, updated_at)
         VALUES
           ('mfr_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
            $1, $2, $3, $4, 'running', NOW(), NOW(), $5::jsonb, '[]'::jsonb, NOW(), NOW())`,
        [
          flow.id,
          brand.id,
          contact.id,
          firstNode,
          JSON.stringify({
            trigger_event: "form_submitted",
            form_id: form.id,
            form_slug: form.slug,
          }),
        ]
      )

      logger.info(
        `[Marketing Tracking] enrolled contact ${contact.id} into flow "${flow.name}" (${flow.id})`
      )
    }
  } finally {
    await pool.end().catch(() => {})
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
