import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260301100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "digital_download" (
        "id" text not null,
        "order_id" text not null,
        "token" text not null,
        "email" text not null,
        "files" jsonb null,
        "expires_at" timestamptz not null,
        "download_count" integer not null default 0,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "digital_download_pkey" primary key ("id")
      );
    `)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_digital_download_token" ON "digital_download" ("token") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_digital_download_order_id" ON "digital_download" ("order_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_digital_download_deleted_at" ON "digital_download" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "digital_download" cascade;`)
  }
}
