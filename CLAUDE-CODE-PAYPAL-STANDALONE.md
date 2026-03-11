# Prompt pro Claude Code: Standalone PayPal integrace

## Příkaz (zkopíruj do Claude Code):

Pracuj na staging branchi. Přečti soubor CLAUDE-CODE-PAYPAL-STANDALONE.md v rootu projektu — obsahuje kompletní instrukce s PayPal API referencí a 6 fází implementace. PayPal je na frontendu částečně funkční (PayPalScriptProvider + PayPalButtons existují), ale chybí: vlastní backend payment provider modul (teď jede přes vestavěný Medusa plugin bez kontroly), webhook handler, refund logika, capture z admin UI, a napojení na gateway_config systém (credentials se berou z env vars místo z admin panelu). Implementuj kompletní standalone PayPal integraci, kde se credentials zadávají v admin Settings → Payment Gateways a celý flow funguje end-to-end. Po každé fázi: git add . && git commit -m 'popis' && git push origin staging. Nikdy nepushuj na master.

---

## ANALÝZA SOUČASNÉHO STAVU

### Co existuje a funguje:

**Storefront (frontend) — většinou OK:**
- `@paypal/paypal-js` a `@paypal/react-paypal-js` balíčky nainstalované v package.json
- `PayPalPaymentButton` v payment-button/index.tsx — volá `actions.order.authorize()`, po schválení `placeOrder()`
- `PayPalScriptProvider` v payment-wrapper/index.tsx — načte PayPal SDK s `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
- `isPaypal()` helper v constants.tsx — detekuje PayPal provider
- PayPal SVG ikona existuje
- Provider ID: `pp_paypal_paypal`

**Backend — částečně:**
- Test connection pro PayPal v gateway/test-connection/route.ts — volá `/v1/oauth2/token`
- Tracking dispatcher — posílá tracking info na PayPal API `/v2/checkout/orders/{id}/track`
- Payment logger — podporuje PayPal jako gateway type
- Upsell charge — podporuje PayPal vault token pro one-click platby
- Admin UI komponenty — PayPal ikony, barvy, labels v order detail

### Co CHYBÍ (hlavní problémy):

**PROBLÉM 1 — Žádný vlastní PayPal payment provider modul:**
- Neexistuje `/backend/src/modules/payment-paypal/` adresář
- PayPal pravděpodobně jede přes vestavěný `@medusajs/payment-paypal` plugin
- Nemáš kontrolu nad payment flow, nemůžeš přidat vlastní logiku
- Credentials se berou z environment variables, NE z admin panelu (gateway_config)

**PROBLÉM 2 — Žádný webhook handler:**
- Neexistuje `/backend/src/api/webhooks/paypal/route.ts`
- PayPal posílá webhooky, ale tvůj systém je nepřijímá
- Pokud platba selže nebo se změní stav, nedozvíš se to
- Refundy provedené přímo v PayPal dashboardu se v tvém systému neprojeví

**PROBLÉM 3 — Žádná refund logika:**
- Backend nemá endpoint pro refund přes PayPal API
- Admin UI nemá Refund tlačítko pro PayPal objednávky
- Refundy musíš dělat ručně v PayPal dashboardu

**PROBLÉM 4 — Credentials mimo gateway_config:**
- `NEXT_PUBLIC_PAYPAL_CLIENT_ID` je hardcoded v env vars
- `PAYPAL_CLIENT_SECRET` je v env vars
- Nejsou v admin panelu pod Settings → Payment Gateways
- Nemůžeš přepínat live/test mode z admin UI
- Nemůžeš mít více PayPal účtů pro různé sales channels

**PROBLÉM 5 — Order metadata subscriber neukládá PayPal IDs:**
- `order-placed-payment-metadata.ts` ukládá Mollie, Klarna, Comgate, P24, Airwallex IDs
- PayPal `paypalOrderId` se ukládá jen z tracking dispatcheru, ne při order.placed
- Webhook handler nemá jak najít objednávku bez uloženého PayPal Order ID

---

## PAYPAL REST API V2 REFERENCE

### Base URLs:
- Sandbox (test): `https://api-m.sandbox.paypal.com`
- Production (live): `https://api-m.paypal.com`

