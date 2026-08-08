// @ts-nocheck
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Sparkles } from "@medusajs/icons"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { sdk } from "../../lib/sdk"

/**
 * Command Center — Slack-like control room for the AI support agent.
 *
 * Approval cards come in two shapes:
 *  - simple: title/description/draft (fallback)
 *  - rich "summary card" when task.payload.summary is present — TL;DR strip,
 *    customer+order grid with IDs, communication-timeline accordion, problem
 *    with root cause, done-list, and a single orange decision zone.
 * Approving a "reply" task sends the e-mail immediately (backend).
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
  new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
const fmtDay = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
const ago = (d: string) => {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return "now"
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.round(h / 24)}d`
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
const toPlainText = (s: string) => {
  if (!s) return ""
  if (!/[<>]/.test(s)) return s
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
const WRAP = { overflowWrap: "anywhere", wordBreak: "break-word" } as const
const MONO = { fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace" } as const

// ── sidebar row ─────────────────────────────────────────────────────────
function ConvRow({ row, active, onClick }: any) {
  const dot =
    row.pending_tasks > 0 ? "🔴" : row.agent_status === "agent_working" ? "🟠" : row.unread ? "🟡" : "🟢"
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-2 text-sm transition-colors min-w-0 ${
        active ? "bg-ui-bg-base shadow-elevation-card-rest" : "hover:bg-ui-bg-base-hover"
      }`}
    >
      <span className="shrink-0">{projectFlag(row.project)}</span>
      <span className={`flex-1 truncate min-w-0 ${row.unread ? "font-semibold" : ""}`}>
        {row.from_email?.split("@")[0] || row.subject}
      </span>
      <span className="shrink-0 text-xs text-ui-fg-muted">{ago(row.last_activity_at)}</span>
      <span className="shrink-0 text-xs">{dot}</span>
    </button>
  )
}

// ── decision buttons (shared by simple + rich card) ─────────────────────
function DecisionZoneButtons({ task, conversationId, isReply, draftText }: any) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<"idle" | "edit" | "reject">("idle")
  const [draft, setDraft] = useState(task.edited_draft || task.draft_reply || "")
  const [note, setNote] = useState("")

  const decide = useMutation({
    mutationFn: (body: any) =>
      sdk.client.fetch(`/admin/support-chat/tasks/${task.id}/decision`, { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sc-thread", conversationId] })
      qc.invalidateQueries({ queryKey: ["sc-conversations"] })
      setMode("idle")
    },
  })

  if (task.status !== "pending") return null

  return (
    <div className="mt-2">
      {mode === "idle" && (
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => decide.mutate({ decision: "approve" })}
            disabled={decide.isPending}
            className="px-4 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#16a34a" }}
          >
            {decide.isPending ? "Sending…" : isReply ? "✓ Yes, send to customer" : "✓ Approve"}
          </button>
          {draftText && (
            <button
              onClick={() => setMode("edit")}
              className="px-3 py-2 rounded-md text-sm border border-ui-border-strong bg-ui-bg-base hover:bg-ui-bg-base-hover"
            >
              ✎ Edit reply
            </button>
          )}
          <button
            onClick={() => setMode("reject")}
            className="px-3 py-2 rounded-md text-sm border bg-ui-bg-base text-ui-fg-error hover:bg-ui-bg-base-hover"
            style={{ borderColor: "#fecaca" }}
          >
            ✗ Give instructions instead
          </button>
          <span className="basis-full text-[11px] text-ui-fg-muted">
            …or just type below — “make it warmer”, “offer 50% instead” — and the agent will redo the proposal.
          </span>
        </div>
      )}
      {mode === "edit" && (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            className="w-full text-sm rounded-md border border-ui-border-base bg-ui-bg-field p-2"
          />
          <div className="flex gap-2 mt-2 flex-wrap">
            <button
              onClick={() => decide.mutate({ decision: "approve", edited_draft: draft })}
              disabled={decide.isPending}
              className="px-4 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "#16a34a" }}
            >
              {decide.isPending ? "Sending…" : isReply ? "✓ Send edited version" : "✓ Approve with edits"}
            </button>
            <button onClick={() => setMode("idle")} className="px-3 py-2 rounded-md text-sm border border-ui-border-base bg-ui-bg-base">
              Cancel
            </button>
          </div>
        </div>
      )}
      {mode === "reject" && (
        <div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Instruction for the agent — what to do instead…"
            className="w-full text-sm rounded-md border border-ui-border-base bg-ui-bg-field p-2"
          />
          <div className="flex gap-2 mt-2 flex-wrap">
            <button
              onClick={() => decide.mutate({ decision: "reject", note })}
              disabled={decide.isPending}
              className="px-3 py-2 rounded-md text-sm font-medium disabled:opacity-50"
              style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
            >
              ✗ Reject with instruction
            </button>
            <button onClick={() => setMode("idle")} className="px-3 py-2 rounded-md text-sm border border-ui-border-base bg-ui-bg-base">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const STATUS_BADGE: Record<string, [string, string]> = {
  pending: ["⚡ NEEDS YOUR OK", "bg-ui-tag-orange-bg text-ui-tag-orange-text"],
  approved: ["✓ Approved — queued for execution", "bg-ui-tag-blue-bg text-ui-tag-blue-text"],
  rejected: ["✗ Rejected", "bg-ui-tag-red-bg text-ui-tag-red-text"],
  executed: ["✅ Done", "bg-ui-tag-green-bg text-ui-tag-green-text"],
  failed: ["⚠️ Failed", "bg-ui-tag-red-bg text-ui-tag-red-text"],
  cancelled: ["— Cancelled", "bg-ui-tag-neutral-bg text-ui-tag-neutral-text"],
}

// ── RICH summary card (payload.summary) ─────────────────────────────────
function SummaryCard({ task, conversationId }: any) {
  const s = task.payload.summary
  const [label, badgeCls] = STATUS_BADGE[task.status] || STATUS_BADGE.pending
  const isReply = task.action_type === "reply"
  const draftText = task.edited_draft || task.draft_reply

  const stChip = (st: any) => {
    if (!st) return null
    const styles: Record<string, any> = {
      dead: { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" },
      ok: { background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" },
      neutral: { background: "var(--bg, #f4f4f5)", color: "#a1a1aa", border: "1px solid #e4e4e7" },
    }
    return (
      <span className="text-[10px] font-bold rounded px-1.5 ml-1.5 align-middle inline-block"
            style={styles[st.type] || styles.neutral}>
        {st.label}
      </span>
    )
  }

  return (
    <div className="my-2 rounded-xl border overflow-hidden max-w-2xl min-w-0 bg-ui-bg-base"
         style={{ borderColor: task.status === "pending" ? "#fdba74" : undefined, ...WRAP }}>
      {/* header */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap"
           style={{ background: "#fff7ed", borderBottom: "1px solid #fdba74" }}>
        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${badgeCls}`}>{label}</span>
        <span className="text-sm font-semibold flex-1 min-w-0" style={WRAP}>{task.title}</span>
        {typeof task.confidence === "number" && (
          <span className="text-xs text-ui-fg-subtle flex items-center gap-1.5 shrink-0">
            {task.confidence}%
            <span className="w-12 h-1.5 rounded bg-ui-bg-subtle overflow-hidden inline-block">
              <span className="block h-full" style={{ width: `${task.confidence}%`, background: "#16a34a" }} />
            </span>
          </span>
        )}
      </div>

      {/* ① TL;DR */}
      {s.tldr && (
        <div className="px-4 py-2.5 text-[15px]" style={{ background: "#fffbeb", borderBottom: "1px solid #e4e4e7" }}>
          📌 {s.tldr}
        </div>
      )}

      <div className="p-4 flex flex-col gap-4">
        {/* ② who: person | order */}
        {(s.customer || s.order) && (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "1fr 1.2fr" }}>
            {s.customer && (
              <div className="rounded-lg border border-ui-border-base px-3 py-2 min-w-0">
                <div className="flex items-center gap-2">
                  {s.customer.flag && <span>{s.customer.flag}</span>}
                  <span className="font-bold text-sm">{s.customer.name}</span>
                </div>
                <div className="text-xs text-ui-fg-subtle" style={WRAP}>{s.customer.email}</div>
                {s.customer.meta && (
                  <div className="text-[11px] text-ui-fg-muted mt-1">{s.customer.meta}</div>
                )}
              </div>
            )}
            {s.order && (
              <div className="rounded-lg border border-ui-border-base px-3 py-2 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-sm" style={MONO}>{s.order.number}</span>
                  {s.order.paid_label && (
                    <span className="text-[10.5px] font-bold rounded-full px-2"
                          style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
                      {s.order.paid_label}
                    </span>
                  )}
                </div>
                {(s.order.rows || []).map((r: any, i: number) => (
                  <div key={i} className="flex gap-1.5 text-xs mt-0.5 text-ui-fg-subtle min-w-0">
                    <span className="text-ui-fg-muted shrink-0 w-16">{r.k}</span>
                    {r.href ? (
                      <a href={r.href} target="_blank" rel="noreferrer"
                         className="text-ui-fg-interactive hover:underline" style={WRAP}>{r.v}</a>
                    ) : (
                      <span title={r.title || undefined}
                            className={r.mono ? "bg-ui-bg-subtle border border-ui-border-base rounded px-1" : ""}
                            style={r.mono ? { ...MONO, ...WRAP, fontSize: "11px" } : WRAP}>
                        {r.v}
                      </span>
                    )}
                    {r.sub && <span className="text-ui-fg-muted text-[11px]">{r.sub}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ②b timeline accordion */}
        {s.timeline?.items?.length > 0 && (
          <details className="rounded-lg border border-ui-border-base overflow-hidden">
            <summary className="cursor-pointer flex items-center gap-2 px-3 py-2 text-[13px] font-semibold text-ui-fg-subtle list-none [&::-webkit-details-marker]:hidden">
              <span>📨 Everything we sent them</span>
              {s.timeline.count_label && (
                <span className="ml-auto text-[11px] font-semibold text-ui-fg-muted bg-ui-bg-subtle border border-ui-border-base rounded-full px-2">
                  {s.timeline.count_label}
                </span>
              )}
            </summary>
            <div className="border-t border-ui-border-base px-3 py-1.5">
              {s.timeline.items.map((it: any, i: number) => (
                <div key={i}
                     className={`grid gap-x-2 py-1.5 items-baseline ${i < s.timeline.items.length - 1 ? "border-b border-dashed border-ui-border-base" : ""}`}
                     style={{ gridTemplateColumns: "88px 20px 1fr" }}>
                  <span className="text-[11px] text-ui-fg-muted whitespace-nowrap" style={MONO}>{it.when}</span>
                  <span className="text-center">{it.icon}</span>
                  <span className="text-[13px] min-w-0" style={WRAP}>
                    {it.what}{stChip(it.status)}
                    {it.to && <div className="text-xs text-ui-fg-muted" style={WRAP}>{it.to}</div>}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* ③ problem */}
        {s.problem && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ui-fg-muted mb-1.5">
              The problem
            </div>
            <div className="rounded-lg border border-ui-border-base overflow-hidden">
              {s.problem.quote && (
                <div className="px-3 py-2 bg-ui-bg-subtle italic text-ui-fg-subtle text-[13px]"
                     style={{ borderLeft: "3px solid #d4d4d8", ...WRAP }}>
                  “{s.problem.quote}”
                </div>
              )}
              {s.problem.cause && (
                <div className="flex gap-2 px-3 py-2 items-baseline text-[13px]"
                     style={{ background: "#fef2f2", borderTop: "1px solid #fecaca", ...WRAP }}>
                  <span className="shrink-0">🐛</span>
                  <span>
                    <b style={{ color: "#dc2626" }}>Root cause:</b> {s.problem.cause}
                    {s.problem.cause_code && (
                      <code className="bg-ui-bg-base border rounded px-1 ml-1"
                            style={{ ...MONO, borderColor: "#fecaca", fontSize: "12px", ...WRAP }}>
                        {s.problem.cause_code}
                      </code>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ④ done */}
        {s.done?.length > 0 && (
          <div className="rounded-lg px-3 py-2" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "#16a34a" }}>
              Already handled — no action needed
            </div>
            {s.done.map((d: any, i: number) => (
              <div key={i} className="flex gap-2 py-0.5 text-[13px] text-ui-fg-subtle items-baseline">
                <span className="font-bold shrink-0" style={{ color: "#16a34a" }}>✓</span>
                <span style={WRAP}>
                  {d.text}
                  {d.extra && <span className="text-ui-fg-muted text-xs"> ({d.extra})</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ⑤ decision zone */}
        <div className="rounded-xl overflow-hidden" style={{ border: "2px solid #fdba74" }}>
          <div className="flex items-center gap-2 px-3 py-2" style={{ background: "#fff7ed" }}>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#ea580c" }}>
              Your call
            </span>
            {s.decide?.what && <span className="text-[13px] font-semibold flex-1" style={WRAP}>{s.decide.what}</span>}
          </div>
          {draftText && (
            <div style={{ borderTop: "1px solid #fdba74" }}>
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-ui-fg-subtle flex-wrap bg-ui-bg-base border-b border-ui-border-base">
                {s.decide?.mail?.lang && (
                  <span className="text-[10px] font-bold text-white rounded px-1.5"
                        style={{ background: "#2563eb" }}>{s.decide.mail.lang}</span>
                )}
                {s.decide?.mail?.from && <span>from <b>{s.decide.mail.from}</b></span>}
                {s.decide?.mail?.attachment && <span>· 📎 {s.decide.mail.attachment}</span>}
              </div>
              <div className="px-3.5 py-3 whitespace-pre-wrap text-[13.5px] bg-ui-bg-base" style={WRAP}>
                {draftText}
              </div>
              {s.decide?.mail?.translation && (
                <details>
                  <summary className="cursor-pointer text-xs px-3 py-1.5 list-none [&::-webkit-details-marker]:hidden"
                           style={{ background: "#eff6ff", color: "#2563eb", borderTop: "1px solid #bfdbfe" }}>
                    🇬🇧 Show English translation
                  </summary>
                  <div className="px-3.5 py-3 whitespace-pre-wrap text-[13px] text-ui-fg-subtle bg-ui-bg-base"
                       style={{ borderTop: "1px solid #bfdbfe", ...WRAP }}>
                    {s.decide.mail.translation}
                  </div>
                </details>
              )}
              {s.decide?.mail?.after && (
                <div className="px-3 py-1.5 text-[11px] text-ui-fg-muted border-t border-dashed border-ui-border-base bg-ui-bg-base">
                  {s.decide.mail.after}
                </div>
              )}
            </div>
          )}
          <div className="px-3 py-2.5" style={{ background: "#fff7ed", borderTop: "1px solid #fdba74" }}>
            <DecisionZoneButtons task={task} conversationId={conversationId} isReply={isReply} draftText={draftText} />
            {task.status !== "pending" && (
              <div className="text-xs text-ui-fg-subtle">
                {task.decision_note && <p style={WRAP}>Instruction: {task.decision_note}</p>}
                {task.result?.summary && <p style={WRAP}>Result: {task.result.summary}</p>}
                {!task.decision_note && !task.result?.summary && <p>Decision recorded.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── simple approval card (fallback, no payload.summary) ─────────────────
function TaskCard({ task, conversationId }: any) {
  if (task.payload?.summary) return <SummaryCard task={task} conversationId={conversationId} />

  const [expanded, setExpanded] = useState(task.status === "pending")
  const isReply = task.action_type === "reply"
  const [label, badgeCls] = STATUS_BADGE[task.status] || STATUS_BADGE.pending
  const draftText = task.edited_draft || task.draft_reply

  return (
    <div
      className={`my-2 rounded-lg border p-3 max-w-2xl min-w-0 ${
        task.status === "pending"
          ? "border-ui-tag-orange-border bg-ui-bg-base shadow-elevation-card-hover"
          : "border-ui-border-base bg-ui-bg-subtle"
      }`}
      style={WRAP}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${badgeCls}`}>{label}</span>
        <span className="text-sm font-semibold" style={WRAP}>{task.title}</span>
        {typeof task.confidence === "number" && (
          <span className="text-xs text-ui-fg-muted">confidence {task.confidence}%</span>
        )}
        <span className="text-xs text-ui-fg-muted ml-auto shrink-0">{fmtTime(task.created_at)}</span>
      </div>
      {task.description && (
        <p className="text-sm text-ui-fg-subtle mt-1 whitespace-pre-wrap" style={WRAP}>
          {task.description}
        </p>
      )}
      {draftText && (
        <div className="mt-2 min-w-0">
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-ui-fg-interactive hover:underline">
            {expanded ? "▾ hide proposed reply" : "▸ show proposed reply"}
          </button>
          {expanded && (
            <div className="mt-1 text-sm whitespace-pre-wrap bg-ui-bg-subtle rounded p-2 border border-ui-border-base" style={WRAP}>
              {draftText}
            </div>
          )}
        </div>
      )}
      <DecisionZoneButtons task={task} conversationId={conversationId} isReply={isReply} draftText={draftText} />
      {task.decision_note && task.status !== "pending" && (
        <p className="text-xs text-ui-fg-muted mt-2" style={WRAP}>Instruction: {task.decision_note}</p>
      )}
      {task.result?.summary && (
        <p className="text-xs text-ui-fg-subtle mt-1" style={WRAP}>Result: {task.result.summary}</p>
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
      <div className={`my-2 flex min-w-0 ${isCustomer ? "justify-start" : "justify-end"}`}>
        <div
          className={`max-w-2xl min-w-0 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
            isCustomer
              ? "bg-ui-bg-subtle border border-ui-border-base"
              : "bg-ui-tag-blue-bg border border-ui-tag-blue-border"
          }`}
          style={WRAP}
        >
          <div className="flex items-center gap-2 text-xs text-ui-fg-muted mb-1 flex-wrap">
            <span>{isCustomer ? "📩" : "📤"}</span>
            <span className="font-medium" style={WRAP}>
              {isCustomer ? item.from_email : "Agent → customer"}
            </span>
            <span>{fmtDay(item.created_at)} {fmtTime(item.created_at)}</span>
            {!isCustomer && item.delivery_status && <span>· {item.delivery_status}</span>}
            {item.attachments?.length > 0 && <span>📎 {item.attachments.length}</span>}
          </div>
          {toPlainText(item.body || "").slice(0, 4000)}
        </div>
      </div>
    )
  }

  if (item.role === "system" || item.kind === "event") {
    return (
      <div className="my-2 text-center px-4">
        <span className="inline-block text-xs text-ui-fg-muted bg-ui-bg-subtle rounded-full px-3 py-1 max-w-full" style={WRAP}>
          {item.body} · {fmtTime(item.created_at)}
        </span>
      </div>
    )
  }
  if (item.role === "owner") {
    return (
      <div className="my-2 flex justify-end min-w-0">
        <div
          className={`max-w-2xl min-w-0 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap border ${
            item.kind === "note"
              ? "bg-ui-tag-orange-bg border-ui-tag-orange-border"
              : "bg-ui-button-inverted text-ui-fg-on-inverted border-transparent"
          }`}
          style={WRAP}
        >
          <div className="text-xs opacity-70 mb-1">
            {item.kind === "note" ? "📝 note" : "👤 you → agent"} · {fmtTime(item.created_at)}
          </div>
          {item.body}
        </div>
      </div>
    )
  }
  return (
    <div className="my-2 flex justify-start min-w-0">
      <div
        className="max-w-2xl min-w-0 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap bg-ui-bg-component border border-dashed border-ui-border-strong"
        style={WRAP}
      >
        <div className="text-xs text-ui-fg-muted mb-1">
          🤖 agent (internal) · {fmtTime(item.created_at)}
          {item.metadata?.confidence != null && ` · confidence ${item.metadata.confidence}%`}
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
    return <div className="p-4 text-sm text-ui-fg-muted">Direct chat with the agent — no ticket.</div>
  }
  const orders = data?.orders || data?.ticket?.orders || []
  return (
    <div className="p-4 space-y-4 overflow-y-auto text-sm min-w-0" style={WRAP}>
      <div>
        <h3 className="font-semibold text-xs uppercase text-ui-fg-muted mb-2">📦 Orders</h3>
        {orders.length === 0 && <p className="text-ui-fg-muted">No orders found.</p>}
        {orders.map((o: any) => (
          <div key={o.order_id || o.id} className="rounded-md border border-ui-border-base p-2 mb-2 space-y-0.5 min-w-0">
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
                className="block text-ui-fg-interactive hover:underline"
                style={WRAP}
              >
                🚚 {o.tracking_number || o.metadata?.dextrum_tracking_number}
              </a>
            )}
            {o.metadata?.fakturoid_invoice_url && (
              <a href={o.metadata.fakturoid_invoice_url} target="_blank" rel="noreferrer"
                 className="block text-ui-fg-interactive hover:underline" style={WRAP}>
                🧾 {o.metadata.fakturoid_invoice_number || "invoice"}
              </a>
            )}
          </div>
        ))}
      </div>
      {data?.ticket && (
        <div className="min-w-0">
          <h3 className="font-semibold text-xs uppercase text-ui-fg-muted mb-2">👤 Customer</h3>
          <p style={WRAP}>{data.ticket.from_name || data.ticket.from_email}</p>
          <p className="text-ui-fg-muted" style={WRAP}>{data.ticket.from_email}</p>
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
      <aside className="w-72 shrink-0 border-r border-ui-border-base flex flex-col bg-ui-bg-subtle-hover min-w-0">
        <div className="p-3 border-b border-ui-border-base">
          <h1 className="font-semibold text-sm flex items-center gap-2">
            <Sparkles className="text-ui-fg-interactive" /> Support Command Center
          </h1>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-4">
          {(data?.waiting?.length || 0) > 0 && (
            <section>
              <h2 className="px-2 text-xs font-semibold text-ui-tag-red-text uppercase mb-1">
                ⚡ Needs you ({data.waiting.length})
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
              <span className="text-xs text-ui-fg-muted ml-auto">direct chat</span>
            </button>
          </section>
          <section>
            <h2 className="px-2 text-xs font-semibold text-ui-fg-muted uppercase mb-1">Tickets</h2>
            {(data?.conversations || []).map((r: any) => (
              <ConvRow key={r.conversation_id} row={r}
                active={r.conversation_id === activeId}
                onClick={() => setActiveId(r.conversation_id)} />
            ))}
            {(data?.conversations?.length || 0) === 0 && (
              <p className="px-3 text-xs text-ui-fg-muted">No open tickets 🎉</p>
            )}
          </section>
          <section>
            <button onClick={() => setShowSolved(!showSolved)}
              className="px-2 text-xs font-semibold text-ui-fg-muted uppercase hover:text-ui-fg-base">
              {showSolved ? "▾" : "▸"} ✅ Solved today ({data?.solved_today?.length || 0})
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
              <span>waiting: <b className="text-ui-fg-base">{stats.waiting}</b></span>
              <span>active: <b className="text-ui-fg-base">{stats.active}</b></span>
              <span>today ✓: <b className="text-ui-fg-base">{stats.solved_today}</b></span>
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
            {agentEnabled ? "⏸ Pause agent" : "▶️ AGENT PAUSED — resume"}
          </button>
        </div>
      </aside>

      {/* ── THREAD ── */}
      <main className="flex-1 flex flex-col min-w-0 bg-ui-bg-base overflow-hidden">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-ui-fg-muted text-sm">
            Select a conversation on the left, or message the agent 🤖
          </div>
        ) : (
          <>
            <header className="px-4 py-2.5 border-b border-ui-border-base flex items-center gap-2 min-w-0">
              <span className="shrink-0">{active.kind === "dm" ? "🤖" : projectFlag(active.project)}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate">
                  {active.kind === "dm" ? "Agent — direct chat" : active.from_email}
                </div>
                {active.kind !== "dm" && (
                  <div className="text-xs text-ui-fg-muted truncate">
                    {active.subject} · {active.project || "?"}
                  </div>
                )}
              </div>
              {agentWorking && (
                <span className="shrink-0 text-xs text-ui-tag-orange-text animate-pulse">🤖 working…</span>
              )}
            </header>
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-2 min-w-0">
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
                  className="text-xs rounded-md border border-ui-border-base bg-ui-bg-field px-2 py-2 shrink-0"
                >
                  <option value="chat">→ To agent</option>
                  <option value="note">📝 Note</option>
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
                  placeholder={composerKind === "chat" ? "Tell the agent what to do… (Enter to send)" : "Internal note…"}
                  className="flex-1 text-sm rounded-md border border-ui-border-base bg-ui-bg-field p-2 resize-none min-w-0"
                />
                <button
                  onClick={() => composer.trim() && sendMessage.mutate()}
                  disabled={sendMessage.isPending || !composer.trim()}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-ui-button-inverted text-ui-fg-on-inverted disabled:opacity-40 shrink-0"
                >
                  Send
                </button>
              </div>
            </footer>
          </>
        )}
      </main>

      {/* ── CONTEXT ── */}
      {active && (
        <aside className="w-80 shrink-0 border-l border-ui-border-base bg-ui-bg-subtle-hover hidden xl:block overflow-y-auto overflow-x-hidden">
          <ContextPanel ticketId={active.ticket_id} />
        </aside>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Command Center",
  icon: Sparkles,
})

export default SupportChatPage
