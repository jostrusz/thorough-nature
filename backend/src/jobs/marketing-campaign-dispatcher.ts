import { MedusaContainer } from "@medusajs/framework/types"
import { Pool } from "pg"
import { MARKETING_MODULE } from "../modules/marketing"
import type MarketingModuleService from "../modules/marketing/service"
import { ResendMarketingClient } from "../modules/marketing/services/resend-client"
import { compileTemplate } from "../modules/marketing/utils/template-compiler"
import { injectTracking, buildUnsubscribeUrl, buildViewInBrowserUrl } from "../modules/marketing/utils/tracking-injector"
import { RecipientResolver } from "../modules/marketing/utils/recipient-resolver"
import { getViewInBrowserStrings } from "../modules/marketing/utils/view-in-browser-i18n"
import { injectLegalFooter } from "../modules/marketing/utils/legal-footer"

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
// Each chunk fires SEND_CHUNK requests concurrently, then pauses. With the
// retry-on-429 backoff now in ResendMarketingClient, an occasional rate-limit
// hit self-heals; tune these to your actual Resend tier (default plans are
// ~2 req/s — raise the pause if you see sustained 429s).
const SEND_CHUNK = 10
const PAUSE_BETWEEN_CHUNKS_MS = 1100
// Frequency cap: a contact receives at most one marketing email per this window
// (across all flows + campaigns). Capped recipients are deferred, not dropped.
const FREQ_CAP_HOURS = 24