### Autentizace:
OAuth 2.0 — nejdřív získej access token, pak ho použij v dalších požadavcích:

```
POST /v1/oauth2/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)

Body: grant_type=client_credentials

Response 200:
{
  "access_token": "A21AAF...",
  "token_type": "Bearer",
  "expires_in": 32400    // 9 hodin
}
```

Pak ve všech dalších požadavcích:
```
Authorization: Bearer A21AAF...
```

### Endpointy:

**1. Create Order** (backend → PayPal)
```
POST /v2/checkout/orders
Content-Type: application/json

Request body:
{
  "intent": "AUTHORIZE",                    // nebo "CAPTURE" pro okamžité stržení
  "purchase_units": [{
    "reference_id": "MEDUSA-ORDER-123",
    "amount": {
      "currency_code": "EUR",
      "value": "29.99",                     // string, ne číslo!
      "breakdown": {
        "item_total": { "currency_code": "EUR", "value": "24.79" },
        "tax_total": { "currency_code": "EUR", "value": "5.20" }
      }
    },
    "items": [{
      "name": "Laat los wat je kapotmaakt",
      "unit_amount": { "currency_code": "EUR", "value": "24.79" },
      "tax": { "currency_code": "EUR", "value": "5.20" },
      "quantity": "1",
      "category": "PHYSICAL_GOODS"
    }],
    "shipping": {
      "name": { "full_name": "Jan Jansen" },
      "address": {
        "address_line_1": "Keizersgracht 1",
        "admin_area_2": "Amsterdam",
        "postal_code": "1015AA",
        "country_code": "NL"
      }
    }
  }],
  "payment_source": {
    "paypal": {
      "experience_context": {
        "payment_method_preference": "IMMEDIATE_PAYMENT_REQUIRED",
        "brand_name": "EverChapter",
        "locale": "nl-NL",
        "landing_page": "LOGIN",
        "user_action": "PAY_NOW",
        "return_url": "https://example.com/order/confirmed",
        "cancel_url": "https://example.com/checkout"
      }
    }
  }
}

Response 200:
{
  "id": "5O190127TN364715T",                // PayPal Order ID
  "status": "CREATED",
  "links": [
    { "rel": "approve", "href": "https://www.paypal.com/checkoutnow?token=5O19..." }
  ]
}
```

**2. Authorize Order** (po zákaznickém schválení)
```
POST /v2/checkout/orders/{order_id}/authorize
Content-Type: application/json

Response 200:
{
  "id": "5O190127TN364715T",
  "status": "COMPLETED",
  "purchase_units": [{
    "payments": {
      "authorizations": [{
        "id": "3C679366HH908993F",          // Authorization ID
        "status": "CREATED",
        "amount": { "currency_code": "EUR", "value": "29.99" },
        "expiration_time": "2026-03-28T..."  // 29 dní platnost
      }]
    }
  }]
}
```
⚠️ Autorizace platí **29 dní**. Po vypršení se peníze uvolní.

**3. Capture Authorized Payment** (po expedici)
```
POST /v2/payments/authorizations/{authorization_id}/capture
Content-Type: application/json

Request body:
{
  "amount": {
    "currency_code": "EUR",
    "value": "29.99"
  },
  "final_capture": true
}

Response 201:
{
  "id": "8F148933LY9388354",                // Capture ID
  "status": "COMPLETED",
  "amount": { "currency_code": "EUR", "value": "29.99" }
}
```

**4. Capture Order přímo** (pro intent=CAPTURE, okamžité stržení)
```
POST /v2/checkout/orders/{order_id}/capture
Content-Type: application/json

Response 201:
{
  "id": "5O190127TN364715T",
  "status": "COMPLETED",
  "purchase_units": [{
    "payments": {
      "captures": [{
        "id": "8F148933LY9388354",
        "status": "COMPLETED"
      }]
    }
  }]
}
```

**5. Refund Captured Payment**
```
POST /v2/payments/captures/{capture_id}/refund
Content-Type: application/json

Request body (částečný refund):
{
  "amount": {
    "currency_code": "EUR",
    "value": "15.00"
  },
  "note_to_payer": "Refund for returned item"
}

Request body (plný refund):
{}     // prázdný objekt = plný refund

Response 201:
{
  "id": "1JU08902781691411",                 // Refund ID
  "status": "COMPLETED",
  "amount": { "currency_code": "EUR", "value": "15.00" }
}
```

