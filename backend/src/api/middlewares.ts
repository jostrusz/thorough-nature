import { defineMiddlewares } from "@medusajs/medusa"

/**
 * Custom raw body capture middleware.
 * Medusa's preserveRawBody can be unreliable due to memoized json parser,
 * so we use require("express").json({ verify }) to capture the raw Buffer.
 */
function captureRawBody(req: any, res: any, next: any) {
  if (req.headers["content-type"]?.includes("application/json")) {
    const { json } = require("express")
    json({
      verify: (r: any, _res: any, buf: Buffer) => {
        r.rawBody = buf
      },
    })(req, res, next)
  } else {
    next()
  }
}

export default defineMiddlewares({
  routes: [
    {
      method: ["POST"],
      matcher: "/webhooks/stripe",
      bodyParser: false,
      middlewares: [captureRawBody],
    },
    {
      method: ["POST"],
      matcher: "/webhooks/mystock",
      bodyParser: { preserveRawBody: true },
    },
    {
      method: ["POST"],
      matcher: "/V1/event",
      bodyParser: { preserveRawBody: true },
    },
  ],
})
