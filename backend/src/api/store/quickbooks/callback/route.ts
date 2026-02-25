import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { QUICKBOOKS_MODULE } from "../../../../modules/quickbooks"
import type QuickBooksModuleService from "../../../../modules/quickbooks/service"
import { exchangeAuthCode } from "../../../../modules/quickbooks/api-client"

/**
 * GET /store/quickbooks/callback?code=...&state=...&realmId=...
 *
 * PUBLIC endpoint (no auth) — QuickBooks OAuth redirect target.
 *
 * - state = config_id (to look up which QBO config initiated the flow)
 * - code = authorization code to exchange for tokens
 * - realmId = QuickBooks company ID
 *
 * Returns HTML page that closes the popup and signals success.
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { code, state, realmId } = req.query as Record<string, string>

    if (!code || !state) {
      res.status(400).send(errorPage("Missing code or state parameter"))
      return
    }

    const configId = state
    const service = req.scope.resolve(
      QUICKBOOKS_MODULE
    ) as unknown as QuickBooksModuleService

    // Look up the config
    let config: any
    try {
      config = await service.retrieveQuickBooksConfig(configId)
    } catch {
      res.status(400).send(errorPage("Invalid state — config not found"))
      return
    }

    if (!config.redirect_uri) {
      res.status(400).send(errorPage("No redirect_uri on config"))
      return
    }

    // Exchange authorization code for tokens
    const tokens = await exchangeAuthCode(
      {
        client_id: config.client_id,
        client_secret: config.client_secret,
        environment: config.environment,
      },
      code,
      config.redirect_uri
    )

    // Update config with tokens
    await service.updateQuickBooksConfigs({
      id: configId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      access_token_expires_at: new Date(
        Date.now() + tokens.expires_in * 1000
      ).toISOString(),
      refresh_token_expires_at: new Date(
        Date.now() + tokens.x_refresh_token_expires_in * 1000
      ).toISOString(),
      realm_id: realmId || config.realm_id,
      is_connected: true,
    })

    // Return success page that closes the popup
    res.status(200).send(successPage())
  } catch (error: any) {
    console.error("[QuickBooks Callback] Error:", error.message)
    res.status(500).send(errorPage(error.message))
  }
}

function successPage(): string {
  return `<!DOCTYPE html>
<html>
<head><title>QuickBooks Connected</title></head>
<body style="font-family: -apple-system, system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #F0FFF0;">
  <div style="text-align: center; padding: 40px;">
    <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
    <h1 style="font-size: 20px; color: #1A1A1A; margin-bottom: 8px;">QuickBooks Connected!</h1>
    <p style="color: #6D7175; font-size: 14px;">This window will close automatically...</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'quickbooks-connected' }, '*');
    }
    setTimeout(function() { window.close(); }, 2000);
  </script>
</body>
</html>`
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>QuickBooks Error</title></head>
<body style="font-family: -apple-system, system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #FFF5F5;">
  <div style="text-align: center; padding: 40px;">
    <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
    <h1 style="font-size: 20px; color: #1A1A1A; margin-bottom: 8px;">Connection Failed</h1>
    <p style="color: #9E2B25; font-size: 14px;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
    <button onclick="window.close()" style="margin-top: 16px; padding: 8px 20px; border: 1px solid #E1E3E5; border-radius: 8px; background: #FFF; cursor: pointer; font-size: 13px;">Close Window</button>
  </div>
</body>
</html>`
}
