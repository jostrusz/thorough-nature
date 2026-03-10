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
    const seedComgate = (await import("../../../scripts/seed-comgate-methods")).default
    await seedComgate({ container: req.scope })
    results.push("Comgate: OK")
  } catch (err: any) {
    results.push(`Comgate: skipped (${err.message})`)
    logger.warn(`[Seed API] Comgate: ${err.message}`)
  }

  // 2. COD method
  try {
    const seedCod = (await import("../../../scripts/seed-cod-method")).default
    await seedCod({ container: req.scope })
    results.push("COD: OK")
  } catch (err: any) {
    results.push(`COD: skipped (${err.message})`)
    logger.warn(`[Seed API] COD: ${err.message}`)
  }

  res.json({ success: true, results })
}
