import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Gender-aware marketing emails. A contact's grammatical gender + vocative
 * (5th case of the first name, e.g. "Jana" -> "Jano") are resolved once at
 * signup (or lazily on first send) and stored here, so flow email nodes can
 * serve a male / female copy variant and a correctly-declined greeting.
 *
 *   gender:   "m" | "f" | "unknown"  (null = not yet resolved)
 *   vocative: declined first name for direct address ("Jano", "Petře")
 */
export class Migration20260625000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "marketing_contact" add column if not exists "gender" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "vocative" text null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "marketing_contact" drop column if exists "vocative";`)
    this.addSql(`alter table "marketing_contact" drop column if exists "gender";`)
  }
}
