// @ts-nocheck
/**
 * Huset (3PLhuset / C-Bolaget, Landvetter SE) WMS configuration.
 *
 * Env-based config (no DB table — single-warehouse, single-project setup).
 * The SOAP endpoint + auth values come from Christoffer Andersson's onboarding
 * email (2026-06-11): CompanyId 99, SalesOrgId 120, IntegrationId 5, CountryId CZE.
 * Endpoint verified against the public WSDL: https://integration.3plhuset.com/wms.asmx?WSDL
 */

export type HusetConfig = {
  enabled: boolean
  endpoint: string
  companyId: string
  hashKey: string
  integrationId: number
  authCountryId: string
  salesOrgId: number
  logisticsMethodId: number
  /** Single-SKU project: when set, every physical item maps to this ArticleRef */
  articleRef: string
  /** Optional JSON map { "MEDUSA_SKU": { "sku": "HUSET_SKU", "qty": 1 } } for bundles */
  skuMap: Record<string, { sku: string; qty: number }>
  holdMinutes: number
  retryMaxAttempts: number
  retryIntervalMinutes: number
  /** Passed to OverrideAdress (string per WSDL). Sample from Huset uses "false". */
  overrideAddress: string
  /** Which project routes to Huset */
  projectSlug: string
}

export function getHusetConfig(): HusetConfig {
  let skuMap: Record<string, { sku: string; qty: number }> = {}
  if (process.env.HUSET_SKU_MAP) {
    try {
      skuMap = JSON.parse(process.env.HUSET_SKU_MAP)
    } catch {
      console.error("[Huset] HUSET_SKU_MAP is not valid JSON — ignoring")
    }
  }

  return {
    enabled: process.env.HUSET_ENABLED === "true",
    endpoint: process.env.HUSET_ENDPOINT || "https://integration.3plhuset.com/wms.asmx",
    companyId: process.env.HUSET_COMPANY_ID || "99",
    hashKey: process.env.HUSET_HASHKEY || "",
    integrationId: Number(process.env.HUSET_INTEGRATION_ID || 5),
    authCountryId: process.env.HUSET_AUTH_COUNTRY_ID || "CZE",
    salesOrgId: Number(process.env.HUSET_SALES_ORG_ID || 120),
    logisticsMethodId: Number(process.env.HUSET_LOGISTICS_METHOD_ID || 1),
    articleRef: process.env.HUSET_ARTICLE_REF || "",
    skuMap,
    holdMinutes: Number(process.env.HUSET_ORDER_HOLD_MINUTES || 15),
    retryMaxAttempts: Number(process.env.HUSET_RETRY_MAX_ATTEMPTS || 10),
    retryIntervalMinutes: Number(process.env.HUSET_RETRY_INTERVAL_MINUTES || 5),
    overrideAddress: process.env.HUSET_OVERRIDE_ADDRESS || "false",
    projectSlug: process.env.HUSET_PROJECT_SLUG || "slipp-taket",
  }
}
