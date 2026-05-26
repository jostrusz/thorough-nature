import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260526120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "brite_bank_logo" (
      "id" text not null,
      "country" text not null,
      "locale" text not null,
      "bank_id" text not null,
      "name" text not null,
      "logo_url" text not null,
      "sort_order" integer not null default 0,
      "is_active" boolean not null default true,
      "metadata" jsonb null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "brite_bank_logo_pkey" primary key ("id")
    );`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_brite_bank_logo_country" ON "brite_bank_logo" ("country") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_brite_bank_logo_locale" ON "brite_bank_logo" ("locale") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_brite_bank_logo_deleted_at" ON "brite_bank_logo" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "brite_bank_logo" cascade;`)
  }
}
