import React, { useEffect, useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../../lib/sdk"
import {
  MarketingShell,
  StatusBadge,
  useSelectedBrand,
  brandQs,
  Modal,
  SlideOver,
  lblStyle,
} from "../../../components/marketing/shared"

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

function ContactsPage() {
  const qc = useQueryClient()
  const { brandId } = useSelectedBrand()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [openContact, setOpenContact] = useState<any | null>(null)

  const debounced = useDebounced(search, 300)

  const qs = useMemo(() => {
    const p: string[] = []
    if (brandId) p.push(`brand_id=${encodeURIComponent(brandId)}`)
    if (debounced) p.push(`email=${encodeURIComponent(debounced)}`)
    if (statusFilter) p.push(`status=${encodeURIComponent(statusFilter)}`)
    return p.length ? `?${p.join("&")}` : ""
  }, [brandId, debounced, statusFilter])

  const { data, isLoading } = useQuery({
    queryKey: ["mkt-contacts", brandId, debounced, statusFilter],
    queryFn: () =>
      sdk.client.fetch<{ contacts: any[] }>(`/admin/marketing/contacts${qs}`, { method: "GET" }),
    enabled: !!brandId,
  })
  const contacts: any[] = ((data as any)?.contacts) || []

  const createMut = useMutation({
    mutationFn: (body: any) =>
      sdk.client.fetch("/admin/marketing/contacts", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-contacts"] })
      toast.success("Contact created")
      setShowNew(false)
    },
    onError: (e: any) => toast.error("Failed: " + (e?.message || "unknown")),
  })

  const importMut = useMutation({
    mutationFn: (body: any) =>
      sdk.client.fetch("/admin/marketing/contacts/import", { method: "POST", body }),
    onSuccess: (resp: any) => {
      qc.invalidateQueries({ queryKey: ["mkt-contacts"] })
      const total = (resp?.created ?? 0) + (resp?.updated ?? 0)
      const errMsg = resp?.errors?.length ? ` with ${resp.errors.length} errors` : ""
      toast.success(`Imported ${total}${errMsg}`)
      setShowImport(false)
    },
    onError: (e: any) => toast.error("Failed: " + (e?.message || "unknown")),
  })

  return (
    <MarketingShell
      title="Contacts"
      subtitle="Subscribers, leads and customers"
      active="/marketing/contacts"
      right={
        <>
          <button className="mkt-btn" onClick={() => setShowImport(true)} style={{ padding: "7px 14px", borderRadius: "6px", fontSize: "13px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A" }}>
            Import
          </button>
          <button className="mkt-btn-primary" onClick={() => setShowNew(true)} style={{ padding: "7px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF" }}>
            + New Contact
          </button>
        </>
      }
    >
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        <input
          className="mkt-input"
          style={{ maxWidth: "320px" }}
          placeholder="Search email, name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="mkt-input"
          style={{ width: "auto", minWidth: "180px" }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="subscribed">Subscribed</option>
          <option value="unconfirmed">Unconfirmed</option>
          <option value="unsubscribed">Unsubscribed</option>
          <option value="bounced">Bounced</option>
        </select>
      </div>

      <div className="mkt-card" style={{ overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: "24px", color: "#8C9196", fontSize: "13px" }}>Loading…</div>
        ) : contacts.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#8C9196", fontSize: "13px" }}>
            No contacts.
          </div>
        ) : (
          <table className="mkt-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Status</th>
                <th>Source</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c: any) => (
                <tr key={c.id} className="mkt-row" style={{ cursor: "pointer" }} onClick={() => setOpenContact(c)}>
                  <td style={{ fontWeight: 500 }}>{c.email}</td>
                  <td style={{ color: "#6D7175" }}>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td><StatusBadge status={c.status || "subscribed"} /></td>
                  <td style={{ color: "#6D7175", fontSize: "12px" }}>{c.source || "—"}</td>
                  <td style={{ color: "#6D7175", fontSize: "12px" }}>{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && <NewContactModal brandId={brandId} onClose={() => setShowNew(false)} onSave={(body) => createMut.mutate(body)} saving={createMut.isPending} />}
      {showImport && <ImportContactsModal brandId={brandId} onClose={() => setShowImport(false)} onImport={(body) => importMut.mutate(body)} importing={importMut.isPending} />}
      {openContact && <ContactDetailsPanel contact={openContact} onClose={() => setOpenContact(null)} />}
    </MarketingShell>
  )
}

function NewContactModal({
  brandId,
  onClose,
  onSave,
  saving,
}: {
  brandId: string | null
  onClose: () => void
  onSave: (body: any) => void
  saving: boolean
}) {
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [status, setStatus] = useState("subscribed")
  const valid = /.+@.+\..+/.test(email)
  return (
    <Modal
      title="New contact"
      onClose={onClose}
      footer={
        <>
          <button className="mkt-btn" onClick={onClose} style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "13px", border: "1px solid #E1E3E5", background: "#FFF", color: "#6D7175" }}>
            Cancel
          </button>
          <button
            className="mkt-btn-primary"
            disabled={!valid || saving}
            onClick={() => onSave({ brand_id: brandId || undefined, email, first_name: firstName || undefined, last_name: lastName || undefined, status })}
            style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF", opacity: !valid ? 0.5 : 1 }}
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <div style={{ gridColumn: "span 2" }}>
          <label style={lblStyle}>Email *</label>
          <input className="mkt-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoFocus />
        </div>
        <div>
          <label style={lblStyle}>First name</label>
          <input className="mkt-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div>
          <label style={lblStyle}>Last name</label>
          <input className="mkt-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div>
          <label style={lblStyle}>Status</label>
          <select className="mkt-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="subscribed">Subscribed</option>
            <option value="unconfirmed">Unconfirmed</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
        </div>
      </div>
    </Modal>
  )
}

