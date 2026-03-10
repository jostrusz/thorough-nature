// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * POST /admin/seed-payment-methods
 * Runs all payment method seeds (idempotent — safe to call multiple times).
 * Replaces the need for Custom Start Command on Railway.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve("logger")
  const results: string[] = []

  // 1. Comgate methods
  try {
    const mod1 = await import("../../../scripts/seed-comgate-methods.js")
    const seedComgate = mod1.default?.default || mod1.default || mod1
    await seedComgate({ container: req.scope })
    results.push("Comgate: OK")
  } catch (err: any) {
    results.push(`Comgate: skipped (${err.message})`)
    logger.warn(`[Seed API] Comgate: ${err.message}`)
  }

  // 2. COD method
  try {
    const mod2 = await import("../../../scripts/seed-cod-method.js")
    const seedCod = mod2.default?.default || mod2.default || mod2
    await seedCod({ container: req.scope })
    results.push("COD: OK")
  } catch (err: any) {
    results.push(`COD: skipped (${err.message})`)
    logger.warn(`[Seed API] COD: ${err.message}`)
  }

  res.json({ success: true, results })
}
