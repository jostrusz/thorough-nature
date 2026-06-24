import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Per-brand tracking domain — when set, marketing email tracking links / open
 * pixel / unsubscribe use this host (e.g. "link.loslatenboek.nl") instead of the
 * global MARKETING_PUBLIC_URL, aligning link domain with the From domain for
 * better deliverability. Null = fall back to global behaviour (no change).
 */
export class Migration20260624010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "marketing_brand" add column if not exists "tracking_domain" text null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "marketing_brand" drop column if exists "tracking_domain";`)
  }
}
