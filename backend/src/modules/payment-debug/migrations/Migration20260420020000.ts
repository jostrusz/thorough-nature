import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * payment_journey_log
 * ═══════════════════
 * Per-event timeline of a customer's payment attempt — emitted from both
 * frontend (via same-origin storefront proxy, adblocker-safe) and backend
 * (Airwallex service + webhook handler). Enables forensic debugging of
 * INCOMPLETE / failed payments: we can reconstruct exactly what happened,
 * when, and where the funnel broke.
 *
 * Event types (not an enum in schema — free-form for forward compat):
 *   frontend: checkout_viewed, payment_methods_loaded,
 *             payment_method_selected, submit_clicked, payment_return
 *   backend:  airwallex_intent_created, airwallex_confirm_request,
 *             airwallex_confirm_response, airwallex_webhook_received
 *
 * Append-only. No soft-delete needed — this is telemetry.
 */
export class Migration20260420020000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "payment_journey_log" (
        "id" text not null,
        "intent_id" text null,
        "cart_id" text null,
        "email" text null,
        "project_slug" text null,
        "event_type" text not null,
        "event_data" jsonb null,
        "error_code" text null,
        "user_agent" text null,
        "referrer" text null,
        "ip_address" text null,
        "occurred_at" timestamptz not null default now(),
        "created_at" timestamptz not null default now(),
        constraint "payment_journey_log_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "IDX_pjl_intent_id" on "payment_journey_log" ("intent_id") where "intent_id" is not null;`)
    this.addSql(`create index if not exists "IDX_pjl_cart_id" on "payment_journey_log" ("cart_id") where "cart_id" is not null;`)
    this.addSql(`create index if not exists "IDX_pjl_email" on "payment_journey_log" (lower("email"), "occurred_at" desc) where "email" is not null;`)
    this.addSql(`create index if not exists "IDX_pjl_project_time" on "payment_journey_log" ("project_slug", "occurred_at" desc);`)
    this.addSql(`create index if not exists "IDX_pjl_event_time" on "payment_journey_log" ("event_type", "occurred_at" desc);`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "payment_journey_log" cascade;`)
  }
}
