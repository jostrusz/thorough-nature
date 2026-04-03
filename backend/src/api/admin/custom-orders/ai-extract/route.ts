// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import Anthropic from "@anthropic-ai/sdk"
import { PROFITABILITY_MODULE } from "../../../../modules/profitability"

/**
 * POST /admin/custom-orders/ai-extract
 *
 * Takes raw text (email conversation, Airwallex data, etc.)
 * and uses Claude Opus to extract structured order details.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const { text } = req.body as { text: string }

    if (!text?.trim()) {
      res.status(400).json({ error: "Text is required" })
      return
    }

    // Fetch available projects for context
    let projects: any[] = []
    try {
      const profitService = req.scope.resolve(PROFITABILITY_MODULE) as any
      projects = await profitService.listProjectConfigs(
        {},
        { order: { display_order: "ASC" }, take: 100 }
      )
    } catch (e) {
      console.warn("[AI Extract] Could not fetch projects:", (e as Error).message)
    }

    // Fetch available products for context
    let products: any[] = []
    try {
      const query = req.scope.resolve("query") as any
      const { data } = await query.graph({
        entity: "product",
        fields: ["id", "title", "handle", "variants.id", "variants.title", "variants.sku", "variants.prices.*"],
        filters: { status: "published" },
      })
      products = data || []
    } catch (e) {
      console.warn("[AI Extract] Could not fetch products:", (e as Error).message)
    }

    const projectList = projects.map((p: any) =>
      `- ${p.project_slug}: "${p.project_name}" (${p.flag_emoji} ${p.country_tag}, sales_channel: ${p.sales_channel_id})`
    ).join("\n")

    const productList = products.map((p: any) => {
      const variants = (p.variants || []).map((v: any) => {
        const price = v.prices?.[0]
        return `  variant: "${v.title}" (id: ${v.id}, sku: ${v.sku}, price: ${price ? `${price.amount} ${price.currency_code}` : "n/a"})`
      }).join("\n")
      return `- "${p.title}" (id: ${p.id}, handle: ${p.handle})\n${variants}`
    }).join("\n")

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const systemPrompt = `You are an order data extractor for an e-commerce system selling books internationally.

Your job: analyze the provided text (which can be email conversations, payment gateway data, customer messages, admin notes, or any combination) and extract structured order details.

AVAILABLE PROJECTS:
${projectList || "No projects configured"}

AVAILABLE PRODUCTS:
${productList || "No products configured"}

RULES:
1. Extract all customer info: name, email, phone, address
2. Detect the country from address format, phone prefix, language, or postal code:
   - 4 digits postal code + Dutch text = NL
   - 4 digits postal code + Belgian city = BE
   - 5 digits postal code + German text = DE
   - XX-XXX postal code + Polish text = PL
   - +31 phone = NL, +32 = BE, +49 = DE, +48 = PL, +46 = SE, +420 = CZ
3. Match to the correct project based on context (product name, language, domain in email)
4. Extract payment info if present (Airwallex int_xxx, Mollie tr_xxx, PayPal ID)
5. Detect payment method (ideal, bancontact, creditcard, klarna, paypal, etc.)
6. Match to the correct product and variant from the available list
7. For each field, provide a confidence level: "high", "medium", or "low"
8. If a field cannot be determined, use null

IMPORTANT: Return ONLY valid JSON, no markdown fences, no explanation text.

JSON SCHEMA:
{
  "extracted": {
    "first_name": string | null,
    "last_name": string | null,
    "email": string | null,
    "phone": string | null,
    "address_1": string | null,
    "address_2": string | null,
    "city": string | null,
    "postal_code": string | null,
    "country_code": string | null (ISO 2-letter, lowercase),
    "project_slug": string | null,
    "product_id": string | null,
    "variant_id": string | null,
    "product_title": string | null,
    "quantity": number,
    "unit_price": number | null (in EUR, e.g. 35.00 for €35.00),
    "currency_code": string (default "eur"),
    "payment_id": string | null,
    "payment_method": string | null,
    "payment_status": "paid" | "pending" | "unknown",
    "notes": string | null
  },
  "confidence": {
    "name": "high" | "medium" | "low",
    "email": "high" | "medium" | "low",
    "phone": "high" | "medium" | "low",
    "address": "high" | "medium" | "low",
    "country": "high" | "medium" | "low",
    "product": "high" | "medium" | "low",
    "payment": "high" | "medium" | "low"
  }
}`

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: text }],
    })

    let responseText = response.content[0].type === "text" ? response.content[0].text : ""
    // Strip markdown code fences if present
    responseText = responseText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()

    let parsed: any
    try {
      parsed = JSON.parse(responseText)
    } catch {
      console.error("[AI Extract] Failed to parse AI response:", responseText)
      res.status(500).json({ error: "AI returned invalid JSON", raw: responseText })
      return
    }

    // Enrich with project details if matched
    const matchedProject = projects.find(
      (p: any) => p.project_slug === parsed.extracted?.project_slug
    )

    res.json({
      ...parsed,
      project: matchedProject || null,
      availableProjects: projects.map((p: any) => ({
        slug: p.project_slug,
        name: p.project_name,
        flag: p.flag_emoji,
        country_tag: p.country_tag,
        sales_channel_id: p.sales_channel_id,
      })),
      availableProducts: products.map((p: any) => ({
        id: p.id,
        title: p.title,
        variants: (p.variants || []).map((v: any) => ({
          id: v.id,
          title: v.title,
          sku: v.sku,
          price: v.prices?.[0]?.amount,
          currency: v.prices?.[0]?.currency_code,
        })),
      })),
    })
  } catch (error: any) {
    console.error("[AI Extract] Error:", error.message)
    res.status(500).json({ error: error.message })
  }
}
