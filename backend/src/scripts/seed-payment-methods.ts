// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"

/**
 * Master seed script — runs all payment method seeds (idempotent).
 * Safe to run on every deploy — skips if data already exists.
 *
 * Usage: npx medusa exec src/scripts/seed-payment-methods.ts
 *
 * This runs:
 *   1. Comgate methods (creditcard, bank_transfer, applepay, googlepay)
 *   2. COD method (dobírka / cash on delivery)
 */
export default async function seedPaymentMethods(args: ExecArgs) {
  const logger = args.container.resolve("logger")
  logger.info("[Seed All] Running all payment method seeds...")

  try {
    // 1. Comgate methods
    const seedComgate = (await import("./seed-comgate-methods")).default
    await seedComgate(args)
  } catch (err: any) {
    logger.warn(`[Seed All] Comgate seed skipped: ${err.message}`)
  }

  try {
    // 2. COD method
    const seedCod = (await import("./seed-cod-method")).default
    await seedCod(args)
  } catch (err: any) {
    logger.warn(`[Seed All] COD seed skipped: ${err.message}`)
  }

  logger.info("[Seed All] All payment method seeds completed!")
}
