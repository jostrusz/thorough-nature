import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../../lib/sdk"
import {
  MarketingShell,
  useSelectedBrand,
  brandQs,
  Modal,
  lblStyle,
  fmt,
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
      active="/marketing/lists"
      right={
        <button
          className="mkt-btn-primary"
          onClick={() => setShowNew(true)}
          style={{ padding: "7px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF" }}
        >
          + New List
        </button>
      }
    >
      {isLoading ? (
        <p style={{ color: "#8C9196", fontSize: "13px" }}>Loading…</p>
      ) : lists.length === 0 ? (
        <div className="mkt-card" style={{ padding: "40px", textAlign: "center", color: "#8C9196" }}>
          <p style={{ fontSize: "14px" }}>No lists yet</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
          {lists.map((l: any) => (
            <a key={l.id} href={`#/marketing/lists/${l.id}`} className="mkt-card" style={{ padding: "16px 18px", display: "block", textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A1A" }}>{l.name}</div>
                  {l.description && <div style={{ fontSize: "12px", color: "#6D7175", marginTop: "2px" }}>{l.description}</div>}
                </div>
                <span className="mkt-badge" style={{ background: l.type === "dynamic" ? "#DBEAFE" : "#E4E5E7", color: l.type === "dynamic" ? "#1D4ED8" : "#4A4A4A" }}>
                  {(l.type || "static").toUpperCase()}
                </span>
              </div>
              <div style={{ marginTop: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", color: "#6D7175" }}>
                  {fmt(l.member_count)} members
                </span>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (confirm(`Delete list "${l.name}"?`)) deleteMut.mutate(l.id)
                  }}
                  className="mkt-btn"
                  style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "11px", border: "1px solid #FED3D1", background: "#FFF", color: "#D72C0D" }}
                >
                  Delete
                </button>
              </div>
            </a>
          ))}
        </div>
      )}

      {showNew && (
        <Modal
          title="New list"
          onClose={() => setShowNew(false)}
          footer={
            <>
              <button className="mkt-btn" onClick={() => setShowNew(false)} style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "13px", border: "1px solid #E1E3E5", background: "#FFF", color: "#6D7175" }}>
                Cancel
              </button>
              <button
                className="mkt-btn-primary"
                disabled={!name || createMut.isPending}
                onClick={() => createMut.mutate({ brand_id: brandId || undefined, name, description, type })}
                style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF", opacity: !name ? 0.5 : 1 }}
              >
                {createMut.isPending ? "Creating…" : "Create list"}
              </button>
            </>
          }
        >
          <label style={lblStyle}>Name *</label>
          <input className="mkt-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <label style={{ ...lblStyle, marginTop: "10px" }}>Description</label>
          <textarea className="mkt-input" style={{ minHeight: "60px", fontFamily: "inherit" }} value={description} onChange={(e) => setDescription(e.target.value)} />
          <label style={{ ...lblStyle, marginTop: "10px" }}>Type</label>
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
})

export default ListsPage