**6. Get Order Details**
```
GET /v2/checkout/orders/{order_id}

Response 200:
{
  "id": "5O190127TN364715T",
  "status": "APPROVED" | "COMPLETED" | "VOIDED",
  "purchase_units": [...],
  "payer": {
    "email_address": "jan@example.nl",
    "name": { "given_name": "Jan", "surname": "Jansen" }
  }
}
```

**7. Add Tracking Info**
```
POST /v2/checkout/orders/{order_id}/track
Content-Type: application/json

Request body:
{
  "tracking_number": "PKG123456",
  "carrier": "DHL",
  "capture_id": "8F148933LY9388354",
  "notify_payer": true
}
```

### Webhook Event Types:

Registruj webhook URL v PayPal Developer Dashboard → Webhooks → Add Webhook:

```
CHECKOUT.ORDER.APPROVED          — zákazník schválil platbu
CHECKOUT.ORDER.COMPLETED         — objednávka dokončena
PAYMENT.AUTHORIZATION.CREATED    — autorizace vytvořena
PAYMENT.AUTHORIZATION.VOIDED     — autorizace zrušena (expired)
PAYMENT.CAPTURE.COMPLETED        — platba stržena (capture OK)
PAYMENT.CAPTURE.DENIED           — capture zamítnut
PAYMENT.CAPTURE.PENDING          — capture čeká na zpracování
PAYMENT.CAPTURE.REFUNDED         — refund proveden
PAYMENT.CAPTURE.REVERSED         — platba vrácena (dispute)
CUSTOMER.DISPUTE.CREATED         — zákazník otevřel spor
CUSTOMER.DISPUTE.RESOLVED        — spor vyřešen
```

Webhook payload:
```json
{
  "id": "WH-1234567890",
  "event_type": "PAYMENT.CAPTURE.COMPLETED",
  "resource": {
    "id": "8F148933LY9388354",              // Capture ID
    "status": "COMPLETED",
    "amount": { "currency_code": "EUR", "value": "29.99" }
  },
  "summary": "Payment completed for EUR 29.99"
}
```

Webhook verifikace — volej PayPal API pro ověření:
```
POST /v1/notifications/verify-webhook-signature
{
  "auth_algo": "SHA256withRSA",
  "cert_url": "https://api.paypal.com/v1/notifications/certs/...",
  "transmission_id": "...",
  "transmission_sig": "...",
  "transmission_time": "...",
  "webhook_id": "YOUR_WEBHOOK_ID",
  "webhook_event": { ... celý event payload ... }
}

Response: { "verification_status": "SUCCESS" }
```

### PayPal JavaScript SDK (frontend):

Script se načte přes `@paypal/react-paypal-js` wrapper — už máš nainstalovaný.

```tsx
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js"

// Provider (už existuje v payment-wrapper):
<PayPalScriptProvider options={{
  "client-id": clientId,
  currency: "EUR",
  intent: "authorize",       // nebo "capture"
  components: "buttons",
}}>
  <PayPalButtons
    createOrder={(data, actions) => {
      // Buď frontend vytvoří order přes actions.order.create()
      // NEBO backend vytvoří order a vrátí ID
      return actions.order.create({
        purchase_units: [{
          amount: { value: "29.99" }
        }]
      })
    }}
    onApprove={async (data, actions) => {
      // Pro AUTHORIZE intent:
      const authorization = await actions.order.authorize()
      // authorization.purchase_units[0].payments.authorizations[0].id

      // Pro CAPTURE intent:
      const capture = await actions.order.capture()

      // Po úspěchu → dokonči objednávku v Medusa
    }}
    onError={(err) => console.error(err)}
    onCancel={() => console.log("Payment cancelled")}
    style={{ layout: "vertical", color: "gold", shape: "rect" }}
  />
</PayPalScriptProvider>
```

---

## IMPLEMENTACE — 6 FÁZÍ

### FÁZE 1: Backend — PayPal payment provider modul

Vytvoř vlastní PayPal payment provider modul, který nahradí vestavěný Medusa plugin a bere credentials z gateway_config:

