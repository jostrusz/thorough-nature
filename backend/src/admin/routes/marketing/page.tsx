import React from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../lib/sdk"
import {
  MarketingShell,
  StatusBadge,
  EmptyState,
  useSelectedBrand,
  brandQs,
  fmt,
  pct,
  tokens,
} from "../../components/marketing/shared"

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: string
  sub?: string
  icon?: string
}) {
  return (
    <div className="mkt-card" style={{ padding: "20px", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: tokens.fgSecondary,
          }}
        >
          {label}
        </div>
        {icon && (
          <div
            style={{
              fontSize: "18px",
              opacity: 0.6,
              lineHeight: 1,
            }}
            aria-hidden
          >
            {icon}
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: "32px",
          fontWeight: 600,
          color: tokens.fg,
          marginTop: "10px",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "12px", color: tokens.fgMuted, marginTop: "6px" }}>{sub}</div>
      )}
    </div>
  )
}

function QuickActionTile({
  to,
  icon,
  title,
  description,
}: {
  to: string
  icon: string
  title: string
  description: string
}) {
  return (
    <Link to={to} className="mkt-tile">
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: tokens.rMd,
            background: tokens.primarySoft,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
          }}
          aria-hidden
        >
          {icon}
        </div>
        <div
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: tokens.fg,
            letterSpacing: "-0.005em",
          }}
        >
          {title}
        </div>
      </div>
      <div style={{ fontSize: "13px", color: tokens.fgSecondary, lineHeight: 1.5 }}>
        {description}
      </div>
    </Link>
  )
}

function SectionHeading({
  title,
  action,
}: {
  title: string
  action?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "12px",
      }}
    >
      <h2
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: tokens.fg,
          margin: 0,
          letterSpacing: "-0.005em",
        }}
      >
        {title}
      </h2>
      {action}
    </div>
  )
}

function MarketingDashboardPage() {
  const { brandId } = useSelectedBrand()
  const qs = brandQs(brandId)

  const summary = useQuery({
    queryKey: ["mkt-summary", brandId],
    queryFn: () =>
      sdk.client
        .fetch<any>(`/admin/marketing/summary${qs}`, { method: "GET" })
        .catch(() => ({ summary: null })),
    enabled: !!brandId,
  })

  const recentCampaigns = useQuery({
    queryKey: ["mkt-recent-campaigns", brandId],
    queryFn: () =>
      sdk.client
        .fetch<{ campaigns: any[] }>(
          `/admin/marketing/campaigns${qs}${qs ? "&" : "?"}limit=10&order=-sent_at`,
          { method: "GET" }
        )
        .catch(() => ({ campaigns: [] })),
    enabled: !!brandId,
  })

  const s: any = (summary.data as any)?.summary || {}
  const campaigns: any[] = ((recentCampaigns.data as any)?.campaigns) || []

  return (
    <MarketingShell
      title="Marketing"
      subtitle="Email campaigns, contacts, flows, forms and analytics"
    >
      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "32px",
        }}
      >
        <StatCard label="Total contacts" value={fmt(s.total_contacts)} sub="all statuses" icon="👥" />
        <StatCard label="Campaigns sent (30d)" value={fmt(s.campaigns_sent_30d)} icon="🚀" />
        <StatCard label="Avg open rate" value={pct(s.avg_open_rate)} icon="📬" />
        <StatCard label="Avg click rate" value={pct(s.avg_click_rate)} icon="🎯" />
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: "32px" }}>
        <SectionHeading title="Quick actions" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
          }}
        >
          <QuickActionTile
            to="/marketing/templates/new"
            icon="📧"
            title="Create template"
            description="Design a reusable email template with blocks or custom HTML."
          />
          <QuickActionTile
            to="/marketing/campaigns/new"
            icon="🚀"
            title="Create campaign"
            description="Broadcast to a list or segment. Schedule or send right away."
          />
          <QuickActionTile
            to="/marketing/contacts"
            icon="👥"
            title="Import contacts"
            description="Add subscribers individually or paste a CSV of emails."
          />
          <QuickActionTile
            to="/marketing/analytics"
            icon="📊"
            title="View analytics"
            description="Compare open, click and bounce rates across campaigns."
          />
        </div>
      </div>

      {/* Sections navigation */}
      <div style={{ marginBottom: "32px" }}>
        <SectionHeading title="Browse" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
          }}
        >
          <QuickActionTile to="/marketing/brands" icon="🎨" title="Brands" description="Sender identities and opt-in settings." />
          <QuickActionTile to="/marketing/templates" icon="📧" title="Templates" description="Reusable email designs." />
          <QuickActionTile to="/marketing/campaigns" icon="🚀" title="Campaigns" description="One-off broadcasts and sends." />
          <QuickActionTile to="/marketing/contacts" icon="👤" title="Contacts" description="Subscribers and leads." />
          <QuickActionTile to="/marketing/lists" icon="📋" title="Lists" description="Static and dynamic lists." />
          <QuickActionTile to="/marketing/segments" icon="🔍" title="Segments" description="Rule-based contact slices." />
          <QuickActionTile to="/marketing/flows" icon="⚡" title="Flows" description="Automations and drip sequences." />
          <QuickActionTile to="/marketing/forms" icon="📝" title="Forms" description="Signup forms and landing pages." />
        </div>
      </div>

      {/* Recent campaigns */}
      <div>
        <SectionHeading
          title="Recent campaigns"
          action={
            <Link to="/marketing/campaigns" className="mkt-link" style={{ fontSize: "13px", fontWeight: 500 }}>
              View all →
            </Link>
          }
        />
        <div className="mkt-card" style={{ overflow: "hidden", padding: 0 }}>
          {recentCampaigns.isLoading ? (
            <div style={{ padding: "32px", color: tokens.fgSecondary, fontSize: "13px", textAlign: "center" }}>
              Loading…
            </div>
          ) : campaigns.length === 0 ? (
            <EmptyState
              icon={"🚀"}
              title="No campaigns yet"
              description="Create your first campaign to broadcast to lists or segments."
              action={
                <Link to="/marketing/campaigns/new" className="mkt-btn-primary">
                  Create campaign
                </Link>
              }
            />
          ) : (
            <table className="mkt-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Sent</th>
                  <th>Opens</th>
                  <th>Clicks</th>
                  <th>Bounces</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c: any) => {
                  const m = c.metrics || {}
                  return (
                    <tr key={c.id} className="mkt-row">
                      <td>
                        <Link
                          to={`/marketing/campaigns/${c.id}`}
                          className="mkt-link"
                          style={{ fontWeight: 500 }}
                        >
                          {c.name || "Untitled"}
                        </Link>
                      </td>
                      <td>
                        <StatusBadge status={c.status || "draft"} />
                      </td>
                      <td>{fmt(m.sent)}</td>
                      <td>{fmt(m.opened)}</td>
                      <td>{fmt(m.clicked)}</td>
                      <td>{fmt(m.bounced)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </MarketingShell>
  )
}

export const config = defineRouteConfig({
  label: "Marketing",
})

export default MarketingDashboardPage
