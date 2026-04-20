import { MedusaService } from "@medusajs/framework/utils"

/**
 * Minimal service — the payment_journey_log table is append-only telemetry
 * and we never need full MedusaService CRUD on it. We write via raw pg
 * (see utils/log.ts) so the service itself is intentionally empty. It
 * exists only so Medusa picks up the migration folder on `db:migrate`.
 */
class PaymentDebugService extends MedusaService({}) {}

export default PaymentDebugService
