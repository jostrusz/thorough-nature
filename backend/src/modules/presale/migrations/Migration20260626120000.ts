import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260626120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "presale_page" (
        "id" TEXT NOT NULL,
        "domain" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "title_cs" TEXT NULL,
        "type" TEXT NOT NULL DEFAULT 'listicle',
        "html_content" TEXT NOT NULL DEFAULT '',
        "meta_title" TEXT NULL,
        "meta_description" TEXT NULL,
        "og_image_url" TEXT NULL,
        "facebook_pixel_id" TEXT NULL,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "publish_at" TIMESTAMPTZ NULL,
        "view_count" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT Now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT Now(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "presale_page_pkey" PRIMARY KEY ("id")
      );
    `)

    // One slug per domain (ignores soft-deleted rows)
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_presale_page_domain_slug"
        ON "presale_page" ("domain", "slug")
        WHERE "deleted_at" IS NULL;
    `)

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_presale_page_domain"
        ON "presale_page" ("domain");
    `)

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_presale_page_status"
        ON "presale_page" ("status");
    `)

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "presale_revision" (
        "id" TEXT NOT NULL,
        "presale_id" TEXT NOT NULL,
        "snapshot" TEXT NOT NULL,
        "note" TEXT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT Now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT Now(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "presale_revision_pkey" PRIMARY KEY ("id")
      );
    `)

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_presale_revision_presale_id"
        ON "presale_revision" ("presale_id");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "presale_revision";`)
    this.addSql(`DROP TABLE IF EXISTS "presale_page";`)
  }
}
