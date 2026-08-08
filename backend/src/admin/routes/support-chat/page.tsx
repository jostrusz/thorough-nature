// @ts-nocheck
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Sparkles } from "@medusajs/icons"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { sdk } from "../../lib/sdk"

/**
 * Velín — Slack-like control room for the AI support agent.
 *
 * Layout: sidebar (queue) | thread (chat + approval cards) | context panel
 * (orders via the existing /admin/supportbox/tickets/:id endpoint).
 * Polling via React Query; no websockets needed for a 1-2 user tool.
 */

// ── data hooks ──────────────────────────────────────────────────────────
const useConversations = () =>
  useQuery({
    queryKey: ["sc-conversations"],
    queryFn: () => sdk.client.fetch("/admin/support-chat/conversations", { method: "GET" }),
    refetchInterval: 4000,
  })

const useThread = (conversationId: string | null) =>
  useQuery({
    queryKey: ["sc-thread", conversationId],
    queryFn: () =>
      sdk.client.fetch(`/admin/support-chat/conversations/${conversationId}`, { method: "GET" }),
    enabled: !!conversationId,
    refetchInterval: 3000,
  })

const useTicketContext = (ticketId: string | null) =>
  useQuery({
    queryKey: ["sc-ticket-ctx", ticketId],
    queryFn: () => sdk.client.fetch(`/admin/supportbox/tickets/${ticketId}`, { method: "GET" }),
    enabled: !!ticketId,
    staleTime: 30000,
  })

// ── helpers ─────────────────────────────────────────────────────────────
const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })
const fmtDay = (d: string) =>
  new Date(d).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" })
const ago = (d: string) => {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return "teď"
  if (m < 60) return `${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h`
  return `${Math.round(h / 24)} d`
}
const FLAGS: Record<string, string> = {
  "Laat los": "🇳🇱", Hondenbijbel: "🇳🇱", "Het Leven": "🇳🇱", Kattenbijbel: "🇳🇱",
  Lass: "🇩🇪", Odpuść: "🇵🇱", Życie: "🇵🇱", Biblia: "🇵🇱", Släpp: "🇸🇪",
  Slipp: "🇳🇴", "Pusť": "🇨🇿", "Život": "🇨🇿", "Psí": "🇨🇿", "Kočičí": "🇨🇿",
  Pusti: "🇸🇰", "Mačacia": "🇸🇰", Engedd: "🇭🇺", Macskabiblia: "🇭🇺",
  "Lâche": "🇫🇷", Suelta: "🇪🇸", Larga: "🇵🇹",
}
const projectFlag = (project: string | null) => {
  if (!project) return "💬"
  for (const key of Object.keys(FLAGS)) if (project.includes(key)) return FLAGS[key]
  return "📦"
}

