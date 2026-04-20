import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * marketing_contact — add structured address + company fields.
 *
 * Previously these had to live in `properties` JSON. Promoting them to
 * top-level columns enables fast per-column filtering, segmentation
 * (e.g. "city = Amsterdam"), and column-based CSV import mapping.
 *
 * All columns nullable — existing rows keep working.
 */
export class Migration20260420000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "marketing_contact" add column if not exists "address_line1" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "city" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "postal_code" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "company" text null;`)

    this.addSql(`create index if not exists "IDX_marketing_contact_city" on "marketing_contact" ("brand_id", "city") where "deleted_at" is null and "city" is not null;`)
    this.addSql(`create index if not exists "IDX_marketing_contact_postal_code" on "marketing_contact" ("brand_id", "postal_code") where "deleted_at" is null and "postal_code" is not null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "marketing_contact" drop column if exists "address_line1";`)
    this.addSql(`alter table "marketing_contact" drop column if exists "city";`)
    this.addSql(`alter table "marketing_contact" drop column if exists "postal_code";`)
    this.addSql(`alter table "marketing_contact" drop column if exists "company";`)
  }
}
