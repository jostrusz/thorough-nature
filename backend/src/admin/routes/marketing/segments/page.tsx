import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../../lib/sdk"
import {
  MarketingShell,
  Modal,
  lblStyle,
  fmt,
  useSelectedBrand,
  brandQs,
} from "../../../components/marketing/shared"

const FIELD_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "first_name", label: "First name" },
  { value: "last_name", label: "Last name" },
  { value: "status", label: "Status" },
  { value: "source", label: "Source" },
  { value: "created_at", label: "Created at" },
  { value: "tag", label: "Tag" },
  { value: "list", label: "List membership" },
  { value: "last_opened_at", label: "Last opened at" },
  { value: "last_clicked_at", label: "Last clicked at" },
  { value: "country", label: "Country" },
]

const OP_OPTIONS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equal to" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "starts_with", label: "starts with" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "≤" },
  { value: "in", label: "in (comma-sep)" },
  { value: "exists", label: "exists" },
  { value: "not_exists", label: "does not exist" },
]

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
      active="/marketing/segments"
      right={
        <button
          className="mkt-btn-primary"
          onClick={() => { setEditing(null); setShowModal(true) }}
          style={{ padding: "7px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF" }}
        >
          + New Segment
        </button>
      }
    >
      {isLoading ? (
        <p style={{ color: "#8C9196", fontSize: "13px" }}>Loading…</p>
      ) : segments.length === 0 ? (
        <div className="mkt-card" style={{ padding: "40px", textAlign: "center", color: "#8C9196" }}>
          <p style={{ fontSize: "14px" }}>No segments yet</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
          {segments.map((s: any) => (
            <div key={s.id} className="mkt-card" style={{ padding: "16px 18px" }}>
              <div style={{ fontSize: "14px", fontWeight: 600 }}>{s.name}</div>
              {s.description && <div style={{ fontSize: "12px", color: "#6D7175", marginTop: "2px" }}>{s.description}</div>}
              <div style={{ marginTop: "10px", fontSize: "12px", color: "#6D7175" }}>
                Cached: {fmt(s.cached_count)} members
                {s.cached_at && <span style={{ marginLeft: "8px", color: "#8C9196" }}>({new Date(s.cached_at).toLocaleString()})</span>}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "10px" }}>
                <button
                  className="mkt-btn"
                  onClick={() => { setEditing(s); setShowModal(true) }}
                  style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "11px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A" }}
                >
                  Edit
                </button>
                <button
                  className="mkt-btn"
                  onClick={() => { if (confirm(`Delete segment "${s.name}"?`)) deleteMut.mutate(s.id) }}
                  style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "11px", border: "1px solid #FED3D1", background: "#FFF", color: "#D72C0D" }}
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

function SegmentModal({ brandId, initial, onClose }: { brandId: string | null; initial: any | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(initial?.name || "")
  const [description, setDescription] = useState(initial?.description || "")
  const [query, setQuery] = useState<Query>(() => {
    if (initial?.query) {
      const q = initial.query
      if (q.all) return { combinator: "all", conditions: (q.all || []).map((c: any) => ({ field: c.field || "", op: c.op || "eq", value: String(c.value ?? "") })) }
      if (q.any) return { combinator: "any", conditions: (q.any || []).map((c: any) => ({ field: c.field || "", op: c.op || "eq", value: String(c.value ?? "") })) }
    }
    return { combinator: "all", conditions: [{ field: "status", op: "eq", value: "subscribed" }] }
  })
  const [previewResult, setPreviewResult] = useState<{ count: number; sample: string[] } | null>(null)

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
      .map((c) => {
        let val: any = c.value
        if (c.op === "in") val = c.value.split(",").map((v) => v.trim()).filter(Boolean)
        else if (["gt", "gte", "lt", "lte"].includes(c.op) && !isNaN(Number(c.value)) && c.value !== "") val = Number(c.value)
        return { field: c.field, op: c.op, value: val }
      })
    return {
      brand_id: brandId || undefined,
      name,
      description,
      query: { [query.combinator]: conds },
    }
  }

  return (
    <Modal
      title={initial ? `Edit segment: ${initial.name}` : "New segment"}
      onClose={onClose}
      width={720}
      footer={
        <>
          <button className="mkt-btn" onClick={onClose} style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "13px", border: "1px solid #E1E3E5", background: "#FFF", color: "#6D7175" }}>
            Cancel
          </button>
          <button
            className="mkt-btn"
            onClick={() => previewMut.mutate(buildBody())}
            disabled={previewMut.isPending || !name}
            style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "13px", border: "1px solid #008060", background: "#FFF", color: "#008060" }}
          >
            {previewMut.isPending ? "Counting…" : "Preview"}
          </button>
          <button
            className="mkt-btn-primary"
            onClick={() => saveMut.mutate(buildBody())}
            disabled={!name || saveMut.isPending}
            style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF", opacity: !name ? 0.5 : 1 }}
          >
            {saveMut.isPending ? "Saving…" : (initial ? "Save" : "Create")}
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <div>
          <label style={lblStyle}>Name *</label>
          <input className="mkt-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label style={lblStyle}>Description</label>
          <input className="mkt-input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: "16px" }}>
        <label style={lblStyle}>Match</label>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <select className="mkt-input" style={{ width: "auto" }} value={query.combinator} onChange={(e) => setQuery({ ...query, combinator: e.target.value as any })}>
            <option value="all">All conditions (AND)</option>
            <option value="any">Any condition (OR)</option>
          </select>
        </div>
        {query.conditions.map((c, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 28px", gap: "6px", marginBottom: "6px" }}>
            <select className="mkt-input" value={c.field} onChange={(e) => {
              const arr = [...query.conditions]
              arr[idx] = { ...arr[idx], field: e.target.value }
              setQuery({ ...query, conditions: arr })
            }}>
              <option value="">— field —</option>
              {FIELD_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <select className="mkt-input" value={c.op} onChange={(e) => {
              const arr = [...query.conditions]
              arr[idx] = { ...arr[idx], op: e.target.value }
              setQuery({ ...query, conditions: arr })
            }}>
              {OP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
              className="mkt-input"
              value={c.value}
              disabled={c.op === "exists" || c.op === "not_exists"}
              onChange={(e) => {
                const arr = [...query.conditions]
                arr[idx] = { ...arr[idx], value: e.target.value }
                setQuery({ ...query, conditions: arr })
              }}
              placeholder="value"
            />
            <button
              onClick={() => {
                const arr = query.conditions.filter((_, i) => i !== idx)
                setQuery({ ...query, conditions: arr.length === 0 ? [{ field: "", op: "eq", value: "" }] : arr })
              }}
              style={{ border: "1px solid #FED3D1", background: "#FFF", color: "#D72C0D", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="mkt-btn"
          onClick={() => setQuery({ ...query, conditions: [...query.conditions, { field: "", op: "eq", value: "" }] })}
          style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A", marginTop: "4px" }}
        >
          + Add condition
        </button>
      </div>

      {previewResult && (
        <div style={{ marginTop: "16px", padding: "10px 12px", background: "#F0FFF8", border: "1px solid #AEE9D1", borderRadius: "8px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#0D5740" }}>
            {fmt(previewResult.count)} matching contact(s)
          </div>
          {previewResult.sample.length > 0 && (
            <div style={{ fontSize: "11px", color: "#0D5740", marginTop: "4px", fontFamily: "monospace", maxHeight: "100px", overflow: "auto" }}>
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
