import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Flow goals + re-entry policy, flow_run exit tracking, and marketing_click
 * table for per-link attribution.
 *
 *  marketing_flow      → goals, re_entry_policy
 *  marketing_flow_run  → exit_reason, goal_id, visited_node_ids
 *  marketing_click     → NEW table (one row per email link click)
 */
export class Migration20260421000000 extends Migration {
  override async up(): Promise<void> {
    // ── marketing_flow ─────────────────────────────────────────────────
    this.addSql(`alter table "marketing_flow" add column if not exists "goals" jsonb null;`)
    this.addSql(`alter table "marketing_flow" add column if not exists "re_entry_policy" jsonb null;`)

    // ── marketing_message — per-node analytics ────────────────────────
    this.addSql(`alter table "marketing_message" add column if not exists "flow_node_id" text null;`)
    this.addSql(`create index if not exists "IDX_mkt_message_flow_node_id" on "marketing_message" ("flow_node_id");`)

    // ── marketing_flow_run ─────────────────────────────────────────────
    this.addSql(`alter table "marketing_flow_run" add column if not exists "exit_reason" text null;`)
    this.addSql(`alter table "marketing_flow_run" add column if not exists "goal_id" text null;`)
    this.addSql(`alter table "marketing_flow_run" add column if not exists "visited_node_ids" jsonb null;`)

    // ── marketing_click ────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "marketing_click" (
        "id" text primary key,
        "brand_id" text not null,
        "message_id" text not null,
        "contact_id" text null,
        "campaign_id" text null,
        "flow_id" text null,
        "flow_run_id" text null,
        "flow_node_id" text null,
        "link_label" text null,
        "target_url" text not null,
        "clicked_at" timestamptz not null default now(),
        "user_agent" text null,
        "ip_hash" text null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null
      );
    `)
    this.addSql(`create index if not exists "IDX_mkt_click_brand_id" on "marketing_click" ("brand_id");`)
    this.addSql(`create index if not exists "IDX_mkt_click_message_id" on "marketing_click" ("message_id");`)
    this.addSql(`create index if not exists "IDX_mkt_click_campaign_id" on "marketing_click" ("campaign_id");`)
    this.addSql(`create index if not exists "IDX_mkt_click_flow_id" on "marketing_click" ("flow_id");`)
    this.addSql(`create index if not exists "IDX_mkt_click_contact_id" on "marketing_click" ("contact_id");`)
    this.addSql(`create index if not exists "IDX_mkt_click_clicked_at" on "marketing_click" ("clicked_at");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "marketing_click";`)
    this.addSql(`alter table "marketing_flow_run" drop column if exists "visited_node_ids";`)
    this.addSql(`alter table "marketing_flow_run" drop column if exists "goal_id";`)
    this.addSql(`alter table "marketing_flow_run" drop column if exists "exit_reason";`)
    this.addSql(`alter table "marketing_flow" drop column if exists "re_entry_policy";`)
    this.addSql(`alter table "marketing_flow" drop column if exists "goals";`)
  }
}
