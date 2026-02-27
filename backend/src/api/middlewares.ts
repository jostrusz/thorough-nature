import { defineMiddlewares } from "@medusajs/medusa"

export default defineMiddlewares({
  routes: [
    {
      method: ["POST"],
      matcher: "/webhooks/stripe",
      bodyParser: { preserveRawBody: true },
    },
  ],
})
