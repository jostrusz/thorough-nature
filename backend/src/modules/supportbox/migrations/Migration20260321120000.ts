import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260321120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE "supportbox_config" ADD COLUMN IF NOT EXISTS "sender_name" text NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "supportbox_config" DROP COLUMN IF EXISTS "sender_name";`);
  }

}
