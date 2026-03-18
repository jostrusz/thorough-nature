import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260318133022 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "dextrum_order_map" add column if not exists "resend_count" integer not null default 0;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "dextrum_order_map" drop column if exists "resend_count";`);
  }

}
