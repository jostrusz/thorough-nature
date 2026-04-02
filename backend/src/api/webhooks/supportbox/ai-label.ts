// @ts-nocheck
import Anthropic from "@anthropic-ai/sdk"

interface AiLabelInput {
  subject: string
  bodyText: string
  emailAddress: string
  configDisplayName: string
}

interface AiLabelResult {
  project: string
  category: string
  summary: string
}

export async function generateAiLabels(
  input: AiLabelInput
): Promise<AiLabelResult | null> {
  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const systemPrompt = `You are a support email classifier. Analyze the email and return JSON with:
- "project": the project name based on the support email context (e.g. "loslatenboek", "dehondenbijbel", "lass-los", "psi-superzivot", "odpusc-ksiazka", "slapp-taget")
- "category": one of: payment_issue, shipping, order_issue, product_feedback, returns, account, spam, other
- "summary": 1-sentence English summary of the customer's issue (max 100 chars)

Context: Support account "${input.configDisplayName}" (${input.emailAddress})

Return ONLY valid JSON, no markdown, no explanation.`

    const userMessage = `Subject: ${input.subject}\n\nBody:\n${input.bodyText}`

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    })

    const text =
      response.content[0].type === "text" ? response.content[0].text : ""
    const parsed = JSON.parse(text)

    if (parsed.project && parsed.category && parsed.summary) {
      return {
        project: parsed.project,
        category: parsed.category,
        summary: parsed.summary,
      }
    }

    return null
  } catch (e) {
    console.log(`[SupportBox] AI label error: ${(e as Error).message}`)
    return null
  }
}
