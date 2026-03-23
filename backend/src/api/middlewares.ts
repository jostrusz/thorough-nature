import { defineMiddlewares } from "@medusajs/medusa"

export default defineMiddlewares({
  routes: [
    {
      method: ["POST"],
      matcher: "/webhooks/stripe",
      bodyParser: { preserveRawBody: true },
    },
    {
      method: ["POST"],
      matcher: "/webhooks/mystock",
      bodyParser: true,
    },
    {
      method: ["POST"],
      matcher: "/V1/event",
      bodyParser: true,
    },
  ],
})
