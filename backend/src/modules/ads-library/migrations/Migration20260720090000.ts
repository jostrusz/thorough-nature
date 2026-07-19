import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260720090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "ad_creative" (
      "id" text not null,
      "name" text not null,
      "project_id" text not null,
      "language" text not null,
      "tag" text not null default 'test',
      "notes" text null,
      "primary_texts" jsonb null,
      "headlines" jsonb null,
      "description_text" text null,
      "cta_type" text null,
      "link_url" text null,
      "media_type" text not null default 'image',
      "image_1x1_url" text null,
      "image_9x16_url" text null,
      "video_thumb_url" text null,
      "source" text not null default 'manual',
      "meta_ad_id" text null,
      "meta_creative_id" text null,
      "meta_account_id" text null,
      "family_id" text null,
      "translated_from_id" text null,
      "perf" jsonb null,
      "metadata" jsonb null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "ad_creative_pkey" primary key ("id")
    );`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ad_creative_deleted_at" ON "ad_creative" ("deleted_at") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ad_creative_project" ON "ad_creative" ("project_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ad_creative_family" ON "ad_creative" ("family_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ad_creative_meta_ad" ON "ad_creative" ("meta_ad_id") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ad_creative" cascade;`)
  }
}