**1.1 Vytvoř PayPal API klienta:**

**Nový soubor:** `backend/src/modules/payment-paypal/api-client.ts`

```typescript
import axios, { AxiosInstance } from 'axios'

interface PayPalTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface IPayPalOrderData {
  intent: 'AUTHORIZE' | 'CAPTURE'
  purchase_units: Array<{
    reference_id?: string
    amount: {
      currency_code: string
      value: string
      breakdown?: {
        item_total?: { currency_code: string; value: string }
        tax_total?: { currency_code: string; value: string }
        shipping?: { currency_code: string; value: string }
      }
    }
    items?: Array<{
      name: string
      unit_amount: { currency_code: string; value: string }
      tax?: { currency_code: string; value: string }
      quantity: string
      category?: 'PHYSICAL_GOODS' | 'DIGITAL_GOODS'
    }>
    shipping?: {
      name?: { full_name: string }
      address?: {
        address_line_1: string
        admin_area_2: string
        postal_code: string
        country_code: string
      }
    }
  }>
  payment_source?: {
    paypal?: {
      experience_context?: {
        brand_name?: string
        locale?: string
        landing_page?: string
        user_action?: string
        return_url?: string
        cancel_url?: string
      }
    }
  }
}

export class PayPalApiClient {
  private httpClient: AxiosInstance
  private clientId: string
  private clientSecret: string
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor(config: { client_id: string; client_secret: string; mode: 'live' | 'test' }) {
    this.clientId = config.client_id
    this.clientSecret = config.client_secret

    const baseURL = config.mode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com'

    this.httpClient = axios.create({ baseURL })
  }

  private async getAccessToken(): Promise<string> {
    // Použij cached token pokud je platný
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    const response = await this.httpClient.post<PayPalTokenResponse>(
      '/v1/oauth2/token',
      'grant_type=client_credentials',
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: { username: this.clientId, password: this.clientSecret },
      }
    )

    this.accessToken = response.data.access_token
    this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000  // 60s buffer
    return this.accessToken
  }

  private async authHeaders() {
    const token = await this.getAccessToken()
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  }

  async createOrder(data: IPayPalOrderData) {
    const headers = await this.authHeaders()
    const response = await this.httpClient.post('/v2/checkout/orders', data, { headers })
    return response.data
  }

  async authorizeOrder(orderId: string) {
    const headers = await this.authHeaders()
    const response = await this.httpClient.post(`/v2/checkout/orders/${orderId}/authorize`, {}, { headers })
    return response.data
  }

  async captureOrder(orderId: string) {
    const headers = await this.authHeaders()
    const response = await this.httpClient.post(`/v2/checkout/orders/${orderId}/capture`, {}, { headers })
    return response.data
  }

  async captureAuthorization(authorizationId: string, amount?: { currency_code: string; value: string }) {
    const headers = await this.authHeaders()
    const body: any = { final_capture: true }
    if (amount) body.amount = amount
    const response = await this.httpClient.post(`/v2/payments/authorizations/${authorizationId}/capture`, body, { headers })
    return response.data
  }

  async refundCapture(captureId: string, data?: { amount?: { currency_code: string; value: string }; note_to_payer?: string }) {
    const headers = await this.authHeaders()
    const response = await this.httpClient.post(`/v2/payments/captures/${captureId}/refund`, data || {}, { headers })
    return response.data
  }

  async getOrder(orderId: string) {
    const headers = await this.authHeaders()
    const response = await this.httpClient.get(`/v2/checkout/orders/${orderId}`, { headers })
    return response.data
  }

  async voidAuthorization(authorizationId: string) {
    const headers = await this.authHeaders()
    const response = await this.httpClient.post(`/v2/payments/authorizations/${authorizationId}/void`, {}, { headers })
    return response.data
  }

  async addTracking(orderId: string, captureId: string, trackingNumber: string, carrier: string) {
    const headers = await this.authHeaders()
    const response = await this.httpClient.post(`/v2/checkout/orders/${orderId}/track`, {
      tracking_number: trackingNumber,
      carrier: carrier.toUpperCase(),
      capture_id: captureId,
      notify_payer: true,
    }, { headers })
    return response.data
  }

  async verifyWebhookSignature(webhookId: string, headers: Record<string, string>, body: any) {
    const authHeaders = await this.authHeaders()
    const response = await this.httpClient.post('/v1/notifications/verify-webhook-signature', {
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: body,
    }, { headers: authHeaders })
    return response.data.verification_status === 'SUCCESS'
  }
}
```