function ImportContactsModal({
  brandId,
  onClose,
  onImport,
  importing,
}: {
  brandId: string | null
  onClose: () => void
  onImport: (body: any) => void
  importing: boolean
}) {
  const [csv, setCsv] = useState("")
  const [defaultStatus, setDefaultStatus] = useState("subscribed")

  function parse() {
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    return lines
      .map((line) => {
        const parts = line.split(",").map((p) => p.trim())
        const email = parts[0]
        if (!email || !/.+@.+\..+/.test(email)) return null
        return {
          email,
          first_name: parts[1] || undefined,
          last_name: parts[2] || undefined,
        }
      })
      .filter(Boolean)
  }

  const parsed = parse()

  return (
    <Modal
      title="Import contacts"
      onClose={onClose}
      width={640}
      footer={
        <>
          <button className="mkt-btn" onClick={onClose} style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "13px", border: "1px solid #E1E3E5", background: "#FFF", color: "#6D7175" }}>
            Cancel
          </button>
          <button
            className="mkt-btn-primary"
            disabled={parsed.length === 0 || importing}
            onClick={() => onImport({ brand_id: brandId || undefined, status: defaultStatus, contacts: parsed })}
            style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF", opacity: parsed.length === 0 ? 0.5 : 1 }}
          >
            {importing ? "Importing…" : `Import ${parsed.length}`}
          </button>
        </>
      }
    >
      <p style={{ fontSize: "12px", color: "#6D7175", marginTop: 0 }}>
        Paste one email per line, or <code>email,first_name,last_name</code>.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", alignItems: "end" }}>
        <div>
          <label style={lblStyle}>Default status</label>
          <select className="mkt-input" value={defaultStatus} onChange={(e) => setDefaultStatus(e.target.value)}>
            <option value="subscribed">Subscribed</option>
            <option value="unconfirmed">Unconfirmed</option>
          </select>
        </div>
        <div style={{ fontSize: "12px", color: "#8C9196", paddingBottom: "9px" }}>
          Valid rows: {parsed.length}
        </div>
      </div>
      <textarea
        className="mkt-input"
        style={{ minHeight: "220px", marginTop: "10px", fontFamily: "monospace", fontSize: "12px" }}
        placeholder={"alice@example.com\nbob@example.com,Bob,Smith"}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
      />
    </Modal>
  )
}

function ContactDetailsPanel({ contact, onClose }: { contact: any; onClose: () => void }) {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ["mkt-contact", contact.id],
    queryFn: () =>
      sdk.client.fetch<{ contact: any }>(`/admin/marketing/contacts/${contact.id}`, { method: "GET" }),
  })
  const c = (data as any)?.contact || contact
  const [tags, setTags] = useState<string[]>(contact.tags || [])
  const [newTag, setNewTag] = useState("")

  useEffect(() => {
    setTags(c.tags || [])
  }, [c.tags])

  const saveTagsMut = useMutation({
    mutationFn: (tags: string[]) =>
      sdk.client.fetch(`/admin/marketing/contacts/${contact.id}`, {
        method: "POST",
        body: { tags },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-contacts"] })
      qc.invalidateQueries({ queryKey: ["mkt-contact", contact.id] })
      toast.success("Tags updated")
    },
    onError: () => toast.error("Failed to update tags"),
  })

  const lists = c.list_memberships || c.lists || []

  return (
    <SlideOver
      title={c.email}
      onClose={onClose}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <label style={lblStyle}>Status</label>
          <div><StatusBadge status={c.status || "subscribed"} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div>
            <label style={lblStyle}>First name</label>
            <div style={{ fontSize: "13px" }}>{c.first_name || "—"}</div>
          </div>
          <div>
            <label style={lblStyle}>Last name</label>
            <div style={{ fontSize: "13px" }}>{c.last_name || "—"}</div>
          </div>
          <div>
            <label style={lblStyle}>Source</label>
            <div style={{ fontSize: "13px" }}>{c.source || "—"}</div>
          </div>
          <div>
            <label style={lblStyle}>Created</label>
            <div style={{ fontSize: "13px" }}>{c.created_at ? new Date(c.created_at).toLocaleString() : "—"}</div>
          </div>
        </div>

        <div>
          <label style={lblStyle}>Tags</label>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "6px" }}>
            {tags.map((t) => (
              <span key={t} className="mkt-badge" style={{ background: "#E4E5E7", color: "#4A4A4A" }}>
                {t}{" "}
                <button onClick={() => setTags(tags.filter((x) => x !== t))} style={{ border: "none", background: "none", cursor: "pointer", color: "#D72C0D", marginLeft: "2px" }}>×</button>
              </span>
            ))}
            {tags.length === 0 && <span style={{ fontSize: "12px", color: "#8C9196" }}>No tags</span>}
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              className="mkt-input"
              placeholder="Add tag…"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTag.trim()) {
                  setTags([...tags, newTag.trim()])
                  setNewTag("")
                }
              }}
            />
            <button
              className="mkt-btn-primary"
              disabled={saveTagsMut.isPending}
              onClick={() => saveTagsMut.mutate(tags)}
              style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF" }}
            >
              Save tags
            </button>
          </div>
        </div>

        <div>
          <label style={lblStyle}>List memberships</label>
          {lists.length === 0 ? (
            <div style={{ fontSize: "12px", color: "#8C9196" }}>Not on any lists</div>
          ) : (
            <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: "13px" }}>
              {lists.map((l: any) => (
                <li key={l.id || l.list_id}>{l.name || l.list_name || l.list_id}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SlideOver>
  )
}

export const config = defineRouteConfig({
  label: "Contacts",
})

export default ContactsPage
