import { MedusaService } from "@medusajs/framework/utils"
import GatewayConfig from "./models/gateway-config"
import PaymentMethodConfig from "./models/payment-method-config"

class GatewayConfigModuleService extends MedusaService({
  GatewayConfig,
  PaymentMethodConfig,
}) {
  /**
   * Override delete to cascade-delete child payment_method_config records first.
   * The FK constraint has no ON DELETE CASCADE, so we handle it here.
   */
  async deleteGatewayConfigs(ids: string | string[]): Promise<void> {
    const idArray = Array.isArray(ids) ? ids : [ids]

    for (const id of idArray) {
      // Delete child payment method configs first
      const methods = await this.listPaymentMethodConfigs(
        { gateway_id: id } as any,
        { take: 1000 }
      )

      if (methods.length > 0) {
        const methodIds = methods.map((m: any) => m.id)
        await this.deletePaymentMethodConfigs(methodIds)
      }
    }

    // Now delete the gateway(s) themselves
    await super.deleteGatewayConfigs(idArray)
  }
}

export default GatewayConfigModuleService