// ── sidebar row ─────────────────────────────────────────────────────────
function ConvRow({ row, active, onClick }: any) {
  const dot =
    row.pending_tasks > 0 ? "🔴" : row.agent_status === "agent_working" ? "🟠" : row.unread ? "🟡" : "🟢"
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-2 text-sm transition-colors ${
        active ? "bg-ui-bg-base shadow-elevation-card-rest" : "hover:bg-ui-bg-base-hover"
      }`}
    >
      <span className="shrink-0">{projectFlag(row.project)}</span>
      <span className={`flex-1 truncate ${row.unread ? "font-semibold" : ""}`}>
        {row.from_email?.split("@")[0] || row.subject}
      </span>
      <span className="shrink-0 text-xs text-ui-fg-muted">{ago(row.last_activity_at)}</span>
      <span className="shrink-0 text-xs">{dot}</span>
    </button>
  )
}

// ── approval card ───────────────────────────────────────────────────────
function TaskCard({ task, conversationId }: any) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<"idle" | "edit" | "reject">("idle")
  const [draft, setDraft] = useState(task.edited_draft || task.draft_reply || "")
  const [note, setNote] = useState("")
  const [expanded, setExpanded] = useState(false)

  const decide = useMutation({
    mutationFn: (body: any) =>
      sdk.client.fetch(`/admin/support-chat/tasks/${task.id}/decision`, { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sc-thread", conversationId] })
      qc.invalidateQueries({ queryKey: ["sc-conversations"] })
      setMode("idle")
    },
  })

  const statusBadge: Record<string, [string, string]> = {
    pending: ["⚡ ČEKÁ NA SCHVÁLENÍ", "bg-ui-tag-orange-bg text-ui-tag-orange-text"],
    approved: ["✓ Schváleno — čeká na provedení", "bg-ui-tag-blue-bg text-ui-tag-blue-text"],
    rejected: ["✗ Zamítnuto", "bg-ui-tag-red-bg text-ui-tag-red-text"],
    executed: ["✅ Provedeno", "bg-ui-tag-green-bg text-ui-tag-green-text"],
    failed: ["⚠️ Selhalo", "bg-ui-tag-red-bg text-ui-tag-red-text"],
    cancelled: ["— Zrušeno", "bg-ui-tag-neutral-bg text-ui-tag-neutral-text"],
  }
  const [label, badgeCls] = statusBadge[task.status] || statusBadge.pending
  const draftText = task.edited_draft || task.draft_reply

  return (
    <div
      className={`my-2 rounded-lg border p-3 max-w-2xl ${
        task.status === "pending"
          ? "border-ui-tag-orange-border bg-ui-bg-base shadow-elevation-card-hover"
          : "border-ui-border-base bg-ui-bg-subtle"
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${badgeCls}`}>{label}</span>
        <span className="text-sm font-semibold">{task.title}</span>
        {typeof task.confidence === "number" && (
          <span className="text-xs text-ui-fg-muted">jistota {task.confidence} %</span>
        )}
        <span className="text-xs text-ui-fg-muted ml-auto">{fmtTime(task.created_at)}</span>
      </div>
      {task.description && (
        <p className="text-sm text-ui-fg-subtle mt-1 whitespace-pre-wrap">{task.description}</p>
      )}

      {draftText && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-ui-fg-interactive hover:underline"
          >
            {expanded ? "▾ skrýt návrh odpovědi" : "▸ zobrazit návrh odpovědi"}
          </button>
          {expanded && mode !== "edit" && (
            <pre className="mt-1 text-sm whitespace-pre-wrap font-sans bg-ui-bg-subtle rounded p-2 border border-ui-border-base">
              {draftText}
            </pre>
          )}
        </div>
      )}

      {task.status === "pending" && mode === "idle" && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => decide.mutate({ decision: "approve" })}
            disabled={decide.isPending}
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-ui-button-inverted text-ui-fg-on-inverted hover:bg-ui-button-inverted-hover disabled:opacity-50"
          >
            ✓ Schválit
          </button>
          {draftText && (
            <button
              onClick={() => { setMode("edit"); setExpanded(true) }}
              className="px-3 py-1.5 rounded-md text-sm border border-ui-border-base hover:bg-ui-bg-base-hover"
            >
              ✎ Upravit
            </button>
          )}
          <button
            onClick={() => setMode("reject")}
            className="px-3 py-1.5 rounded-md text-sm border border-ui-border-base text-ui-fg-error hover:bg-ui-bg-base-hover"
          >
            ✗ Zamítnout
          </button>
        </div>
      )}

      {mode === "edit" && (
        <div className="mt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            className="w-full text-sm rounded-md border border-ui-border-base bg-ui-bg-field p-2 font-sans"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => decide.mutate({ decision: "approve", edited_draft: draft })}
              disabled={decide.isPending}
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-ui-button-inverted text-ui-fg-on-inverted disabled:opacity-50"
            >
              ✓ Schválit s úpravou
            </button>
            <button onClick={() => setMode("idle")} className="px-3 py-1.5 rounded-md text-sm border border-ui-border-base">
              Zrušit
            </button>
          </div>
        </div>
      )}

      {mode === "reject" && (
        <div className="mt-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Pokyn agentovi — co udělat místo toho…"
            className="w-full text-sm rounded-md border border-ui-border-base bg-ui-bg-field p-2"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => decide.mutate({ decision: "reject", note })}
              disabled={decide.isPending}
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-ui-tag-red-bg text-ui-tag-red-text disabled:opacity-50"
            >
              ✗ Zamítnout s pokynem
            </button>
            <button onClick={() => setMode("idle")} className="px-3 py-1.5 rounded-md text-sm border border-ui-border-base">
              Zrušit
            </button>
          </div>
        </div>
      )}

      {task.decision_note && task.status !== "pending" && (
        <p className="text-xs text-ui-fg-muted mt-2">Pokyn: {task.decision_note}</p>
      )}
      {task.result?.summary && (
        <p className="text-xs text-ui-fg-subtle mt-1">Výsledek: {task.result.summary}</p>
      )}
    </div>
  )
}

// ── thread message ──────────────────────────────────────────────────────
function ThreadItem({ item, conversationId }: any) {
  if (item.type === "task") return <TaskCard task={item} conversationId={conversationId} />

  if (item.type === "email") {
    const isCustomer = item.role === "customer"
    return (
      <div className={`my-2 flex ${isCustomer ? "justify-start" : "justify-end"}`}>
        <div
          className={`max-w-2xl rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
            isCustomer
              ? "bg-ui-bg-subtle border border-ui-border-base"
              : "bg-ui-tag-blue-bg border border-ui-tag-blue-border"
          }`}
        >
          <div className="flex items-center gap-2 text-xs text-ui-fg-muted mb-1">
            <span>{isCustomer ? "📩" : "📤"}</span>
            <span className="font-medium">{isCustomer ? item.from_email : "Agent → zákazník"}</span>
            <span>{fmtDay(item.created_at)} {fmtTime(item.created_at)}</span>
            {!isCustomer && item.delivery_status && <span>· {item.delivery_status}</span>}
            {item.attachments?.length > 0 && <span>📎 {item.attachments.length}</span>}
          </div>
          {(item.body || "").slice(0, 4000)}
        </div>
      </div>
    )
  }

  // agent_message
  if (item.role === "system" || item.kind === "event") {
    return (
      <div className="my-2 text-center">
        <span className="text-xs text-ui-fg-muted bg-ui-bg-subtle rounded-full px-3 py-1">
          {item.body} · {fmtTime(item.created_at)}
        </span>
      </div>
    )
  }
  if (item.role === "owner") {
    return (
      <div className="my-2 flex justify-end">
        <div className={`max-w-2xl rounded-lg px-3 py-2 text-sm whitespace-pre-wrap border ${
          item.kind === "note"
            ? "bg-ui-tag-orange-bg border-ui-tag-orange-border"
            : "bg-ui-button-inverted text-ui-fg-on-inverted border-transparent"
        }`}>
          <div className="text-xs opacity-70 mb-1">
            {item.kind === "note" ? "📝 poznámka" : "👤 ty → agentovi"} · {fmtTime(item.created_at)}
          </div>
          {item.body}
        </div>
      </div>
    )
  }
  // assistant internal
  return (
    <div className="my-2 flex justify-start">
      <div className="max-w-2xl rounded-lg px-3 py-2 text-sm whitespace-pre-wrap bg-ui-bg-component border border-dashed border-ui-border-strong">
        <div className="text-xs text-ui-fg-muted mb-1">
          🤖 agent (interní) · {fmtTime(item.created_at)}
          {item.metadata?.confidence != null && ` · jistota ${item.metadata.confidence} %`}
        </div>
        {item.body}
      </div>
    </div>
  )
}

// ── context panel ───────────────────────────────────────────────────────
function ContextPanel({ ticketId }: { ticketId: string | null }) {
  const { data } = useTicketContext(ticketId)
  if (!ticketId) {
    return <div className="p-4 text-sm text-ui-fg-muted">Přímý chat s agentem — bez ticketu.</div>
  }
  const orders = data?.orders || data?.ticket?.orders || []
  return (
    <div className="p-4 space-y-4 overflow-y-auto text-sm">
      <div>
        <h3 className="font-semibold text-xs uppercase text-ui-fg-muted mb-2">📦 Objednávky</h3>
        {orders.length === 0 && <p className="text-ui-fg-muted">Žádné objednávky.</p>}
        {orders.map((o: any) => (
          <div key={o.order_id || o.id} className="rounded-md border border-ui-border-base p-2 mb-2 space-y-0.5">
            <div className="font-medium">
              {o.custom_display_id || o.metadata?.custom_order_number || `#${o.display_id}`}
            </div>
            <div className="text-ui-fg-subtle">
              {o.total} {(o.currency || o.currency_code || "").toUpperCase()} · {o.payment_provider || o.payment_status || ""}
            </div>
            {(o.delivery_status || o.metadata?.dextrum_status) && (
              <div className="text-ui-fg-subtle">WMS: {o.delivery_status || o.metadata?.dextrum_status}</div>
            )}
            {(o.tracking_number || o.metadata?.dextrum_tracking_number) && (
              <a
                href={o.tracking_link || o.metadata?.dextrum_tracking_url || "#"}
                target="_blank" rel="noreferrer"
                className="text-ui-fg-interactive hover:underline"
              >
                🚚 {o.tracking_number || o.metadata?.dextrum_tracking_number}
              </a>
            )}
            {o.metadata?.fakturoid_invoice_url && (
              <a href={o.metadata.fakturoid_invoice_url} target="_blank" rel="noreferrer"
                 className="block text-ui-fg-interactive hover:underline">
                🧾 {o.metadata.fakturoid_invoice_number || "faktura"}
              </a>
            )}
          </div>
        ))}
      </div>
      {data?.ticket && (
        <div>
          <h3 className="font-semibold text-xs uppercase text-ui-fg-muted mb-2">👤 Zákazník</h3>
          <p>{data.ticket.from_name || data.ticket.from_email}</p>
          <p className="text-ui-fg-muted">{data.ticket.from_email}</p>
        </div>
      )}
    </div>
  )
}

