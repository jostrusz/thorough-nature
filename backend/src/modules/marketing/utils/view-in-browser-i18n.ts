/**
 * "View in browser" fallback translations.
 *
 * Injected into campaign HTML via template placeholders:
 *   {{ view_in_browser_text }}   → "Kun je deze mail niet goed lezen?"
 *   {{ view_in_browser_label }}  → "Bekijk in je browser"
 *   {{ view_in_browser_url }}    → brand storefront URL (or # if unknown)
 *
 * Keyed by 2-letter ISO 639-1 code (matches `marketing_brand.locale`).
 * Unknown locales fall back to English.
 */

export type ViewInBrowserStrings = {
  text: string
  label: string
}

const TRANSLATIONS: Record<string, ViewInBrowserStrings> = {
  nl: { text: "Kun je deze mail niet goed lezen?", label: "Bekijk in je browser" },
  de: { text: "Kannst du diese E-Mail nicht richtig lesen?", label: "Im Browser ansehen" },
  pl: { text: "Nie możesz poprawnie przeczytać tego e-maila?", label: "Zobacz w przeglądarce" },
  sv: { text: "Kan du inte läsa detta e-postmeddelande ordentligt?", label: "Visa i webbläsaren" },
  cs: { text: "Nemůžete si e-mail správně zobrazit?", label: "Zobrazit v prohlížeči" },
  sk: { text: "Nemôžete si e-mail správne zobraziť?", label: "Zobraziť v prehliadači" },
  hu: { text: "Nem látszik jól az e-mail?", label: "Megtekintés a böngészőben" },
  en: { text: "Can't read this email properly?", label: "View in browser" },
}

export function getViewInBrowserStrings(locale: string | null | undefined): ViewInBrowserStrings {
  if (!locale) return TRANSLATIONS.en
  const code = String(locale).toLowerCase().slice(0, 2)
  return TRANSLATIONS[code] ?? TRANSLATIONS.en
}
