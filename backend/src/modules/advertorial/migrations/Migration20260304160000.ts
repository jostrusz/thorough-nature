import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260304160000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "advertorial_page" (
        "id" TEXT NOT NULL,
        "project_id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "html_content" TEXT NOT NULL DEFAULT '',
        "meta_title" TEXT NULL,
        "meta_description" TEXT NULL,
        "og_image_url" TEXT NULL,
        "facebook_pixel_id" TEXT NULL,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "view_count" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT Now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT Now(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "advertorial_page_pkey" PRIMARY KEY ("id")
      );
    `)

    // Unique composite index: one slug per project
    this.addSql(`
      CREATE UNIQUE INDEX "idx_advertorial_page_project_slug"
        ON "advertorial_page" ("project_id", "slug")
        WHERE "deleted_at" IS NULL;
    `)

    // Index for fast lookups by project
    this.addSql(`
      CREATE INDEX "idx_advertorial_page_project_id"
        ON "advertorial_page" ("project_id");
    `)

    // Index for status filtering
    this.addSql(`
      CREATE INDEX "idx_advertorial_page_status"
        ON "advertorial_page" ("status");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "advertorial_page";`)
  }
}
