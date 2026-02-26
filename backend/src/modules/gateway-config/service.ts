import { MedusaService } from "@medusajs/framework/utils"
import GatewayConfig from "./models/gateway-config"
import PaymentMethodConfig from "./models/payment-method-config"

const BaseService = MedusaService({
  GatewayConfig,
  PaymentMethodConfig,
})

class GatewayConfigModuleService extends BaseService {
  private __parentDeleteGatewayConfigs: any

  constructor(...args: any[]) {
    super(...args)
    // Store the auto-generated delete before overriding
    this.__parentDeleteGatewayConfigs = this.deleteGatewayConfigs
    this.deleteGatewayConfigs = this.__deleteWithCascade as any
  }

  /**
   * Custom delete that handles FK constraint:
   * PaymentMethodConfig → GatewayConfig has no ON DELETE CASCADE,
   * so we delete child records first.
   */
  private __deleteWithCascade = async (ids: string | string[]): Promise<void> => {
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
    await this.__parentDeleteGatewayConfigs(idArray)
  }
}

export default GatewayConfigModuleService
