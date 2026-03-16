import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260316180000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "dextrum_delivery_mapping" (
      "id" text not null,
      "sales_channel_id" text not null,
      "sales_channel_name" text null,
      "shipping_option_id" text not null,
      "shipping_option_name" text null,
      "is_cod" boolean not null default false,
      "delivery_type" text not null default 'home',
      "delivery_method_id" text not null,
      "external_carrier_code" text null,
      "payment_method_id" text not null,
      "metadata" jsonb null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "dextrum_delivery_mapping_pkey" primary key ("id")
    );`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dextrum_delivery_mapping_deleted_at" ON "dextrum_delivery_mapping" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dextrum_delivery_mapping_unique" ON "dextrum_delivery_mapping" ("sales_channel_id", "shipping_option_id", "is_cod") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "dextrum_delivery_mapping" cascade;`);
  }
}
