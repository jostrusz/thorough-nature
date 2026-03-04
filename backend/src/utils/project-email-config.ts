/**
 * Project-specific email configuration.
 * Maps project_id (from order.metadata) to email sender info.
 */

export interface ProjectEmailConfig {
  /** Reply-to email address */
  replyTo: string
  /** "From" display name (used in subject prefix if needed) */
  fromName: string
  /** Project identifier for template resolution */
  project: string
}

const PROJECT_CONFIGS: Record<string, ProjectEmailConfig> = {
  dehondenbijbel: {
    replyTo: 'support@dehondenbijbel.nl',
    fromName: 'De Hondenbijbel',
    project: 'dehondenbijbel',
  },
  loslatenboek: {
    replyTo: 'devries@loslatenboek.nl',
    fromName: 'Laat Los Wat Je Kapotmaakt',
    project: 'loslatenboek',
  },
}

/** Default config (Loslatenboek) when project_id is missing or unknown */
const DEFAULT_CONFIG: ProjectEmailConfig = PROJECT_CONFIGS.loslatenboek

/**
 * Resolve email config for a given order.
 * Reads `order.metadata.project_id` and returns the matching config.
 */
export function getProjectEmailConfig(order: any): ProjectEmailConfig {
  const projectId = order?.metadata?.project_id as string | undefined
  if (projectId && PROJECT_CONFIGS[projectId]) {
    return PROJECT_CONFIGS[projectId]
  }
  return DEFAULT_CONFIG
}
