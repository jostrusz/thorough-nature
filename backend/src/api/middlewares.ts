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
      matcher: "/webhooks/marketing/resend",
      bodyParser: { preserveRawBody: true },
    },
    {
      method: ["POST"],
      matcher: "/V1/event",
      bodyParser: { preserveRawBody: true },
    },
    // Raise body size limit for contact import (CSV-derived JSON can easily
    // exceed the default ~1MB for lists of a few thousand rows).
    {
      method: ["POST"],
      matcher: "/admin/marketing/contacts/import",
      bodyParser: { sizeLimit: "25mb" },
    },
    {
      method: ["POST"],
      matcher: "/admin/marketing/contacts/bulk",
      bodyParser: { sizeLimit: "5mb" },
    },
    // Marketing flow definitions can grow large — every email node carries
    // its own full HTML body, and a 20-node nurture sequence with rich
    // sample HTML easily blows past the default ~1 MB. Without this users
    // see a generic "Failed: An unknown error occurred." toast and lose
    // their work. 25 MB is well above realistic flow size.
    {
      method: ["POST"],
      matcher: "/admin/marketing/flows",
      bodyParser: { sizeLimit: "25mb" },
    },
    {
      method: ["POST"],
      matcher: "/admin/marketing/flows/*",
      bodyParser: { sizeLimit: "25mb" },
    },
    // Same reason for campaign editor — full HTML body in payload.
    {
      method: ["POST"],
      matcher: "/admin/marketing/campaigns",
      bodyParser: { sizeLimit: "25mb" },
    },
    {
      method: ["POST"],
      matcher: "/admin/marketing/campaigns/*",
      bodyParser: { sizeLimit: "25mb" },
    },
    // Email templates also store full HTML.
    {
      method: ["POST"],
      matcher: "/admin/marketing/templates",
      bodyParser: { sizeLimit: "25mb" },
    },
    {
      method: ["POST"],
      matcher: "/admin/marketing/templates/*",
      bodyParser: { sizeLimit: "25mb" },
    },
    // Test-send endpoint also receives full compiled HTML.
    {
      method: ["POST"],
      matcher: "/admin/marketing/email/test-send",
      bodyParser: { sizeLimit: "25mb" },
    },
    // Supportbox replies / compose — base64 attachments inflate ×1.33,
    // so 50 MB body ≈ 35 MB raw files (under Resend's 40 MB cap).
    {
      method: ["POST"],
      matcher: "/admin/supportbox/tickets/*/reply",
      bodyParser: { sizeLimit: "50mb" },
    },
    {
      method: ["POST"],
      matcher: "/admin/supportbox/tickets/compose",
      bodyParser: { sizeLimit: "50mb" },
    },
  ],
})