**1.2 Vytvoř PayPal payment provider service:**

**Nový soubor:** `backend/src/modules/payment-paypal/service.ts`

Provider musí implementovat `AbstractPaymentProvider` z MedusaJS s těmito metodami:
- `initiatePayment()` — vytvoří PayPal order, vrátí order ID pro frontend
- `authorizePayment()` — zavolá PayPal authorize endpoint (nebo ověří stav po authorize na frontendu)
- `capturePayment()` — zavolá PayPal capture endpoint
- `refundPayment()` — zavolá PayPal refund endpoint s capture_id
- `cancelPayment()` — zavolá void authorization
- `getPaymentStatus()` — vrátí aktuální stav z PayPal
- `deletePayment()` — no-op
- `getWebhookActionAndData()` — zpracuje webhook event

**DŮLEŽITÉ:** Service musí brát credentials z gateway_config (databáze), ne z env vars:

```typescript
private async getPayPalClient(): Promise<PayPalApiClient> {
  // 1. Zkus gateway_config z databáze
  const gatewayConfigs = await this.gatewayConfigService.list({
    provider: 'paypal',
    is_active: true,
  })

  if (gatewayConfigs.length > 0) {
    const config = gatewayConfigs[0]
    const keys = config.mode === 'live' ? config.live_keys : config.test_keys
    return new PayPalApiClient({
      client_id: keys.client_id,
      client_secret: keys.client_secret,
      mode: config.mode,
    })
  }

  // 2. Fallback na env vars
  return new PayPalApiClient({
    client_id: process.env.PAYPAL_CLIENT_ID!,
    client_secret: process.env.PAYPAL_CLIENT_SECRET!,
    mode: process.env.PAYPAL_MODE === 'live' ? 'live' : 'test',
  })
}
```

**1.3 Vytvoř modul index:**

**Nový soubor:** `backend/src/modules/payment-paypal/index.ts`

```typescript
import { Module } from '@medusajs/framework/utils'
import PayPalPaymentProvider from './service'

export const PAYPAL_MODULE_NAME = 'payment_paypal'

export default Module(PAYPAL_MODULE_NAME, {
  service: PayPalPaymentProvider,
})
```

**1.4 Zaregistruj v medusa-config.js:**

```javascript
// Přidej do modules array:
{ resolve: "./src/modules/payment-paypal" }

// V payment providers:
payment: {
  providers: [
    { resolve: "./src/modules/payment-paypal", id: "paypal" },
    // ... ostatní providery
  ]
}
```

⚠️ **Odstraň starý `@medusajs/payment-paypal` plugin pokud existuje** — nahrazujeme ho vlastním modulem.

### FÁZE 2: Webhook handler

**Nový soubor:** `backend/src/api/webhooks/paypal/route.ts`

