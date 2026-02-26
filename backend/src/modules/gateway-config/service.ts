import { MedusaService } from "@medusajs/framework/utils"
import GatewayConfig from "./models/gateway-config"
import PaymentMethodConfig from "./models/payment-method-config"

class GatewayConfigModuleService extends MedusaService({
  GatewayConfig,
  PaymentMethodConfig,
}) {
  /**
   * Override delete to handle FK constraint:
   * PaymentMethodConfig → GatewayConfig has no ON DELETE CASCADE,
   * so we need to delete child records first.
   */
  async deleteGatewayConfigs(ids: string | string[]): Promise<void> {
    const idArray = Array.isArray(ids) ? ids : [ids]
    for (const id of idArray) {
      const methods = await this.listPaymentMethodConfigs(
        { gateway_id: id } as any,
        { take: 1000 }
      )
      if (methods.length > 0) {
        await this.deletePaymentMethodConfigs(
          methods.map((m: any) => m.id)
        )
      }
    }
    await super.deleteGatewayConfigs(idArray)
  }
}

export default GatewayConfigModuleService