// ── main page ───────────────────────────────────────────────────────────
const SupportChatPage = () => {
  const qc = useQueryClient()
  const { data } = useConversations()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [composer, setComposer] = useState("")
  const [composerKind, setComposerKind] = useState<"chat" | "note">("chat")
  const [showSolved, setShowSolved] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const allRows = useMemo(
    () => [...(data?.waiting || []), ...(data?.conversations || []), ...(data?.dms || [])],
    [data]
  )
  const active = allRows.find((r: any) => r.conversation_id === activeId) || null
  const { data: threadData } = useThread(activeId)

  const markRead = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/support-chat/conversations/${id}/read`, { method: "POST", body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sc-conversations"] }),
  })
  const sendMessage = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/support-chat/conversations/${activeId}/messages`, {
        method: "POST",
        body: { body: composer, kind: composerKind },
      }),
    onSuccess: () => {
      setComposer("")
      qc.invalidateQueries({ queryKey: ["sc-thread", activeId] })
    },
  })
  const openDm = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/support-chat/conversations/dm", { method: "POST", body: {} }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["sc-conversations"] })
      setActiveId(res.conversation.id)
    },
  })
  const toggleAgent = useMutation({
    mutationFn: (enabled: boolean) =>
      sdk.client.fetch("/admin/support-chat/settings", { method: "POST", body: { agent_enabled: enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sc-conversations"] }),
  })

  useEffect(() => {
    if (activeId) markRead.mutate(activeId)
  }, [activeId])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [threadData?.thread?.length])

  const stats = data?.stats
  const agentEnabled = data?.agent_enabled !== false
  const agentWorking = active?.agent_status === "agent_working" ||
    threadData?.conversation?.status === "agent_working"

  return (
    <div className="flex h-[calc(100vh-57px)] -m-4 overflow-hidden bg-ui-bg-subtle">
      {/* ── SIDEBAR ── */}
      <aside className="w-72 shrink-0 border-r border-ui-border-base flex flex-col bg-ui-bg-subtle-hover">
        <div className="p-3 border-b border-ui-border-base">
          <h1 className="font-semibold text-sm flex items-center gap-2">
            <Sparkles className="text-ui-fg-interactive" /> Velín podpory
          </h1>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {(data?.waiting?.length || 0) > 0 && (
            <section>
              <h2 className="px-2 text-xs font-semibold text-ui-tag-red-text uppercase mb-1">
                ⚡ Čeká na tebe ({data.waiting.length})
              </h2>
              {data.waiting.map((r: any) => (
                <ConvRow key={r.conversation_id} row={r}
                  active={r.conversation_id === activeId}
                  onClick={() => setActiveId(r.conversation_id)} />
              ))}
            </section>
          )}
          <section>
            <button
              onClick={() => (data?.dms?.length ? setActiveId(data.dms[0].conversation_id) : openDm.mutate())}
              className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 ${
                active?.kind === "dm" ? "bg-ui-bg-base shadow-elevation-card-rest" : "hover:bg-ui-bg-base-hover"
              }`}
            >
              🤖 <span className="font-medium">Agent</span>
              <span className="text-xs text-ui-fg-muted ml-auto">přímý chat</span>
            </button>
          </section>
          <section>
            <h2 className="px-2 text-xs font-semibold text-ui-fg-muted uppercase mb-1">Tickety</h2>
            {(data?.conversations || []).map((r: any) => (
              <ConvRow key={r.conversation_id} row={r}
                active={r.conversation_id === activeId}
                onClick={() => setActiveId(r.conversation_id)} />
            ))}
            {(data?.conversations?.length || 0) === 0 && (
              <p className="px-3 text-xs text-ui-fg-muted">Žádné otevřené tickety 🎉</p>
            )}
          </section>
          <section>
            <button onClick={() => setShowSolved(!showSolved)}
              className="px-2 text-xs font-semibold text-ui-fg-muted uppercase hover:text-ui-fg-base">
              {showSolved ? "▾" : "▸"} ✅ Dnes vyřešeno ({data?.solved_today?.length || 0})
            </button>
            {showSolved && (data?.solved_today || []).map((t: any) => (
              <div key={t.ticket_id} className="px-3 py-1 text-xs text-ui-fg-muted truncate">
                ✓ {t.from_email?.split("@")[0]} — {t.subject}
              </div>
            ))}
          </section>
        </div>
        <div className="p-3 border-t border-ui-border-base space-y-2 text-xs text-ui-fg-muted">
          {stats && (
            <div className="flex justify-between">
              <span>čeká: <b className="text-ui-fg-base">{stats.waiting}</b></span>
              <span>aktivní: <b className="text-ui-fg-base">{stats.active}</b></span>
              <span>dnes ✓: <b className="text-ui-fg-base">{stats.solved_today}</b></span>
            </div>
          )}
          <button
            onClick={() => toggleAgent.mutate(!agentEnabled)}
            className={`w-full py-1.5 rounded-md text-xs font-medium border ${
              agentEnabled
                ? "border-ui-border-base hover:bg-ui-bg-base-hover"
                : "bg-ui-tag-red-bg text-ui-tag-red-text border-ui-tag-red-border"
            }`}
          >
            {agentEnabled ? "⏸ Pozastavit agenta" : "▶️ AGENT POZASTAVEN — spustit"}
          </button>
        </div>
      </aside>

      {/* ── THREAD ── */}
      <main className="flex-1 flex flex-col min-w-0 bg-ui-bg-base">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-ui-fg-muted text-sm">
            Vyber konverzaci vlevo, nebo napiš agentovi 🤖
          </div>
        ) : (
          <>
            <header className="px-4 py-2.5 border-b border-ui-border-base flex items-center gap-2">
              <span>{active.kind === "dm" ? "🤖" : projectFlag(active.project)}</span>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">
                  {active.kind === "dm" ? "Agent — přímý chat" : active.from_email}
                </div>
                {active.kind !== "dm" && (
                  <div className="text-xs text-ui-fg-muted truncate">
                    {active.subject} · {active.project || "?"}
                  </div>
                )}
              </div>
              {agentWorking && (
                <span className="ml-auto text-xs text-ui-tag-orange-text animate-pulse">🤖 pracuje…</span>
              )}
            </header>
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {(threadData?.thread || []).map((item: any) => (
                <ThreadItem key={`${item.type}-${item.id}`} item={item} conversationId={activeId} />
              ))}
              <div ref={bottomRef} />
            </div>
            <footer className="p-3 border-t border-ui-border-base">
              <div className="flex items-end gap-2">
                <select
                  value={composerKind}
                  onChange={(e) => setComposerKind(e.target.value as any)}
                  className="text-xs rounded-md border border-ui-border-base bg-ui-bg-field px-2 py-2"
                >
                  <option value="chat">→ Agentovi</option>
                  <option value="note">📝 Poznámka</option>
                </select>
                <textarea
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && composer.trim()) {
                      e.preventDefault()
                      sendMessage.mutate()
                    }
                  }}
                  rows={2}
                  placeholder={composerKind === "chat" ? "Napiš pokyn agentovi… (Enter = odeslat)" : "Interní poznámka…"}
                  className="flex-1 text-sm rounded-md border border-ui-border-base bg-ui-bg-field p-2 resize-none"
                />
                <button
                  onClick={() => composer.trim() && sendMessage.mutate()}
                  disabled={sendMessage.isPending || !composer.trim()}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-ui-button-inverted text-ui-fg-on-inverted disabled:opacity-40"
                >
                  Odeslat
                </button>
              </div>
            </footer>
          </>
        )}
      </main>

      {/* ── CONTEXT ── */}
      {active && (
        <aside className="w-80 shrink-0 border-l border-ui-border-base bg-ui-bg-subtle-hover hidden xl:block overflow-y-auto">
          <ContextPanel ticketId={active.ticket_id} />
        </aside>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Velín",
  icon: Sparkles,
})

export default SupportChatPage
