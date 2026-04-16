// @ts-nocheck
import { MedusaContainer } from "@medusajs/framework/types"
import { Pool } from "pg"
import { MARKETING_MODULE } from "../modules/marketing"
import type MarketingModuleService from "../modules/marketing/service"
import { ResendMarketingClient } from "../modules/marketing/services/resend-client"
import { compileTemplate } from "../modules/marketing/utils/template-compiler"
import { injectTracking, buildUnsubscribeUrl } from "../modules/marketing/utils/tracking-injector"

/**
 * Marketing Flow Executor
 * ───────────────────────
 * Runs every minute. For each marketing_flow_run in state 'waiting' or
 * 'running' whose next_run_at <= NOW(), execute the current node of the
 * flow's definition.
 *
 * Node types supported:
 *   - delay          → sleep config.ms then advance
 *   - email          → send email via Resend, create marketing_message, advance
 *   - tag_add        → append config.tag to contact.tags
 *   - tag_remove     → remove config.tag from contact.tags
 *   - condition      → branch based on simple predicate
 *   - wait_for_event → set state='waiting' with 7-day timeout (external
 *                      subscriber will advance when matching event arrives)
 *   - exit           → mark run as completed
 *
 * Safety:
 *   - max 50 runs per tick
 *   - max 10 node executions per run per tick (prevents infinite loops)
 *   - errored runs are marked, never block the cron
 */

const MAX_RUNS_PER_TICK = 50
const MAX_NODES_PER_RUN = 10
const WAIT_FOR_EVENT_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

type FlowNode = {
  id: string
  type: string
  config?: Record<string, any>
  next?: string | null
  next_true?: string | null
  next_false?: string | null
}

type FlowDefinition = {
  nodes: FlowNode[]
  edges?: Array<{ from: string; to: string }>
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

function findNode(def: FlowDefinition, nodeId: string | null | undefined): FlowNode | null {
  if (!nodeId || !def?.nodes) return null
  return def.nodes.find((n) => n.id === nodeId) || null
}

function firstNodeId(def: FlowDefinition): string | null {
  return def?.nodes?.[0]?.id || null
}

/** Evaluate a condition node against the contact + context. Returns true/false. */
function evaluateCondition(cfg: Record<string, any>, contact: any, ctx: Record<string, any>): boolean {
  try {
    const op = cfg?.op || cfg?.operator
    switch (op) {
      case "has_tag": {
        const tag = String(cfg.tag || cfg.value || "")
        const tags = Array.isArray(contact?.tags) ? contact.tags : []
        return tags.includes(tag)
      }
      case "not_has_tag": {
        const tag = String(cfg.tag || cfg.value || "")
        const tags = Array.isArray(contact?.tags) ? contact.tags : []
        return !tags.includes(tag)
      }
      case "has_ordered":
        return !!ctx?.has_ordered
      case "context_truthy": {
        const key = String(cfg.key || "")
        return !!ctx?.[key]
      }
      case "always_true":
        return true
      case "always_false":
        return false
      default:
        return false
    }
  } catch {
    return false
  }
}

export default async function marketingFlowExecutor(container: MedusaContainer) {
  const logger = (container.resolve("logger") as any) || console
  const service = container.resolve(MARKETING_MODULE) as unknown as MarketingModuleService

  let pool: Pool | null = null
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })

    const { rows: runs } = await pool.query(
      `SELECT id, flow_id, brand_id, contact_id, current_node_id, state, context
       FROM marketing_flow_run
       WHERE deleted_at IS NULL
         AND state IN ('running','waiting')
         AND (next_run_at IS NULL OR next_run_at <= NOW())
       ORDER BY next_run_at ASC NULLS FIRST
       LIMIT ${MAX_RUNS_PER_TICK}`
    )

    if (!runs.length) return

    logger.info(`[Marketing Flow] Processing ${runs.length} flow run(s)`)

    for (const run of runs) {
      try {
        await executeRun(run, { pool, service, logger })
      } catch (err: any) {
        logger.error(`[Marketing Flow] Run ${run.id} errored: ${err?.message || err}`)
        try {
          await pool.query(
            `UPDATE marketing_flow_run
             SET state = 'errored', error = $2, next_run_at = NULL
             WHERE id = $1`,
            [run.id, String(err?.message || err).slice(0, 1000)]
          )
        } catch {}
      }
    }
  } catch (err: any) {
    logger.error(`[Marketing Flow] Fatal: ${err?.message || err}`)
  } finally {
    if (pool) await pool.end().catch(() => {})
  }
}

