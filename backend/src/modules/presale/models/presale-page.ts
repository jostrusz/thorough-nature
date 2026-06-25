import { model } from "@medusajs/framework/utils"

/**
 * Presale page — a domain-bound pre-sell / listicle / advertorial landing page.
 *
 * Design notes vs. the legacy `advertorial` module:
 *  - Binds to `domain` directly (no `project_id` mismatch hack). The admin picks
 *    a domain; serving matches on (domain, slug).
 *  - `title_cs` holds an AI (Haiku) Czech translation of the headline for the
 *    operator, shown next to the original in the admin list.
 *  - `type` makes the model extensible to future page formats (quiz, vsl, …).
 *  - `publish_at` is scheduling-ready (cron can flip drafts live later).
 */
const PresalePage = model.define("presale_page", {
  id: model.id().primaryKey(),
  domain: model.text(),
  slug: model.text(),
  title: model.text(),
  title_cs: model.text().nullable(),
  type: model.text().default("listicle"),
  html_content: model.text().default(""),
  meta_title: model.text().nullable(),
  meta_description: model.text().nullable(),
  og_image_url: model.text().nullable(),
  facebook_pixel_id: model.text().nullable(),
  status: model.enum(["draft", "published"]).default("draft"),
  publish_at: model.dateTime().nullable(),
  view_count: model.number().default(0),
})

export default PresalePage
