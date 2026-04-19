import React, { useState } from "react"
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
 *   - text   → plain <input>
 *   - list   → <select> filled from `listsQ`
 *   - flow   → <select> filled from `flowsQ`
 *   - bool   → Yes/No select (for flow.in_any_run)
 *   - date   → datetime-local
 *   - empty  → no value input (exists-only operators)
 */
const FIELD_OPTIONS: {
  value: string
  label: string
  dsl_field: string
  value_kind: "text" | "list" | "flow" | "bool" | "date" | "empty"
  ops?: string[]
}[] = [
  { value: "status", label: "Status", dsl_field: "contact.status", value_kind: "text" },
  { value: "source", label: "Source", dsl_field: "contact.source", value_kind: "text" },
  { value: "country", label: "Country", dsl_field: "contact.country_code", value_kind: "text" },
  { value: "locale", label: "Locale", dsl_field: "contact.locale", value_kind: "text" },
  { value: "created_at", label: "Created at", dsl_field: "contact.created_at", value_kind: "date" },
  { value: "subscribed_at", label: "Subscribed at", dsl_field: "contact.subscribed_at", value_kind: "date" },
  { value: "tag", label: "Tag", dsl_field: "contact.tags", value_kind: "text", ops: ["has"] },
  { value: "list_member", label: "List membership", dsl_field: "list.member", value_kind: "list", ops: ["eq", "ne"] },
  { value: "flow_in_any", label: "In any active flow", dsl_field: "flow.in_any_run", value_kind: "bool", ops: ["eq"] },
  { value: "flow_in", label: "In specific flow", dsl_field: "flow.in_run", value_kind: "flow", ops: ["eq", "ne"] },
  { value: "order_count", label: "Order count (total)", dsl_field: "order.count", value_kind: "text", ops: ["eq", "ne", "gt", "gte", "lt", "lte"] },
  { value: "order_total_sum", label: "Order total sum", dsl_field: "order.total_sum", value_kind: "text", ops: ["eq", "gt", "gte", "lt", "lte"] },
  { value: "order_last_at", label: "Last order at", dsl_field: "order.last_at", value_kind: "date", ops: ["before", "after", "exists"] },
]

const OP_OPTIONS = [
  { value: "eq", label: "equals" },
  { value: "ne", label: "not equal to" },
  { value: "contains", label: "contains" },
  { value: "starts", label: "starts with" },
  { value: "ends", label: "ends with" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "≤" },
  { value: "before", label: "before" },
  { value: "after", label: "after" },
  { value: "in", label: "in (comma-sep)" },
  { value: "nin", label: "not in" },
  { value: "has", label: "has" },
  { value: "exists", label: "exists" },
]

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

  let val: any = c.value
  if (meta.value_kind === "bool") {
    val = c.value === "true" || c.value === "yes" || c.value === "1"
  } else if (c.op === "in" || c.op === "nin") {
    val = String(c.value || "").split(",").map((v) => v.trim()).filter(Boolean)
  } else if (["gt", "gte", "lt", "lte"].includes(c.op) && c.value !== "" && !isNaN(Number(c.value))) {
    val = Number(c.value)
  } else if (c.op === "exists") {
    val = !(c.value === "false" || c.value === "no" || c.value === "0")
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
  const lists: any[] = ((listsQ.data as any)?.lists) || []
  const flows: any[] = ((flowsQ.data as any)?.flows) || []

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
          const ops = meta?.ops ? OP_OPTIONS.filter((o) => meta.ops!.includes(o.value)) : OP_OPTIONS
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
                {FIELD_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <select className="mkt-input" value={c.op} onChange={(e) => updateField({ op: e.target.value })}>
                {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {meta?.value_kind === "list" ? (
                <select className="mkt-input" value={c.value} onChange={(e) => updateField({ value: e.target.value })}>
                  <option value="">— select list —</option>
                  {lists.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              ) : meta?.value_kind === "flow" ? (
                <select className="mkt-input" value={c.value} onChange={(e) => updateField({ value: e.target.value })}>
                  <option value="">— select flow —</option>
                  {flows.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              ) : meta?.value_kind === "bool" ? (
                <select className="mkt-input" value={c.value || "true"} onChange={(e) => updateField({ value: e.target.value })}>
                  <option value="true">Yes (is in a flow)</option>
                  <option value="false">No (not in any flow)</option>
                </select>
              ) : meta?.value_kind === "date" ? (
                <input
                  className="mkt-input"
                  type="datetime-local"
                  value={c.value}
                  disabled={c.op === "exists"}
                  onChange={(e) => updateField({ value: e.target.value })}
                />
              ) : (
                <input
                  className="mkt-input"
                  value={c.value}
                  disabled={c.op === "exists"}
                  onChange={(e) => updateField({ value: e.target.value })}
                  placeholder="value"
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
})

export default SegmentsPage
