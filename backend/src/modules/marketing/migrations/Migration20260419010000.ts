import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Marketing — campaigns own their email content.
 *
 * Previously campaigns referenced a marketing_template row that held the
 * subject / preheader / from / html / text. That indirection is gone: each
 * campaign now carries its own subject, preheader, from_name, from_email,
 * reply_to and custom_html. Templates are no longer part of the campaign
 * authoring flow.
 *
 * Backward compat:
 *   - template_id stays on the row (nullable) so old campaigns remain
 *     readable. The dispatcher reads inline fields first and only falls
 *     back to template_id when every inline field is null.
 */
export class Migration20260419010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "marketing_campaign" add column if not exists "subject" text null;`)
    this.addSql(`alter table "marketing_campaign" add column if not exists "preheader" text null;`)
    this.addSql(`alter table "marketing_campaign" add column if not exists "from_name" text null;`)
    this.addSql(`alter table "marketing_campaign" add column if not exists "from_email" text null;`)
    this.addSql(`alter table "marketing_campaign" add column if not exists "reply_to" text null;`)
    this.addSql(`alter table "marketing_campaign" add column if not exists "custom_html" text null;`)

    // Make template_id nullable (was NOT NULL)
    this.addSql(`alter table "marketing_campaign" alter column "template_id" drop not null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "marketing_campaign" drop column if exists "subject";`)
    this.addSql(`alter table "marketing_campaign" drop column if exists "preheader";`)
    this.addSql(`alter table "marketing_campaign" drop column if exists "from_name";`)
    this.addSql(`alter table "marketing_campaign" drop column if exists "from_email";`)
    this.addSql(`alter table "marketing_campaign" drop column if exists "reply_to";`)
    this.addSql(`alter table "marketing_campaign" drop column if exists "custom_html";`)
    // Do NOT restore NOT NULL on template_id — down-migrations should not
    // fail on rows with NULL template_id written under the new schema.
  }
}
