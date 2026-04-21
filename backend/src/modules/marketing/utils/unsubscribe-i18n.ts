/**
 * Unsubscribe page translations.
 *
 * Keyed by 2-letter ISO 639-1 code (matches `marketing_brand.locale`).
 * Unknown locales fall back to "en".
 */

export type UnsubLocale = "cs" | "sk" | "hu" | "nl" | "de" | "pl" | "sv" | "en"

export type UnsubStrings = {
  page_title_confirm: string
  page_title_success: string
  page_title_error: string
  heading_confirm: string
  heading_success: string
  body_confirm: string
  body_success: (email: string) => string
  body_error: string
  button_confirm: string
  text_unsubscribed: string
}

const TRANSLATIONS: Record<UnsubLocale, UnsubStrings> = {
  en: {
    page_title_confirm: "Unsubscribe",
    page_title_success: "Unsubscribed",
    page_title_error: "Unsubscribe error",
    heading_confirm: "Unsubscribe from emails",
    heading_success: "You have been unsubscribed.",
    body_confirm: "Click the button below to confirm you want to stop receiving emails.",
    body_success: (email) =>
      `${email} will no longer receive marketing emails from us. If this was a mistake, just reply to any previous email to let us know.`,
    body_error:
      "This unsubscribe link is no longer valid. If you want to stop receiving emails, please reply to any previous message and we'll remove you manually.",
    button_confirm: "Confirm unsubscribe",
    text_unsubscribed: "Unsubscribed",
  },
  cs: {
    page_title_confirm: "Odhlášení z odběru",
    page_title_success: "Odhlášeno",
    page_title_error: "Chyba odhlášení",
    heading_confirm: "Odhlásit se z odběru e-mailů",
    heading_success: "Byli jste odhlášeni.",
    body_confirm: "Kliknutím na tlačítko níže potvrdíte, že si již nepřejete dostávat e-maily.",
    body_success: (email) =>
      `${email} již od nás nebude dostávat marketingové e-maily. Pokud se jedná o omyl, stačí odpovědět na kterýkoli předchozí e-mail a dáte nám vědět.`,
    body_error:
      "Tento odhlašovací odkaz již není platný. Pokud si přejete přestat dostávat e-maily, odpovězte prosím na kteroukoli předchozí zprávu a my vás odhlásíme ručně.",
    button_confirm: "Potvrdit odhlášení",
    text_unsubscribed: "Odhlášeno",
  },
  sk: {
    page_title_confirm: "Odhlásenie z odberu",
    page_title_success: "Odhlásené",
    page_title_error: "Chyba odhlásenia",
    heading_confirm: "Odhlásiť sa z odberu e-mailov",
    heading_success: "Boli ste odhlásení.",
    body_confirm: "Kliknutím na tlačidlo nižšie potvrdíte, že si už neželáte dostávať e-maily.",
    body_success: (email) =>
      `${email} už od nás nebude dostávať marketingové e-maily. Ak ide o omyl, stačí odpovedať na ktorýkoľvek predchádzajúci e-mail a dáte nám vedieť.`,
    body_error:
      "Tento odhlasovací odkaz už nie je platný. Ak si želáte prestať dostávať e-maily, odpovedzte prosím na ktorúkoľvek predchádzajúcu správu a my vás odhlásime ručne.",
    button_confirm: "Potvrdiť odhlásenie",
    text_unsubscribed: "Odhlásené",
  },
  hu: {
    page_title_confirm: "Leiratkozás",
    page_title_success: "Leiratkozva",
    page_title_error: "Leiratkozási hiba",
    heading_confirm: "Leiratkozás az e-mailekről",
    heading_success: "Sikeresen leiratkozott.",
    body_confirm: "Kattintson az alábbi gombra annak megerősítéséhez, hogy nem szeretne több e-mailt kapni.",
    body_success: (email) =>
      `A(z) ${email} címre többé nem küldünk marketing e-maileket. Ha ez tévedés volt, válaszoljon bármelyik korábbi e-mailünkre, és jelezze nekünk.`,
    body_error:
      "Ez a leiratkozási link már nem érvényes. Ha le szeretne iratkozni, kérjük, válaszoljon bármelyik korábbi üzenetünkre, és manuálisan eltávolítjuk Önt.",
    button_confirm: "Leiratkozás megerősítése",
    text_unsubscribed: "Leiratkozva",
  },
  nl: {
    page_title_confirm: "Uitschrijven",
    page_title_success: "Uitgeschreven",
    page_title_error: "Fout bij uitschrijven",
    heading_confirm: "Uitschrijven voor e-mails",
    heading_success: "Je bent uitgeschreven.",
    body_confirm: "Klik op de knop hieronder om te bevestigen dat je geen e-mails meer wilt ontvangen.",
    body_success: (email) =>
      `${email} ontvangt geen marketing-e-mails meer van ons. Als dit per ongeluk is gebeurd, beantwoord dan een eerdere e-mail om het ons te laten weten.`,
    body_error:
      "Deze uitschrijflink is niet meer geldig. Als je geen e-mails meer wilt ontvangen, beantwoord dan een eerder bericht en wij verwijderen je handmatig.",
    button_confirm: "Uitschrijven bevestigen",
    text_unsubscribed: "Uitgeschreven",
  },
  de: {
    page_title_confirm: "Abmelden",
    page_title_success: "Abgemeldet",
    page_title_error: "Fehler beim Abmelden",
    heading_confirm: "Vom E-Mail-Versand abmelden",
    heading_success: "Du wurdest abgemeldet.",
    body_confirm: "Klicke auf die Schaltfläche unten, um zu bestätigen, dass du keine E-Mails mehr erhalten möchtest.",
    body_success: (email) =>
      `${email} erhält keine Marketing-E-Mails mehr von uns. Sollte dies ein Versehen gewesen sein, antworte einfach auf eine frühere E-Mail und gib uns Bescheid.`,
    body_error:
      "Dieser Abmeldelink ist nicht mehr gültig. Wenn du keine E-Mails mehr erhalten möchtest, antworte bitte auf eine frühere Nachricht und wir entfernen dich manuell.",
    button_confirm: "Abmeldung bestätigen",
    text_unsubscribed: "Abgemeldet",
  },
  sv: {
    page_title_confirm: "Avregistrera",
    page_title_success: "Avregistrerad",
    page_title_error: "Fel vid avregistrering",
    heading_confirm: "Avregistrera dig från e-post",
    heading_success: "Du har avregistrerats.",
    body_confirm: "Klicka på knappen nedan för att bekräfta att du inte längre vill ta emot e-post.",
    body_success: (email) =>
      `${email} kommer inte längre att få marknadsförings-e-post från oss. Om detta var ett misstag, svara bara på något tidigare e-postmeddelande så hör vi av oss.`,
    body_error:
      "Den här avregistreringslänken är inte längre giltig. Om du vill sluta få e-post, svara på något tidigare meddelande så tar vi bort dig manuellt.",
    button_confirm: "Bekräfta avregistrering",
    text_unsubscribed: "Avregistrerad",
  },
  pl: {
    page_title_confirm: "Wypisanie",
    page_title_success: "Wypisano",
    page_title_error: "Błąd wypisania",
    heading_confirm: "Wypisz się z e-maili",
    heading_success: "Zostałeś wypisany.",
    body_confirm: "Kliknij przycisk poniżej, aby potwierdzić, że nie chcesz już otrzymywać e-maili.",
    body_success: (email) =>
      `${email} nie będzie już otrzymywać od nas marketingowych e-maili. Jeśli to pomyłka, odpowiedz na dowolny poprzedni e-mail, a damy znać.`,
    body_error:
      "Ten link do wypisania nie jest już ważny. Jeśli chcesz przestać otrzymywać e-maile, odpowiedz na dowolną poprzednią wiadomość, a usuniemy Cię ręcznie.",
    button_confirm: "Potwierdź wypisanie",
    text_unsubscribed: "Wypisano",
  },
}

/**
 * Normalize a brand locale string to a supported code.
 * Accepts forms like "cs", "cs-CZ", "CS_CZ", returns "cs" or fallback "en".
 */
export function resolveLocale(input: string | null | undefined): UnsubLocale {
  if (!input) return "en"
  const code = String(input).toLowerCase().slice(0, 2)
  if (code in TRANSLATIONS) return code as UnsubLocale
  return "en"
}

export function getStrings(locale: string | null | undefined): UnsubStrings {
  return TRANSLATIONS[resolveLocale(locale)]
}