```typescript
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework'

// PayPal webhook event types a jejich mapping
const EVENT_MAP: Record<string, { activity_event: string; status: string }> = {
  'CHECKOUT.ORDER.APPROVED':         { activity_event: 'order_approved',        status: 'pending' },
  'CHECKOUT.ORDER.COMPLETED':        { activity_event: 'order_completed',       status: 'success' },
  'PAYMENT.AUTHORIZATION.CREATED':   { activity_event: 'authorization_created', status: 'success' },
  'PAYMENT.AUTHORIZATION.VOIDED':    { activity_event: 'authorization_voided',  status: 'failed' },
  'PAYMENT.CAPTURE.COMPLETED':       { activity_event: 'capture_completed',     status: 'success' },
  'PAYMENT.CAPTURE.DENIED':          { activity_event: 'capture_denied',        status: 'failed' },
  'PAYMENT.CAPTURE.PENDING':         { activity_event: 'capture_pending',       status: 'pending' },
  'PAYMENT.CAPTURE.REFUNDED':        { activity_event: 'refund_completed',      status: 'success' },
  'PAYMENT.CAPTURE.REVERSED':        { activity_event: 'payment_reversed',      status: 'failed' },
  'CUSTOMER.DISPUTE.CREATED':        { activity_event: 'dispute_created',       status: 'failed' },
  'CUSTOMER.DISPUTE.RESOLVED':       { activity_event: 'dispute_resolved',      status: 'success' },
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const event = req.body as any
    const eventType = event.event_type

    // 1. Ověř webhook podpis
    // Načti PayPal credentials z gateway_config
    // Zavolej paypalClient.verifyWebhookSignature() s webhook_id z gateway_config

    // 2. Najdi objednávku
    // Hledej v order.metadata: paypalOrderId, payment_paypal_order_id
    // Nebo prohledej payment sessions

    // 3. Aktualizuj stav
    const mapping = EVENT_MAP[eventType]
    if (!mapping) {
      return res.status(200).json({ received: true, handled: false })
    }

    // 4. Zapiš do payment_activity_log
    // 5. Vrať 200 OK (PayPal vyžaduje odpověď do 30 sekund)

    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('PayPal webhook error:', error)
    return res.status(200).json({ received: true })  // Vždy vrať 200, jinak PayPal retry
  }
}
```

**ÚKOL:** Implementuj kompletní webhook handler podle vzoru z `/backend/src/api/webhooks/mollie/route.ts`. Přidej verifikaci podpisu přes PayPal API. Webhook ID se bere z gateway_config.live_keys.webhook_id nebo test_keys.webhook_id.

### FÁZE 3: Order metadata subscriber

**Soubor:** `backend/src/subscribers/order-placed-payment-metadata.ts`

Přidej PayPal do existujícího subscriberu:

```typescript
// Přidej handling pro PayPal vedle Mollie, Klarna, Comgate, P24, Airwallex:

if (providerId === 'paypal' || providerId?.includes('paypal')) {
  const paypalOrderId = paymentData?.paypalOrderId || paymentData?.orderID || paymentData?.id
  const paypalAuthId = paymentData?.authorizationId

  if (paypalOrderId) {
    updatedMetadata.paypalOrderId = paypalOrderId
    updatedMetadata.payment_paypal_order_id = paypalOrderId
  }
  if (paypalAuthId) {
    updatedMetadata.payment_paypal_authorization_id = paypalAuthId
  }
  updatedMetadata.payment_method = 'paypal'
}
```

### FÁZE 4: Frontend — napojení na gateway_config credentials

**4.1 PayPal Client ID z backendu místo env var:**

Aktuálně `payment-wrapper/index.tsx` používá `process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID`. To je špatně — credentials by se měly brát z gateway_config přes API.

**Řešení:** Endpoint `/store/payment-options` už vrací gateway data. Přidej `client_id` pro PayPal:

```typescript
// V payment-options route — když je provider PayPal:
if (gateway.provider === 'paypal') {
  const keys = gateway.mode === 'live' ? gateway.live_keys : gateway.test_keys
  methodData.client_id = keys.client_id  // publishable, bezpečné poslat na frontend
  methodData.currency = gateway.supported_currencies?.[0] || 'EUR'
}
```

**4.2 Uprav PayPalScriptProvider:**

```typescript
// payment-wrapper/index.tsx — místo env var použij client_id z API:
if (isPaypal(paymentSession?.provider_id)) {
  const clientId = paymentSession?.data?.client_id || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
  if (clientId && cart) {
    return (
      <PayPalScriptProvider options={{
        "client-id": clientId,
        currency: cart.currency_code.toUpperCase(),
        intent: "authorize",
        components: "buttons",
      }}>
        {children}
      </PayPalScriptProvider>
    )
  }
}
```

**4.3 Ověř PayPalPaymentButton:**

Přečti existující `PayPalPaymentButton` v payment-button/index.tsx. Ověř:
- `createOrder` callback vrací PayPal order ID (z backend payment session)
- `onApprove` callback po authorize pošle authorization data na backend
- Error handling zobrazí chybovou hlášku zákazníkovi
- Po úspěchu se zavolá `placeOrder()`

### FÁZE 5: Admin UI — Capture a Refund

**5.1 Capture endpoint:**

**Nový soubor:** `backend/src/api/admin/custom/orders/[id]/capture-paypal/route.ts`

