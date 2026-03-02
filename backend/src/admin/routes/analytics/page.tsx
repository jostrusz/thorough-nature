import React, { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../lib/sdk"

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════

function PageStyles() {
  return (
    <style>{`
      @keyframes anFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .an-wrap { max-width: 1400px; margin: 0 auto; padding: 0; }
      .an-card { background: #FFF; border: 1px solid #E1E3E5; border-radius: 10px; overflow: hidden; margin-bottom: 24px; animation: anFadeIn 0.3s ease; transition: box-shadow 0.2s; }
      .an-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
      .an-card-header { padding: 16px 20px; border-bottom: 1px solid #E1E3E5; display: flex; align-items: center; justify-content: space-between; }
      .an-card-title { font-size: 14px; font-weight: 600; color: #1A1A1A; }
      .an-page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
      .an-page-header h1 { font-size: 20px; font-weight: 600; color: #1A1A1A; }
      .an-header-actions { display: flex; gap: 8px; }

      /* Project selector */
      .an-project-selector { display: flex; gap: 8px; margin-bottom: 24px; padding: 12px 16px; background: #FFF; border: 1px solid #E1E3E5; border-radius: 10px; flex-wrap: wrap; align-items: center; }
      .an-chip { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 20px; font-size: 13px; font-weight: 500; cursor: pointer; background: #F1F1F1; color: #1A1A1A; border: 1px solid transparent; transition: all 0.2s; white-space: nowrap; }
      .an-chip:hover { background: #F9FAFB; }
      .an-chip.active { background: #1A1A1A; color: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

      /* Period selector */
      .an-period { display: flex; gap: 4px; }
      .an-period-btn { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid #E1E3E5; background: #FFF; color: #6D7175; transition: all 0.15s; }
      .an-period-btn:hover { background: #F9FAFB; }
      .an-period-btn.active { background: #1A1A1A; color: #FFF; border-color: #1A1A1A; }

      /* Stat cards */
      .an-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
      .an-stat-card { background: #FFF; border: 1px solid #E1E3E5; border-radius: 10px; padding: 20px; transition: box-shadow 0.2s, transform 0.2s; animation: anFadeIn 0.3s ease; }
      .an-stat-card:hover { box-shadow: 0 1px 3px rgba(0,0,0,0.1); transform: translateY(-1px); }
      .an-stat-label { font-size: 13px; color: #6D7175; font-weight: 500; margin-bottom: 8px; }
      .an-stat-value { font-size: 28px; font-weight: 600; color: #1A1A1A; letter-spacing: -0.5px; }
      .an-stat-change { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 500; margin-top: 6px; padding: 2px 8px; border-radius: 12px; }
      .an-stat-change.up { color: #0D5740; background: #AEE9D1; }
      .an-stat-change.down { color: #9E2B25; background: #FED3D1; }
      .an-stat-change.neutral { color: #6D7175; background: #F1F1F1; }

      /* Tabs */
      .an-tabs { display: flex; align-items: center; gap: 0; padding: 0 16px; border-bottom: 1px solid #E1E3E5; overflow-x: auto; scrollbar-width: none; }
      .an-tabs::-webkit-scrollbar { display: none; }
      .an-tab { padding: 12px 14px; font-size: 13px; font-weight: 500; color: #6D7175; cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; transition: all 0.2s; user-select: none; }
      .an-tab:hover { color: #1A1A1A; }
      .an-tab.active { color: #1A1A1A; border-bottom-color: #1A1A1A; font-weight: 600; }

      /* Table */
      .an-table { width: 100%; border-collapse: collapse; }
      .an-table th { text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 600; color: #6D7175; border-bottom: 1px solid #E1E3E5; white-space: nowrap; background: #FFF; }
      .an-table td { padding: 12px; font-size: 13px; border-bottom: 1px solid #F1F1F1; vertical-align: middle; }
      .an-table tbody tr { transition: background 0.12s; cursor: pointer; }
      .an-table tbody tr:hover { background: #F9FAFB; }
      .an-table .right { text-align: right; }

      /* Badges */
      .an-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; white-space: nowrap; transition: transform 0.12s; }
      .an-badge:hover { transform: scale(1.03); }
      .an-badge-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
      .an-badge-facebook { background: #E7F3FF; color: #1565C0; }
      .an-badge-facebook .an-badge-dot { background: #1565C0; }
      .an-badge-email { background: #FFF3E0; color: #E65100; }
      .an-badge-email .an-badge-dot { background: #E65100; }
      .an-badge-google { background: #FFF8E1; color: #F57F17; }
      .an-badge-google .an-badge-dot { background: #F57F17; }
      .an-badge-direct { background: #F3E5F5; color: #7B1FA2; }
      .an-badge-direct .an-badge-dot { background: #7B1FA2; }
      .an-badge-instagram { background: #FCE4EC; color: #C62828; }
      .an-badge-instagram .an-badge-dot { background: #C62828; }
      .an-badge-organic { background: #E8F5E9; color: #2E7D32; }
      .an-badge-organic .an-badge-dot { background: #2E7D32; }
      .an-badge-referral { background: #F1F1F1; color: #44474A; }
      .an-badge-referral .an-badge-dot { background: #44474A; }

      /* Funnel */
      .an-funnel { padding: 24px; }
      .an-funnel-step { margin-bottom: 20px; }
      .an-funnel-label { font-size: 13px; font-weight: 500; color: #1A1A1A; margin-bottom: 8px; }
      .an-funnel-bar-row { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
      .an-funnel-bar { flex: 1; height: 32px; background: linear-gradient(90deg, #008060, #00a870); border-radius: 4px; display: flex; align-items: center; padding: 0 12px; color: #fff; font-weight: 600; font-size: 13px; transition: width 0.4s ease; }
      .an-funnel-value { min-width: 120px; text-align: right; font-size: 13px; color: #1A1A1A; font-weight: 500; }
      .an-funnel-dropoff { font-size: 12px; color: #6D7175; min-width: 80px; text-align: right; }

      /* Email link */
      .an-email-link { color: #2C6ECB; font-weight: 600; text-decoration: none; cursor: pointer; transition: color 0.12s; }
      .an-email-link:hover { color: #1A5DB4; text-decoration: underline; }

      /* Modal */
      .an-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); z-index: 999; opacity: 0; pointer-events: none; transition: opacity 0.3s; }
      .an-modal-overlay.visible { opacity: 1; pointer-events: all; }
      .an-modal-panel { position: fixed; top: 0; right: 0; bottom: 0; width: 450px; background: #FFF; box-shadow: -4px 0 20px rgba(0,0,0,0.15); z-index: 1000; overflow-y: auto; transform: translateX(450px); transition: transform 0.3s; }
      .an-modal-panel.visible { transform: translateX(0); }
      .an-modal-header { padding: 20px; border-bottom: 1px solid #E1E3E5; display: flex; align-items: center; justify-content: space-between; background: #F6F6F7; }
      .an-modal-header h2 { font-size: 16px; font-weight: 600; color: #1A1A1A; }
      .an-modal-close { background: none; border: none; cursor: pointer; font-size: 20px; color: #8C9196; transition: color 0.2s; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
      .an-modal-close:hover { color: #1A1A1A; }
      .an-modal-body { padding: 24px; }
      .an-modal-section { margin-bottom: 24px; }
      .an-modal-section-title { font-size: 12px; font-weight: 600; color: #6D7175; text-transform: uppercase; margin-bottom: 12px; }
      .an-modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px; }
      .an-modal-stat { padding: 12px; background: #F6F6F7; border-radius: 6px; }
      .an-modal-stat-label { font-size: 11px; color: #6D7175; font-weight: 500; margin-bottom: 4px; }
      .an-modal-stat-value { font-size: 18px; font-weight: 600; color: #1A1A1A; }
      .an-mini-funnel-step { padding: 8px 12px; background: #F6F6F7; border-radius: 4px; font-size: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
      .an-converter-item { padding: 10px; background: #F6F6F7; border-radius: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; }

      /* Conversion paths */
      .an-paths { padding: 24px; }
      .an-path-item { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #E1E3E5; }
      .an-path-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
      .an-path-rank { min-width: 30px; font-size: 14px; font-weight: 600; color: #6D7175; }
      .an-path-flow { flex: 1; display: flex; align-items: center; gap: 8px; font-size: 12px; color: #1A1A1A; flex-wrap: wrap; }
      .an-path-arrow { color: #8C9196; }
      .an-path-stats { min-width: 100px; text-align: right; font-size: 12px; }

      /* Loading */
      .an-loading { display: flex; align-items: center; justify-content: center; padding: 40px; color: #6D7175; font-size: 13px; }
      .an-empty { text-align: center; padding: 40px; color: #8C9196; font-size: 13px; }

      @media (max-width: 1200px) { .an-stats-grid { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 768px) { .an-stats-grid { grid-template-columns: 1fr; } }
    `}</style>
  )
}

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

interface OverviewData {
  visitors: { current: number; previous: number; change: number }
  conversion_rate: { current: number; previous: number; change: number }
  revenue: { current: number; previous: number; change: number }
  orders: { current: number; previous: number; change: number }
  cpa: { current: number; previous: number; change: number }
}

interface TrafficSource {
  source: string
  visitors: number
  sessions: number
  orders: number
  conversion_rate: number
  revenue: number
}

interface FunnelStep {
  step: string
  label: string
  count: number
  rate: number
  drop_off?: number
}

interface EmailCampaign {
  id: string
  project_id: string
  email_name: string
  email_subject: string | null
  email_type: string | null
  sent_count: number
  delivered_count: number
  opened_count: number
  clicked_count: number
  bounced_count: number
  unsubscribed_count: number
  conversion_count: number
  revenue: number
  open_rate: number
  click_rate: number
  bounce_rate?: number
  created_at: string
}

interface EmailCampaignDetail extends EmailCampaign {
  conversions: Array<{
    id: string
    customer_email: string
    order_id: string
    order_amount: number
    clicked_link: string | null
    time_to_conversion: number
    created_at: string
  }>
}

interface ProjectComparison {
  project_id: string
  visitors: number
  sessions: number
  orders: number
  conversion_rate: number
  revenue: number
}

interface ConversionPath {
  path: string
  steps: string[]
  conversions: number
  percentage: number
}

interface DailyStats {
  date: string
  total_visitors: number
  total_conversions: number
  by_source: Record<string, { visitors: number; conversions: number }>
}

// ═══════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════

function useOverview(projectId: string | null, period: string) {
  return useQuery({
    queryKey: ["analytics-overview", projectId, period],
    queryFn: () => {
      const params = new URLSearchParams({ period })
      if (projectId) params.set("project_id", projectId)
      return sdk.client.fetch<OverviewData>(
        `/admin/analytics/overview?${params}`,
        { method: "GET" }
      )
    },
  })
}

function useTrafficSources(projectId: string | null, period: string) {
  return useQuery({
    queryKey: ["analytics-traffic", projectId, period],
    queryFn: () => {
      const params = new URLSearchParams({ period })
      if (projectId) params.set("project_id", projectId)
      return sdk.client.fetch<{ sources: TrafficSource[] }>(
        `/admin/analytics/traffic-sources?${params}`,
        { method: "GET" }
      )
    },
  })
}

function useFunnel(projectId: string | null, period: string) {
  return useQuery({
    queryKey: ["analytics-funnel", projectId, period],
    queryFn: () => {
      const params = new URLSearchParams({ period })
      if (projectId) params.set("project_id", projectId)
      return sdk.client.fetch<{ funnel: FunnelStep[] }>(
        `/admin/analytics/funnel?${params}`,
        { method: "GET" }
      )
    },
  })
}

function useEmailCampaigns(projectId: string | null) {
  return useQuery({
    queryKey: ["analytics-email-campaigns", projectId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (projectId) params.set("project_id", projectId)
      return sdk.client.fetch<{ campaigns: EmailCampaign[] }>(
        `/admin/analytics/email-campaigns?${params}`,
        { method: "GET" }
      )
    },
  })
}

function useEmailCampaignDetail(id: string | null) {
  return useQuery({
    queryKey: ["analytics-email-campaign", id],
    queryFn: () =>
      sdk.client.fetch<{ campaign: EmailCampaign; conversions: EmailCampaignDetail["conversions"] }>(
        `/admin/analytics/email-campaigns/${id}`,
        { method: "GET" }
      ),
    enabled: !!id,
  })
}

function useProjectsComparison(period: string) {
  return useQuery({
    queryKey: ["analytics-projects", period],
    queryFn: () => {
      const params = new URLSearchParams({ period })
      return sdk.client.fetch<{ projects: ProjectComparison[] }>(
        `/admin/analytics/projects-comparison?${params}`,
        { method: "GET" }
      )
    },
  })
}

function useConversionPaths(projectId: string | null, period: string) {
  return useQuery({
    queryKey: ["analytics-paths", projectId, period],
    queryFn: () => {
      const params = new URLSearchParams({ period })
      if (projectId) params.set("project_id", projectId)
      return sdk.client.fetch<{ paths: ConversionPath[]; total_journeys: number }>(
        `/admin/analytics/conversion-paths?${params}`,
        { method: "GET" }
      )
    },
  })
}

function useDailyStats(projectId: string | null, period: string) {
  return useQuery({
    queryKey: ["analytics-daily", projectId, period],
    queryFn: () => {
      const params = new URLSearchParams({ period })
      if (projectId) params.set("project_id", projectId)
      return sdk.client.fetch<{ daily: DailyStats[]; sources: string[] }>(
        `/admin/analytics/daily-stats?${params}`,
        { method: "GET" }
      )
    },
  })
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M"
  if (n >= 1000) return (n / 1000).toFixed(1) + "K"
  return n.toLocaleString()
}

function formatCurrency(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function getSourceBadgeClass(source: string): string {
  const s = source.toLowerCase()
  if (s.includes("facebook") || s.includes("fb")) return "an-badge-facebook"
  if (s.includes("instagram") || s.includes("ig")) return "an-badge-instagram"
  if (s.includes("google")) return "an-badge-google"
  if (s.includes("email")) return "an-badge-email"
  if (s.includes("direct")) return "an-badge-direct"
  if (s.includes("organic")) return "an-badge-organic"
  return "an-badge-referral"
}

function changeClass(val: number): string {
  if (val > 0) return "up"
  if (val < 0) return "down"
  return "neutral"
}

function changePrefix(val: number): string {
  if (val > 0) return "+"
  return ""
}

// ═══════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════

function StatCard({
  label,
  value,
  change,
  format = "number",
}: {
  label: string
  value: number
  change: number
  format?: "number" | "currency" | "percent"
}) {
  const formatted =
    format === "currency"
      ? formatCurrency(value)
      : format === "percent"
        ? value.toFixed(2) + "%"
        : formatNumber(value)

  return (
    <div className="an-stat-card">
      <div className="an-stat-label">{label}</div>
      <div className="an-stat-value">{formatted}</div>
      <span className={`an-stat-change ${changeClass(change)}`}>
        {changePrefix(change)}
        {Math.abs(change).toFixed(1)}%
      </span>
    </div>
  )
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span className={`an-badge ${getSourceBadgeClass(source)}`}>
      <span className="an-badge-dot" />
      {source.charAt(0).toUpperCase() + source.slice(1)}
    </span>
  )
}

function TrafficSourcesSection({
  projectId,
  period,
}: {
  projectId: string | null
  period: string
}) {
  const { data, isLoading } = useTrafficSources(projectId, period)
  const [tab, setTab] = useState("all")

  const sources = data?.sources || []
  const filtered = useMemo(() => {
    if (tab === "all") return sources
    return sources.filter(
      (s) => s.source.toLowerCase() === tab.toLowerCase()
    )
  }, [sources, tab])

  const tabs = ["all", "facebook", "google", "email", "direct"]

  return (
    <div className="an-card">
      <div className="an-card-header">
        <div className="an-card-title">Traffic Sources</div>
      </div>
      <div className="an-tabs">
        {tabs.map((t) => (
          <div
            key={t}
            className={`an-tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>
      {isLoading ? (
        <div className="an-loading">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="an-empty">No traffic data yet</div>
      ) : (
        <table className="an-table">
          <thead>
            <tr>
              <th>Source</th>
              <th className="right">Visitors</th>
              <th className="right">Sessions</th>
              <th className="right">Conv. Rate</th>
              <th className="right">Orders</th>
              <th className="right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.source}>
                <td>
                  <SourceBadge source={s.source} />
                </td>
                <td className="right">{formatNumber(s.visitors)}</td>
                <td className="right">{formatNumber(s.sessions)}</td>
                <td className="right">{s.conversion_rate.toFixed(2)}%</td>
                <td className="right">{s.orders}</td>
                <td className="right">{formatCurrency(s.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function FunnelSection({
  projectId,
  period,
}: {
  projectId: string | null
  period: string
}) {
  const { data, isLoading } = useFunnel(projectId, period)
  const funnel = data?.funnel || []
  const maxCount = funnel.length > 0 ? funnel[0].count : 1

  return (
    <div className="an-card">
      <div className="an-card-header">
        <div className="an-card-title">Conversion Funnel</div>
      </div>
      {isLoading ? (
        <div className="an-loading">Loading...</div>
      ) : funnel.length === 0 ? (
        <div className="an-empty">No funnel data yet</div>
      ) : (
        <div className="an-funnel">
          {funnel.map((step) => {
            const width = maxCount > 0 ? Math.max(5, (step.count / maxCount) * 100) : 5
            return (
              <div key={step.step} className="an-funnel-step">
                <div className="an-funnel-label">{step.label}</div>
                <div className="an-funnel-bar-row">
                  <div
                    className="an-funnel-bar"
                    style={{ width: `${width}%` }}
                  >
                    {step.rate.toFixed(1)}%
                  </div>
                  <div className="an-funnel-value">
                    {formatNumber(step.count)} visitors
                  </div>
                  {step.drop_off !== undefined && step.drop_off > 0 && (
                    <div className="an-funnel-dropoff">
                      -{step.drop_off.toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EmailCampaignsSection({
  projectId,
}: {
  projectId: string | null
}) {
  const { data, isLoading } = useEmailCampaigns(projectId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const campaigns = data?.campaigns || []

  return (
    <>
      <div className="an-card">
        <div className="an-card-header">
          <div className="an-card-title">Email Performance</div>
        </div>
        {isLoading ? (
          <div className="an-loading">Loading...</div>
        ) : campaigns.length === 0 ? (
          <div className="an-empty">No email campaign data yet</div>
        ) : (
          <table className="an-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th className="right">Sent</th>
                <th className="right">Delivered</th>
                <th className="right">Open Rate</th>
                <th className="right">Click Rate</th>
                <th className="right">Conversions</th>
                <th className="right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} onClick={() => setSelectedId(c.id)}>
                  <td>
                    <span className="an-email-link">{c.email_name}</span>
                    {c.email_type && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          color: "#8C9196",
                          fontWeight: 500,
                        }}
                      >
                        {c.email_type}
                      </span>
                    )}
                  </td>
                  <td className="right">{formatNumber(c.sent_count)}</td>
                  <td className="right">{formatNumber(c.delivered_count)}</td>
                  <td className="right">{c.open_rate.toFixed(1)}%</td>
                  <td className="right">{c.click_rate.toFixed(1)}%</td>
                  <td className="right">{c.conversion_count}</td>
                  <td className="right">{formatCurrency(c.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Drill-down modal */}
      <EmailDrillDown
        campaignId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  )
}

function EmailDrillDown({
  campaignId,
  onClose,
}: {
  campaignId: string | null
  onClose: () => void
}) {
  const { data, isLoading } = useEmailCampaignDetail(campaignId)
  const visible = !!campaignId

  const campaign = data?.campaign
  const conversions = data?.conversions || []

  return (
    <>
      <div
        className={`an-modal-overlay ${visible ? "visible" : ""}`}
        onClick={onClose}
      />
      <div className={`an-modal-panel ${visible ? "visible" : ""}`}>
        <div className="an-modal-header">
          <h2>{campaign?.email_name || "Campaign Details"}</h2>
          <button className="an-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="an-modal-body">
          {isLoading ? (
            <div className="an-loading">Loading...</div>
          ) : campaign ? (
            <>
              <div className="an-modal-section">
                <div className="an-modal-section-title">Metrics</div>
                <div className="an-modal-grid">
                  <div className="an-modal-stat">
                    <div className="an-modal-stat-label">Sent</div>
                    <div className="an-modal-stat-value">
                      {formatNumber(campaign.sent_count)}
                    </div>
                  </div>
                  <div className="an-modal-stat">
                    <div className="an-modal-stat-label">Delivered</div>
                    <div className="an-modal-stat-value">
                      {formatNumber(campaign.delivered_count)}
                    </div>
                  </div>
                  <div className="an-modal-stat">
                    <div className="an-modal-stat-label">Open Rate</div>
                    <div className="an-modal-stat-value">
                      {campaign.open_rate.toFixed(1)}%
                    </div>
                  </div>
                  <div className="an-modal-stat">
                    <div className="an-modal-stat-label">Click Rate</div>
                    <div className="an-modal-stat-value">
                      {campaign.click_rate.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              <div className="an-modal-section">
                <div className="an-modal-section-title">Email Funnel</div>
                {[
                  { label: "Sent", count: campaign.sent_count },
                  { label: "Delivered", count: campaign.delivered_count },
                  { label: "Opened", count: campaign.opened_count },
                  { label: "Clicked", count: campaign.clicked_count },
                  { label: "Converted", count: campaign.conversion_count },
                ].map((step) => (
                  <div key={step.label} className="an-mini-funnel-step">
                    <span style={{ fontWeight: 500 }}>{step.label}</span>
                    <span style={{ color: "#6D7175", fontWeight: 600 }}>
                      {formatNumber(step.count)}
                    </span>
                  </div>
                ))}
              </div>

              {conversions.length > 0 && (
                <div className="an-modal-section">
                  <div className="an-modal-section-title">
                    Converters ({conversions.length})
                  </div>
                  {conversions.map((conv) => (
                    <div key={conv.id} className="an-converter-item">
                      <span style={{ fontWeight: 500 }}>
                        {conv.customer_email}
                      </span>
                      <span style={{ fontWeight: 600, color: "#008060" }}>
                        {formatCurrency(conv.order_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="an-modal-section">
                <div className="an-modal-section-title">Revenue</div>
                <div className="an-modal-stat">
                  <div className="an-modal-stat-label">Total Revenue</div>
                  <div className="an-modal-stat-value">
                    {formatCurrency(campaign.revenue)}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}

function ProjectsComparisonSection({ period }: { period: string }) {
  const { data, isLoading } = useProjectsComparison(period)
  const projects = data?.projects || []

  return (
    <div className="an-card">
      <div className="an-card-header">
        <div className="an-card-title">Project Comparison</div>
      </div>
      {isLoading ? (
        <div className="an-loading">Loading...</div>
      ) : projects.length === 0 ? (
        <div className="an-empty">No project data yet</div>
      ) : (
        <table className="an-table">
          <thead>
            <tr>
              <th>Project</th>
              <th className="right">Visitors</th>
              <th className="right">Orders</th>
              <th className="right">Conv. Rate</th>
              <th className="right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.project_id}>
                <td style={{ fontWeight: 600 }}>{p.project_id}</td>
                <td className="right">{formatNumber(p.visitors)}</td>
                <td className="right">{p.orders}</td>
                <td className="right">{p.conversion_rate.toFixed(2)}%</td>
                <td className="right">{formatCurrency(p.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function DailyChartSection({
  projectId,
  period,
}: {
  projectId: string | null
  period: string
}) {
  const { data, isLoading } = useDailyStats(projectId, period)
  const daily = data?.daily || []
  const sources = data?.sources || []

  if (isLoading) {
    return (
      <div className="an-card">
        <div className="an-card-header">
          <div className="an-card-title">Daily Traffic</div>
        </div>
        <div className="an-loading">Loading...</div>
      </div>
    )
  }

  if (daily.length === 0) {
    return (
      <div className="an-card">
        <div className="an-card-header">
          <div className="an-card-title">Daily Traffic</div>
        </div>
        <div className="an-empty">No daily data yet</div>
      </div>
    )
  }

  // Simple bar chart via SVG
  const maxVisitors = Math.max(...daily.map((d) => d.total_visitors), 1)
  const chartW = 800
  const chartH = 200
  const barW = Math.max(8, (chartW - 60) / daily.length - 4)

  const sourceColors: Record<string, string> = {
    facebook: "#1565C0",
    google: "#F57F17",
    email: "#E65100",
    direct: "#7B1FA2",
    instagram: "#C62828",
    organic: "#2E7D32",
    referral: "#44474A",
  }

  return (
    <div className="an-card">
      <div className="an-card-header">
        <div className="an-card-title">Daily Traffic</div>
      </div>
      <div style={{ padding: 24, overflowX: "auto" }}>
        <svg width={chartW} height={chartH + 40} style={{ display: "block" }}>
          {/* Y-axis labels */}
          <text x={0} y={15} fontSize={10} fill="#6D7175">
            {maxVisitors}
          </text>
          <text x={0} y={chartH + 5} fontSize={10} fill="#6D7175">
            0
          </text>
          <line
            x1={40}
            y1={0}
            x2={40}
            y2={chartH}
            stroke="#E1E3E5"
            strokeWidth={1}
          />
          <line
            x1={40}
            y1={chartH}
            x2={chartW}
            y2={chartH}
            stroke="#E1E3E5"
            strokeWidth={1}
          />

          {daily.map((d, i) => {
            const x = 50 + i * (barW + 4)
            let yOffset = 0

            return (
              <g key={d.date}>
                {sources.map((source) => {
                  const val = d.by_source[source]?.visitors || 0
                  const h = (val / maxVisitors) * chartH
                  const y = chartH - yOffset - h
                  yOffset += h
                  return (
                    <rect
                      key={source}
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(0, h)}
                      fill={sourceColors[source] || "#8C9196"}
                      rx={2}
                      opacity={0.8}
                    />
                  )
                })}
                {/* X-axis label */}
                {(i % Math.ceil(daily.length / 10) === 0 || daily.length <= 14) && (
                  <text
                    x={x + barW / 2}
                    y={chartH + 20}
                    fontSize={9}
                    fill="#6D7175"
                    textAnchor="middle"
                  >
                    {d.date.slice(5)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          {sources.map((source) => (
            <div
              key={source}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: "#6D7175",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: sourceColors[source] || "#8C9196",
                  display: "inline-block",
                }}
              />
              {source.charAt(0).toUpperCase() + source.slice(1)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ConversionPathsSection({
  projectId,
  period,
}: {
  projectId: string | null
  period: string
}) {
  const { data, isLoading } = useConversionPaths(projectId, period)
  const paths = data?.paths || []

  return (
    <div className="an-card">
      <div className="an-card-header">
        <div className="an-card-title">Top Conversion Paths</div>
      </div>
      {isLoading ? (
        <div className="an-loading">Loading...</div>
      ) : paths.length === 0 ? (
        <div className="an-empty">No conversion path data yet</div>
      ) : (
        <div className="an-paths">
          {paths.slice(0, 10).map((p, i) => (
            <div key={i} className="an-path-item">
              <div className="an-path-rank">#{i + 1}</div>
              <div className="an-path-flow">
                {p.steps.map((step, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && <span className="an-path-arrow">&rarr;</span>}
                    <SourceBadge source={step} />
                  </React.Fragment>
                ))}
              </div>
              <div className="an-path-stats">
                <div style={{ fontWeight: 600 }}>{p.conversions}</div>
                <div style={{ color: "#6D7175", fontSize: 11 }}>
                  {p.percentage.toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════

const AnalyticsPage = () => {
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [period, setPeriod] = useState("7d")

  // Get project list from traffic data
  const { data: projectsData } = useProjectsComparison(period)
  const projectIds = useMemo(
    () => (projectsData?.projects || []).map((p) => p.project_id),
    [projectsData]
  )

  const { data: overviewData, isLoading: overviewLoading } = useOverview(
    selectedProject,
    period
  )

  return (
    <>
      <PageStyles />
      <div className="an-wrap">
        {/* Page Header */}
        <div className="an-page-header">
          <h1>Analytics</h1>
          <div className="an-header-actions">
            <div className="an-period">
              {["7d", "14d", "30d"].map((p) => (
                <button
                  key={p}
                  className={`an-period-btn ${period === p ? "active" : ""}`}
                  onClick={() => setPeriod(p)}
                >
                  {p === "7d" ? "7 Days" : p === "14d" ? "14 Days" : "30 Days"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Project Selector */}
        {projectIds.length > 0 && (
          <div className="an-project-selector">
            <div
              className={`an-chip ${!selectedProject ? "active" : ""}`}
              onClick={() => setSelectedProject(null)}
            >
              All Projects
            </div>
            {projectIds.map((pid) => (
              <div
                key={pid}
                className={`an-chip ${selectedProject === pid ? "active" : ""}`}
                onClick={() => setSelectedProject(pid)}
              >
                {pid}
              </div>
            ))}
          </div>
        )}

        {/* Stat Cards */}
        <div className="an-stats-grid">
          {overviewLoading ? (
            <>
              <div className="an-stat-card">
                <div className="an-stat-label">Visitors</div>
                <div className="an-stat-value">...</div>
              </div>
              <div className="an-stat-card">
                <div className="an-stat-label">Conv. Rate</div>
                <div className="an-stat-value">...</div>
              </div>
              <div className="an-stat-card">
                <div className="an-stat-label">Revenue</div>
                <div className="an-stat-value">...</div>
              </div>
              <div className="an-stat-card">
                <div className="an-stat-label">Orders</div>
                <div className="an-stat-value">...</div>
              </div>
            </>
          ) : overviewData ? (
            <>
              <StatCard
                label="Visitors"
                value={overviewData.visitors.current}
                change={overviewData.visitors.change}
              />
              <StatCard
                label="Conv. Rate"
                value={overviewData.conversion_rate.current}
                change={overviewData.conversion_rate.change}
                format="percent"
              />
              <StatCard
                label="Revenue"
                value={overviewData.revenue.current}
                change={overviewData.revenue.change}
                format="currency"
              />
              <StatCard
                label="Orders"
                value={overviewData.orders.current}
                change={overviewData.orders.change}
              />
            </>
          ) : null}
        </div>

        {/* Traffic Sources */}
        <TrafficSourcesSection projectId={selectedProject} period={period} />

        {/* Conversion Funnel */}
        <FunnelSection projectId={selectedProject} period={period} />

        {/* Daily Traffic Chart */}
        <DailyChartSection projectId={selectedProject} period={period} />

        {/* Email Performance */}
        <EmailCampaignsSection projectId={selectedProject} />

        {/* Project Comparison (only when "All Projects" selected) */}
        {!selectedProject && <ProjectsComparisonSection period={period} />}

        {/* Conversion Paths */}
        <ConversionPathsSection projectId={selectedProject} period={period} />
      </div>
    </>
  )
}

export default AnalyticsPage

export const config = defineRouteConfig({
  label: "Analytics",
  rank: 4,
})
