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
  no: {
    orderPlaced: 'Takk for bestillingen din {id}!',
    orderPlacedPreview: 'Takk for bestillingen din!',
    shipmentSent: 'Bestillingen din {id} er sendt! 📦',
    shipmentPreview: 'Bestillingen din er sendt!',
  },
  hu: {
    orderPlaced: 'Köszönjük a rendelésed ({id})!',
    orderPlacedPreview: 'Köszönjük a rendelésed!',
    shipmentSent: 'A rendelésed ({id}) elindult! 📦',
    shipmentPreview: 'A rendelésed elindult!',
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
  'slipp-taket': {
    replyTo: 'bok@slipptaketboken.no',
    fromName: 'Slipp taket på det som ødelegger deg',
    fromEmail: 'Slipp taket på det som ødelegger deg <bok@slipptaketboken.no>',
    project: 'slipp-taket',
    locale: 'no',
    smsDispatchTemplate: 'Slipp taket pa det som odelegger deg: Bestillingen din er pa vei. Sporing: {url} bok@slipptaketboken.no',
  },
  // Also match without hyphen (fallback)
  slipptaket: {
    replyTo: 'bok@slipptaketboken.no',
    fromName: 'Slipp taket på det som ødelegger deg',
    fromEmail: 'Slipp taket på det som ødelegger deg <bok@slipptaketboken.no>',
    project: 'slipp-taket',
    locale: 'no',
    smsDispatchTemplate: 'Slipp taket pa det som odelegger deg: Bestillingen din er pa vei. Sporing: {url} bok@slipptaketboken.no',
  },
  'slapp-taget': {
    replyTo: 'hej@slapptagetboken.se',
    fromName: 'Släpp Taget',
    fromEmail: 'Släpp Taget <hej@slapptagetboken.se>',
    project: 'slapp-taget',
    locale: 'sv',
    smsDispatchTemplate: 'Slapp taget om det som forstor dig: Din bestallning ar pa vag. Spara: {url} hej@slapptagetboken.se',
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
    smsDispatchTemplate: 'Slapp taget om det som forstor dig: Din bestallning ar pa vag. Spara: {url} hej@slapptagetboken.se',
  },
  'lass-los': {
    replyTo: 'buch@jetztloslassen.de',
    fromName: 'Joris de Vries - Lass los, was dich kaputt macht',
    fromEmail: 'Joris de Vries - Lass los, was dich kaputt macht <buch@jetztloslassen.de>',
    project: 'lass-los',
    locale: 'de',
    smsDispatchTemplate: 'Lass los, was dich kaputt macht: Bestellung versandt. Sendungsverfolgung: {url} buch@jetztloslassen.de',
  },
  // Also match without hyphen (fallback)
  lasslos: {
    replyTo: 'buch@jetztloslassen.de',
    fromName: 'Joris de Vries - Lass los, was dich kaputt macht',
    fromEmail: 'Joris de Vries - Lass los, was dich kaputt macht <buch@jetztloslassen.de>',
    project: 'lass-los',
    locale: 'de',
    smsDispatchTemplate: 'Lass los, was dich kaputt macht: Bestellung versandt. Sendungsverfolgung: {url} buch@jetztloslassen.de',
  },
  'psi-superzivot': {
    replyTo: 'podpora@psi-superzivot.cz',
    fromName: 'Lars Vermeulen - Psí superživot',
    fromEmail: 'Lars Vermeulen - Psí superživot <podpora@psi-superzivot.cz>',
    project: 'psi-superzivot',
    locale: 'cs',
    smsDispatchTemplate: 'Psi superzivot: Zasilka odeslana. Sledovaci odkaz: {url} podpora@psi-superzivot.cz',
  },
  'kocici-bible': {
    replyTo: 'peterka@kocicibible.cz',
    fromName: 'Michal Peterka - Kočičí bible',
    fromEmail: 'Michal Peterka - Kočičí bible <peterka@kocicibible.cz>',
    project: 'kocici-bible',
    locale: 'cs',
    smsDispatchTemplate: 'Kocici bible: Zasilka odeslana. Sledovaci odkaz: {url} peterka@kocicibible.cz',
  },
  // Also match without hyphen
  kocicibible: {
    replyTo: 'peterka@kocicibible.cz',
    fromName: 'Michal Peterka - Kočičí bible',
    fromEmail: 'Michal Peterka - Kočičí bible <peterka@kocicibible.cz>',
    project: 'kocici-bible',
    locale: 'cs',
    smsDispatchTemplate: 'Kocici bible: Zasilka odeslana. Sledovaci odkaz: {url} peterka@kocicibible.cz',
  },
  'odpust-knizka': {
    replyTo: 'podpora@pusttocotenici.cz',
    fromName: 'Joris de Vries - Pusť to, co tě ničí',
    fromEmail: 'Joris de Vries - Pusť to, co tě ničí <podpora@pusttocotenici.cz>',
    project: 'odpust-knizka',
    locale: 'cs',
    smsDispatchTemplate: 'Pust to, co te nici: Zasilka odeslana. Sledovaci odkaz: {url} podpora@pusttocotenici.cz',
  },
  // Also match without hyphen
  odpustknizka: {
    replyTo: 'podpora@pusttocotenici.cz',
    fromName: 'Joris de Vries - Pusť to, co tě ničí',
    fromEmail: 'Joris de Vries - Pusť to, co tě ničí <podpora@pusttocotenici.cz>',
    project: 'odpust-knizka',
    locale: 'cs',
    smsDispatchTemplate: 'Pust to, co te nici: Zasilka odeslana. Sledovaci odkaz: {url} podpora@pusttocotenici.cz',
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
  'het-leven': {
    replyTo: 'annadevries@pakjeleventerug.nl',
    fromName: 'Het Leven Dat Je Verdient',
    fromEmail: 'Het Leven Dat Je Verdient <annadevries@pakjeleventerug.nl>',
    project: 'het-leven',
    smsDispatchTemplate: 'Het Leven Dat Je Verdient: je boek is onderweg. Track: {url} Vragen? annadevries@pakjeleventerug.nl',
  },
  'zycie-zaslugy': {
    replyTo: 'anna@najpierw-ja.pl',
    fromName: 'Anna de Vries — Życie, jakiego nigdy sobie nie pozwoliłaś',
    fromEmail: 'Anna de Vries <anna@najpierw-ja.pl>',
    project: 'zycie-zaslugy',
    locale: 'pl',
    smsDispatchTemplate: 'Zycie, jakiego nigdy sobie nie pozwolilas: Twoje zamowienie zostalo wyslane. Sledzenie: {url} anna@najpierw-ja.pl',
  },
  // Also match without hyphen
  zyciezaslugy: {
    replyTo: 'anna@najpierw-ja.pl',
    fromName: 'Anna de Vries — Życie, jakiego nigdy sobie nie pozwoliłaś',
    fromEmail: 'Anna de Vries <anna@najpierw-ja.pl>',
    project: 'zycie-zaslugy',
    locale: 'pl',
    smsDispatchTemplate: 'Zycie, jakiego nigdy sobie nie pozwolilas: Twoje zamowienie zostalo wyslane. Sledzenie: {url} anna@najpierw-ja.pl',
  },
  // Also match without hyphen
  hetleven: {
    replyTo: 'annadevries@pakjeleventerug.nl',
    fromName: 'Het Leven Dat Je Verdient',
    fromEmail: 'Het Leven Dat Je Verdient <annadevries@pakjeleventerug.nl>',
    project: 'het-leven',
    smsDispatchTemplate: 'Het Leven Dat Je Verdient: je boek is onderweg. Track: {url} Vragen? annadevries@pakjeleventerug.nl',
  },
  // PLACEHOLDER DOMAIN — replace REPLACE-DOMAIN.hu once the real domain is registered
  'engedd-el': {
    replyTo: 'info@REPLACE-DOMAIN.hu',
    fromName: 'Joris de Vries - Engedd el, ami tönkretesz',
    fromEmail: 'Joris de Vries - Engedd el, ami tönkretesz <info@REPLACE-DOMAIN.hu>',
    project: 'engedd-el',
    locale: 'hu',
    smsDispatchTemplate: 'Engedd el, ami tonkretesz: Csomagod uton van. Kovetes: {url} info@REPLACE-DOMAIN.hu',
  },
  // Also match without hyphen
  engeddel: {
    replyTo: 'info@REPLACE-DOMAIN.hu',
    fromName: 'Joris de Vries - Engedd el, ami tönkretesz',
    fromEmail: 'Joris de Vries - Engedd el, ami tönkretesz <info@REPLACE-DOMAIN.hu>',
    project: 'engedd-el',
    locale: 'hu',
    smsDispatchTemplate: 'Engedd el, ami tonkretesz: Csomagod uton van. Kovetes: {url} info@REPLACE-DOMAIN.hu',
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
  // Strip URL query params that bloat the SMS (e.g. &postalCode=12345)
  // Keep only the base tracking URL with the main match/id parameter
  let smsUrl = trackingUrl
  try {
    const u = new URL(smsUrl)
    const keysToRemove = [...u.searchParams.keys()].filter(k => k !== 'match' && k !== 'id' && k !== 'number')
    keysToRemove.forEach(k => u.searchParams.delete(k))
    smsUrl = u.toString()
  } catch { /* not a valid URL, use as-is */ }
  return config.smsDispatchTemplate.replace('{url}', smsUrl)
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