```typescript
export async function POST(req, res) {
  const { id } = req.params
  const order = await orderService.retrieve(id)

  // PayPal intent=AUTHORIZE → potřebuješ capture authorization
  const authorizationId = order.metadata?.payment_paypal_authorization_id

  if (!authorizationId) {
    // Zkus intent=CAPTURE — zavolej capture order
    const paypalOrderId = order.metadata?.paypalOrderId
    if (!paypalOrderId) return res.status(400).json({ error: 'No PayPal order/authorization ID' })

    const result = await paypalClient.captureOrder(paypalOrderId)
    // Ulož capture ID do metadata
    return res.json({ success: true, capture: result })
  }

  // Capture authorization
  const result = await paypalClient.captureAuthorization(authorizationId, {
    currency_code: order.currency_code.toUpperCase(),
    value: formatAmount(order.total),
  })

  // Ulož capture ID do metadata
  order.metadata.payment_paypal_capture_id = result.id
  order.metadata.payment_activity_log = [
    ...(order.metadata.payment_activity_log || []),
    {
      timestamp: new Date().toISOString(),
      event: 'capture',
      gateway: 'paypal',
      status: 'success',
      amount: order.total,
      currency: order.currency_code,
      transaction_id: result.id,
    }
  ]
  await orderService.update(id, { metadata: order.metadata })

  return res.json({ success: true, capture_id: result.id })
}
```

**5.2 Refund endpoint:**

**Nový soubor:** `backend/src/api/admin/custom/orders/[id]/refund-paypal/route.ts`

```typescript
export async function POST(req, res) {
  const { id } = req.params
  const { amount, reason } = req.body

  const order = await orderService.retrieve(id)
  const captureId = order.metadata?.payment_paypal_capture_id

  if (!captureId) {
    return res.status(400).json({ error: 'No PayPal capture ID — order must be captured first' })
  }

  const refundData: any = {}
  if (amount) {
    refundData.amount = {
      currency_code: order.currency_code.toUpperCase(),
      value: formatAmount(amount),
    }
  }
  if (reason) {
    refundData.note_to_payer = reason
  }

  const result = await paypalClient.refundCapture(captureId, refundData)

  // Zapiš do activity logu
  order.metadata.payment_activity_log = [
    ...(order.metadata.payment_activity_log || []),
    {
      timestamp: new Date().toISOString(),
      event: 'refund',
      gateway: 'paypal',
      status: 'success',
      amount: amount || order.total,
      currency: order.currency_code,
      transaction_id: result.id,
      detail: reason,
    }
  ]
  await orderService.update(id, { metadata: order.metadata })

  return res.json({ success: true, refund_id: result.id })
}
```

**5.3 Admin UI tlačítka:**

Na stránce order detail přidej pro PayPal objednávky:
- Badge: AUTHORIZED (žlutý) / CAPTURED (zelený) / REFUNDED (oranžový)
- Tlačítko "Capture Payment" pro authorized objednávky
- Tlačítko "Refund" s inputem na částku pro captured objednávky

### FÁZE 6: Gateway Config admin UI — PayPal nastavení

**Soubor:** `backend/src/admin/routes/settings-billing/page.tsx`

V sekci Payment Gateways ověř, že PayPal je v SUPPORTED_PROVIDERS a formulář pro přidání PayPal obsahuje:

```
Provider: PayPal
Fields:
  - Client ID (string) — PayPal Client ID
  - Client Secret (string, masked) — PayPal Secret
  - Webhook ID (string) — z PayPal Developer Dashboard
  - Mode: Live / Sandbox
  - Statement Descriptor (max 22 chars pro PayPal)
  - Supported Currencies: EUR, USD, GBP, CZK, PLN, SEK atd.
  - Sales Channels: přiřazení k sales channelům
  - Priority: 1-10
```

**ÚKOL:** Přečti existující admin UI. PayPal provider a ikona jsou tam (SUPPORTED_PROVIDERS a payment-method-icons.tsx). Ověř, že formulář pro credentials funguje správně a ukládá client_id, client_secret, webhook_id do live_keys/test_keys JSONB polí v gateway_config.

---

## VERIFIKACE

