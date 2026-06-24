import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Multi-list/segment campaigns + double-send guard.
 *
 *  marketing_campaign → list_ids, segment_ids (jsonb arrays, backfilled from
 *                       the legacy singular list_id / segment_id columns).
 *  marketing_message  → UNIQUE (campaign_id, contact_id) partial index so the
 *                       dispatcher can never send the same campaign to the same
 *                       contact twice, even under overlapping cron ticks.
 */
export class Migration20260624000000 extends Migration {
  override async up(): Promise<void> {
    // ── marketing_campaign — multi-target columns ─────────────────────────
    this.addSql(`alter table "marketing_campaign" add column if not exists "list_ids" jsonb null;`)
    this.addSql(`alter table "marketing_campaign" add column if not exists "segment_ids" jsonb null;`)

    // Backfill arrays from the legacy singular columns
    this.addSql(`
      update "marketing_campaign"
      set "list_ids" = case when "list_id" is not null then jsonb_build_array("list_id") else '[]'::jsonb end
      where "list_ids" is null;
    `)
    this.addSql(`
      update "marketing_campaign"
      set "segment_ids" = case when "segment_id" is not null then jsonb_build_array("segment_id") else '[]'::jsonb end
      where "segment_ids" is null;
    `)

    // ── marketing_message — dedupe then enforce uniqueness ────────────────
    // Soft-delete any pre-existing duplicate (campaign_id, contact_id) rows,
    // keeping the most-progressed one, so the unique index can be created.
    this.addSql(`
      with ranked as (
        select "id", row_number() over (
          partition by "campaign_id", "contact_id"
          order by
            case "status"
              when 'clicked' then 1 when 'opened' then 2 when 'delivered' then 3
              when 'sent' then 4 when 'bounced' then 5 when 'complained' then 6
              when 'suppressed' then 7 when 'queued' then 8 when 'failed' then 9
              else 10 end,
            "sent_at" desc nulls last,
            "created_at" asc
        ) as rn
        from "marketing_message"
        where "deleted_at" is null and "campaign_id" is not null
      )
      update "marketing_message" m
      set "deleted_at" = now()
      from ranked r
      where m."id" = r."id" and r.rn > 1;
    `)

    this.addSql(`
      create unique index if not exists "UQ_mkt_message_campaign_contact"
      on "marketing_message" ("campaign_id", "contact_id")
      where "deleted_at" is null and "campaign_id" is not null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "UQ_mkt_message_campaign_contact";`)
    this.addSql(`alter table "marketing_campaign" drop column if exists "segment_ids";`)
    this.addSql(`alter table "marketing_campaign" drop column if exists "list_ids";`)
  }
}
