// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GATEWAY_CONFIG_MODULE } from "../../../modules/gateway-config"
import type GatewayConfigModuleService from "../../../modules/gateway-config/service"

/**
 * GET /.well-known/apple-developer-merchantid-domain-association
 *
 * Apple Pay domain verification file endpoint.
 * Returns the domain association file content stored in the gateway config metadata.
 * This is required by Apple for Apple Pay on the web.
 *
 * The verification file content should be set in admin:
 * Settings → Payment Gateways → Mollie → metadata.apple_pay_verification_file
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const gatewayService = req.scope.resolve(
      GATEWAY_CONFIG_MODULE
    ) as GatewayConfigModuleService

    // Find Mollie gateway config with Apple Pay verification file
    const gateways = await gatewayService.listGatewayConfigs(
      { provider: "mollie", is_active: true },
      { take: 1 }
    )

    const gateway = gateways[0]
    const verificationFile = gateway?.metadata?.apple_pay_verification_file

    if (!verificationFile) {
      res.status(404).send("Apple Pay verification file not configured")
      return
    }

    res.setHeader("Content-Type", "text/plain")
    res.send(verificationFile)
  } catch (error: any) {
    res.status(500).send("Internal server error")
  }
}
