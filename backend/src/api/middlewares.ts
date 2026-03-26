import { defineMiddlewares } from "@medusajs/medusa"

/**
 * Capture raw request body as Buffer before any JSON parsing.
 * Reads the raw stream directly to avoid memoized express.json() issues.
 */
function captureRawBody(req: any, res: any, next: any) {
  const chunks: Buffer[] = []
  req.on("data", (chunk: Buffer) => chunks.push(chunk))
  req.on("end", () => {
    req.rawBody = Buffer.concat(chunks)
    // Also parse JSON so req.body is available
    try {
      req.body = JSON.parse(req.rawBody.toString("utf8"))
    } catch {
      req.body = {}
    }
    next()
  })
  req.on("error", (err: any) => next(err))
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
