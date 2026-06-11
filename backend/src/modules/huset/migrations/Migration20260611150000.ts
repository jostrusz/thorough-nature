import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260611150000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "huset_order_map" ("id" text not null, "medusa_order_id" text not null, "display_id" text not null, "project_code" text null, "order_ref" text not null, "outgoing_delivery_order_id" text null, "outgoing_delivery_id" text null, "delivery_status" text not null default 'NEW', "delivery_status_updated_at" text null, "tracking_number" text null, "tracking_url" text null, "carrier_name" text null, "hold_until" text null, "retry_count" integer not null default 0, "last_error" text null, "sent_to_wms_at" text null, "dispatched_at" text null, "delivered_at" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "huset_order_map_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_huset_order_map_deleted_at" ON "huset_order_map" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_huset_order_map_order_ref" ON "huset_order_map" ("order_ref");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_huset_order_map_status" ON "huset_order_map" ("delivery_status");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "huset_order_map" cascade;`);
  }

}
