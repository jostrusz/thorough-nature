// @ts-nocheck
/**
 * Railway custom-domain reader for the presale domain picker.
 *
 * Reads the Storefront service's custom domains straight from Railway's GraphQL
 * API, so presale pages can be created on ANY connected domain — fully
 * independent of the profitability module's project_config. Result is cached
 * in-memory (10 min) and never throws: on any failure it returns the last good
 * cache, or an empty list, so callers can fall back gracefully.
 *
 * Domains are always returned WITH the `www.` prefix (Railway stores them that
 * way and that's the canonical serving host). The serving layer normalises
 * away `www.` on both sides, so presale pages are stored on the bare domain.
 *
 * Auth: project-scoped token via the `Project-Access-Token` header
 *   (env RAILWAY_PRESALE_TOKEN). IDs default to the thorough-nature production
 *   Storefront service but can be overridden via env.
 */

const RAILWAY_GQL = "https://backboard.railway.app/graphql/v2"
const PROJECT_ID =
  process.env.RAILWAY_PRESALE_PROJECT_ID || "9d7e8516-91b9-46a1-9bd9-66e4ab1da096"
const ENV_ID =
  process.env.RAILWAY_PRESALE_ENV_ID || "ec0e71d0-68bf-42b0-93a1-b2e36e9203a6"
// Both storefront services carry customer-facing custom domains (Storefront +
// Storefront-2, e.g. www.knihyzosrdca.sk lives on Storefront-2). Comma-separated
// env override, defaults to both production services.
const SERVICE_IDS = (
  process.env.RAILWAY_PRESALE_STOREFRONT_SERVICE_ID ||
  "2fdea638-c253-4996-af5c-b1fa5e98471b,11998e87-ec96-41cf-8ddd-d525d2b5a84a"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
const TOKEN = process.env.RAILWAY_PRESALE_TOKEN || ""
const TTL_MS = 10 * 60 * 1000

let _cache: { at: number; domains: string[] } | null = null

/** Strip protocol / leading www / trailing slash, lowercase. */
export function bareDomain(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .trim()
}

/** Always-www form of a domain (per project convention). "" if empty. */
export function toWww(raw: string): string {
  const b = bareDomain(raw)
  return b ? `www.${b}` : ""
}

async function fetchRailwayDomains(): Promise<string[]> {
  if (!TOKEN) return []
  const query =
    "query($p:String!,$e:String!,$s:String!){ domains(projectId:$p, environmentId:$e, serviceId:$s){ customDomains{ domain } } }"
  const results = await Promise.all(
    SERVICE_IDS.map(async (serviceId) => {
      const resp = await fetch(RAILWAY_GQL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Project-Access-Token": TOKEN,
        },
        body: JSON.stringify({
          query,
          variables: { p: PROJECT_ID, e: ENV_ID, s: serviceId },
        }),
      })
      if (!resp.ok) throw new Error(`railway graphql ${resp.status}`)
      const json: any = await resp.json()
      if (json?.errors?.length) {
        throw new Error(`railway graphql: ${JSON.stringify(json.errors[0]?.message)}`)
      }
      const cds = json?.data?.domains?.customDomains || []
      return cds.map((c: any) => c?.domain).filter(Boolean) as string[]
    })
  )
  return results.flat()
}

/**
 * Connected custom domains (www-prefixed, deduped, sorted). Cached 10 min.
 * Returns the last good cache (or []) on any failure — never throws.
 */
export async function getRailwayDomains(): Promise<string[]> {
  if (_cache && Date.now() - _cache.at < TTL_MS) return _cache.domains
  try {
    const raw = await fetchRailwayDomains()
    const set = new Set<string>()
    for (const d of raw) {
      const w = toWww(d)
      if (w) set.add(w)
    }
    const domains = [...set].sort()
    _cache = { at: Date.now(), domains }
    return domains
  } catch {
    return _cache?.domains || []
  }
}

/** True if `domain` (any www/bare form) is a connected Railway custom domain. */
export async function isRailwayPresaleDomain(domain: string): Promise<boolean> {
  const target = bareDomain(domain)
  if (!target) return false
  const list = await getRailwayDomains()
  return list.some((w) => bareDomain(w) === target)
}
