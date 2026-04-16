import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { useParams } from "react-router-dom"
import { sdk } from "../../../../lib/sdk"
import {
  MarketingShell,
  EmptyState,
  fmt,
  tokens,
} from "../../../../components/marketing/shared"

function ListDetailPage() {
  const params = useParams()
  const qc = useQueryClient()
  const id = params.id
  const [page, setPage] = useState(0)
  const [emailsText, setEmailsText] = useState("")

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
      breadcrumbs={[
        { label: "Marketing", to: "/marketing" },
        { label: "Lists", to: "/marketing/lists" },
        { label: list?.name || "Detail" },
      ]}
    >
      <div className="mkt-card" style={{ padding: "24px", marginBottom: "16px" }}>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: tokens.fgSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: "12px",
          }}
        >
          Add members
        </div>
        <label className="mkt-label">Emails (comma, space or newline separated)</label>
        <textarea
          className="mkt-input"
          style={{ minHeight: "90px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "13px" }}
          value={emailsText}
          onChange={(e) => setEmailsText(e.target.value)}
          placeholder="alice@example.com, bob@example.com"
        />
        <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
          <button
            className="mkt-btn-primary"
            disabled={!emailsText.trim() || addMut.isPending}
            onClick={submitAdd}
          >
            {addMut.isPending ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      <div className="mkt-card" style={{ overflow: "hidden", padding: 0 }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${tokens.borderSubtle}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 600, color: tokens.fg }}>Members ({fmt(count)})</div>
        </div>
        {isLoading ? (
          <div style={{ padding: "32px", color: tokens.fgSecondary, fontSize: "13px", textAlign: "center" }}>
            Loading…
          </div>
        ) : members.length === 0 ? (
          <EmptyState icon="👥" title="No members yet" description="Add contacts above to populate this list." />
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
                    <td style={{ fontWeight: 500 }}>{m.email}</td>
                    <td style={{ color: tokens.fgSecondary }}>{[m.first_name, m.last_name].filter(Boolean).join(" ") || "—"}</td>
                    <td style={{ color: tokens.fgSecondary, fontSize: "13px" }}>{m.added_at ? new Date(m.added_at).toLocaleDateString() : "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="mkt-btn-danger-ghost"
                        onClick={() => { if (confirm(`Remove ${m.email}?`)) removeMut.mutate(m.contact_id || m.id) }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {count > limit && (
              <div style={{ padding: "14px 20px", display: "flex", justifyContent: "flex-end", gap: "10px", alignItems: "center", borderTop: `1px solid ${tokens.borderSubtle}` }}>
                <button disabled={page === 0} onClick={() => setPage(page - 1)} className="mkt-btn mkt-btn-sm">
                  Previous
                </button>
                <span style={{ fontSize: "13px", color: tokens.fgSecondary }}>Page {page + 1}</span>
                <button disabled={(page + 1) * limit >= count} onClick={() => setPage(page + 1)} className="mkt-btn mkt-btn-sm">
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
