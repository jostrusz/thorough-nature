import fs from "fs"
import path from "path"

export interface ProjectConfig {
  slug: string
  name: string
  domain: string
  locale: string
  defaultCountry: string
  salesChannelName: string
  medusaUrl: string
  publishableApiKey: string
  facebookPixelId: string
  regions: Record<string, string>
  mainProduct: {
    name: string
    handle: string
    variantId: string
    price: number
    currency: string
    thumbnail: string
  }
  upsellProduct: {
    name: string
    handle: string
    variantId: string
    price: number
    originalPrice: number
    currency: string
  }
  bundleOptions: Array<{ qty: number; price: number; label: string; save?: number; savings?: number; originalPrice?: number; sublabel?: string; badge?: string }>
  paymentProviders: Record<string, string>
  pages: Record<string, string>
}

const projectsBySlug = new Map<string, ProjectConfig>()
const projectsByDomain = new Map<string, ProjectConfig>()
let loaded = false

function loadProjects() {
  if (loaded) return

  const projectsDir = path.join(process.cwd(), "src", "projects")
  if (!fs.existsSync(projectsDir)) {
    loaded = true
    return
  }

  const dirs = fs.readdirSync(projectsDir, { withFileTypes: true }).filter((d) => d.isDirectory())

  for (const dir of dirs) {
    const configPath = path.join(projectsDir, dir.name, "config.json")
    if (fs.existsSync(configPath)) {
      const config: ProjectConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"))
      if (!config.medusaUrl) {
        config.medusaUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
      }
      if (!config.publishableApiKey) {
        config.publishableApiKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
      }
      projectsBySlug.set(config.slug, config)
      if (config.domain) {
        projectsByDomain.set(config.domain.replace(/^www\./, ""), config)
      }
      // Register domain aliases (e.g. de-hondenbijbel.nl → dehondenbijbel)
      const aliases = (config as any).domainAliases as string[] | undefined
      if (aliases && Array.isArray(aliases)) {
        for (const alias of aliases) {
          projectsByDomain.set(alias.replace(/^www\./, ""), config)
        }
      }
    }
  }

  loaded = true
}

export function getProjectBySlug(slug: string): ProjectConfig | undefined {
  loadProjects()
  return projectsBySlug.get(slug)
}

export function getProjectByDomain(hostname: string): ProjectConfig | undefined {
  loadProjects()
  const domain = hostname.replace(/^www\./, "")
  return projectsByDomain.get(domain)
}

export function getAllProjects(): ProjectConfig[] {
  loadProjects()
  return Array.from(projectsBySlug.values())
}
