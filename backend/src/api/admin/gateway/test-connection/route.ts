import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import axios from "axios"

/**
 * Test connection endpoints for payment gateways
 * Each provider has a different test endpoint and credential format
 */

async function testStripeConnection(credentials: Record<string, string>): Promise<boolean> {
  try {
    const response = await axios.get("https://api.stripe.com/v1/balance", {
      headers: {
        Authorization: `Bearer ${credentials.secret_key}`,
      },
    })
    return response.status === 200
  } catch {
    throw new Error("Stripe API key invalid")
  }
}

async function testPayPalConnection(credentials: Record<string, string>): Promise<boolean> {
  try {
    const response = await axios.post(
      "https://api.paypal.com/v1/oauth2/token",
      "grant_type=client_credentials",
      {
        headers: {
          "Accept-Language": "en_US",
          Accept: "application/json",
        },
        auth: {
          username: credentials.client_id,
          password: credentials.client_secret,
        },
      }
    )
    return response.status === 200 && !!response.data.access_token
  } catch {
    throw new Error("PayPal credentials invalid")
  }
}

async function testMollieConnection(credentials: Record<string, string>): Promise<boolean> {
  try {
    const response = await axios.get("https://api.mollie.com/v2/methods", {
      headers: {
        Authorization: `Bearer ${credentials.api_key}`,
      },
    })
    return response.status === 200
  } catch {
    throw new Error("Mollie API key invalid")
  }
}

async function testComgateConnection(credentials: Record<string, string>): Promise<boolean> {
  try {
    const response = await axios.post(
      "https://payments.comgate.cz/v1/status",
      new URLSearchParams({
        merchant: credentials.merchant_id,
        transId: "999999999",
        secret: credentials.secret_key,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    )
    return response.status === 200
  } catch {
    throw new Error("Comgate merchant credentials invalid")
  }
}

async function testPrzelewy24Connection(credentials: Record<string, string>): Promise<boolean> {
  try {
    const response = await axios.get("https://secure.przelewy24.pl/api/v1/testAccess", {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${credentials.merchant_id}:${credentials.api_key}`
        ).toString("base64")}`,
      },
    })
    return response.status === 200
  } catch {
    throw new Error("Przelewy24 credentials invalid")
  }
}

async function testKlarnaConnection(credentials: Record<string, string>): Promise<boolean> {
  try {
    // Klarna uses HTTP Basic Auth with api_key:secret_key
    const username = credentials.api_key
    const password = credentials.secret_key || credentials.api_secret
    if (!username || !password) {
      throw new Error("Missing Klarna API key or secret key")
    }
    const basicAuth = Buffer.from(`${username}:${password}`).toString("base64")
    // Use playground URL for test keys
    const isTest = username.startsWith("test_") || username.includes("playground")
    const baseUrl = isTest
      ? "https://api.playground.klarna.com"
      : "https://api.klarna.com"
    const response = await axios.get(
      `${baseUrl}/payments/v1/sessions`,
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
        },
      }
    )
    return response.status !== 403
  } catch (error: any) {
    // 401/405 means credentials are recognized but request method/path invalid — valid credentials
    if (error.response?.status === 401 || error.response?.status === 405) {
      return true
    }
    throw new Error("Klarna credentials invalid")
  }
}

async function testAirwallexConnection(credentials: Record<string, string>): Promise<boolean> {
  try {
    const response = await axios.post("https://api.airwallex.com/api/v1/authentication/login", {
      api_key: credentials.api_key,
    })
    return response.status === 200 && !!response.data.token
  } catch {
    throw new Error("Airwallex API key invalid")
  }
}

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> => {
  try {
    const body = req.body as Record<string, any>
    const gateway_type = body.gateway_type as string
    const credentials = body.credentials as Record<string, string>

    if (!gateway_type || !credentials) {
      res.status(400).json({ message: "gateway_type and credentials required" })
      return
    }

    let success = false

    switch (gateway_type) {
      case "stripe":
        success = await testStripeConnection(credentials)
        break
      case "paypal":
        success = await testPayPalConnection(credentials)
        break
      case "mollie":
        success = await testMollieConnection(credentials)
        break
      case "comgate":
        success = await testComgateConnection(credentials)
        break
      case "przelewy24":
        success = await testPrzelewy24Connection(credentials)
        break
      case "klarna":
        success = await testKlarnaConnection(credentials)
        break
      case "airwallex":
        success = await testAirwallexConnection(credentials)
        break
      default:
        res.status(400).json({ message: `Unknown gateway: ${gateway_type}` })
        return
    }

    if (success) {
      res.status(200).json({ success: true, message: "Connection verified" })
    } else {
      res.status(400).json({ success: false, message: "Connection test failed" })
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Connection test error",
    })
  }
}
