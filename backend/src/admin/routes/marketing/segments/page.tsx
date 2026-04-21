import React, { useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../../lib/sdk"
import {
  MarketingShell,
  Modal,
  EmptyState,
  fmt,
  useSelectedBrand,
  brandQs,
  tokens,
} from "../../../components/marketing/shared"

/**
 * Field catalogue. Each UI field maps to an evaluator DSL key via `dsl_field`.
 * `value_kind` drives the value-input widget:
 *   - text        → plain <input>
 *   - number      → <input type="number">
 *   - date        → datetime-local
 *   - bool        → Yes/No select
 *   - list        → <select> filled from listsQ
 *   - flow        → <select> filled from flowsQ
 *   - project     → <select> of brand slugs (for primary_book / purchased_books)
 *   - lifecycle   → <select> of 8 lifecycle stages
 *   - rfm_segment → <select> of 7 RFM segments
 *   - empty       → no value input (for exists/not_exists)
 *
 * `ops` is REQUIRED — defines exactly which operators appear. Must be a subset
 * of what the evaluator can compile for this field type. If omitted, UI
 * defaults to a safe text-op set.
 */
type ValueKind =
  | "text" | "number" | "date" | "bool"
  | "list" | "flow" | "project" | "lifecycle" | "rfm_segment" | "order_status"

type FieldOption = {
  value: string
  label: string
  dsl_field: string
  value_kind: ValueKind
  ops: string[]
  group?: string
}

// Op groups — each field picks the relevant ones.
const OPS = {
  text: ["eq", "ne", "contains", "starts", "ends", "in", "nin", "exists", "not_exists"],
  textExact: ["eq", "ne", "in", "nin", "exists", "not_exists"],
  number: ["eq", "ne", "gt", "gte", "lt", "lte", "exists", "not_exists"],
  date: ["before", "after", "exists", "not_exists"],
  days: ["gt", "gte", "lt", "lte", "exists", "not_exists"],
  bool: ["eq"],
  arrayContains: ["has", "not_has", "exists", "not_exists"],
  membership: ["eq", "ne"],
}

const FIELD_OPTIONS: FieldOption[] = [
  // ─ Identity / status ─
  { group: "Identity", value: "status",        label: "Status",          dsl_field: "contact.status",        value_kind: "text",   ops: OPS.text },
  { group: "Identity", value: "source",        label: "Source",          dsl_field: "contact.source",        value_kind: "text",   ops: OPS.text },
  { group: "Identity", value: "country",       label: "Country (2-letter)", dsl_field: "contact.country_code", value_kind: "text", ops: OPS.textExact },
  { group: "Identity", value: "locale",        label: "Locale",          dsl_field: "contact.locale",        value_kind: "text",   ops: OPS.textExact },
  { group: "Identity", value: "created_at",    label: "Created at",      dsl_field: "contact.created_at",    value_kind: "date",   ops: OPS.date },
  { group: "Identity", value: "subscribed_at", label: "Subscribed at",   dsl_field: "contact.subscribed_at", value_kind: "date",   ops: OPS.date },

  // ─ Lists / tags ─
  { group: "Lists & tags", value: "tag",         label: "Tag",             dsl_field: "contact.tags",     value_kind: "text", ops: ["has", "not_has"] },
  { group: "Lists & tags", value: "list_member", label: "List membership", dsl_field: "list.member",      value_kind: "list", ops: OPS.membership },

  // ─ Flows ─
  { group: "Flows", value: "flow_in_any", label: "In any active flow",  dsl_field: "flow.in_any_run", value_kind: "bool", ops: OPS.bool },
  { group: "Flows", value: "flow_in",     label: "In specific flow",    dsl_field: "flow.in_run",     value_kind: "flow", ops: OPS.membership },

  // ─ Purchases (real-time + pre-computed) ─
  { group: "Purchases", value: "order_status",       label: "Order status (Buyer / Non-buyer)", dsl_field: "contact.order_status", value_kind: "order_status", ops: ["eq", "ne"] },
  { group: "Purchases", value: "total_orders",       label: "Total orders",              dsl_field: "contact.total_orders",       value_kind: "number", ops: OPS.number },
  { group: "Purchases", value: "total_revenue",      label: "Total revenue (EUR)",       dsl_field: "contact.total_revenue_eur",  value_kind: "number", ops: OPS.number },
  { group: "Purchases", value: "avg_order_value",    label: "Avg order value (EUR)",     dsl_field: "contact.avg_order_value_eur",value_kind: "number", ops: OPS.number },
  { group: "Purchases", value: "first_order_at",     label: "First order at",            dsl_field: "contact.first_order_at",     value_kind: "date",   ops: OPS.date },
  { group: "Purchases", value: "last_order_at",      label: "Last order at",             dsl_field: "contact.last_order_at",      value_kind: "date",   ops: OPS.date },
  { group: "Purchases", value: "days_since_order",   label: "Days since last order",     dsl_field: "contact.days_since_last_order", value_kind: "number", ops: OPS.days },
  { group: "Purchases", value: "email_attr_orders",  label: "Email-attributed orders",   dsl_field: "contact.email_attributed_orders", value_kind: "number", ops: OPS.number },
  { group: "Purchases", value: "email_attr_revenue", label: "Email-attributed revenue (EUR)", dsl_field: "contact.email_attributed_revenue_eur", value_kind: "number", ops: OPS.number },

  // ─ Project affinity (per-project purchase filters) ─
  { group: "Projects", value: "primary_book",   label: "Primary project",          dsl_field: "contact.primary_book",    value_kind: "project", ops: OPS.textExact },
  { group: "Projects", value: "purchased_book", label: "Purchased in project",     dsl_field: "contact.purchased_books", value_kind: "project", ops: OPS.arrayContains },

  // ─ Segmentation (pre-computed by nightly cron) ─
  { group: "Segmentation", value: "lifecycle_stage", label: "Lifecycle stage", dsl_field: "contact.lifecycle_stage", value_kind: "lifecycle",   ops: OPS.textExact },
  { group: "Segmentation", value: "rfm_segment",     label: "RFM segment",     dsl_field: "contact.rfm_segment",     value_kind: "rfm_segment", ops: OPS.textExact },
  { group: "Segmentation", value: "rfm_score",       label: "RFM score (111–555)", dsl_field: "contact.rfm_score",   value_kind: "number",      ops: OPS.number },

  // ─ Engagement ─
  { group: "Engagement", value: "engagement_score",  label: "Engagement score (0–100)", dsl_field: "contact.engagement_score",   value_kind: "number", ops: OPS.number },
  { group: "Engagement", value: "emails_sent",       label: "Emails sent (total)",      dsl_field: "contact.emails_sent_total",  value_kind: "number", ops: OPS.number },
  { group: "Engagement", value: "emails_opened",     label: "Emails opened (total)",    dsl_field: "contact.emails_opened_total",value_kind: "number", ops: OPS.number },
  { group: "Engagement", value: "last_email_opened", label: "Last email opened at",     dsl_field: "contact.last_email_opened_at", value_kind: "date", ops: OPS.date },
  { group: "Engagement", value: "last_email_clicked",label: "Last email clicked at",    dsl_field: "contact.last_email_clicked_at", value_kind: "date", ops: OPS.date },

  // ─ Acquisition ─
  { group: "Acquisition", value: "acq_source",       label: "Acquisition source",       dsl_field: "contact.acquisition_source",   value_kind: "text", ops: OPS.text },
  { group: "Acquisition", value: "acq_medium",       label: "Acquisition medium",       dsl_field: "contact.acquisition_medium",   value_kind: "text", ops: OPS.text },
  { group: "Acquisition", value: "acq_campaign",     label: "Acquisition campaign",     dsl_field: "contact.acquisition_campaign", value_kind: "text", ops: OPS.text },
  { group: "Acquisition", value: "acq_at",           label: "Acquisition date",         dsl_field: "contact.acquisition_at",       value_kind: "date", ops: OPS.date },
  { group: "Acquisition", value: "days_since_acq",   label: "Days since acquisition",   dsl_field: "contact.days_since_acquisition", value_kind: "number", ops: OPS.days },
]

const OP_OPTIONS: Record<string, string> = {
  eq:         "equals",
  ne:         "not equal to",
  contains:   "contains",
  starts:     "starts with",
  ends:       "ends with",
  gt:         "greater than",
  gte:        "≥",
  lt:         "less than",
  lte:        "≤",
  before:     "before",
  after:      "after",
  in:         "in (comma-sep)",
  nin:        "not in",
  has:        "has",
  not_has:    "does not have",
  exists:     "is set",
  not_exists: "is not set",
}

const LIFECYCLE_STAGES = ["lead", "new_customer", "active", "loyal", "at_risk", "dormant", "sunset", "churned"]
const RFM_SEGMENTS = ["champion", "loyal", "potential_loyal", "at_risk", "cant_lose", "hibernating", "lost"]

/**
 * Convert a UI condition into an evaluator DSL leaf:
 *   { field: "status", op: "eq", value: "subscribed" }
 *     →  { "contact.status": { eq: "subscribed" } }
 *
 * Returns null for invalid/empty rows (caller filters them out).
 */
function toDslLeaf(c: { field: string; op: string; value: string }): any {
  const meta = FIELD_OPTIONS.find((f) => f.value === c.field)
  if (!meta) return null
  const dslField = meta.dsl_field

  // exists / not_exists ignore value.
  if (c.op === "exists") return { [dslField]: { exists: true } }
  if (c.op === "not_exists") return { [dslField]: { not_exists: true } }

  let val: any = c.value
  if (meta.value_kind === "bool") {
    val = c.value === "true" || c.value === "yes" || c.value === "1"
  } else if (c.op === "in" || c.op === "nin") {
    val = String(c.value || "").split(",").map((v) => v.trim()).filter(Boolean)
  } else if (
    meta.value_kind === "number" ||
    ["gt", "gte", "lt", "lte"].includes(c.op)
  ) {
    if (c.value === "" || isNaN(Number(c.value))) return null
    val = Number(c.value)
  }

  return { [dslField]: { [c.op]: val } }
}

type Condition = { field: string; op: string; value: string }
type Query = { combinator: "all" | "any"; conditions: Condition[] }

function SegmentsPage() {
  const qc = useQueryClient()
  const { brandId } = useSelectedBrand()
  const qs = brandQs(brandId)
  const [editing, setEditing] = useState<any | null>(null)
  const [showModal, setShowModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["mkt-segments", brandId],
    queryFn: () =>
      sdk.client.fetch<{ segments: any[] }>(`/admin/marketing/segments${qs}`, { method: "GET" }),
    enabled: !!brandId,
  })
  const segments: any[] = ((data as any)?.segments) || []

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/marketing/segments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-segments"] })
      toast.success("Segment deleted")
    },
    onError: () => toast.error("Failed to delete"),
  })

  return (
    <MarketingShell
      title="Segments"
      subtitle="Dynamic contact slices based on rules"
      breadcrumbs={[
        { label: "Marketing", to: "/marketing" },
        { label: "Segments" },
      ]}
      right={
        <button className="mkt-btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
          New segment
        </button>
      }
    >
      {isLoading ? (
        <div className="mkt-card" style={{ padding: "32px", color: tokens.fgSecondary, fontSize: "13px", textAlign: "center" }}>
          Loading…
        </div>
      ) : segments.length === 0 ? (
        <div className="mkt-card">
          <EmptyState
            icon="🔍"
            title="No segments yet"
            description="Create rule-based slices of your contacts to target them precisely."
            action={
              <button className="mkt-btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
                Create segment
              </button>
            }
          />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {segments.map((s: any) => (
            <div key={s.id} className="mkt-card mkt-card-hover" style={{ padding: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: 600, color: tokens.fg, letterSpacing: "-0.005em" }}>{s.name}</div>
              {s.description && <div style={{ fontSize: "13px", color: tokens.fgSecondary, marginTop: "4px", lineHeight: 1.4 }}>{s.description}</div>}
              <div style={{ marginTop: "14px", fontSize: "13px", color: tokens.fgSecondary }}>
                Cached: <strong style={{ color: tokens.fg }}>{fmt(s.cached_count)}</strong> members
                {s.cached_at && <div style={{ marginTop: "4px", color: tokens.fgMuted, fontSize: "12px" }}>Updated {new Date(s.cached_at).toLocaleString()}</div>}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "14px" }}>
                <button className="mkt-btn mkt-btn-sm" onClick={() => { setEditing(s); setShowModal(true) }}>
                  Edit
                </button>
                <button
                  className="mkt-btn-danger-ghost"
                  onClick={() => { if (confirm(`Delete segment "${s.name}"?`)) deleteMut.mutate(s.id) }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <SegmentModal
          brandId={brandId}
          initial={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
        />
      )}
    </MarketingShell>
  )
}

/**
 * Parse an evaluator DSL leaf back into the UI's flat shape.
 * Inverse of toDslLeaf. Returns null if the leaf can't be matched.
 */
function fromDslLeaf(leaf: any): { field: string; op: string; value: string } | null {
  if (!leaf || typeof leaf !== "object") return null
  const [dslField, opRec] = Object.entries(leaf)[0] || []
  if (!dslField || !opRec || typeof opRec !== "object") return null
  const [op, val] = Object.entries(opRec as any)[0] || []
  if (!op) return null
  const meta = FIELD_OPTIONS.find((f) => f.dsl_field === dslField)
  if (!meta) return null
  let value = ""
  if (Array.isArray(val)) value = val.join(",")
  else if (typeof val === "boolean") value = val ? "true" : "false"
  else if (val != null) value = String(val)
  return { field: meta.value, op: String(op), value }
}

function SegmentModal({ brandId, initial, onClose }: { brandId: string | null; initial: any | null; onClose: () => void }) {
  const qc = useQueryClient()
  const bQs = brandQs(brandId)
  const [name, setName] = useState(initial?.name || "")
  const [description, setDescription] = useState(initial?.description || "")
  const [query, setQuery] = useState<Query>(() => {
    if (initial?.query) {
      const q = initial.query
      if (q.all || q.any) {
        const combinator = q.all ? "all" : "any"
        const list = (q.all || q.any) as any[]
        const parsed = list
          .map((leaf: any) => {
            // Legacy rows stored as { field, op, value } — read them back as-is
            if (leaf && leaf.field && leaf.op !== undefined) {
              return { field: leaf.field, op: leaf.op, value: String(leaf.value ?? "") }
            }
            return fromDslLeaf(leaf)
          })
          .filter(Boolean) as any[]
        return {
          combinator,
          conditions: parsed.length ? parsed : [{ field: "status", op: "eq", value: "subscribed" }],
        }
      }
    }
    return { combinator: "all", conditions: [{ field: "status", op: "eq", value: "subscribed" }] }
  })
  const [previewResult, setPreviewResult] = useState<{ count: number; sample: string[] } | null>(null)

  const listsQ = useQuery({
    queryKey: ["mkt-lists-for-segment", brandId],
    queryFn: () =>
      sdk.client.fetch<{ lists: any[] }>(`/admin/marketing/lists${bQs}`, { method: "GET" }),
    enabled: !!brandId,
  })
  const flowsQ = useQuery({
    queryKey: ["mkt-flows-for-segment", brandId],
    queryFn: () =>
      sdk.client.fetch<{ flows: any[] }>(`/admin/marketing/flows${bQs}`, { method: "GET" }),
    enabled: !!brandId,
  })
  const brandsQ = useQuery({
    queryKey: ["mkt-all-brands-for-segment"],
    queryFn: () =>
      sdk.client.fetch<{ brands: any[] }>(`/admin/marketing/brands`, { method: "GET" }),
  })
  const lists: any[] = ((listsQ.data as any)?.lists) || []
  const flows: any[] = ((flowsQ.data as any)?.flows) || []
  const allBrands: any[] = ((brandsQ.data as any)?.brands) || []
  // Projects are brand.project_id — one-to-one with brand.
  const projects = useMemo(() => {
    const out: { id: string; label: string }[] = []
    const seen = new Set<string>()
    for (const b of allBrands) {
      const pid = b.project_id || b.slug
      if (!pid || seen.has(pid)) continue
      seen.add(pid)
      out.push({ id: pid, label: b.display_name ? `${b.display_name} (${pid})` : pid })
    }
    return out
  }, [allBrands])

  const saveMut = useMutation({
    mutationFn: (body: any) => {
      if (initial?.id) {
        return sdk.client.fetch(`/admin/marketing/segments/${initial.id}`, { method: "POST", body })
      }
      return sdk.client.fetch("/admin/marketing/segments", { method: "POST", body })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-segments"] })
      toast.success(initial ? "Segment updated" : "Segment created")
      onClose()
    },
    onError: (e: any) => toast.error("Failed: " + (e?.message || "unknown")),
  })

  const previewMut = useMutation({
    mutationFn: (body: any) =>
      sdk.client.fetch<{ count: number; sample: string[] }>(
        `/admin/marketing/segments${initial?.id ? `/${initial.id}` : ""}/preview`,
        { method: "POST", body }
      ),
    onSuccess: (resp: any) => setPreviewResult({ count: resp?.count ?? 0, sample: resp?.sample ?? [] }),
    onError: () => toast.error("Preview failed"),
  })

  function buildBody() {
    const conds = query.conditions
      .filter((c) => c.field)
      .map(toDslLeaf)
      .filter(Boolean)
    return {
      brand_id: brandId || undefined,
      name,
      description,
      query: { [query.combinator]: conds },
    }
  }

  return (
    <Modal
      title={initial ? `Edit segment` : "New segment"}
      onClose={onClose}
      width={840}
      footer={
        <>
          <button className="mkt-btn" onClick={onClose}>Cancel</button>
          <button
            className="mkt-btn"
            onClick={() => previewMut.mutate(buildBody())}
            disabled={previewMut.isPending || !name}
            style={{ borderColor: tokens.primary, color: tokens.primary }}
          >
            {previewMut.isPending ? "Counting…" : "Preview"}
          </button>
          <button
            className="mkt-btn-primary"
            onClick={() => saveMut.mutate(buildBody())}
            disabled={!name || saveMut.isPending}
          >
            {saveMut.isPending ? "Saving…" : (initial ? "Save" : "Create")}
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <label className="mkt-label">Name *</label>
          <input className="mkt-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mkt-label">Description</label>
          <input className="mkt-input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: "20px" }}>
        <label className="mkt-label">Match</label>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
          <select className="mkt-input" style={{ width: "auto" }} value={query.combinator} onChange={(e) => setQuery({ ...query, combinator: e.target.value as any })}>
            <option value="all">All conditions (AND)</option>
            <option value="any">Any condition (OR)</option>
          </select>
        </div>
        {query.conditions.map((c, idx) => {
          const meta = FIELD_OPTIONS.find((f) => f.value === c.field)
          // Operators are always filtered by field.ops (no field selected = empty).
          const ops = meta?.ops || []
          const valueless = c.op === "exists" || c.op === "not_exists"
          const updateField = (patch: Partial<Condition>) => {
            const arr = [...query.conditions]
            arr[idx] = { ...arr[idx], ...patch }
            setQuery({ ...query, conditions: arr })
          }
          return (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 40px", gap: "8px", marginBottom: "8px" }}>
              <select className="mkt-input" value={c.field} onChange={(e) => {
                const newMeta = FIELD_OPTIONS.find((f) => f.value === e.target.value)
                const defaultOp = newMeta?.ops?.[0] || "eq"
                updateField({ field: e.target.value, op: defaultOp, value: "" })
              }}>
                <option value="">— field —</option>
                {(() => {
                  // Render grouped options (optgroup per group)
                  const groups: Record<string, FieldOption[]> = {}
                  for (const f of FIELD_OPTIONS) {
                    const g = f.group || "Other"
                    if (!groups[g]) groups[g] = []
                    groups[g].push(f)
                  }
                  return Object.entries(groups).map(([g, list]) => (
                    <optgroup key={g} label={g}>
                      {list.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </optgroup>
                  ))
                })()}
              </select>
              <select className="mkt-input" value={c.op} onChange={(e) => updateField({ op: e.target.value })} disabled={!meta}>
                {ops.map((o) => <option key={o} value={o}>{OP_OPTIONS[o] || o}</option>)}
              </select>
              {!meta ? (
                <input className="mkt-input" value="" disabled placeholder="— select field first —" />
              ) : valueless ? (
                <input className="mkt-input" value="" disabled placeholder="(no value needed)" />
              ) : meta.value_kind === "list" ? (
                <select className="mkt-input" value={c.value} onChange={(e) => updateField({ value: e.target.value })}>
                  <option value="">— select list —</option>
                  {lists.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              ) : meta.value_kind === "flow" ? (
                <select className="mkt-input" value={c.value} onChange={(e) => updateField({ value: e.target.value })}>
                  <option value="">— select flow —</option>
                  {flows.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              ) : meta.value_kind === "project" ? (
                <select className="mkt-input" value={c.value} onChange={(e) => updateField({ value: e.target.value })}>
                  <option value="">— select project —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              ) : meta.value_kind === "lifecycle" ? (
                c.op === "in" || c.op === "nin" ? (
                  <input className="mkt-input" value={c.value} onChange={(e) => updateField({ value: e.target.value })} placeholder="e.g. active,loyal,new_customer" />
                ) : (
                  <select className="mkt-input" value={c.value} onChange={(e) => updateField({ value: e.target.value })}>
                    <option value="">— select stage —</option>
                    {LIFECYCLE_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )
              ) : meta.value_kind === "rfm_segment" ? (
                c.op === "in" || c.op === "nin" ? (
                  <input className="mkt-input" value={c.value} onChange={(e) => updateField({ value: e.target.value })} placeholder="e.g. champion,loyal" />
                ) : (
                  <select className="mkt-input" value={c.value} onChange={(e) => updateField({ value: e.target.value })}>
                    <option value="">— select RFM segment —</option>
                    {RFM_SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )
              ) : meta.value_kind === "bool" ? (
                <select className="mkt-input" value={c.value || "true"} onChange={(e) => updateField({ value: e.target.value })}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : meta.value_kind === "order_status" ? (
                <select className="mkt-input" value={c.value || "buyer"} onChange={(e) => updateField({ value: e.target.value })}>
                  <option value="buyer">Buyer (1+ orders)</option>
                  <option value="non_buyer">Non-buyer (0 orders)</option>
                </select>
              ) : meta.value_kind === "number" ? (
                <input
                  className="mkt-input"
                  type="number"
                  value={c.value}
                  onChange={(e) => updateField({ value: e.target.value })}
                  placeholder="e.g. 90"
                />
              ) : meta.value_kind === "date" ? (
                <input
                  className="mkt-input"
                  type="datetime-local"
                  value={c.value}
                  onChange={(e) => updateField({ value: e.target.value })}
                />
              ) : (
                <input
                  className="mkt-input"
                  value={c.value}
                  onChange={(e) => updateField({ value: e.target.value })}
                  placeholder={c.op === "in" || c.op === "nin" ? "comma-separated values" : "value"}
                />
              )}
              <button
                onClick={() => {
                  const arr = query.conditions.filter((_, i) => i !== idx)
                  setQuery({ ...query, conditions: arr.length === 0 ? [{ field: "", op: "eq", value: "" }] : arr })
                }}
                className="mkt-btn-danger-ghost"
                style={{ border: `1px solid ${tokens.borderStrong}`, height: "40px" }}
                aria-label="Remove condition"
              >
                ×
              </button>
            </div>
          )
        })}
        <button
          className="mkt-btn mkt-btn-sm"
          onClick={() => setQuery({ ...query, conditions: [...query.conditions, { field: "", op: "eq", value: "" }] })}
          style={{ marginTop: "4px" }}
        >
          + Add condition
        </button>
      </div>

      {previewResult && (
        <div
          style={{
            marginTop: "20px",
            padding: "14px 16px",
            background: tokens.successSoft,
            border: `1px solid #A7F3D0`,
            borderRadius: tokens.rMd,
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 600, color: tokens.successFg }}>
            {fmt(previewResult.count)} matching contact(s)
          </div>
          {previewResult.sample.length > 0 && (
            <div
              style={{
                fontSize: "12px",
                color: tokens.successFg,
                marginTop: "6px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                maxHeight: "120px",
                overflow: "auto",
              }}
            >
              {previewResult.sample.slice(0, 50).join(", ")}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export const config = defineRouteConfig({
  label: "Segments",
  rank: 90,
})

export default SegmentsPage