export default async function marketingCampaignDispatcher(container: MedusaContainer) {
  const logger = (container.resolve("logger") as any) || console
  const service = container.resolve(MARKETING_MODULE) as unknown as MarketingModuleService

  let pool: Pool | null = null
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })

    // Fetch campaigns ready to dispatch
    const { rows: campaigns } = await pool.query(
      `SELECT id, brand_id, name, subject, preheader, from_name, from_email, reply_to, custom_html,
              template_id, template_version, list_id, segment_id, list_ids, segment_ids,
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
      // Per-campaign advisory lock: Medusa's scheduler has no overlap guard, so a
      // slow campaign would otherwise be picked up again by the next tick and sent
      // twice. try-lock means a second concurrent tick simply skips this campaign.
      const { rows: lockRows } = await pool.query(`SELECT pg_try_advisory_lock(hashtext($1)) AS locked`, [campaign.id])
      if (!lockRows[0]?.locked) {
        logger.info(`[Marketing Dispatcher] Campaign ${campaign.id} already being processed — skipping this tick`)
        continue
      }
      try {
        await dispatchCampaign(campaign, { pool, resolver, service, logger })
      } catch (e: any) {
        logger.error(`[Marketing Dispatcher] Campaign ${campaign.id} failed: ${e.message}`)
        await pool.query(
          `UPDATE marketing_campaign SET status = 'failed', metadata = jsonb_set(COALESCE(metadata,'{}')::jsonb, '{last_error}', to_jsonb($2::text)) WHERE id = $1`,
          [campaign.id, e.message || String(e)]
        )
      } finally {
        await pool.query(`SELECT pg_advisory_unlock(hashtext($1))`, [campaign.id]).catch(() => {})
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

  // Resolve recipients (union of all selected lists/segments, deduped)
  const recipients = await resolver.resolve({
    brandId: campaign.brand_id,
    listIds: Array.isArray(campaign.list_ids) ? campaign.list_ids : undefined,
    listId: campaign.list_id,
    segmentIds: Array.isArray(campaign.segment_ids) ? campaign.segment_ids : undefined,
    segmentId: campaign.segment_id,
    suppressionSegmentIds: campaign.suppression_segment_ids || [],
  })

  logger.info(
    `[Marketing Dispatcher] Campaign ${campaign.id} (${campaign.name}): ${recipients.length} recipients`
  )

  if (recipients.length === 0) {
    await finishCampaign(pool, campaign.id, 0)
    return
  }

  // Idempotency: skip recipients that already have a DONE message for this
  // campaign. A 'queued'/'failed' row is NOT done — it gets retried (the upsert
  // below + the UNIQUE (campaign_id, contact_id) index make the retry safe and
  // prevent any double-send across overlapping ticks). This fixes the previous
  // behaviour where a crash between row-create and send silently dropped a
  // recipient forever (their 'queued' row counted as "already sent").
  const DONE_STATUSES = "('sent','delivered','opened','clicked','bounced','complained','suppressed')"
  const { rows: doneRows } = await pool.query(
    `SELECT contact_id FROM marketing_message
     WHERE campaign_id = $1 AND deleted_at IS NULL AND status IN ${DONE_STATUSES}`,
    [campaign.id]
  )
  const alreadyDone = new Set<string>(doneRows.map((r: any) => r.contact_id))
  const pending = recipients.filter((r) => !alreadyDone.has(r.id))

  if (pending.length === 0) {
    logger.info(`[Marketing Dispatcher] Campaign ${campaign.id}: nothing left to send`)
    await finishCampaign(pool, campaign.id, recipients.length)
    return
  }

  // Frequency cap: defer recipients who already received a marketing email in
  // the last FREQ_CAP_HOURS (across flows + campaigns). They are NOT dropped —
  // the campaign is re-armed and retries them once the window clears.
  const cappedSet = new Set<string>()
  {
    const { rows: capRows } = await pool.query(
      `SELECT DISTINCT contact_id FROM marketing_message
       WHERE brand_id = $1 AND deleted_at IS NULL
         AND status IN ('sent','delivered','opened','clicked')
         AND sent_at > NOW() - ($2 || ' hours')::interval
         AND contact_id = ANY($3::text[])`,
      [campaign.brand_id, String(FREQ_CAP_HOURS), pending.map((r) => r.id)]
    )
    for (const r of capRows) cappedSet.add(r.contact_id)
  }
  const sendable = pending.filter((r) => !cappedSet.has(r.id))

  if (sendable.length === 0) {
    // Nothing to send right now — everyone left is frequency-capped. Re-arm.
    await deferCampaign(pool, campaign.id, cappedSet.size, logger)
    return
  }

  // Prepare send context
  const resend = new ResendMarketingClient({
    id: brand.id,
    slug: brand.slug,
    resend_api_key_encrypted: brand.resend_api_key_encrypted,
  })
  // Prefer the brand's own tracking domain (aligns links/pixel/unsubscribe with
  // the From domain → better deliverability). Falls back to the global host.
  const baseUrl = (brand as any).tracking_domain
    ? `https://${(brand as any).tracking_domain}`
    : process.env.MARKETING_PUBLIC_URL ||
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
  for (let i = 0; i < sendable.length; i += SEND_CHUNK) {
    // Honour a pause requested mid-send: re-read status before each chunk and
    // stop cleanly (leaving the campaign 'paused') instead of running to the end.
    const { rows: stRows } = await pool.query(`SELECT status FROM marketing_campaign WHERE id = $1`, [campaign.id])
    if (stRows[0]?.status === "paused") {
      logger.info(`[Marketing Dispatcher] Campaign ${campaign.id} paused mid-send (sent=${sent}, remaining=${sendable.length - i})`)
      return
    }
    const chunk = sendable.slice(i, i + SEND_CHUNK)
    await Promise.all(
      chunk.map(async (r) => {
        try {
          // 1. Claim the marketing_message row (idempotent upsert). The UNIQUE
          // (campaign_id, contact_id) index guarantees exactly one row per
          // recipient per campaign — a concurrent/retried attempt re-uses the
          // same row instead of creating a duplicate (no double-send).
          const { rows: msgRows } = await pool.query(
            `INSERT INTO marketing_message
               (id, brand_id, contact_id, campaign_id, template_id, template_version,
                to_email, from_email, subject_snapshot, status, created_at, updated_at)
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, 'queued', now(), now())
             ON CONFLICT ("campaign_id", "contact_id") WHERE ("deleted_at" IS NULL AND "campaign_id" IS NOT NULL)
             DO UPDATE SET status = 'queued', error = NULL, updated_at = now()
             RETURNING id`,
            [
              campaign.brand_id,
              r.id,
              campaign.id,
              template?.id ?? null,
              templateVersion,
              r.email,
              fromEmail,
              email.subject,
            ]
          )
          const messageId = msgRows[0]?.id

          // 2. Compile email body with contact context
          const unsubscribe_url = buildUnsubscribeUrl({
            contactId: r.id,
            brandId: campaign.brand_id,
            baseUrl,
          })

          // Auto-inject brand compliance footer (legal identity, IČO, BTW,
          // address, unsubscribe). Skipped only if the body already has the
          // brand's company-name fingerprint. See utils/legal-footer.ts.
          const htmlToCompile = email.editor_type === "html"
            ? injectLegalFooter(email.custom_html || "", (brand as any).compliance_footer_html)
            : (email.custom_html || "")

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
              // View-in-browser fallback — localized text + real per-message
              // web-view URL that re-renders this exact email on our domain.
              ...(() => {
                const vib = getViewInBrowserStrings((brand as any).locale)
                return {
                  view_in_browser_text: vib.text,
                  view_in_browser_label: vib.label,
                  view_in_browser_url: buildViewInBrowserUrl({
                    messageId,
                    brandId: campaign.brand_id,
                    baseUrl,
                  }),
                }
              })(),
            }
          )

          // 3. Inject tracking (links + open pixel)
          const trackedHtml = injectTracking(compiled.html, {
            messageId,
            brandId: campaign.brand_id,
            baseUrl,
            utmCampaign: `campaign_${String(campaign.name || campaign.id).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60) || campaign.id}`,
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

  if (cappedSet.size > 0) {
    // Some recipients were frequency-capped this pass — re-arm so the campaign
    // retries them later, then finalize once none remain.
    await deferCampaign(pool, campaign.id, cappedSet.size, logger)
  } else {
    await finishCampaign(pool, campaign.id, recipients.length)
  }

  logger.info(
    `[Marketing Dispatcher] Campaign ${campaign.id} ${campaign.name} done: sent=${sent}, failed=${failed}, deferred=${cappedSet.size}`
  )
}

/**
 * Re-arm a campaign that still has frequency-capped recipients: keep it
 * 'scheduled' with send_at pushed forward so the next eligible tick retries the
 * remaining contacts once their 24h cap window has cleared.
 */
async function deferCampaign(pool: Pool, campaignId: string, deferred: number, logger: any) {
  await pool.query(
    `UPDATE marketing_campaign
     SET status = 'scheduled', send_at = NOW() + interval '2 hours'
     WHERE id = $1`,
    [campaignId]
  )
  logger.info(`[Marketing Dispatcher] Campaign ${campaignId}: ${deferred} recipient(s) frequency-capped — re-armed in 2h`)
}

/**
 * Finalize a campaign. Metrics are computed from the source of truth
 * (marketing_message rows) rather than in-memory counters, and the final
 * status reflects failures: a campaign where everything failed is 'failed',
 * a partial failure is 'sent_with_errors', a clean run is 'sent'.
 */
async function finishCampaign(pool: Pool, campaignId: string, total: number) {
  const { rows } = await pool.query(
    `SELECT
       count(*) FILTER (WHERE status IN ('sent','delivered','opened','clicked','bounced','complained'))::int AS sent,
       count(*) FILTER (WHERE status = 'failed')::int AS failed,
       count(*) FILTER (WHERE status = 'suppressed')::int AS suppressed
     FROM marketing_message
     WHERE campaign_id = $1 AND deleted_at IS NULL`,
    [campaignId]
  )
  const sent = rows[0]?.sent ?? 0
  const failed = rows[0]?.failed ?? 0
  const suppressed = rows[0]?.suppressed ?? 0
  const status = sent === 0 && failed > 0 ? "failed" : failed > 0 ? "sent_with_errors" : "sent"
  await pool.query(
    `UPDATE marketing_campaign
     SET status = $3,
         sent_at = NOW(),
         metrics = $2::jsonb
     WHERE id = $1`,
    [campaignId, JSON.stringify({ sent, failed, suppressed, total }), status]
  )
}

export const config = {
  name: "marketing-campaign-dispatcher",
  schedule: "*/2 * * * *", // every 2 minutes
}
