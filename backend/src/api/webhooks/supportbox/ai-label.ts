// @ts-nocheck
import Anthropic from "@anthropic-ai/sdk"

/**
 * Deterministic project resolution from the recipient support inbox domain.
 * Each project has its OWN support domain, so the recipient (To) address is a
 * 100% reliable project signal — unlike AI content classification, which cannot
 * tell apart same-language siblings (e.g. CZ pusttocotenici.cz vs SK
 * pustitocotanici.sk — a Slovak customer may even write in Czech).
 */
export const EMAIL_DOMAIN_TO_PROJECT: Record<string, string> = {
  "pusttocotenici.cz": "odpust-knizka",
  "pustitocotanici.sk": "pusti-to-sk",
  "psi-superzivot.cz": "psi-superzivot",
  "loslatenboek.nl": "loslatenboek",
  "pakjeleventerug.nl": "het-leven",
  "dehondenbijbel.nl": "dehondenbijbel",
  "najpierw-ja.pl": "zycie-zaslugy",
  "odpusc-ksiazka.pl": "odpusc-ksiazka",
  "ksiazkidladuszy.pl": "odpusc-ksiazka",
  "slipptaketboken.no": "slipp-taket",
  "jetztloslassen.de": "lass-los",
  "lasslosbuch.de": "lass-los",
  "bucherfurdich.de": "lass-los",
  "slapptagetboken.se": "slapp-taget",
  "bokochkaffe.com": "slapp-taget",
  "engeddelkonyv.hu": "engedd-el",
}

/** Resolve the project slug from a support inbox email address (by its domain). */
export function resolveProjectFromEmail(email?: string): string | null {
  if (!email) return null
  const domain = email.toLowerCase().split("@").pop()?.replace(/^www\./, "") || ""
  return EMAIL_DOMAIN_TO_PROJECT[domain] || null
}

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

    // Project is DETERMINISTIC from the recipient support inbox — never let the AI
    // guess it (it can't reliably tell CZ from SK). The AI only classifies
    // category + summary; we always trust the inbox for the project.
    const deterministicProject = resolveProjectFromEmail(input.emailAddress)

    const systemPrompt = `You are a support email classifier. Analyze the email and return JSON with:
- "project": ${deterministicProject
        ? `MUST be exactly "${deterministicProject}" (this email arrived at that project's dedicated support inbox — do not change it)`
        : `the project name based on the support email context (e.g. "loslatenboek", "dehondenbijbel", "lass-los", "psi-superzivot", "kocici-bible", "odpust-knizka", "pusti-to-sk", "odpusc-ksiazka", "slapp-taget")`}
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

    let text =
      response.content[0].type === "text" ? response.content[0].text : ""
    // Strip markdown code fences if present (```json ... ```)
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
    const parsed = JSON.parse(text)

    if (parsed.project && parsed.category && parsed.summary) {
      return {
        // Inbox domain wins over the AI's guess whenever it's known.
        project: deterministicProject || parsed.project,
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
