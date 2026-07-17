import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../modules/dextrum"
import { MyStockApiClient } from "../modules/dextrum/api-client"

/**
 * Zkontroluje, které objednávky označené jako odeslané do Dextra tam SKUTEČNĚ jsou.
 *
 * PROČ: mySTOCK umí odpovědět 200 OK, a přesto objednávku nevytvořit (neznámý kód
 * zboží, chybějící metoda dopravy). Do 17. 7. 2026 se v takovém případě zapsalo
 * delivery_status = "IMPORTED" s mystock_order_id = null — v adminu svítilo
 * „odesláno", ve skladu nebylo nic. Commit a603a257 tomu do budoucna brání,
 * ale objednávky odeslané PŘED ním můžou být takhle rozbité.
 *
 * CO DĚLÁ:
 *   1. Projde dextrum_order_map
 *   2. mystock_order_id == null + IMPORTED  → TICHÉ SELHÁNÍ (nikdy nevzniklo)
 *   3. mystock_order_id != null             → doptá se Dextra: existuje tam?
 *
 * Read-only — nic nemění, jen čte a vypisuje.
 *
 * Spuštění:
 *   pnpm medusa exec ./src/scripts/check-dextrum-orders.ts
 *   pnpm medusa exec ./src/scripts/check-dextrum-orders.ts -- --project=engedd-el
 *   pnpm medusa exec ./src/scripts/check-dextrum-orders.ts -- --limit=500 --verify
 *
 * Bez --verify se Dextra neptá (rychlé, jen z DB). S --verify ověří každou
 * objednávku dotazem do skladu (pomalejší, ale jistota).
 */

export default async function checkDextrumOrders({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const dextrumService = container.resolve(DEXTRUM_MODULE) as any

  const argv = args || []
  const getArg = (name: string, fallback?: string) => {
    const hit = argv.find((a: string) => a.startsWith(`--${name}=`))
    return hit ? hit.split("=")[1] : fallback
  }
  const project = getArg("project")
  const limit = parseInt(getArg("limit", "200") as string, 10)
  const verify = argv.includes("--verify")

  logger.info(
    `[Dextrum Check] Start — projekt=${project || "vše"}, limit=${limit}, ` +
    `ověření v Dextru=${verify ? "ANO" : "ne (jen DB)"}`
  )

  // ── Načti order mapy ──────────────────────────────────────────────────
  const filter: any = {}
  if (project) filter.project_code = project
  const maps = await dextrumService.listDextrumOrderMaps(filter, {
    take: limit,
    order: { sent_to_wms_at: "DESC" },
  })
  logger.info(`[Dextrum Check] Nalezeno ${maps.length} záznamů`)

  if (!maps.length) {
    logger.info("[Dextrum Check] Nic ke kontrole.")
    return
  }

  // ── Klient na ověření v Dextru ────────────────────────────────────────
  let client: MyStockApiClient | null = null
  if (verify) {
    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
    const config = configs[0]
    if (!config) {
      logger.error("[Dextrum Check] Chybí konfigurace Dextra — nemůžu ověřovat, končím.")
      return
    }
    client = new MyStockApiClient({
      apiUrl: config.api_url,
      username: config.api_username,
      password: config.api_password,
    })
  }

  // ── Roztřiď ───────────────────────────────────────────────────────────
  const silentFail: any[] = []   // označeno odesláno, ale mystock_order_id chybí
  const neverSent: any[] = []    // nikdy neodesláno
  const inDextrum: any[] = []    // ověřeno, že v Dextru je
  const missing: any[] = []      // má ID, ale Dextrum ji nezná
  const unverified: any[] = []   // má ID, neověřováno

  for (const m of maps) {
    const sent = !!m.sent_to_wms_at
    const hasId = !!m.mystock_order_id

    if (!sent && !hasId) {
      neverSent.push(m)
      continue
    }
    if (!hasId) {
      silentFail.push(m)
      continue
    }
    if (!verify || !client) {
      unverified.push(m)
      continue
    }
    try {
      const remote = await client.getOrder(m.mystock_order_id)
      if (remote) inDextrum.push({ ...m, _remote: remote })
      else missing.push(m)
    } catch (err: any) {
      // 404 = ve skladu není; cokoli jiného = problém spojení, nehádej
      const notFound = /404|not found/i.test(err.message || "")
      if (notFound) missing.push({ ...m, _err: err.message })
      else {
        logger.warn(`[Dextrum Check] ${m.mystock_order_code}: chyba dotazu → ${err.message}`)
        unverified.push(m)
      }
    }
  }

  // ── Výpis ─────────────────────────────────────────────────────────────
  const line = (m: any) =>
    `    ${String(m.mystock_order_code).padEnd(18)} ${String(m.project_code || "?").padEnd(16)} ` +
    `${String(m.delivery_status).padEnd(12)} id=${m.mystock_order_id || "—"} ` +
    `odesláno=${m.sent_to_wms_at || "—"}${m.last_error ? ` chyba=${String(m.last_error).slice(0, 60)}` : ""}`

  logger.info("")
  logger.info("═".repeat(100))

  if (silentFail.length) {
    logger.error(`🔴 TICHÉ SELHÁNÍ — tváří se jako odeslané, ale v Dextru NIKDY nevznikly (${silentFail.length}):`)
    silentFail.forEach((m) => logger.error(line(m)))
    logger.error("   → potřebují přeposlat")
  } else {
    logger.info("🟢 Žádné tiché selhání — každá odeslaná objednávka má ID z Dextra")
  }

  if (verify && missing.length) {
    logger.error("")
    logger.error(`🔴 MAJÍ ID, ALE DEXTRUM JE NEZNÁ (${missing.length}):`)
    missing.forEach((m) => logger.error(line(m)))
  }

  if (neverSent.length) {
    logger.info("")
    logger.warn(`🟡 NIKDY NEODESLÁNO (${neverSent.length}) — čekají, nebo je něco blokuje:`)
    neverSent.forEach((m) => logger.warn(line(m)))
  }

  if (verify && inDextrum.length) {
    logger.info("")
    logger.info(`🟢 OVĚŘENO V DEXTRU (${inDextrum.length})`)
  }
  if (unverified.length) {
    logger.info("")
    logger.info(
      `⚪ MÁ ID Z DEXTRA, NEOVĚŘOVÁNO (${unverified.length})` +
      (verify ? " — dotaz selhal, viz varování výš" : " — spusť s --verify pro jistotu")
    )
  }

  logger.info("")
  logger.info("═".repeat(100))
  logger.info(
    `SOUHRN: celkem ${maps.length} | tiché selhání ${silentFail.length} | ` +
    `chybí v Dextru ${missing.length} | nikdy neodesláno ${neverSent.length} | ` +
    `ověřeno ${inDextrum.length} | neověřeno ${unverified.length}`
  )
}
