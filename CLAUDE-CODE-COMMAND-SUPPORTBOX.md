# Claude Code Command — SupportBox Customer Support Module

## Příkaz (zkopíruj a vlož do Claude Code):

```
Implementuj kompletní SupportBox modul pro zákaznickou podporu podle souboru SUPPORTBOX-IMPLEMENTATION.md v root adresáři projektu.

DŮLEŽITÉ INSTRUKCE:

1. PRACUJ NA STAGING BRANCHI. Ověř: git checkout staging && git pull origin staging

2. PŘEČTI SI CELÝ SOUBOR SUPPORTBOX-IMPLEMENTATION.md — obsahuje 18 sekcí, kompletní TypeScript kód. NEIMPROVIZUJ — použij přesně kód z dokumentu.

3. POŘADÍ IMPLEMENTACE (dodržuj striktně):

   FÁZE 1 — Data Model + Module Service:
   - Vytvoř backend/src/modules/supportbox/models/supportbox-config.ts
   - Vytvoř backend/src/modules/supportbox/models/supportbox-ticket.ts (status enum: "new", "solved", "old" + pole solved_at)
   - Vytvoř backend/src/modules/supportbox/models/supportbox-message.ts
   - Vytvoř backend/src/modules/supportbox/service.ts (včetně metody archiveOldTickets pro auto-archivaci po 30 dnech)
   - Vytvoř backend/src/modules/supportbox/index.ts
   - Vytvoř migraci pro všechny 3 tabulky (status ENUM musí obsahovat 'new', 'solved', 'old' + sloupec solved_at)

   FÁZE 2 — Backend Services:
   - Vytvoř backend/src/services/resend-email.service.ts (odesílání emailů přes Resend API)
   - Vytvoř backend/src/services/order-matcher.service.ts (automatické párování emailu s objednávkou)

   FÁZE 3 — API Routes:
   - Vytvoř backend/src/api/admin/supportbox/configs/route.ts (GET, POST)
   - Vytvoř backend/src/api/admin/supportbox/configs/[id]/route.ts (PUT, DELETE)
   - Vytvoř backend/src/api/admin/supportbox/tickets/route.ts (GET — list s filtry)
   - Vytvoř backend/src/api/admin/supportbox/tickets/[id]/route.ts (GET — detail s messages + order)
   - Vytvoř backend/src/api/admin/supportbox/tickets/[id]/reply/route.ts (POST — odeslání odpovědi přes Resend S CELOU HISTORIÍ KONVERZACE v emailu)
   - Vytvoř backend/src/api/admin/supportbox/tickets/[id]/solve/route.ts (POST — mark as solved, uloží solved_at)
   - Vytvoř backend/src/api/admin/supportbox/tickets/[id]/reopen/route.ts (POST — reopen, resetuje solved_at na null)
   - Vytvoř backend/src/api/webhooks/supportbox/inbound/route.ts (POST — příjem příchozích emailů)

   FÁZE 4 — Admin UI:
   - Vytvoř backend/src/admin/routes/supportbox/page.tsx (hlavní dashboard — inbox list + ticket tabulka)
     - Taby: All, New, Solved, Old
     - Badge barvy: new=green, solved=grey, old=orange
   - Vytvoř backend/src/admin/routes/supportbox/[id]/page.tsx (ticket detail — konverzace + reply + order sidebar)
     - Přidej tlačítko "Copy Thread for AI" — zkopíruje celou konverzaci jako plain text do schránky
     - Reply route posílá email S KOMPLETNÍ HISTORIÍ celé konverzace (zákazník vidí co jsme si psali)
   - Vytvoř backend/src/admin/routes/supportbox/settings/page.tsx (správa emailových účtů)
   - Vytvoř backend/src/admin/hooks/use-supportbox.ts (React Query hooks)

   FÁZE 5 — Scheduled Jobs + Registration:
   - Vytvoř backend/src/jobs/supportbox-archive-job.ts (cron: 0 3 * * * — denně ve 3:00 přesune solved tickety starší 30 dní do "old")
   - Uprav backend/medusa-config.js — zaregistruj supportbox modul

4. DESIGN SYSTÉM — použij PŘESNĚ stejný design jako existující stránky:
   - Šířka dashboardu: 1400px (stejně jako custom-orders)
   - Šířka settings: 800px (stejně jako dextrum)
   - Barvy: #008060 (primary), #1A1A1A (text), #6D7175 (secondary), #E1E3E5 (border), #F6F6F7 (bg)
   - Karty: white bg, 1px solid #E1E3E5, border-radius 10px
   - Font: -apple-system, 13px pro běžný text
   - CSS třídy: od-card, od-btn, od-btn-primary pro hover efekty
   - Animace: fadeIn keyframe, 0.15s ease transitions
   - Ikony: @medusajs/icons
   - Toasty: toast from @medusajs/ui
   - Data: @tanstack/react-query, sdk from ../../lib/sdk

5. KLÍČOVÁ PRAVIDLA:
   - Emaily se odesílají POUZE přes Resend API (POST https://api.resend.com/emails)
   - Resend API klíč se ukládá per emailový účet v supportbox_config
   - Příchozí emaily přicházejí přes webhook POST /webhooks/supportbox/inbound
   - Automatické párování objednávek: hledej v Medusa orders podle from_email
   - Statusy ticketů: "new" (zelený badge), "solved" (šedý badge), "old" (oranžový badge)
   - Konverzace: inbound zprávy vlevo (šedé pozadí), outbound vpravo (zelenkavé pozadí)
   - Sidebar v ticket detailu: Customer info + Order info (pokud nalezena objednávka)
   - KAŽDÁ odeslaná odpověď MUSÍ obsahovat kompletní historii konverzace ve spodní části emailu
   - Tlačítko "Copy Thread for AI" kopíruje celý thread jako plain text do clipboardu
   - Solved tickety se po 30 dnech automaticky přesunou do statusu "old" (scheduled job denně ve 3:00)

6. PO DOKONČENÍ:
   - Spusť: pnpm build v backend/
   - Oprav TypeScript chyby
   - Commitni: git add . && git commit -m 'feat: SupportBox — customer support with email management, auto order matching, thread history, auto-archive, Resend integration' && git push origin staging
```
