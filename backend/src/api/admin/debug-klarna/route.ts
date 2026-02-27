// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * GET /admin/debug-klarna
 * Temporary debug endpoint — shows Klarna gateway config from DB
 * and tests the API connection. DELETE after debugging.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const gcService = req.scope.resolve("gatewayConfig")
    const configs = await gcService.listGatewayConfigs(
      { provider: "klarna" },
      { take: 5 }
    )

    const result = configs.map((c: any) => ({
      id: c.id,
      provider: c.provider,
      mode: c.mode,
      is_active: c.is_active,
      test_keys: c.test_keys ? {
        api_key: c.test_keys.api_key ? c.test_keys.api_key.substring(0, 12) + '...' + c.test_keys.api_key.slice(-6) : 'EMPTY',
        secret_key: c.test_keys.secret_key ? c.test_keys.secret_key.substring(0, 20) + '...' + c.test_keys.secret_key.slice(-6) : 'EMPTY',
        webhook_secret: c.test_keys.webhook_secret ? '***SET***' : 'EMPTY',
        // Show full lengths to verify truncation
        api_key_length: c.test_keys.api_key?.length || 0,
        secret_key_length: c.test_keys.secret_key?.length || 0,
      } : null,
      live_keys: c.live_keys ? {
        api_key: c.live_keys.api_key ? c.live_keys.api_key.substring(0, 12) + '...' : 'EMPTY',
        secret_key: c.live_keys.secret_key ? c.live_keys.secret_key.substring(0, 20) + '...' : 'EMPTY',
        api_key_length: c.live_keys.api_key?.length || 0,
        secret_key_length: c.live_keys.secret_key?.length || 0,
      } : null,
    }))

    // Also show env vars (partial)
    const envInfo = {
      KLARNA_API_KEY: process.env.KLARNA_API_KEY
        ? process.env.KLARNA_API_KEY.substring(0, 12) + '...' + process.env.KLARNA_API_KEY.slice(-6)
        : 'NOT SET',
      KLARNA_SECRET_KEY: process.env.KLARNA_SECRET_KEY
        ? process.env.KLARNA_SECRET_KEY.substring(0, 20) + '...' + process.env.KLARNA_SECRET_KEY.slice(-6)
        : 'NOT SET',
      KLARNA_TEST_MODE: process.env.KLARNA_TEST_MODE || 'NOT SET (defaults to true)',
    }

    // Quick API test
    let apiTest = null
    if (configs[0]) {
      const config = configs[0]
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      const apiKey = keys?.api_key || process.env.KLARNA_API_KEY
      const secretKey = keys?.secret_key || process.env.KLARNA_SECRET_KEY
      const baseURL = isLive ? "https://api.klarna.com" : "https://api.playground.klarna.com"

      try {
        const basicAuth = Buffer.from(`${apiKey}:${secretKey}`).toString("base64")
        const testRes = await fetch(`${baseURL}/payments/v1/sessions`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            purchase_country: "NL",
            purchase_currency: "EUR",
            locale: "en-NL",
            order_amount: 100,
            order_tax_amount: 0,
            order_lines: [{
              type: "physical",
              name: "Test",
              quantity: 1,
              unit_price: 100,
              tax_rate: 0,
              total_amount: 100,
              total_tax_amount: 0,
            }],
          }),
        })

        const testBody = await testRes.text()
        apiTest = {
          endpoint: baseURL,
          status: testRes.status,
          statusText: testRes.statusText,
          response: testBody.substring(0, 500),
          auth_header_preview: `Basic ${basicAuth.substring(0, 20)}...`,
        }
      } catch (err: any) {
        apiTest = { error: err.message }
      }
    }

    res.json({ gateway_configs: result, env_vars: envInfo, api_test: apiTest })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
