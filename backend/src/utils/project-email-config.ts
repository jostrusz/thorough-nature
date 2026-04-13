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
  /** SMS dispatch template (GSM 03.38, ≤160 chars). Placeholders: {url}, {email} */
  smsDispatchTemplate?: string
}

/** Localized email subject strings */
const EMAIL_SUBJECTS: Record<string, Record<string, string>> = {
  nl: {
    orderPlaced: 'Bedankt voor je bestelling {id}!',
    orderPlacedPreview: 'Bedankt voor je bestelling!',
    shipmentSent: 'Je bestelling {id} is verzonden! 📦',
    shipmentPreview: 'Je bestelling is verzonden!',
  },
  sv: {
    orderPlaced: 'Tack för din beställning {id}!',
    orderPlacedPreview: 'Tack för din beställning!',
    shipmentSent: 'Din beställning {id} har skickats! 📦',
    shipmentPreview: 'Din beställning har skickats!',
  },
  pl: {
    orderPlaced: 'Dziękujemy za zamówienie {id}!',
    orderPlacedPreview: 'Dziękujemy za zamówienie!',
    shipmentSent: 'Twoje zamówienie {id} zostało wysłane! 📦',
    shipmentPreview: 'Twoje zamówienie zostało wysłane!',
  },
  cs: {
    orderPlaced: 'Děkujeme za vaši objednávku {id}!',
    orderPlacedPreview: 'Děkujeme za vaši objednávku!',
    shipmentSent: 'Vaše objednávka {id} byla odeslána! 📦',
    shipmentPreview: 'Vaše objednávka byla odeslána!',
  },
  de: {
    orderPlaced: 'Danke für deine Bestellung {id}!',
    orderPlacedPreview: 'Danke für deine Bestellung!',
    shipmentSent: 'Deine Bestellung {id} wurde versendet! 📦',
    shipmentPreview: 'Deine Bestellung wurde versendet!',
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
    replyTo: 'support@dehondenbijbel.nl',
    fromName: 'De Hondenbijbel',
    fromEmail: 'De Hondenbijbel <support@dehondenbijbel.nl>',
    project: 'dehondenbijbel',
    smsDispatchTemplate: 'De Hondenbijbel: Bestelling verzonden. Track & trace: {url} support@dehondenbijbel.nl',
  },
  loslatenboek: {
    replyTo: 'boek@loslatenboek.nl',
    fromName: 'Laat Los Wat Je Kapotmaakt',
    fromEmail: 'Laat Los Wat Je Kapotmaakt <boek@loslatenboek.nl>',
    project: 'loslatenboek',
    smsDispatchTemplate: 'Laat los wat je kapotmaakt: Bestelling verzonden. Track & trace: {url} boek@loslatenboek.nl',
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
    smsDispatchTemplate: 'Odpusc to, co cie niszczy: Zamowienie wyslane. Sledzenie: {url} biuro@odpusc-ksiazka.pl',
  },
  // Also match without hyphen (fallback)
  slapptaget: {
    replyTo: 'hej@slapptagetboken.se',
    fromName: 'Släpp Taget',
    fromEmail: 'Släpp Taget <hej@slapptagetboken.se>',
    project: 'slapp-taget',
    locale: 'sv',
  },
  'lass-los': {
    replyTo: 'buch@lasslosbuch.de',
    fromName: 'Joris de Vries - Lass los, was dich kaputt macht',
    fromEmail: 'Joris de Vries - Lass los, was dich kaputt macht <buch@lasslosbuch.de>',
    project: 'lass-los',
    locale: 'de',
    smsDispatchTemplate: 'Lass los, was dich kaputt macht: Bestellung versandt. Sendungsverfolgung: {url} buch@lasslosbuch.de',
  },
  // Also match without hyphen (fallback)
  lasslos: {
    replyTo: 'buch@lasslosbuch.de',
    fromName: 'Joris de Vries - Lass los, was dich kaputt macht',
    fromEmail: 'Joris de Vries - Lass los, was dich kaputt macht <buch@lasslosbuch.de>',
    project: 'lass-los',
    locale: 'de',
    smsDispatchTemplate: 'Lass los, was dich kaputt macht: Bestellung versandt. Sendungsverfolgung: {url} buch@lasslosbuch.de',
  },
  'psi-superzivot': {
    replyTo: 'podpora@psi-superzivot.cz',
    fromName: 'Lars Vermeulen - Psí superživot',
    fromEmail: 'Lars Vermeulen - Psí superživot <podpora@psi-superzivot.cz>',
    project: 'psi-superzivot',
    locale: 'cs',
    smsDispatchTemplate: 'Psi superzivot: Zasilka odeslana. Sledovaci odkaz: {url} podpora@psi-superzivot.cz',
  },
  // Also match without hyphen
  psisuperzivot: {
    replyTo: 'podpora@psi-superzivot.cz',
    fromName: 'Lars Vermeulen - Psí superživot',
    fromEmail: 'Lars Vermeulen - Psí superživot <podpora@psi-superzivot.cz>',
    project: 'psi-superzivot',
    locale: 'cs',
    smsDispatchTemplate: 'Psi superzivot: Zasilka odeslana. Sledovaci odkaz: {url} podpora@psi-superzivot.cz',
  },
}

/** Default config (Loslatenboek) when project_id is missing or unknown */
const DEFAULT_CONFIG: ProjectEmailConfig = PROJECT_CONFIGS.loslatenboek

/**
 * Build dispatch SMS text for a given project config and tracking URL.
 * Returns null if SMS is not configured for this project.
 */
export function buildDispatchSms(
  config: ProjectEmailConfig,
  trackingUrl: string
): string | null {
  if (!config.smsDispatchTemplate) return null
  return config.smsDispatchTemplate.replace('{url}', trackingUrl)
}

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
