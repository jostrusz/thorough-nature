import React, { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { useParams } from "react-router-dom"
import { sdk } from "../../../../lib/sdk"
import {
  MarketingShell,
  lblStyle,
  fmt,
} from "../../../../components/marketing/shared"

function ListDetailPage() {
  const params = useParams()
  const qc = useQueryClient()
  const [id, setId] = useState<string | undefined>(params.id)
  const [page, setPage] = useState(0)
  const [emailsText, setEmailsText] = useState("")

  useEffect(() => {
    if (!id && typeof window !== "undefined") {
      const m = window.location.hash.match(/#\/marketing\/lists\/([^/?#]+)/)
      if (m) setId(m[1])
    }
  }, [id])

  const { data: listData } = useQuery({
    queryKey: ["mkt-list", id],
    queryFn: () =>
      id
        ? sdk.client.fetch<{ list: any }>(`/admin/marketing/lists/${id}`, { method: "GET" })
        : Promise.resolve({ list: null } as any),
    enabled: !!id,
  })
  const list: any = (listData as any)?.list

  const limit = 25
  const { data: membersData, isLoading } = useQuery({
    queryKey: ["mkt-list-members", id, page],
    queryFn: () =>
      id
        ? sdk.client.fetch<{ members: any[]; count: number }>(`/admin/marketing/lists/${id}/members?limit=${limit}&offset=${page * limit}`, { method: "GET" })
        : Promise.resolve({ members: [], count: 0 } as any),
    enabled: !!id,
  })
  const members: any[] = ((membersData as any)?.members) || []
  const count = Number(((membersData as any)?.count) ?? members.length)

  const addMut = useMutation({
    mutationFn: (emails: string[]) =>
      sdk.client.fetch(`/admin/marketing/lists/${id}/members`, {
        method: "POST",
        body: { emails },
      }),
    onSuccess: (resp: any) => {
      qc.invalidateQueries({ queryKey: ["mkt-list-members", id] })
      qc.invalidateQueries({ queryKey: ["mkt-lists"] })
      toast.success(`Added ${resp?.added ?? 0}`)
      setEmailsText("")
    },
    onError: (e: any) => toast.error("Failed: " + (e?.message || "unknown")),
  })

  const removeMut = useMutation({
    mutationFn: (contactId: string) =>
      sdk.client.fetch(`/admin/marketing/lists/${id}/members/${contactId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-list-members", id] })
      qc.invalidateQueries({ queryKey: ["mkt-lists"] })
      toast.success("Removed")
    },
    onError: () => toast.error("Failed to remove"),
  })

  function submitAdd() {
    const emails = emailsText
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => /.+@.+\..+/.test(s))
    if (emails.length === 0) {
      toast.error("Enter at least one valid email")
      return
    }
    addMut.mutate(emails)
  }

  return (
    <MarketingShell
      title={list?.name || "List"}
      subtitle={list?.description}
      active="/marketing/lists"
      right={<a href="#/marketing/lists" className="mkt-link" style={{ fontSize: "12px" }}>← Back to lists</a>}
    >
      <div className="mkt-card" style={{ padding: "16px 18px", marginBottom: "12px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#6D7175", textTransform: "uppercase", marginBottom: "8px" }}>Add members</div>
        <label style={lblStyle}>Emails (comma, space or newline separated)</label>
        <textarea
          className="mkt-input"
          style={{ minHeight: "70px", fontFamily: "monospace", fontSize: "12px" }}
          value={emailsText}
          onChange={(e) => setEmailsText(e.target.value)}
          placeholder="alice@example.com, bob@example.com"
        />
        <div style={{ marginTop: "8px", display: "flex", justifyContent: "flex-end" }}>
          <button
            className="mkt-btn-primary"
            disabled={!emailsText.trim() || addMut.isPending}
            onClick={submitAdd}
            style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF" }}
          >
            {addMut.isPending ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      <div className="mkt-card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #F1F2F4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "13px", fontWeight: 600 }}>Members ({fmt(count)})</div>
        </div>
        {isLoading ? (
          <div style={{ padding: "20px", color: "#8C9196", fontSize: "13px" }}>Loading…</div>
        ) : members.length === 0 ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#8C9196", fontSize: "13px" }}>
            No members yet.
          </div>
        ) : (
          <>
            <table className="mkt-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Added</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m: any) => (
                  <tr key={m.id || m.contact_id} className="mkt-row">
                    <td>{m.email}</td>
                    <td style={{ color: "#6D7175" }}>{[m.first_name, m.last_name].filter(Boolean).join(" ") || "—"}</td>
                    <td style={{ color: "#6D7175", fontSize: "12px" }}>{m.added_at ? new Date(m.added_at).toLocaleDateString() : "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="mkt-btn"
                        onClick={() => { if (confirm(`Remove ${m.email}?`)) removeMut.mutate(m.contact_id || m.id) }}
                        style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "11px", border: "1px solid #FED3D1", background: "#FFF", color: "#D72C0D" }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {count > limit && (
              <div style={{ padding: "10px 14px", display: "flex", justifyContent: "flex-end", gap: "8px", borderTop: "1px solid #F1F2F4" }}>
                <button disabled={page === 0} onClick={() => setPage(page - 1)} className="mkt-btn" style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A", opacity: page === 0 ? 0.5 : 1 }}>
                  Previous
                </button>
                <span style={{ fontSize: "12px", color: "#6D7175", alignSelf: "center" }}>Page {page + 1}</span>
                <button disabled={(page + 1) * limit >= count} onClick={() => setPage(page + 1)} className="mkt-btn" style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A", opacity: (page + 1) * limit >= count ? 0.5 : 1 }}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </MarketingShell>
  )
}

export default ListDetailPage
