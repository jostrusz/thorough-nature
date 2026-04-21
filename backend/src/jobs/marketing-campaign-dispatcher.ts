import { MedusaContainer } from "@medusajs/framework/types"
import { Pool } from "pg"
import { MARKETING_MODULE } from "../modules/marketing"
import type MarketingModuleService from "../modules/marketing/service"
import { ResendMarketingClient } from "../modules/marketing/services/resend-client"
import { compileTemplate } from "../modules/marketing/utils/template-compiler"
import { injectTracking, buildUnsubscribeUrl } from "../modules/marketing/utils/tracking-injector"
import { RecipientResolver } from "../modules/marketing/utils/recipient-resolver"
import { getViewInBrowserStrings } from "../modules/marketing/utils/view-in-browser-i18n"

/**
 * Marketing campaign dispatcher
 * ─────────────────────────────
 * Runs every 2 minutes. For each campaign with:
 *   status = 'scheduled' AND send_at <= NOW()
 * it:
 *   1. Loads template (+ snapshots current version)
 *   2. Resolves recipients (list ∪ segment − suppression segments − suppression list)
 *   3. Creates marketing_message rows per recipient
 *   4. Compiles HTML per recipient with contact context + injects tracking
 *   5. Sends via ResendMarketingClient (chunked, rate-limited)
 *   6. Updates campaign status to 'sending' → 'sent', aggregates metrics
 *
 * Idempotency: If job crashes mid-send, campaign stays in 'sending' and the
 * next run picks up by skipping contacts that already have a message row for
 * this campaign (UNIQUE key on campaign_id + contact_id recommended — we
 * enforce it in code).
 */

const MAX_CAMPAIGNS_PER_TICK = 3
const SEND_CHUNK = 10         // resend-friendly burst
const PAUSE_BETWEEN_CHUNKS_MS = 1100 // stays under Resend's 10 req/s tier

export default async function marketingCampaignDispatcher(container: MedusaContainer) {
  const logger = (container.resolve("logger") as any) || console
  const service = container.resolve(MARKETING_MODULE) as unknown as MarketingModuleService

  let pool: Pool | null = null
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })

    // Fetch campaigns ready to dispatch
    const { rows: campaigns } = await pool.query(
      `SELECT id, brand_id, name, subject, preheader, from_name, from_email, reply_to, custom_html,
              template_id, template_version, list_id, segment_id,
              suppression_segment_ids, send_at, status, metrics
       FROM marketing_campaign
       WHERE deleted_at IS NULL
         AND status IN ('scheduled','sending')
         AND (send_at IS NULL OR send_at <= NOW())
       ORDER BY send_at ASC NULLS FIRST
       LIMIT ${MAX_CAMPAIGNS_PER_TICK}`
    )

    if (!campaigns.length) return

    logger.info(`[Marketing Dispatcher] Found ${campaigns.length} campaign(s) to dispatch`)

    const resolver = new RecipientResolver(pool)

    for (const campaign of campaigns) {
      try {
        await dispatchCampaign(campaign, { pool, resolver, service, logger })
      } catch (e: any) {
        logger.error(`[Marketing Dispatcher] Campaign ${campaign.id} failed: ${e.message}`)
        await pool.query(
          `UPDATE marketing_campaign SET status = 'failed', metadata = jsonb_set(COALESCE(metadata,'{}')::jsonb, '{last_error}', to_jsonb($2::text)) WHERE id = $1`,
          [campaign.id, e.message || String(e)]
        )
      }
    }
  } catch (err: any) {
    logger.error(`[Marketing Dispatcher] Fatal: ${err.message}`)
  } finally {
    if (pool) await pool.end().catch(() => {})
  }
}