### Po FÁZI 1:
- [ ] `backend/src/modules/payment-paypal/` existuje s api-client.ts, service.ts, index.ts
- [ ] PayPal provider je registrovaný v medusa-config.js
- [ ] Credentials se berou z gateway_config (databáze), fallback na env vars
- [ ] initiatePayment() vytvoří PayPal order a vrátí order ID
- [ ] capturePayment() strhne peníze přes PayPal API
- [ ] refundPayment() vrátí peníze přes PayPal API

### Po FÁZI 2:
- [ ] `/api/webhooks/paypal/route.ts` existuje
- [ ] Webhook handler verifikuje podpis přes PayPal API
- [ ] Všechny event types jsou mapované (CAPTURE.COMPLETED, REFUNDED, DENIED, DISPUTE atd.)
- [ ] Webhook aktualizuje order metadata a payment_activity_log
- [ ] PayPal dostane 200 OK response do 30 sekund

### Po FÁZI 3:
- [ ] order-placed-payment-metadata.ts ukládá paypalOrderId a authorizationId
- [ ] Metadata obsahuje: paypalOrderId, payment_paypal_order_id, payment_paypal_authorization_id

### Po FÁZI 4:
- [ ] PayPal Client ID se bere z gateway_config (ne z env var)
- [ ] PayPalScriptProvider se inicializuje s client_id z API response
- [ ] PayPalPaymentButton funguje — zákazník vidí PayPal tlačítka
- [ ] Po schválení se authorization token/ID pošle na backend
- [ ] Objednávka se dokončí

### Po FÁZI 5:
- [ ] POST /admin/custom/orders/[id]/capture-paypal funguje
- [ ] POST /admin/custom/orders/[id]/refund-paypal funguje
- [ ] Admin UI má Capture a Refund tlačítka pro PayPal objednávky
- [ ] Activity log se aktualizuje po capture/refund

### Po FÁZI 6:
- [ ] PayPal lze přidat v Settings → Payment Gateways
- [ ] Client ID, Secret, Webhook ID se ukládají do gateway_config
- [ ] Test Connection ověří credentials přes OAuth token endpoint
- [ ] Mode (live/sandbox) se přepíná z admin UI

---

## DŮLEŽITÉ POZNÁMKY

- **PayPal Sandbox credentials:** Zeptej se uživatele. Vytvoří se na https://developer.paypal.com/dashboard/applications/sandbox
- **Webhook URL:** Musí se registrovat v PayPal Developer Dashboard → Webhooks. URL: `https://tvuj-backend.com/api/webhooks/paypal`
- **Authorization platnost:** 29 dní (o 1 den delší než Klarna)
- **Amounts:** PayPal používá STRING formát ("29.99"), ne integer minor units
- **Order lifetime:** PayPal order je platný 3 hodiny po vytvoření (lze prodloužit na 72h)
- **Intent:** Systém používá AUTHORIZE intent — peníze se strhnou až při capture po expedici
- **Starý plugin:** Pokud existuje `@medusajs/payment-paypal` v package.json, odinstaluj ho a nahraď vlastním modulem
- **PayPal vault:** Pro upsell one-click platby se ukládá vault_id — ověř, že nový modul toto podporuje

## KLÍČOVÉ SOUBORY K PŘEČTENÍ PŘED IMPLEMENTACÍ:

1. `backend/src/modules/payment-mollie/service.ts` — vzor pro PayPal service (pattern)
2. `backend/src/modules/payment-mollie/api-client.ts` — vzor pro API klienta
3. `backend/src/api/webhooks/mollie/route.ts` — vzor pro webhook handler
4. `backend/src/subscribers/order-placed-payment-metadata.ts` — přidej PayPal
5. `storefront/src/modules/checkout/components/payment-button/index.tsx` — existující PayPalPaymentButton
6. `storefront/src/modules/checkout/components/payment-wrapper/index.tsx` — existující PayPalScriptProvider
7. `storefront/src/lib/constants.tsx` — PayPal helpers
8. `backend/src/api/admin/gateway/test-connection/route.ts` — existující PayPal test connection
9. `backend/src/subscribers/tracking-dispatcher.ts` — existující PayPal tracking
10. `backend/src/admin/components/billing/payment-method-icons.tsx` — PayPal v admin UI
