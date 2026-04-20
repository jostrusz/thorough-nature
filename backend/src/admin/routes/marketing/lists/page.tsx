import React, { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../../lib/sdk"
import {
  MarketingShell,
  EmptyState,
  useSelectedBrand,
  brandQs,
  Modal,
  fmt,
  tokens,
} from "../../../components/marketing/shared"

function ListsPage() {
  const qc = useQueryClient()
  const { brandId } = useSelectedBrand()
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<"static" | "dynamic">("static")

  const qs = brandQs(brandId)
  const { data, isLoading } = useQuery({
    queryKey: ["mkt-lists", brandId],
    queryFn: () =>
      sdk.client.fetch<{ lists: any[] }>(`/admin/marketing/lists${qs}`, { method: "GET" }),
    enabled: !!brandId,
  })
  const lists: any[] = ((data as any)?.lists) || []

  const createMut = useMutation({
    mutationFn: (body: any) =>
      sdk.client.fetch("/admin/marketing/lists", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-lists"] })
      toast.success("List created")
      setShowNew(false)
      setName("")
      setDescription("")
      setType("static")
    },
    onError: (e: any) => toast.error("Failed: " + (e?.message || "unknown")),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/marketing/lists/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-lists"] })
      toast.success("List deleted")
    },
    onError: () => toast.error("Failed to delete"),
  })

  return (
    <MarketingShell
      title="Lists"
      subtitle="Static or dynamic contact lists"
      breadcrumbs={[
        { label: "Marketing", to: "/marketing" },
        { label: "Lists" },
      ]}
      right={
        <button className="mkt-btn-primary" onClick={() => setShowNew(true)}>
          New list
        </button>
      }
    >
      {isLoading ? (
        <div className="mkt-card" style={{ padding: "32px", color: tokens.fgSecondary, fontSize: "13px", textAlign: "center" }}>
          Loading…
        </div>
      ) : lists.length === 0 ? (
        <div className="mkt-card">
          <EmptyState
            icon="📋"
            title="No lists yet"
            description="Create your first list to group contacts for campaigns."
            action={
              <button className="mkt-btn-primary" onClick={() => setShowNew(true)}>
                Create list
              </button>
            }
          />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {lists.map((l: any) => (
            <Link
              key={l.id}
              to={`/marketing/lists/${l.id}`}
              className="mkt-tile"
              style={{ display: "block" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: tokens.fg, letterSpacing: "-0.005em" }}>{l.name}</div>
                  {l.description && <div style={{ fontSize: "13px", color: tokens.fgSecondary, marginTop: "4px", lineHeight: 1.4 }}>{l.description}</div>}
                </div>
                <span
                  className="mkt-badge"
                  style={{
                    background: l.type === "dynamic" ? tokens.infoSoft : tokens.borderSubtle,
                    color: l.type === "dynamic" ? tokens.info : tokens.fgSecondary,
                  }}
                >
                  {l.type || "static"}
                </span>
              </div>
              <div style={{ marginTop: "14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: tokens.fgSecondary }}>
                  {fmt(l.member_count)} members
                </span>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (confirm(`Delete list "${l.name}"?`)) deleteMut.mutate(l.id)
                  }}
                  className="mkt-btn-danger-ghost"
                >
                  Delete
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showNew && (
        <Modal
          title="New list"
          onClose={() => setShowNew(false)}
          footer={
            <>
              <button className="mkt-btn" onClick={() => setShowNew(false)}>Cancel</button>
              <button
                className="mkt-btn-primary"
                disabled={!name || createMut.isPending}
                onClick={() => createMut.mutate({ brand_id: brandId || undefined, name, description, type })}
              >
                {createMut.isPending ? "Creating…" : "Create list"}
              </button>
            </>
          }
        >
          <label className="mkt-label">Name *</label>
          <input className="mkt-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <label className="mkt-label" style={{ marginTop: "16px" }}>Description</label>
          <textarea className="mkt-input" style={{ minHeight: "80px" }} value={description} onChange={(e) => setDescription(e.target.value)} />
          <label className="mkt-label" style={{ marginTop: "16px" }}>Type</label>
          <select className="mkt-input" value={type} onChange={(e) => setType(e.target.value as "static" | "dynamic")}>
            <option value="static">Static</option>
            <option value="dynamic">Dynamic (segment-backed)</option>
          </select>
        </Modal>
      )}
    </MarketingShell>
  )
}

export const config = defineRouteConfig({
  label: "Lists",
  rank: 80,
})

export default ListsPage
