import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260225155442 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "dextrum_config" ("id" text not null, "api_url" text not null, "api_username" text not null, "api_password" text not null, "default_warehouse_code" text not null default 'MAIN', "partner_id" text null, "partner_code" text null, "webhook_secret" text null, "order_hold_minutes" integer not null default 15, "payment_timeout_minutes" integer not null default 30, "retry_max_attempts" integer not null default 10, "retry_interval_minutes" integer not null default 5, "inventory_sync_enabled" boolean not null default true, "inventory_sync_interval_minutes" integer not null default 15, "low_stock_threshold" integer not null default 10, "critical_stock_threshold" integer not null default 3, "out_of_stock_action" text not null default 'disable_variant', "last_inventory_sync" text null, "last_inventory_sync_products" integer not null default 0, "last_inventory_sync_updated" integer not null default 0, "connection_status" text not null default 'unknown', "last_connection_test" text null, "enabled" boolean not null default true, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dextrum_config_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dextrum_config_deleted_at" ON "dextrum_config" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "dextrum_event_log" ("id" text not null, "event_id" text not null, "event_type" text not null, "event_subtype" text null, "document_id" text null, "document_code" text null, "status" text not null default 'received', "medusa_order_id" text null, "delivery_status_before" text null, "delivery_status_after" text null, "error_message" text null, "raw_payload" jsonb null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dextrum_event_log_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dextrum_event_log_deleted_at" ON "dextrum_event_log" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "dextrum_inventory" ("id" text not null, "sku" text not null, "product_name" text null, "available_stock" integer not null default 0, "physical_stock" integer not null default 0, "reserved_stock" integer not null default 0, "blocked_stock" integer not null default 0, "medusa_variant_id" text null, "medusa_product_id" text null, "warehouse_code" text not null default 'MAIN', "last_synced_at" text null, "stock_changed" boolean not null default false, "previous_available" integer not null default 0, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dextrum_inventory_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dextrum_inventory_deleted_at" ON "dextrum_inventory" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "dextrum_order_map" ("id" text not null, "medusa_order_id" text not null, "display_id" text not null, "project_code" text null, "mystock_order_id" text null, "mystock_order_code" text not null, "delivery_status" text not null default 'NEW', "delivery_status_updated_at" text null, "tracking_number" text null, "tracking_url" text null, "carrier_name" text null, "package_count" integer not null default 0, "total_weight_kg" text null, "hold_until" text null, "retry_count" integer not null default 0, "last_error" text null, "sent_to_wms_at" text null, "dispatched_at" text null, "delivered_at" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dextrum_order_map_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dextrum_order_map_deleted_at" ON "dextrum_order_map" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "dextrum_config" cascade;`);

    this.addSql(`drop table if exists "dextrum_event_log" cascade;`);

    this.addSql(`drop table if exists "dextrum_inventory" cascade;`);

    this.addSql(`drop table if exists "dextrum_order_map" cascade;`);
  }

}
