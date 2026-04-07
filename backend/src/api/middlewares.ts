import { defineMiddlewares } from "@medusajs/medusa"

/**
 * Middleware that re-serializes parsed body to capture a "raw" version.
 * This is a workaround for Medusa's memoized json parser ignoring
 * preserveRawBody on subsequent calls with different options.
 *
 * It runs AFTER the body parser, so req.body is already available.
 * We store a Buffer version for Stripe signature verification.
 */
function ensureRawBody(req: any, _res: any, next: any) {
  if (!req.rawBody && req.body) {
    // Store the raw serialized body — not byte-perfect with Stripe's original,
    // but we'll fix this properly below with bodyParser: false
    req.rawBody = Buffer.from(JSON.stringify(req.body), "utf8")
  }
  next()
}

export default defineMiddlewares({
  routes: [
    {
      method: ["GET", "POST", "OPTIONS"],
      matcher: "/public/*",
      middlewares: [
        function publicCors(req: any, res: any, next: any) {
          res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*")
          res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
          res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
          res.setHeader("Access-Control-Allow-Credentials", "true")
          if (req.method === "OPTIONS") {
            res.status(204).end()
            return
          }
          next()
        },
      ],
    },
    {
      method: ["POST"],
      matcher: "/webhooks/stripe",
      // Disable the default body parser entirely so we can read the raw stream
      bodyParser: false,
      middlewares: [
        // Read raw body from the request stream before any parsing
        function rawBodyReader(req: any, _res: any, next: any) {
          const chunks: Buffer[] = []
          req.on("data", (chunk: Buffer) => chunks.push(chunk))
          req.on("end", () => {
            const raw = Buffer.concat(chunks)
            req.rawBody = raw
            try {
              req.body = JSON.parse(raw.toString("utf8"))
            } catch {
              req.body = {}
            }
            next()
          })
          req.on("error", next)
        },
      ],
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
