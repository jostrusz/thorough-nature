// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

/**
 * GET /admin/marketing/contacts/:id/flow-runs
 *
 * Returns:
 *   {
 *     active:   [{ run_id, flow_id, flow_name, state, current_node_id,
 *                  current_node_type, next_email_subject, next_run_at,
 *                  started_at }],
 *     history:  [{ run_id, flow_id, flow_name, state, exit_reason,
 *                  started_at, completed_at }]
 *   }
 *
 * Active = running OR waiting (not exited / completed / errored).
 * Resolves the human-readable email subject of the run's current_node_id
 * by reading the flow definition JSON, so the UI can show "Next email:
 * 'de leeftijdsvraag' on Tue 14:44" without a second round-trip.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  if (!process.env.DATABASE_URL) {
    res.status(500).json({ error: "database_not_configured" })
    return
  }
  const id = String((req.params as any).id || "")
  if (!id) {
    res.status(400).json({ error: "missing_id" })
    return
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const { rows } = await pool.query(
      `SELECT
         fr.id              AS run_id,
         fr.flow_id,
         fr.state,
         fr.exit_reason,
         fr.current_node_id,
         fr.next_run_at,
         fr.started_at,
         fr.completed_at,
         f.name             AS flow_name,
         f.definition       AS flow_definition
       FROM marketing_flow_run fr
       LEFT JOIN marketing_flow f ON f.id = fr.flow_id
       WHERE fr.contact_id = $1
         AND fr.deleted_at IS NULL
       ORDER BY fr.started_at DESC
       LIMIT 50`,
      [id]
    )

    const active: any[] = []
    const history: any[] = []

    for (const r of rows as any[]) {
      const def = r.flow_definition || {}
      const nodes: any[] = Array.isArray(def.nodes) ? def.nodes : []
      const currentNode = r.current_node_id ? nodes.find((n) => n?.id === r.current_node_id) : null
      const currentType = currentNode?.type || null

      // Resolve "next email subject". If current node is itself an email,
      // the subject lives on it. If it's a delay, walk the edges/explicit
      // ordering to find the next email node and report THAT subject —
      // that's what the user actually wants to see ("what's the next
      // mail going to be?").
      let nextEmailSubject: string | null = null
      let nextEmailNodeId: string | null = null
      if (currentNode) {
        if (currentNode.type === "email") {
          nextEmailSubject = currentNode.config?.subject || null
          nextEmailNodeId = currentNode.id
        } else {
          const next = walkToNextEmail(nodes, def.edges, currentNode.id)
          if (next) {
            nextEmailSubject = next.config?.subject || null
            nextEmailNodeId = next.id
          }
        }
      }

      const base = {
        run_id: r.run_id,
        flow_id: r.flow_id,
        flow_name: r.flow_name,
        state: r.state,
        exit_reason: r.exit_reason || null,
        started_at: r.started_at,
        completed_at: r.completed_at,
      }

      if (r.state === "running" || r.state === "waiting") {
        active.push({
          ...base,
          current_node_id: r.current_node_id,
          current_node_type: currentType,
          next_email_node_id: nextEmailNodeId,
          next_email_subject: nextEmailSubject,
          next_run_at: r.next_run_at,
        })
      } else {
        history.push(base)
      }
    }

    res.json({ active, history })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  } finally {
    await pool.end().catch(() => {})
  }
}

/**
 * Walk the flow graph from a starting node to the next email-typed node.
 * Two strategies, in order:
 *   1. If `edges` exist (explicit graph), follow next/source-target.
 *   2. Otherwise fall back to nodes[] ordering — same heuristic the
 *      flow-executor uses ([marketing-flow-executor.ts]) when no edges
 *      are defined.
 *
 * Capped at 30 hops so a malformed loop never blocks the response.
 */
function walkToNextEmail(nodes: any[], edges: any[] | undefined, startId: string): any | null {
  const byId = new Map<string, any>()
  for (const n of nodes) {
    if (n?.id) byId.set(n.id, n)
  }
  const indexById = new Map<string, number>()
  nodes.forEach((n, i) => {
    if (n?.id) indexById.set(n.id, i)
  })

  let cursor: string | null = startId
  const seen = new Set<string>()
  for (let i = 0; i < 30 && cursor; i++) {
    if (seen.has(cursor)) return null
    seen.add(cursor)
    const node = byId.get(cursor)
    if (!node) return null
    if (i > 0 && node.type === "email") return node

    let nextId: string | null = null
    if (Array.isArray(edges) && edges.length) {
      const edge = edges.find((e: any) => e?.source === cursor || e?.from === cursor)
      nextId = edge?.target || edge?.to || null
    }
    if (!nextId) {
      const idx = indexById.get(cursor)
      if (idx != null && idx + 1 < nodes.length) {
        nextId = nodes[idx + 1]?.id || null
      }
    }
    cursor = nextId
  }
  return null
}
