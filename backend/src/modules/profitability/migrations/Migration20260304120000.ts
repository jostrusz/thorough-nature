import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260304120000 extends Migration {

  override async up(): Promise<void> {
    // ═══ project_config ═══
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "project_config" (
        "id" TEXT NOT NULL,
        "project_name" TEXT NOT NULL,
        "project_slug" TEXT NOT NULL,
        "flag_emoji" TEXT NOT NULL,
        "country_tag" TEXT NOT NULL,
        "sales_channel_id" TEXT NULL,
        "book_cost_eur" NUMERIC NOT NULL DEFAULT 1.80,
        "raw_book_cost_eur" JSONB NOT NULL DEFAULT '{"value": "1.80", "precision": 20}',
        "shipping_cost_eur" NUMERIC NOT NULL DEFAULT 5.00,
        "raw_shipping_cost_eur" JSONB NOT NULL DEFAULT '{"value": "5.00", "precision": 20}',
        "pick_pack_cost_eur" NUMERIC NOT NULL DEFAULT 1.50,
        "raw_pick_pack_cost_eur" JSONB NOT NULL DEFAULT '{"value": "1.50", "precision": 20}',
        "payment_fee_rate" NUMERIC NOT NULL DEFAULT 0.03,
        "raw_payment_fee_rate" JSONB NOT NULL DEFAULT '{"value": "0.03", "precision": 20}',
        "meta_ad_account_id" TEXT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "display_order" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT Now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT Now(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "project_config_pkey" PRIMARY KEY ("id")
      );
    `)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_project_config_project_slug_unique" ON "project_config" ("project_slug") WHERE "deleted_at" IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_project_config_deleted_at" ON "project_config" ("deleted_at") WHERE "deleted_at" IS NULL;`)

    // ═══ meta_ads_config ═══
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "meta_ads_config" (
        "id" TEXT NOT NULL,
        "access_token" TEXT NOT NULL,
        "token_status" TEXT NOT NULL DEFAULT 'valid' CHECK ("token_status" IN ('valid', 'expired', 'error')),
        "last_validated_at" TIMESTAMPTZ NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT Now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT Now(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "meta_ads_config_pkey" PRIMARY KEY ("id")
      );
    `)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_meta_ads_config_deleted_at" ON "meta_ads_config" ("deleted_at") WHERE "deleted_at" IS NULL;`)

    // ═══ daily_project_stats ═══
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "daily_project_stats" (
        "id" TEXT NOT NULL,
        "project_id" TEXT NOT NULL,
        "date" TEXT NOT NULL,
        "revenue" NUMERIC NOT NULL DEFAULT 0,
        "raw_revenue" JSONB NOT NULL DEFAULT '{"value": "0", "precision": 20}',
        "tax_amount" NUMERIC NOT NULL DEFAULT 0,
        "raw_tax_amount" JSONB NOT NULL DEFAULT '{"value": "0", "precision": 20}',
        "order_count" INTEGER NOT NULL DEFAULT 0,
        "item_count" INTEGER NOT NULL DEFAULT 0,
        "refund_amount" NUMERIC NOT NULL DEFAULT 0,
        "raw_refund_amount" JSONB NOT NULL DEFAULT '{"value": "0", "precision": 20}',
        "ad_spend" NUMERIC NOT NULL DEFAULT 0,
        "raw_ad_spend" JSONB NOT NULL DEFAULT '{"value": "0", "precision": 20}',
        "book_cost_total" NUMERIC NOT NULL DEFAULT 0,
        "raw_book_cost_total" JSONB NOT NULL DEFAULT '{"value": "0", "precision": 20}',
        "shipping_cost_total" NUMERIC NOT NULL DEFAULT 0,
        "raw_shipping_cost_total" JSONB NOT NULL DEFAULT '{"value": "0", "precision": 20}',
        "pick_pack_total" NUMERIC NOT NULL DEFAULT 0,
        "raw_pick_pack_total" JSONB NOT NULL DEFAULT '{"value": "0", "precision": 20}',
        "payment_fee_total" NUMERIC NOT NULL DEFAULT 0,
        "raw_payment_fee_total" JSONB NOT NULL DEFAULT '{"value": "0", "precision": 20}',
        "net_profit" NUMERIC NOT NULL DEFAULT 0,
        "raw_net_profit" JSONB NOT NULL DEFAULT '{"value": "0", "precision": 20}',
        "last_synced_at" TIMESTAMPTZ NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT Now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT Now(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "daily_project_stats_pkey" PRIMARY KEY ("id")
      );
    `)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_daily_project_stats_project_id" ON "daily_project_stats" ("project_id") WHERE "deleted_at" IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_daily_project_stats_date" ON "daily_project_stats" ("date") WHERE "deleted_at" IS NULL;`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_daily_project_stats_project_date" ON "daily_project_stats" ("project_id", "date") WHERE "deleted_at" IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_daily_project_stats_deleted_at" ON "daily_project_stats" ("deleted_at") WHERE "deleted_at" IS NULL;`)

    // ═══ Foreign key ═══
    this.addSql(`ALTER TABLE IF EXISTS "daily_project_stats" ADD CONSTRAINT "daily_project_stats_project_id_foreign" FOREIGN KEY ("project_id") REFERENCES "project_config" ("id") ON UPDATE CASCADE;`)
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "daily_project_stats" DROP CONSTRAINT IF EXISTS "daily_project_stats_project_id_foreign";`)
    this.addSql(`DROP TABLE IF EXISTS "daily_project_stats" CASCADE;`)
    this.addSql(`DROP TABLE IF EXISTS "meta_ads_config" CASCADE;`)
    this.addSql(`DROP TABLE IF EXISTS "project_config" CASCADE;`)
  }

}
