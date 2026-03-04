import { model } from "@medusajs/framework/utils"

const AdvertorialPage = model.define("advertorial_page", {
  id: model.id().primaryKey(),
  project_id: model.text(),
  title: model.text(),
  slug: model.text(),
  html_content: model.text(),
  meta_title: model.text().nullable(),
  meta_description: model.text().nullable(),
  og_image_url: model.text().nullable(),
  facebook_pixel_id: model.text().nullable(),
  status: model.enum(["draft", "published"]).default("draft"),
  view_count: model.number().default(0),
})

export default AdvertorialPage
