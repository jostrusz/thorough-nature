import React, { useEffect, useMemo, useState, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../../lib/sdk"
import {
  MarketingShell,
  StatusBadge,
  EmptyState,
  useSelectedBrand,
  Modal,
  SlideOver,
  fmt,
  tokens,
} from "../../../components/marketing/shared"

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

// ─── Column configuration ────────────────────────────────────────────────
type Col = { key: string; label: string; default: boolean; render: (c: any) => React.ReactNode }
const ALL_COLUMNS: Col[] = [
  { key: "email", label: "Email", default: true, render: (c) => <span style={{ fontWeight: 500 }}>{c.email}</span> },
  { key: "name", label: "Name", default: true, render: (c) => <span style={{ color: tokens.fgSecondary }}>{[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}</span> },
  { key: "status", label: "Status", default: true, render: (c) => <StatusBadge status={c.status || "subscribed"} /> },
  { key: "project", label: "Project", default: true, render: (c) => <span style={{ color: tokens.fgSecondary, fontSize: "13px" }}>{c.project_id || c.brand_display_name || "—"}</span> },
  { key: "source", label: "Source", default: true, render: (c) => <span style={{ color: tokens.fgSecondary, fontSize: "13px" }}>{c.source || "—"}</span> },
  { key: "created", label: "Created", default: true, render: (c) => <span style={{ color: tokens.fgSecondary, fontSize: "13px" }}>{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</span> },
  { key: "phone", label: "Phone", default: false, render: (c) => <span style={{ color: tokens.fgSecondary, fontSize: "13px" }}>{c.phone || "—"}</span> },
  { key: "city", label: "City", default: false, render: (c) => <span style={{ color: tokens.fgSecondary, fontSize: "13px" }}>{c.city || "—"}</span> },
  { key: "postal_code", label: "Postal code", default: false, render: (c) => <span style={{ color: tokens.fgSecondary, fontSize: "13px" }}>{c.postal_code || "—"}</span> },
  { key: "country", label: "Country", default: false, render: (c) => <span style={{ color: tokens.fgSecondary, fontSize: "13px" }}>{c.country_code || "—"}</span> },
  { key: "company", label: "Company", default: false, render: (c) => <span style={{ color: tokens.fgSecondary, fontSize: "13px" }}>{c.company || "—"}</span> },
  { key: "locale", label: "Locale", default: false, render: (c) => <span style={{ color: tokens.fgSecondary, fontSize: "13px" }}>{c.locale || "—"}</span> },
  { key: "tags", label: "Tags", default: false, render: (c) => <span style={{ color: tokens.fgSecondary, fontSize: "12px" }}>{(Array.isArray(c.tags) && c.tags.length) ? c.tags.join(", ") : "—"}</span> },
  { key: "total_revenue_eur", label: "Revenue (€)", default: false, render: (c) => <span style={{ color: tokens.fgSecondary, fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>{c.total_revenue_eur != null ? Number(c.total_revenue_eur).toFixed(2) : "—"}</span> },
  { key: "total_orders", label: "Orders", default: false, render: (c) => <span style={{ color: tokens.fgSecondary, fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>{c.total_orders ?? 0}</span> },
  { key: "lifecycle", label: "Lifecycle", default: false, render: (c) => <span style={{ color: tokens.fgSecondary, fontSize: "12px" }}>{c.lifecycle_stage || "—"}</span> },
  { key: "rfm", label: "RFM", default: false, render: (c) => <span style={{ color: tokens.fgSecondary, fontSize: "12px", fontVariantNumeric: "tabular-nums" }}>{c.rfm_score || "—"}</span> },
]

const COL_STORAGE_KEY = "mkt.contacts.columns.v1"
function useVisibleColumns(): [string[], (next: string[]) => void] {
  const [keys, setKeys] = useState<string[]>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(COL_STORAGE_KEY) : null
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length) return parsed
      }
    } catch {}
    return ALL_COLUMNS.filter((c) => c.default).map((c) => c.key)
  })
  const setAndPersist = (next: string[]) => {
    setKeys(next)
    try {
      window.localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(next))
    } catch {}
  }
  return [keys, setAndPersist]
}

function ContactsPage() {
  const qc = useQueryClient()
  const { brandId } = useSelectedBrand()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [openContact, setOpenContact] = useState<any | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showCols, setShowCols] = useState(false)
  const [visibleCols, setVisibleCols] = useVisibleColumns()

  const debounced = useDebounced(search, 300)

  const qs = useMemo(() => {
    const p: string[] = []
    if (brandId) p.push(`brand_id=${encodeURIComponent(brandId)}`)
    if (debounced) p.push(`email=${encodeURIComponent(debounced)}`)
    if (statusFilter) p.push(`status=${encodeURIComponent(statusFilter)}`)
    p.push(`limit=500`)
    return p.length ? `?${p.join("&")}` : ""
  }, [brandId, debounced, statusFilter])

  const { data, isLoading } = useQuery({
    queryKey: ["mkt-contacts", brandId, debounced, statusFilter],
    queryFn: () =>
      sdk.client.fetch<{ contacts: any[]; count?: number }>(`/admin/marketing/contacts${qs}`, { method: "GET" }),
    enabled: !!brandId,
  })
  const contacts: any[] = ((data as any)?.contacts) || []
  const totalCount: number = ((data as any)?.count) ?? contacts.length

  // Clear selection when brand or filters change.
  useEffect(() => {
    setSelectedIds(new Set())
  }, [brandId, debounced, statusFilter])

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
      const brandsCount = resp?.brands_count ?? 1
      const errMsg = resp?.errors?.length ? `, ${resp.errors.length} errors` : ""
      toast.success(`Imported ${total} record(s) across ${brandsCount} brand(s)${errMsg}`)
      setShowImport(false)
    },
    onError: (e: any) => toast.error("Failed: " + (e?.message || "unknown")),
  })

  const bulkMut = useMutation({
    mutationFn: (body: any) =>
      sdk.client.fetch("/admin/marketing/contacts/bulk", { method: "POST", body }),
    onSuccess: (resp: any) => {
      qc.invalidateQueries({ queryKey: ["mkt-contacts"] })
      setSelectedIds(new Set())
      const errs = resp?.errors?.length ? ` (${resp.errors.length} errors)` : ""
      toast.success(`${resp?.action || "Bulk"} applied to ${resp?.processed || 0} contact(s)${errs}`)
    },
    onError: (e: any) => toast.error("Bulk failed: " + (e?.message || "unknown")),
  })

  const shownColumns = ALL_COLUMNS.filter((c) => visibleCols.includes(c.key))
  const allOnPageSelected = contacts.length > 0 && contacts.every((c) => selectedIds.has(c.id))
  const someOnPageSelected = contacts.some((c) => selectedIds.has(c.id))
  const selectedCount = selectedIds.size

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleAllOnPage = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        contacts.forEach((c) => next.delete(c.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        contacts.forEach((c) => next.add(c.id))
        return next
      })
    }
  }

  return (
    <MarketingShell
      title="Contacts"
      subtitle="Subscribers, leads and customers"
      breadcrumbs={[
        { label: "Marketing", to: "/marketing" },
        { label: "Contacts" },
      ]}
      right={
        <>
          <button className="mkt-btn" onClick={() => setShowImport(true)}>
            Import
          </button>
          <button className="mkt-btn-primary" onClick={() => setShowNew(true)}>
            New contact
          </button>
        </>
      }
    >
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="mkt-input"
          style={{ maxWidth: "360px", height: "36px", fontSize: "13px" }}
          placeholder="Search email, name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="mkt-input"
          style={{ width: "auto", minWidth: "200px", height: "36px", fontSize: "13px" }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="subscribed">Subscribed</option>
          <option value="unconfirmed">Unconfirmed</option>
          <option value="unsubscribed">Unsubscribed</option>
          <option value="bounced">Bounced</option>
        </select>

        <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: tokens.fgSecondary }}>
            {fmt(totalCount)} total
          </span>
          <div style={{ position: "relative" }}>
            <button className="mkt-btn mkt-btn-sm" onClick={() => setShowCols((v) => !v)}>
              Columns ({shownColumns.length})
            </button>
            {showCols && (
              <ColumnsPopover
                visibleCols={visibleCols}
                setVisibleCols={setVisibleCols}
                onClose={() => setShowCols(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bulk actions bar (MailerLite-style) */}
      {selectedCount > 0 && (
        <BulkActionsBar
          count={selectedCount}
          busy={bulkMut.isPending}
          onClear={() => setSelectedIds(new Set())}
          onDelete={() => {
            if (!confirm(`Delete ${selectedCount} contact(s)? This cannot be undone.`)) return
            bulkMut.mutate({ action: "delete", ids: Array.from(selectedIds) })
          }}
          onStatus={(status) => {
            bulkMut.mutate({ action: "update_status", ids: Array.from(selectedIds), status })
          }}
          onAddTags={(tags) => {
            bulkMut.mutate({ action: "add_tags", ids: Array.from(selectedIds), tags })
          }}
        />
      )}

      <div className="mkt-card" style={{ overflow: "hidden", padding: 0 }}>
        {isLoading ? (
          <div style={{ padding: "32px", color: tokens.fgSecondary, fontSize: "13px", textAlign: "center" }}>
            Loading…
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState
            icon="👤"
            title="No contacts yet"
            description="Add individual contacts or import a CSV to get started."
            action={
              <button className="mkt-btn-primary" onClick={() => setShowNew(true)}>
                Add contact
              </button>
            }
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="mkt-table">
              <thead>
                <tr>
                  <th style={{ width: "40px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected
                      }}
                      onChange={toggleAllOnPage}
                      aria-label="Select all on page"
                    />
                  </th>
                  {shownColumns.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c: any) => {
                  const selected = selectedIds.has(c.id)
                  return (
                    <tr
                      key={c.id}
                      className="mkt-row"
                      style={{
                        cursor: "pointer",
                        background: selected ? tokens.primarySoft : undefined,
                      }}
                      onClick={(e) => {
                        // If they click the checkbox cell, don't open detail.
                        const tag = (e.target as HTMLElement).tagName
                        if (tag === "INPUT") return
                        setOpenContact(c)
                      }}
                    >
                      <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleOne(c.id)}
                          aria-label={`Select ${c.email}`}
                        />
                      </td>
                      {shownColumns.map((col) => (
                        <td key={col.key}>{col.render(c)}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNew && <NewContactModal brandId={brandId} onClose={() => setShowNew(false)} onSave={(body) => createMut.mutate(body)} saving={createMut.isPending} />}
      {showImport && <ImportContactsModal defaultBrandId={brandId} onClose={() => setShowImport(false)} onImport={(body) => importMut.mutate(body)} importing={importMut.isPending} />}
      {openContact && <ContactDetailsPanel contact={openContact} onClose={() => setOpenContact(null)} />}
    </MarketingShell>
  )
}

// ─── Columns popover ─────────────────────────────────────────────────────
function ColumnsPopover({
  visibleCols,
  setVisibleCols,
  onClose,
}: {
  visibleCols: string[]
  setVisibleCols: (next: string[]) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  const toggle = (key: string) => {
    if (visibleCols.includes(key)) {
      setVisibleCols(visibleCols.filter((k) => k !== key))
    } else {
      // Preserve ALL_COLUMNS order.
      const next = ALL_COLUMNS.filter((c) => visibleCols.includes(c.key) || c.key === key).map((c) => c.key)
      setVisibleCols(next)
    }
  }

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        right: 0,
        top: "calc(100% + 6px)",
        background: tokens.surface,
        border: `1px solid ${tokens.borderStrong}`,
        borderRadius: tokens.rMd,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        padding: "8px",
        minWidth: "220px",
        maxHeight: "400px",
        overflowY: "auto",
        zIndex: 100,
      }}
    >
      <div style={{ fontSize: "11px", fontWeight: 600, color: tokens.fgSecondary, letterSpacing: "0.04em", textTransform: "uppercase", padding: "6px 8px" }}>
        Visible columns
      </div>
      {ALL_COLUMNS.map((col) => (
        <label
          key={col.key}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 10px",
            cursor: "pointer",
            borderRadius: tokens.rSm,
            fontSize: "13px",
            color: tokens.fg,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = tokens.borderSubtle)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <input
            type="checkbox"
            checked={visibleCols.includes(col.key)}
            onChange={() => toggle(col.key)}
          />
          {col.label}
        </label>
      ))}
    </div>
  )
}

// ─── Bulk actions bar ────────────────────────────────────────────────────
function BulkActionsBar({
  count,
  busy,
  onClear,
  onDelete,
  onStatus,
  onAddTags,
}: {
  count: number
  busy: boolean
  onClear: () => void
  onDelete: () => void
  onStatus: (status: string) => void
  onAddTags: (tags: string[]) => void
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagInput, setTagInput] = useState("")

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        background: tokens.fg,
        color: "#fff",
        borderRadius: tokens.rMd,
        marginBottom: "14px",
        flexWrap: "wrap",
      }}
    >
      <div style={{ fontSize: "14px", fontWeight: 600 }}>
        {fmt(count)} selected
      </div>
      <div style={{ height: "18px", width: "1px", background: "rgba(255,255,255,0.2)" }} />

      <div style={{ position: "relative" }}>
        <button
          className="mkt-btn mkt-btn-sm"
          style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
          onClick={() => setShowStatusMenu((v) => !v)}
          disabled={busy}
        >
          Change status ▾
        </button>
        {showStatusMenu && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              background: tokens.surface,
              color: tokens.fg,
              border: `1px solid ${tokens.borderStrong}`,
              borderRadius: tokens.rMd,
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              padding: "6px",
              minWidth: "180px",
              zIndex: 100,
            }}
          >
            {["subscribed", "unconfirmed", "unsubscribed", "bounced", "suppressed"].map((s) => (
              <button
                key={s}
                onClick={() => {
                  onStatus(s)
                  setShowStatusMenu(false)
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "13px",
                  color: tokens.fg,
                  borderRadius: tokens.rSm,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = tokens.borderSubtle)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Set to <strong>{s}</strong>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ position: "relative" }}>
        <button
          className="mkt-btn mkt-btn-sm"
          style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
          onClick={() => setShowTagInput((v) => !v)}
          disabled={busy}
        >
          Add tags ▾
        </button>
        {showTagInput && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              background: tokens.surface,
              color: tokens.fg,
              border: `1px solid ${tokens.borderStrong}`,
              borderRadius: tokens.rMd,
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              padding: "12px",
              minWidth: "260px",
              zIndex: 100,
            }}
          >
            <label className="mkt-label">Tags (comma-separated)</label>
            <input
              className="mkt-input"
              style={{ fontSize: "13px" }}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="e.g. vip, black_friday"
              autoFocus
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "10px" }}>
              <button className="mkt-btn mkt-btn-sm" onClick={() => { setShowTagInput(false); setTagInput("") }}>Cancel</button>
              <button
                className="mkt-btn-primary mkt-btn-sm"
                onClick={() => {
                  const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean)
                  if (tags.length) {
                    onAddTags(tags)
                    setShowTagInput(false)
                    setTagInput("")
                  }
                }}
                disabled={!tagInput.trim()}
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        className="mkt-btn mkt-btn-sm"
        style={{ background: "rgba(220, 38, 38, 0.2)", color: "#fff", border: "1px solid rgba(220, 38, 38, 0.4)" }}
        onClick={onDelete}
        disabled={busy}
      >
        Delete
      </button>

      <button
        className="mkt-btn mkt-btn-sm"
        style={{ marginLeft: "auto", background: "transparent", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.2)" }}
        onClick={onClear}
        disabled={busy}
      >
        Clear
      </button>
    </div>
  )
}

