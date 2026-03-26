import { defineMiddlewares } from "@medusajs/medusa"
import type { Request, Response, NextFunction } from "express"
import { json } from "express"

/**
 * Custom raw body capture middleware.
 * Medusa's preserveRawBody can be unreliable due to memoized json parser,
 * so we use our own express.json({ verify }) to capture the raw Buffer.
 */
function captureRawBody(req: Request, res: Response, next: NextFunction) {
  if (req.headers["content-type"]?.includes("application/json")) {
    json({
      verify: (r: any, _res, buf) => {
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
      bodyParser: false, // disable default parser, we handle it ourselves
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
