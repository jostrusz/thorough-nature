import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260720150000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "ad_variant" (
      "id" text not null,
      "creative_id" text not null,
      "format" text not null,
      "variant_no" integer not null,
      "url" text not null,
      "model_id" text null,
      "mode" text null,
      "prompt" text null,
      "is_official" boolean not null default false,
      "metadata" jsonb null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "ad_variant_pkey" primary key ("id")
    );`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ad_variant_deleted_at" ON "ad_variant" ("deleted_at") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ad_variant_creative" ON "ad_variant" ("creative_id") WHERE deleted_at IS NULL;`)

    this.addSql(`create table if not exists "ad_localization_job" (
      "id" text not null,
      "source_creative_id" text not null,
      "target_project" text not null,
      "status" text not null default 'queued',
      "steps" jsonb null,
      "params" jsonb null,
      "result_creative_id" text null,
      "error" text null,
      "metadata" jsonb null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "ad_localization_job_pkey" primary key ("id")
    );`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ad_loc_job_deleted_at" ON "ad_localization_job" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ad_variant" cascade;`)
    this.addSql(`drop table if exists "ad_localization_job" cascade;`)
  }
}
