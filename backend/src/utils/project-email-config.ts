/**
 * Project-specific email configuration.
 * Maps project_id (from order.metadata) to email sender info.
 */

export interface ProjectEmailConfig {
  /** Reply-to email address */
  replyTo: string
  /** "From" display name (used in subject prefix if needed) */
  fromName: string
  /** Full "from" header, e.g. "Brand <email@domain.com>" — overrides global RESEND_FROM_EMAIL */
  fromEmail?: string
  /** Project identifier for template resolution */
  project: string
  /** Locale code for email subjects (default: "nl") */
  locale?: string
}

/** Localized email subject strings */
const EMAIL_SUBJECTS: Record<string, Record<string, string>> = {
  nl: {
    orderPlaced: 'Bedankt voor je bestelling!',
    orderPlacedPreview: 'Bedankt voor je bestelling!',
    shipmentSent: 'Je bestelling {id} is verzonden! 📦',
    shipmentPreview: 'Je bestelling is verzonden!',
  },
  sv: {
    orderPlaced: 'Tack för din beställning!',
    orderPlacedPreview: 'Tack för din beställning!',
    shipmentSent: 'Din beställning {id} har skickats! 📦',
    shipmentPreview: 'Din beställning har skickats!',
  },
  pl: {
    orderPlaced: 'Dziękujemy za zamówienie!',
    orderPlacedPreview: 'Dziękujemy za zamówienie!',
    shipmentSent: 'Twoje zamówienie {id} zostało wysłane! 📦',
    shipmentPreview: 'Twoje zamówienie zostało wysłane!',
  },
}

/**
 * Get localized email subject for a given project config.
 */
export function getEmailSubject(
  config: ProjectEmailConfig,
  key: keyof typeof EMAIL_SUBJECTS['nl'],
  replacements?: Record<string, string>
): string {
  const locale = config.locale || 'nl'
  const strings = EMAIL_SUBJECTS[locale] || EMAIL_SUBJECTS['nl']
  let subject = strings[key] || EMAIL_SUBJECTS['nl'][key] || ''
  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      subject = subject.replace(`{${k}}`, v)
    }
  }
  return subject
}

const PROJECT_CONFIGS: Record<string, ProjectEmailConfig> = {
  dehondenbijbel: {
    replyTo: 'support@travelbible.nl',
    fromName: 'De Hondenbijbel',
    fromEmail: 'De Hondenbijbel <support@travelbible.nl>',
    project: 'dehondenbijbel',
  },
  loslatenboek: {
    replyTo: 'devries@loslatenboek.nl',
    fromName: 'Laat Los Wat Je Kapotmaakt',
    project: 'loslatenboek',
  },
  'slapp-taget': {
    replyTo: 'hej@slapptagetboken.se',
    fromName: 'Släpp Taget',
    fromEmail: 'Släpp Taget <hej@slapptagetboken.se>',
    project: 'slapp-taget',
    locale: 'sv',
  },
  'odpusc-ksiazka': {
    replyTo: 'biuro@odpusc-ksiazka.pl',
    fromName: 'Odpuść to, co cię niszczy',
    fromEmail: 'Odpuść to, co cię niszczy <biuro@odpusc-ksiazka.pl>',
    project: 'odpusc-ksiazka',
    locale: 'pl',
  },
  // Also match without hyphen (fallback)
  slapptaget: {
    replyTo: 'hej@slapptagetboken.se',
    fromName: 'Släpp Taget',
    fromEmail: 'Släpp Taget <hej@slapptagetboken.se>',
    project: 'slapp-taget',
    locale: 'sv',
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
