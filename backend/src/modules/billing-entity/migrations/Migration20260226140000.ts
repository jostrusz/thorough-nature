import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260226140000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE "billing_entity" ADD COLUMN IF NOT EXISTS "invoicing_system" text NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "billing_entity" DROP COLUMN IF EXISTS "invoicing_system";`);
  }

}
