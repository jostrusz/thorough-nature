import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260226150000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "project_settings" add column if not exists "promo_codes" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "project_settings" drop column if exists "promo_codes";`);
  }

}