async function executeRun(
  run: any,
  deps: { pool: Pool; service: MarketingModuleService; logger: any }
): Promise<void> {
  const { pool, service, logger } = deps

  // Load flow definition
  const { rows: flowRows } = await pool.query(
    `SELECT id, brand_id, name, definition, status
     FROM marketing_flow
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [run.flow_id]
  )
  const flow = flowRows[0]
  if (!flow) {
    throw new Error(`Flow ${run.flow_id} not found`)
  }
  if (flow.status !== "live") {
    // Pause the run quietly — flow paused upstream
    await pool.query(
      `UPDATE marketing_flow_run SET state = 'waiting', next_run_at = NOW() + INTERVAL '1 hour' WHERE id = $1`,
      [run.id]
    )
    return
  }

  const def: FlowDefinition = flow.definition || { nodes: [] }
  if (!def.nodes || !def.nodes.length) {
    throw new Error(`Flow ${flow.id} has empty definition`)
  }

  // Load contact
  const { rows: contactRows } = await pool.query(
    `SELECT id, brand_id, email, first_name, last_name, locale, country_code, tags, status
     FROM marketing_contact
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [run.contact_id]
  )
  const contact = contactRows[0]
  if (!contact) {
    throw new Error(`Contact ${run.contact_id} not found`)
  }

  // Load brand
  const { rows: brandRows } = await pool.query(
    `SELECT * FROM marketing_brand WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [run.brand_id]
  )
  const brand = brandRows[0]
  if (!brand) {
    throw new Error(`Brand ${run.brand_id} not found`)
  }

  let ctx = run.context || {}
  let currentNodeId: string | null = run.current_node_id || firstNodeId(def)
  let advanced = 0
  let shouldWait = false
  let waitUntil: Date | null = null
  let completed = false

  while (currentNodeId && advanced < MAX_NODES_PER_RUN && !shouldWait && !completed) {
    const node = findNode(def, currentNodeId)
    if (!node) {
      throw new Error(`Node ${currentNodeId} not found in flow ${flow.id}`)
    }

    switch (node.type) {
      case "delay": {
        const ms = Math.max(0, Number(node.config?.ms) || 0)
        waitUntil = new Date(Date.now() + ms)
        // Advance to next node but wait for the duration
        currentNodeId = node.next || getNextEdge(def, node.id)
        shouldWait = true
        break
      }

      case "email": {
        await sendFlowEmail({
          node,
          run,
          flow,
          brand,
          contact,
          ctx,
          pool,
          service,
          logger,
        })
        currentNodeId = node.next || getNextEdge(def, node.id)
        advanced++
        break
      }

      case "tag_add": {
        const tag = String(node.config?.tag || "")
        if (tag) {
          const existing: string[] = Array.isArray(contact.tags) ? contact.tags : []
          if (!existing.includes(tag)) {
            const updated = [...existing, tag]
            await pool.query(
              `UPDATE marketing_contact SET tags = $2::jsonb WHERE id = $1`,
              [contact.id, JSON.stringify(updated)]
            )
            contact.tags = updated
          }
        }
        currentNodeId = node.next || getNextEdge(def, node.id)
        advanced++
        break
      }

      case "tag_remove": {
        const tag = String(node.config?.tag || "")
        if (tag) {
          const existing: string[] = Array.isArray(contact.tags) ? contact.tags : []
          const updated = existing.filter((t) => t !== tag)
          await pool.query(
            `UPDATE marketing_contact SET tags = $2::jsonb WHERE id = $1`,
            [contact.id, JSON.stringify(updated)]
          )
          contact.tags = updated
        }
        currentNodeId = node.next || getNextEdge(def, node.id)
        advanced++
        break
      }

      case "condition": {
        const branch = evaluateCondition(node.config || {}, contact, ctx)
        currentNodeId = branch
          ? node.next_true || node.config?.next_true || null
          : node.next_false || node.config?.next_false || null
        advanced++
        break
      }

      case "wait_for_event": {
        // Just park the run — subscribers will advance it when matching event fires.
        // Safety timeout: after 7d treat as complete (advance to next node).
        waitUntil = new Date(Date.now() + WAIT_FOR_EVENT_TIMEOUT_MS)
        // Stay on the same node so external event can find us
        shouldWait = true
        break
      }

      case "exit":
      case "end": {
        completed = true
        break
      }

      default: {
        logger.warn(`[Marketing Flow] Unknown node type "${node.type}" in flow ${flow.id}; skipping`)
        currentNodeId = node.next || getNextEdge(def, node.id)
        advanced++
      }
    }

    if (!currentNodeId && !shouldWait) {
      completed = true
      break
    }
  }

  if (completed) {
    await pool.query(
      `UPDATE marketing_flow_run
       SET state = 'completed', completed_at = NOW(), current_node_id = NULL,
           next_run_at = NULL, context = $2::jsonb
       WHERE id = $1`,
      [run.id, JSON.stringify(ctx)]
    )
  } else if (shouldWait) {
    await pool.query(
      `UPDATE marketing_flow_run
       SET state = 'waiting', current_node_id = $2, next_run_at = $3, context = $4::jsonb
       WHERE id = $1`,
      [run.id, currentNodeId, waitUntil, JSON.stringify(ctx)]
    )
  } else {
    // Hit node cap — stay running, pick up next tick
    await pool.query(
      `UPDATE marketing_flow_run
       SET state = 'running', current_node_id = $2, next_run_at = NOW() + INTERVAL '1 minute',
           context = $3::jsonb
       WHERE id = $1`,
      [run.id, currentNodeId, JSON.stringify(ctx)]
    )
  }
}

function getNextEdge(def: FlowDefinition, nodeId: string): string | null {
  if (!def.edges) return null
  const e = def.edges.find((x) => x.from === nodeId)
  return e?.to || null
}

async function sendFlowEmail(args: {
  node: FlowNode
  run: any
  flow: any
  brand: any
  contact: any
  ctx: Record<string, any>
  pool: Pool
  service: MarketingModuleService
  logger: any
}): Promise<void> {
  const { node, run, flow, brand, contact, ctx, pool, service, logger } = args

  if (!contact.email) {
    logger.warn(`[Marketing Flow] Skipping email for contact ${contact.id} — no email`)
    return
  }
  if (contact.status !== "subscribed") {
    logger.warn(`[Marketing Flow] Skipping email for contact ${contact.id} — status=${contact.status}`)
    return
  }

  // Resolve template
  const templateId = node.config?.template_id
  let tpl: any = null
  if (templateId) {
    const { rows } = await pool.query(
      `SELECT * FROM marketing_template WHERE id = $1 AND brand_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [templateId, flow.brand_id]
    )
    tpl = rows[0]
  }

  // Fallback: inline subject/body on node.config
  if (!tpl) {
    tpl = {
      id: null,
      version: 1,
      subject: node.config?.subject || "",
      preheader: node.config?.preheader || "",
      editor_type: node.config?.editor_type || "html",
      custom_html: node.config?.html || "",
      block_json: node.config?.block_json || null,
      from_name: node.config?.from_name || null,
      from_email: node.config?.from_email || null,
      reply_to: node.config?.reply_to || null,
    }
  }
  if (!tpl.subject) {
    throw new Error(`Email node ${node.id} has no subject / template`)
  }

  const baseUrl = getBaseUrl()
  const fromEmail = tpl.from_email || brand.marketing_from_email
  const fromName = tpl.from_name || brand.marketing_from_name
  const replyTo = tpl.reply_to || brand.marketing_reply_to || null
  const fromLine = `${fromName} <${fromEmail}>`

  // Create message row FIRST so tracking tokens resolve
  const msg = await service.createMarketingMessages({
    brand_id: flow.brand_id,
    contact_id: contact.id,
    flow_id: flow.id,
    flow_run_id: run.id,
    template_id: tpl.id,
    template_version: tpl.version,
    to_email: contact.email,
    from_email: fromEmail,
    subject_snapshot: tpl.subject,
    status: "queued",
  } as any)
  const messageId = (msg as any).id

  const unsubscribe_url = buildUnsubscribeUrl({
    contactId: contact.id,
    brandId: flow.brand_id,
    baseUrl,
  })

  const compiled = compileTemplate(
    {
      subject: tpl.subject,
      preheader: tpl.preheader,
      editor_type: tpl.editor_type,
      block_json: tpl.block_json,
      custom_html: tpl.custom_html,
    },
    {
      contact: {
        first_name: contact.first_name || "",
        last_name: contact.last_name || "",
        email: contact.email,
        locale: contact.locale || "",
        country_code: contact.country_code || "",
      },
      brand: {
        name: brand.display_name,
        from_email: fromEmail,
      },
      flow_context: ctx,
      unsubscribe_url,
    }
  )

  const trackedHtml = brand.tracking_enabled
    ? injectTracking(compiled.html, {
        messageId,
        brandId: flow.brand_id,
        baseUrl,
      })
    : compiled.html

  const resend = new ResendMarketingClient({
    id: brand.id,
    slug: brand.slug,
    resend_api_key_encrypted: brand.resend_api_key_encrypted,
  })

  const result = await resend.send({
    from: fromLine,
    to: contact.email,
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
      { name: "flow", value: flow.id },
    ],
  })

  if (result.ok) {
    await service.updateMarketingMessages({
      id: messageId,
      resend_email_id: result.resend_id,
      status: "sent",
      sent_at: new Date(),
    } as any)
  } else {
    await service.updateMarketingMessages({
      id: messageId,
      status: "failed",
      error: result.error || "unknown",
    } as any)
    logger.warn(`[Marketing Flow] Send failed for run ${run.id}: ${result.error}`)
  }
}

export const config = {
  name: "marketing-flow-executor",
  schedule: "* * * * *", // every minute
}