// ─── New contact modal ───────────────────────────────────────────────────
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
  const [form, setForm] = useState({
    email: "", first_name: "", last_name: "", phone: "",
    city: "", postal_code: "", address_line1: "", company: "",
    country_code: "", status: "subscribed",
  })
  const update = (patch: Partial<typeof form>) => setForm({ ...form, ...patch })
  const valid = /.+@.+\..+/.test(form.email)

  return (
    <Modal
      title="New contact"
      onClose={onClose}
      width={640}
      footer={
        <>
          <button className="mkt-btn" onClick={onClose}>Cancel</button>
          <button
            className="mkt-btn-primary"
            disabled={!valid || saving}
            onClick={() => {
              const body: any = { brand_id: brandId || undefined, status: form.status }
              for (const k of Object.keys(form) as (keyof typeof form)[]) {
                if (k === "status") continue
                if (form[k]) body[k] = form[k]
              }
              onSave(body)
            }}
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div style={{ gridColumn: "span 2" }}>
          <label className="mkt-label">Email *</label>
          <input className="mkt-input" type="email" value={form.email} onChange={(e) => update({ email: e.target.value })} placeholder="name@example.com" autoFocus />
        </div>
        <Field label="First name" value={form.first_name} onChange={(v) => update({ first_name: v })} />
        <Field label="Last name" value={form.last_name} onChange={(v) => update({ last_name: v })} />
        <Field label="Phone" value={form.phone} onChange={(v) => update({ phone: v })} />
        <Field label="Company" value={form.company} onChange={(v) => update({ company: v })} />
        <div style={{ gridColumn: "span 2" }}>
          <Field label="Street address" value={form.address_line1} onChange={(v) => update({ address_line1: v })} />
        </div>
        <Field label="City" value={form.city} onChange={(v) => update({ city: v })} />
        <Field label="Postal code" value={form.postal_code} onChange={(v) => update({ postal_code: v })} />
        <Field label="Country code (e.g. NL)" value={form.country_code} onChange={(v) => update({ country_code: v.toUpperCase().slice(0, 2) })} />
        <div>
          <label className="mkt-label">Status</label>
          <select className="mkt-input" value={form.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="subscribed">Subscribed</option>
            <option value="unconfirmed">Unconfirmed</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mkt-label">{label}</label>
      <input className="mkt-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

// ─── Import modal ────────────────────────────────────────────────────────
const IMPORT_FIELDS = [
  { key: "email", label: "Email", required: true },
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "City" },
  { key: "postal_code", label: "Postal code" },
  { key: "address_line1", label: "Street address" },
  { key: "company", label: "Company" },
  { key: "country_code", label: "Country code" },
  { key: "locale", label: "Locale" },
  { key: "tags", label: "Tags (comma-sep)" },
  { key: "external_id", label: "External ID" },
  { key: "status", label: "Status" },
]

function ImportContactsModal({
  defaultBrandId,
  onClose,
  onImport,
  importing,
}: {
  defaultBrandId: string | null
  onClose: () => void
  onImport: (body: any) => void
  importing: boolean
}) {
  const [tab, setTab] = useState<"paste" | "upload">("paste")
  const [defaultStatus, setDefaultStatus] = useState("subscribed")
  const [pasteValue, setPasteValue] = useState("")
  const [csvRows, setCsvRows] = useState<string[][]>([]) // 2D grid from upload
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<number, string>>({}) // col index → field key
  const [selectedBrands, setSelectedBrands] = useState<string[]>(defaultBrandId ? [defaultBrandId] : [])
  const fileRef = useRef<HTMLInputElement>(null)

  const brandsQ = useQuery({
    queryKey: ["mkt-brands-for-import"],
    queryFn: () =>
      sdk.client.fetch<{ brands: any[] }>(`/admin/marketing/brands`, { method: "GET" }),
  })
  const brands: any[] = ((brandsQ.data as any)?.brands) || []

  // Simple CSV parser (handles quoted values with commas).
  const parseCsv = (text: string): string[][] => {
    const rows: string[][] = []
    let cur: string[] = []
    let cell = ""
    let inQuotes = false
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            cell += '"'
            i++
          } else {
            inQuotes = false
          }
        } else {
          cell += ch
        }
      } else {
        if (ch === '"') inQuotes = true
        else if (ch === ",") {
          cur.push(cell)
          cell = ""
        } else if (ch === "\n" || ch === "\r") {
          if (ch === "\r" && text[i + 1] === "\n") i++
          cur.push(cell)
          if (cur.length > 1 || cur[0]) rows.push(cur)
          cur = []
          cell = ""
        } else {
          cell += ch
        }
      }
    }
    if (cell.length || cur.length) {
      cur.push(cell)
      if (cur.length > 1 || cur[0]) rows.push(cur)
    }
    return rows
  }

  const handleFile = async (file: File) => {
    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length === 0) return
    const headers = rows[0].map((h) => String(h).trim())
    const data = rows.slice(1)
    setCsvHeaders(headers)
    setCsvRows(data)
    // Auto-map headers by name matching
    const autoMap: Record<number, string> = {}
    headers.forEach((h, i) => {
      const norm = h.toLowerCase().replace(/[^a-z_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "")
      const found = IMPORT_FIELDS.find((f) => f.key === norm || f.label.toLowerCase() === h.toLowerCase())
      if (found) autoMap[i] = found.key
    })
    setMapping(autoMap)
  }

  // Build contacts array for submission.
  const buildContacts = (): any[] => {
    if (tab === "paste") {
      return pasteValue.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
        const parts = line.split(",").map((p) => p.trim())
        const email = parts[0]
        if (!email || !/.+@.+\..+/.test(email)) return null
        return {
          email,
          first_name: parts[1] || undefined,
          last_name: parts[2] || undefined,
          status: defaultStatus,
        }
      }).filter(Boolean) as any[]
    }
    // CSV upload path
    return csvRows.map((row) => {
      const obj: any = { status: defaultStatus, properties: {} }
      let hasEmail = false
      row.forEach((val, i) => {
        const field = mapping[i]
        const trimmed = String(val).trim()
        if (!trimmed) return
        if (!field) {
          // Unmapped column goes to properties using original header name
          const header = csvHeaders[i] || `col_${i}`
          obj.properties[header] = trimmed
        } else if (field === "email") {
          if (/.+@.+\..+/.test(trimmed)) {
            obj.email = trimmed.toLowerCase()
            hasEmail = true
          }
        } else if (field === "tags") {
          obj.tags = trimmed.split(",").map((t) => t.trim()).filter(Boolean)
        } else {
          obj[field] = trimmed
        }
      })
      if (!Object.keys(obj.properties).length) delete obj.properties
      return hasEmail ? obj : null
    }).filter(Boolean) as any[]
  }

  const parsed = buildContacts()
  const canImport = parsed.length > 0 && selectedBrands.length > 0 && !importing

  const toggleBrand = (id: string) => {
    setSelectedBrands((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <Modal
      title="Import contacts"
      onClose={onClose}
      width={900}
      footer={
        <>
          <button className="mkt-btn" onClick={onClose}>Cancel</button>
          <button
            className="mkt-btn-primary"
            disabled={!canImport}
            onClick={() =>
              onImport({
                brand_ids: selectedBrands,
                default_status: defaultStatus,
                contacts: parsed,
              })
            }
          >
            {importing ? "Importing…" : `Import ${parsed.length} × ${selectedBrands.length || "0"} brand(s)`}
          </button>
        </>
      }
    >
      {/* Brand selector */}
      <div style={{ marginBottom: "20px" }}>
        <label className="mkt-label">Import to brand(s) — creates one contact row per brand</label>
        {brands.length === 0 ? (
          <div style={{ fontSize: "13px", color: tokens.fgMuted }}>Loading brands…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "6px" }}>
            {brands.map((b: any) => {
              const on = selectedBrands.includes(b.id)
              return (
                <label
                  key={b.id}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "8px 12px",
                    borderRadius: tokens.rMd,
                    border: on ? `1.5px solid ${tokens.primary}` : `1px solid ${tokens.borderStrong}`,
                    background: on ? tokens.primarySoft : tokens.surface,
                    fontSize: "13px", color: tokens.fg, cursor: "pointer",
                  }}
                >
                  <input type="checkbox" checked={on} onChange={() => toggleBrand(b.id)} />
                  <span>{b.display_name || b.slug}</span>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* Status + tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "14px", flexWrap: "wrap" }}>
        <div>
          <label className="mkt-label" style={{ marginBottom: 6 }}>Default status</label>
          <select className="mkt-input" style={{ width: "180px", fontSize: "13px" }} value={defaultStatus} onChange={(e) => setDefaultStatus(e.target.value)}>
            <option value="subscribed">Subscribed</option>
            <option value="unconfirmed">Unconfirmed</option>
          </select>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "4px", border: `1px solid ${tokens.borderStrong}`, borderRadius: tokens.rMd, padding: "3px" }}>
          <TabButton active={tab === "paste"} onClick={() => setTab("paste")}>Paste</TabButton>
          <TabButton active={tab === "upload"} onClick={() => setTab("upload")}>Upload CSV</TabButton>
        </div>
      </div>

      {tab === "paste" ? (
        <>
          <p style={{ fontSize: "13px", color: tokens.fgSecondary, marginTop: 0, marginBottom: "8px" }}>
            Paste one email per line, or <code style={{ background: tokens.borderSubtle, padding: "2px 6px", borderRadius: tokens.rSm, fontSize: "12px" }}>email,first_name,last_name</code>. For more fields, use CSV upload.
          </p>
          <textarea
            className="mkt-input"
            style={{ minHeight: "220px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "13px" }}
            placeholder={"alice@example.com\nbob@example.com,Bob,Smith"}
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
          />
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
              style={{ display: "none" }}
            />
            <button className="mkt-btn" onClick={() => fileRef.current?.click()}>
              {csvRows.length > 0 ? "Choose different file" : "Choose CSV file…"}
            </button>
            {csvRows.length > 0 && (
              <span style={{ fontSize: "13px", color: tokens.fgSecondary }}>
                {csvHeaders.length} columns · {csvRows.length} rows
              </span>
            )}
          </div>

          {csvRows.length > 0 && (
            <>
              <label className="mkt-label">Map columns</label>
              <div style={{ fontSize: "12px", color: tokens.fgMuted, marginBottom: "10px" }}>
                Assign each CSV column to a contact field. Unmapped columns are saved to custom <code>properties</code>.
              </div>
              <div style={{ border: `1px solid ${tokens.borderStrong}`, borderRadius: tokens.rMd, overflow: "auto", maxHeight: "420px" }}>
                <table className="mkt-table" style={{ fontSize: "12px" }}>
                  <thead>
                    <tr>
                      {csvHeaders.map((h, i) => (
                        <th key={i} style={{ minWidth: "160px" }}>
                          <div style={{ fontWeight: 600, marginBottom: "6px" }}>{h || `(col ${i + 1})`}</div>
                          <select
                            className="mkt-input"
                            style={{ fontSize: "12px", height: "30px" }}
                            value={mapping[i] || ""}
                            onChange={(e) => setMapping({ ...mapping, [i]: e.target.value })}
                          >
                            <option value="">— skip / properties —</option>
                            {IMPORT_FIELDS.map((f) => (
                              <option key={f.key} value={f.key}>
                                {f.label}{f.required ? " *" : ""}
                              </option>
                            ))}
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 5).map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{ whiteSpace: "nowrap", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", color: tokens.fgSecondary }}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvRows.length > 5 && (
                  <div style={{ padding: "8px 12px", fontSize: "12px", color: tokens.fgMuted, background: tokens.borderSubtle }}>
                    Showing first 5 of {csvRows.length} rows · full data will be imported.
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      <div style={{ marginTop: "14px", padding: "10px 14px", background: tokens.borderSubtle, borderRadius: tokens.rMd, fontSize: "13px", color: tokens.fg }}>
        <strong>{parsed.length}</strong> valid row(s) · {selectedBrands.length} brand(s) selected
        {selectedBrands.length > 0 && parsed.length > 0 && (
          <> · <strong>{parsed.length * selectedBrands.length}</strong> contact records will be created/updated</>
        )}
      </div>
    </Modal>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        background: active ? tokens.surface : "transparent",
        color: active ? tokens.fg : tokens.fgSecondary,
        padding: "6px 14px",
        fontSize: "13px",
        fontWeight: active ? 600 : 400,
        borderRadius: tokens.rSm,
        cursor: "pointer",
        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
      }}
    >
      {children}
    </button>
  )
}

// ─── Contact details slide-over ──────────────────────────────────────────
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
    <SlideOver title={c.email} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div>
          <label className="mkt-label">Status</label>
          <div><StatusBadge status={c.status || "subscribed"} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <Detail label="First name" value={c.first_name} />
          <Detail label="Last name" value={c.last_name} />
          <Detail label="Phone" value={c.phone} />
          <Detail label="Company" value={c.company} />
          <Detail label="City" value={c.city} />
          <Detail label="Postal code" value={c.postal_code} />
          <Detail label="Country" value={c.country_code} />
          <Detail label="Locale" value={c.locale} />
          <Detail label="Source" value={c.source} />
          <Detail label="Project" value={c.project_id || c.brand_display_name} />
          <Detail label="Created" value={c.created_at ? new Date(c.created_at).toLocaleString() : null} />
          <Detail label="Lifecycle" value={c.lifecycle_stage} />
        </div>

        <div>
          <label className="mkt-label">Tags</label>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
            {tags.map((t) => (
              <span key={t} className="mkt-badge" style={{ background: tokens.borderSubtle, color: tokens.fgSecondary }}>
                {t}
                <button
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                  style={{ border: "none", background: "none", cursor: "pointer", color: tokens.dangerFg, marginLeft: "2px", fontSize: "14px", padding: 0, lineHeight: 1 }}
                  aria-label={`Remove tag ${t}`}
                >
                  ×
                </button>
              </span>
            ))}
            {tags.length === 0 && <span style={{ fontSize: "13px", color: tokens.fgMuted }}>No tags</span>}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
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
            >
              Save tags
            </button>
          </div>
        </div>

        <div>
          <label className="mkt-label">List memberships</label>
          {lists.length === 0 ? (
            <div style={{ fontSize: "13px", color: tokens.fgMuted }}>Not on any lists</div>
          ) : (
            <ul style={{ margin: 0, padding: "0 0 0 20px", fontSize: "14px", color: tokens.fg }}>
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

function Detail({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <label className="mkt-label">{label}</label>
      <div style={{ fontSize: "14px", color: tokens.fg }}>{value || "—"}</div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Contacts",
  rank: 20,
})

export default ContactsPage