async function dispatchCampaign(
  campaign: any,
  deps: {
    pool: Pool
    resolver: RecipientResolver
    service: MarketingModuleService
    logger: any
  }
) {
  const { pool, resolver, service, logger } = deps

  // Mark as 'sending'
  await pool.query(`UPDATE marketing_campaign SET status = 'sending' WHERE id = $1`, [campaign.id])

  // Load brand + template (latest version snapshot if missing)
  const { rows: brandRows } = await pool.query(
    `SELECT * FROM marketing_brand WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [campaign.brand_id]
  )
  const brand = brandRows[0]
  if (!brand) throw new Error(`Brand ${campaign.brand_id} not found`)
  if (!brand.enabled) throw new Error(`Brand ${brand.slug} is disabled`)

  // Prefer inline campaign content; fall back to legacy template (only for
  // old campaigns still linked to a template_id).
  const hasInlineContent =
    !!(campaign.subject && (campaign.custom_html || campaign.custom_html === ""))

  let template: any = null
  let templateVersion: number | null = campaign.template_version ?? null

  if (!hasInlineContent) {
    if (!campaign.template_id) {
      throw new Error(`Campaign ${campaign.id} has no subject/custom_html and no template_id`)
    }
    const { rows: templateRows } = await pool.query(
      `SELECT * FROM marketing_template WHERE id = $1 AND brand_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [campaign.template_id, campaign.brand_id]
    )
    template = templateRows[0]
    if (!template) throw new Error(`Template ${campaign.template_id} not found`)

    if (!templateVersion) {
      await pool.query(
        `INSERT INTO marketing_template_version
          (id, template_id, brand_id, version, subject, preheader, from_name, from_email, reply_to,
           block_json, custom_html, compiled_html, compiled_text, editor_type, created_at, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [
          template.id,
          template.brand_id,
          template.version,
          template.subject,
          template.preheader,
          template.from_name,
          template.from_email,
          template.reply_to,
          template.block_json,
          template.custom_html,
          template.compiled_html,
          template.compiled_text,
          template.editor_type,
        ]
      )
      templateVersion = template.version
      await pool.query(`UPDATE marketing_campaign SET template_version = $2 WHERE id = $1`, [
        campaign.id,
        templateVersion,
      ])
    }
  }

  // Unified email-spec object consumed by the per-recipient send loop.
  const email = hasInlineContent
    ? {
        subject: campaign.subject || "",
        preheader: campaign.preheader || "",
        editor_type: "html" as const,
        block_json: null,
        custom_html: campaign.custom_html || "",
        from_email: campaign.from_email || null,
        from_name: campaign.from_name || null,
        reply_to: campaign.reply_to || null,
      }
    : {
        subject: template.subject,
        preheader: template.preheader,
        editor_type: template.editor_type,
        block_json: template.block_json,
        custom_html: template.custom_html,
        from_email: template.from_email,
        from_name: template.from_name,
        reply_to: template.reply_to,
      }

  // Resolve recipients
  const recipients = await resolver.resolve({
    brandId: campaign.brand_id,
    listId: campaign.list_id,
    segmentId: campaign.segment_id,
    suppressionSegmentIds: campaign.suppression_segment_ids || [],
  })

  logger.info(
    `[Marketing Dispatcher] Campaign ${campaign.id} (${campaign.name}): ${recipients.length} recipients`
  )

  if (recipients.length === 0) {
    await finishCampaign(pool, campaign.id, {
      sent: 0,
      failed: 0,
      skipped: 0,
      total: 0,
    })
    return
  }

  // Filter out recipients that already have a message for this campaign (idempotency)
  const { rows: existing } = await pool.query(
    `SELECT contact_id FROM marketing_message
     WHERE campaign_id = $1 AND deleted_at IS NULL`,
    [campaign.id]
  )
  const alreadySent = new Set<string>(existing.map((r: any) => r.contact_id))
  const pending = recipients.filter((r) => !alreadySent.has(r.id))

  if (pending.length === 0) {
    logger.info(`[Marketing Dispatcher] Campaign ${campaign.id}: nothing left to send`)
    await finishCampaign(pool, campaign.id, {
      sent: recipients.length - alreadySent.size,
      skipped: alreadySent.size,
      failed: 0,
      total: recipients.length,
    })
    return
  }

  // Prepare send context
  const resend = new ResendMarketingClient({
    id: brand.id,
    slug: brand.slug,
    resend_api_key_encrypted: brand.resend_api_key_encrypted,
  })
  const baseUrl =
    process.env.MARKETING_PUBLIC_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN_VALUE
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN_VALUE}`
      : "http://localhost:9000")

  const fromEmail = email.from_email || brand.marketing_from_email
  const fromName = email.from_name || brand.marketing_from_name
  const replyTo = email.reply_to || brand.marketing_reply_to || null
  const fromLine = `${fromName} <${fromEmail}>`

  // Send in chunks
  let sent = 0
  let failed = 0
  for (let i = 0; i < pending.length; i += SEND_CHUNK) {
    const chunk = pending.slice(i, i + SEND_CHUNK)
    await Promise.all(
      chunk.map(async (r) => {
        try {
          // 1. Create marketing_message row first (so we have the ID for tracking tokens)
          const msg = await service.createMarketingMessages({
            brand_id: campaign.brand_id,
            contact_id: r.id,
            campaign_id: campaign.id,
            template_id: template?.id ?? null,
            template_version: templateVersion,
            to_email: r.email,
            from_email: fromEmail,
            subject_snapshot: email.subject,
            status: "queued",
          } as any)
          const messageId = (msg as any).id

          // 2. Compile email body with contact context
          const unsubscribe_url = buildUnsubscribeUrl({
            contactId: r.id,
            brandId: campaign.brand_id,
            baseUrl,
          })

          // Auto-inject compliance footer when the author's HTML does not
          // already include an unsubscribe placeholder. Guarantees every
          // outgoing marketing email carries required legal disclosures
          // (company ID, address, unsubscribe, privacy) even if the author
          // forgets to add them manually.
          let htmlToCompile = email.custom_html || ""
          const hasUnsubMarker = /\{\{\s*unsubscribe_url\s*\}\}|\{\$\s*unsubscribe(_url)?\s*\}|\$\{\s*unsubscribe_url\s*\}|<%=\s*unsubscribe_url\s*%>|\/public\/marketing\/u\//.test(htmlToCompile)
          const footerTpl = (brand as any).compliance_footer_html as string | null | undefined
          if (!hasUnsubMarker && footerTpl && htmlToCompile && email.editor_type === "html") {
            // Inject before </body> if present, otherwise append at end.
            if (/<\/body>/i.test(htmlToCompile)) {
              htmlToCompile = htmlToCompile.replace(/<\/body>/i, `${footerTpl}\n</body>`)
            } else {
              htmlToCompile = htmlToCompile + "\n" + footerTpl
            }
          }

          const compiled = compileTemplate(
            {
              subject: email.subject,
              preheader: email.preheader,
              editor_type: email.editor_type,
              block_json: email.block_json,
              custom_html: htmlToCompile,
            },
            {
              contact: {
                first_name: r.first_name || "",
                last_name: r.last_name || "",
                email: r.email,
                locale: r.locale || "",
                country_code: r.country_code || "",
              },
              brand: {
                name: brand.display_name,
                from_email: fromEmail,
              },
              unsubscribe_url,
              // View-in-browser fallback — localized per brand.locale.
              // URL defaults to brand storefront (no dedicated web-view endpoint yet).
              ...(() => {
                const vib = getViewInBrowserStrings((brand as any).locale)
                const domain = (brand as any).storefront_domain
                const url = domain ? `https://${String(domain).replace(/^https?:\/\//, "")}` : "#"
                return {
                  view_in_browser_text: vib.text,
                  view_in_browser_label: vib.label,
                  view_in_browser_url: url,
                }
              })(),
            }
          )

          // 3. Inject tracking (links + open pixel)
          const trackedHtml = injectTracking(compiled.html, {
            messageId,
            brandId: campaign.brand_id,
            baseUrl,
          })

          // 4. Send via Resend
          const res = await resend.send({
            from: fromLine,
            to: r.email,
            replyTo,
            subject: compiled.subject,
            html: trackedHtml,
            text: compiled.text,
            headers: {
              "List-Unsubscribe": `<${unsubscribe_url}>, <mailto:${replyTo || fromEmail}?subject=unsubscribe>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
            tags: [
              { name: "brand", value: brand.slug },
              { name: "campaign", value: campaign.id },
            ],
          })

          if (res.ok) {
            await service.updateMarketingMessages({
              id: messageId,
              resend_email_id: res.resend_id,
              status: "sent",
              sent_at: new Date(),
            } as any)
            sent++
          } else {
            await service.updateMarketingMessages({
              id: messageId,
              status: "failed",
              error: res.error || "unknown",
            } as any)
            failed++
          }
        } catch (e: any) {
          logger.warn(`[Marketing Dispatcher] Send failed to ${r.email}: ${e.message}`)
          failed++
        }
      })
    )
    // rate-limit pause between chunks
    if (i + SEND_CHUNK < pending.length) {
      await new Promise((r) => setTimeout(r, PAUSE_BETWEEN_CHUNKS_MS))
    }
  }

  await finishCampaign(pool, campaign.id, {
    sent,
    failed,
    skipped: alreadySent.size,
    total: recipients.length,
  })

  logger.info(
    `[Marketing Dispatcher] Campaign ${campaign.id} ${campaign.name} done: sent=${sent}, failed=${failed}, skipped=${alreadySent.size}`
  )
}

async function finishCampaign(
  pool: Pool,
  campaignId: string,
  counts: { sent: number; failed: number; skipped: number; total: number }
) {
  await pool.query(
    `UPDATE marketing_campaign
     SET status = 'sent',
         sent_at = NOW(),
         metrics = $2::jsonb
     WHERE id = $1`,
    [campaignId, JSON.stringify(counts)]
  )
}

export const config = {
  name: "marketing-campaign-dispatcher",
  schedule: "*/2 * * * *", // every 2 minutes
}
