# Prompt pro Claude Code: Standalone Klarna integrace

## Příkaz (zkopíruj do Claude Code):

Pracuj na staging branchi. Přečti tento soubor CLAUDE-CODE-KLARNA-STANDALONE.md a implementuj standalone integraci platební brány Klarna do MedusaJS 2.0 e-commerce backendu EverChapter. Backend Klarna provider (service.ts, api-client.ts, webhook handler) již existuje a je funkční. Hlavní problém je na FRONTENDU — Klarna widget se nikdy nezobrazí, protože storefront nemá KlarnaWrapper ani KlarnaPaymentButton, a místo toho se Klarna řeší přes Mollie redirect, což je špatně. Implementuj nativní Klarna Payments SDK integraci na frontendu (init → load → authorize flow), opravu payment-button komponenty, a doplň chybějící části na backendu (capture z admin UI, refund z admin UI, webhook verifikaci). Postupuj podle instrukcí níže. Po každé fázi: git add . && git commit -m 'popis' && git push origin staging. Nikdy nepushuj na master.

---

## ANALÝZA SOUČASNÉHO STAVU

### Co funguje (backend):
- `backend/src/modules/payment-klarna/service.ts` (661 řádků) — kompletní provider s initiatePayment(), authorizePayment(), capturePayment(), refundPayment(), cancelPayment()
- `backend/src/modules/payment-klarna/api-client.ts` (410 řádků) — HTTP klient volající Klarna API:
  - `createSession()` → POST `/payments/v1/sessions` → vrátí session_id + client_token
  - `createOrder()` → POST `/payments/v1/authorizations/{authToken}/order` → vrátí order_id
  - `captureOrder()` → POST `/ordermanagement/v1/orders/{orderId}/captures`
  - `refundOrder()` → POST `/ordermanagement/v1/orders/{orderId}/refunds`
  - `getOrder()` → GET `/ordermanagement/v1/orders/{orderId}`
  - `releaseAuthorization()` → POST `/ordermanagement/v1/orders/{orderId}/release-remaining-authorization`
- `backend/src/api/webhooks/klarna/route.ts` (240 řádků) — webhook handler mapující Klarna events
- `backend/src/subscribers/order-placed-payment-metadata.ts` — kopíruje klarnaOrderId do order.metadata
- Registrace v medusa-config.js
- Test/live base URLs: `https://api.playground.klarna.com` / `https://api.klarna.com`
- Auth: HTTP Basic Auth (username:password = Klarna API credentials)

### Co NEFUNGUJE (hlavní problémy):

**PROBLÉM 1 — Frontend nemá Klarna widget:**
- `storefront/src/lib/constants.tsx` → `isKlarna()` existuje, ale `isRedirectPayment()` řadí Klarna mezi redirect metody (řádek s `isKlarna`)
- `storefront/src/modules/checkout/components/payment-button/index.tsx` → Klarna nemá vlastní button komponentu, jede přes MolliePaymentButton
- `storefront/src/modules/checkout/components/payment-wrapper/index.tsx` → žádný KlarnaWrapper
- Backend vrací `client_token` z `initiatePayment()`, ale frontend ho nikdy nepoužije
- **Výsledek: zákazník nikdy nevidí Klarna widget, platba se nedokončí správně**

**PROBLÉM 2 — Chybí KlarnaPaymentButton:**
- Payment button pouze pro: Stripe, Manual, PayPal, Mollie
- Klarna potřebuje vlastní flow: init(client_token) → load(container) → authorize() → authorization_token → backend createOrder()

**PROBLÉM 3 — Admin UI nemá Klarna capture/refund tlačítka:**
- Backend capture a refund metody existují, ale admin UI je nevolá
- Klarna vyžaduje manuální capture (authorize-capture model, 28 dní na capture)

---

## KLARNA PAYMENTS API REFERENCE

### Base URLs:
- Playground (test): `https://api.playground.klarna.com`
- Production (live): `https://api.klarna.com`

### Autentizace:
HTTP Basic Auth — `Authorization: Basic base64(username:password)`
- Username = Klarna Merchant ID (např. `K123456_abcdef`)
- Password = Klarna API Secret

### Endpointy:

**1. Create Session** (backend → Klarna)
```
POST /payments/v1/sessions
Content-Type: application/json

Request body:
{
  "acquiring_channel": "ECOMMERCE",
  "intent": "buy",
  "purchase_country": "NL",         // ISO 3166-1 alpha-2
  "purchase_currency": "EUR",        // ISO 4217
  "locale": "nl-NL",                 // BCP 47
  "order_amount": 2999,              // v minor units (29.99 EUR = 2999)
  "order_tax_amount": 520,           // DPH v minor units
  "order_lines": [
    {
      "type": "physical",
      "reference": "BOOK-001",
      "name": "Laat los wat je kapotmaakt",
      "quantity": 1,
      "unit_price": 2999,
      "tax_rate": 2100,              // 21% = 2100
      "total_amount": 2999,
      "total_tax_amount": 520
    }
  ],
  "billing_address": {               // optional pro session, povinné pro authorize
    "given_name": "Jan",
    "family_name": "Jansen",
    "email": "jan@example.nl",
    "street_address": "Keizersgracht 1",
    "postal_code": "1015AA",
    "city": "Amsterdam",
    "country": "NL"
  },
  "merchant_urls": {
    "confirmation": "https://example.com/order/confirmed",
    "notification": "https://example.com/api/webhooks/klarna"
  }
}

Response 200:
{
  "session_id": "068df369-13a7-4d47-a564-62f8408bb760",
  "client_token": "eyJhbGciOiJIUzI1...",            // → pošli na frontend
  "payment_method_categories": [
    {
      "identifier": "pay_later",                      // Pay in 30 days
      "name": "Pay later",
      "asset_urls": { "descriptive": "...", "standard": "..." }
    },
    {
      "identifier": "pay_over_time",                  // Installments
      "name": "Financing",
      "asset_urls": { ... }
    }
  ]
}
```

**2. Create Order** (backend → Klarna, po authorize na frontendu)
```
POST /payments/v1/authorizations/{authorization_token}/order
Content-Type: application/json

Request body: (stejné jako session + billing/shipping address povinně)
{
  "purchase_country": "NL",
  "purchase_currency": "EUR",
  "order_amount": 2999,
  "order_tax_amount": 520,
  "order_lines": [ ... ],
  "billing_address": { ... },     // POVINNÉ
  "shipping_address": { ... },    // POVINNÉ
  "merchant_urls": {
    "confirmation": "https://example.com/order/confirmed",
    "notification": "https://example.com/api/webhooks/klarna"
  },
  "merchant_reference1": "MEDUSA-ORDER-123"   // tvoje order ID
}

Response 200:
{
  "order_id": "f3392f8b-6116-4073-ab96-e330c0ab8b18",  // → ulož do metadata
  "redirect_url": "https://payments.klarna.com/...",
  "fraud_status": "ACCEPTED"
}
```
⚠️ authorization_token je platný pouze **60 minut** od authorize() na frontendu!

**3. Capture Order** (backend → Klarna, po expedici)
```
POST /ordermanagement/v1/orders/{order_id}/captures
Content-Type: application/json
Klarna-Idempotency-Key: unique-key-123

Request body:
{
  "captured_amount": 2999,
  "description": "Shipment dispatched",
  "order_lines": [ ... ],         // optional — celý order nebo partial
  "shipping_info": [
    {
      "tracking_number": "PKG123456",
      "tracking_uri": "https://tracking.example.com/PKG123456",
      "shipping_company": "PostNL",
      "shipping_method": "standard"
    }
  ]
}

Response 201 Created
Headers: capture_id, Location
```
⚠️ Autorizace vyprší po **28 dnech**! Musíš capturovat před tím.

**4. Refund** (backend → Klarna)
```
POST /ordermanagement/v1/orders/{order_id}/refunds
Content-Type: application/json
Klarna-Idempotency-Key: unique-refund-key

Request body:
{
  "refunded_amount": 2999,
  "description": "Customer return",
  "order_lines": [ ... ]           // optional
}

Response 201 Created
Headers: refund_id, Location
```

**5. Cancel / Release Authorization**
```
POST /ordermanagement/v1/orders/{order_id}/release-remaining-authorization

Response 204 No Content
```

**6. Get Order**
```
GET /ordermanagement/v1/orders/{order_id}

Response 200:
{
  "order_id": "...",
  "status": "AUTHORIZED" | "PART_CAPTURED" | "CAPTURED" | "CANCELLED" | "EXPIRED",
  "order_amount": 2999,
  "remaining_authorized_amount": 2999,
  "captures": [ ... ],
  "refunds": [ ... ],
  ...
}
```

### Webhook Events:
Klarna posílá POST na tvůj webhook URL s JSON body:
```json
{
  "event_type": "order.captured",
  "order_id": "f3392f8b-..."
}
```
Event types: `order.created`, `order.approved`, `order.authorized`, `order.captured`, `order.refund.initiated`, `order.refund.completed`, `order.cancelled`, `order.expired`

### Klarna Payments JavaScript SDK:

**Script:** `<script src="https://x.klarnacdn.net/kp/lib/v1/api.js" async></script>`

**Metody:**

```javascript
// 1. INIT — inicializace s client_token ze session
Klarna.Payments.init({
  client_token: "eyJhbGciOiJI..."    // z POST /payments/v1/sessions response
})

// 2. LOAD — zobrazí Klarna widget v containeru
Klarna.Payments.load(
  {
    container: '#klarna-payments-container',          // CSS selektor
    payment_method_category: 'pay_later'              // nebo 'pay_over_time'
  },
  {},                                                  // optional data update
  function(res) {
    // res.show_form = true/false — zda Klarna schválil zobrazení
    // res.error = objekt s chybou pokud selhalo
    if (res.show_form) {
      // Widget se zobrazil, zákazník může pokračovat
    }
  }
)

// 3. AUTHORIZE — zákazník klikne "Zaplatit" → Klarna otevře popup
Klarna.Payments.authorize(
  {
    payment_method_category: 'pay_later'
  },
  {
    // Povinné billing/shipping údaje
    billing_address: {
      given_name: "Jan",
      family_name: "Jansen",
      email: "jan@example.nl",
      street_address: "Keizersgracht 1",
      postal_code: "1015AA",
      city: "Amsterdam",
      country: "NL"
    },
    shipping_address: { ... }
  },
  function(res) {
    if (res.approved) {
      // res.authorization_token = "b4bd3423-24e3-..."
      // → POŠLI NA BACKEND pro createOrder()
      // Token platný 60 minut!
    }
    if (res.show_form) {
      // Klarna chce, aby zákazník opravil údaje
    }
    if (res.finalize_required) {
      // Zavolej Klarna.Payments.finalize() — např. pro bank transfer
    }
  }
)

// 4. FINALIZE — dokončení pro metody vyžadující extra krok
Klarna.Payments.finalize(
  { payment_method_category: 'pay_later' },
  {},
  function(res) {
    // Stejný response jako authorize
  }
)

// EVENT HANDLING — pro dynamickou výšku widgetu
Klarna.Payments.on('heightChanged', function(newHeight) {
  // Uprav výšku containeru
})
```

---

## IMPLEMENTACE — 5 FÁZÍ

### FÁZE 1: Frontend — KlarnaWrapper a widget zobrazení

**1.1 Vytvoř KlarnaWrapper komponentu:**

**Nový soubor:** `storefront/src/modules/checkout/components/klarna-wrapper/index.tsx`

Tato komponenta:
- Dynamicky načte Klarna Payments SDK script (`https://x.klarnacdn.net/kp/lib/v1/api.js`)
- Zavolá `Klarna.Payments.init({ client_token })` s tokenem z payment session
- Poskytne context s metodami `load()` a `authorize()` pro child komponenty
- Spravuje state: isReady, isLoaded, error

```typescript
'use client'

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'

interface KlarnaContextType {
  isReady: boolean
  isLoaded: boolean
  error: string | null
  loadWidget: (containerId: string, category?: string) => Promise<boolean>
  authorize: (billingAddress: any, shippingAddress: any, category?: string) => Promise<{ approved: boolean; authorization_token?: string; finalize_required?: boolean }>
  finalize: (category?: string) => Promise<{ approved: boolean; authorization_token?: string }>
}

const KlarnaContext = createContext<KlarnaContextType | null>(null)

export const useKlarna = () => {
  const ctx = useContext(KlarnaContext)
  if (!ctx) throw new Error('useKlarna must be used within KlarnaWrapper')
  return ctx
}

interface KlarnaWrapperProps {
  clientToken: string
  children: React.ReactNode
}

export function KlarnaWrapper({ clientToken, children }: KlarnaWrapperProps) {
  const [isReady, setIsReady] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scriptLoaded = useRef(false)

  useEffect(() => {
    if (!clientToken || scriptLoaded.current) return

    // Dynamicky načti Klarna SDK
    const script = document.createElement('script')
    script.src = 'https://x.klarnacdn.net/kp/lib/v1/api.js'
    script.async = true

    ;(window as any).klarnaAsyncCallback = () => {
      try {
        ;(window as any).Klarna.Payments.init({ client_token: clientToken })
        setIsReady(true)
      } catch (err: any) {
        setError(err.message || 'Klarna init failed')
      }
    }

    script.onerror = () => setError('Failed to load Klarna SDK')
    document.body.appendChild(script)
    scriptLoaded.current = true

    return () => {
      // Cleanup při unmount
      delete (window as any).klarnaAsyncCallback
    }
  }, [clientToken])

  const loadWidget = useCallback(async (containerId: string, category?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!(window as any).Klarna?.Payments) {
        setError('Klarna SDK not available')
        resolve(false)
        return
      }

      const options: any = { container: containerId }
      if (category) options.payment_method_category = category

      ;(window as any).Klarna.Payments.load(options, {}, (res: any) => {
        if (res.error) {
          setError(res.error.invalid_fields?.join(', ') || 'Load failed')
          resolve(false)
        } else {
          setIsLoaded(res.show_form)
          resolve(res.show_form)
        }
      })
    })
  }, [])

  const authorize = useCallback(async (
    billingAddress: any,
    shippingAddress: any,
    category?: string
  ) => {
    return new Promise<{ approved: boolean; authorization_token?: string; finalize_required?: boolean }>((resolve) => {
      const options: any = {}
      if (category) options.payment_method_category = category

      ;(window as any).Klarna.Payments.authorize(
        options,
        {
          billing_address: billingAddress,
          shipping_address: shippingAddress || billingAddress,
        },
        (res: any) => {
          resolve({
            approved: res.approved,
            authorization_token: res.authorization_token,
            finalize_required: res.finalize_required,
          })
        }
      )
    })
  }, [])

  const finalize = useCallback(async (category?: string) => {
    return new Promise<{ approved: boolean; authorization_token?: string }>((resolve) => {
      const options: any = {}
      if (category) options.payment_method_category = category

      ;(window as any).Klarna.Payments.finalize(options, {}, (res: any) => {
        resolve({
          approved: res.approved,
          authorization_token: res.authorization_token,
        })
      })
    })
  }, [])

  return (
    <KlarnaContext.Provider value={{ isReady, isLoaded, error, loadWidget, authorize, finalize }}>
      {children}
    </KlarnaContext.Provider>
  )
}
```

**1.2 Uprav payment-wrapper/index.tsx:**

Přidej KlarnaWrapper vedle StripeWrapper a PayPalWrapper:

```typescript
// V souboru: storefront/src/modules/checkout/components/payment-wrapper/index.tsx
import { KlarnaWrapper } from '../klarna-wrapper'

// V renderovací logice:
if (isKlarna(selectedProviderId)) {
  const clientToken = paymentSession?.data?.clientToken as string
  if (clientToken) {
    return <KlarnaWrapper clientToken={clientToken}>{children}</KlarnaWrapper>
  }
}
```

**1.3 Uprav constants.tsx:**

Klarna NENÍ redirect metoda — odstraň ji z `isRedirectPayment()`:

```typescript
// storefront/src/lib/constants.tsx
// ZMĚŇ isRedirectPayment() — ODSTRAŇ isKlarna:
export const isRedirectPayment = (providerId: string) =>
  isMollie(providerId) || isComgate(providerId) || isP24(providerId)
// ☝️ Klarna tady NESMÍ být — má vlastní widget flow
```

### FÁZE 2: Frontend — KlarnaPaymentButton

**2.1 Vytvoř KlarnaPaymentButton:**

**Nový soubor:** `storefront/src/modules/checkout/components/klarna-payment-button/index.tsx`

```typescript
'use client'

import React, { useEffect, useState } from 'react'
import { useKlarna } from '../klarna-wrapper'
// import tvůj placeOrder, cart context atd.

interface KlarnaPaymentButtonProps {
  cart: any          // Cart objekt s billing/shipping address
  notReady: boolean
}

export function KlarnaPaymentButton({ cart, notReady }: KlarnaPaymentButtonProps) {
  const { isReady, isLoaded, error, loadWidget, authorize, finalize } = useKlarna()
  const [submitting, setSubmitting] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [widgetShown, setWidgetShown] = useState(false)

  // Automaticky načti widget jakmile je SDK ready
  useEffect(() => {
    if (isReady && !isLoaded) {
      loadWidget('#klarna-payments-container', 'pay_later').then((shown) => {
        setWidgetShown(shown)
        if (!shown) {
          // Zkus pay_over_time (splátky) jako fallback
          loadWidget('#klarna-payments-container', 'pay_over_time').then(setWidgetShown)
        }
      })
    }
  }, [isReady, isLoaded, loadWidget])

  const handlePayment = async () => {
    setSubmitting(true)
    setPaymentError(null)

    try {
      // 1. Sesbírej billing/shipping z cartu
      const billingAddress = {
        given_name: cart.billing_address?.first_name || '',
        family_name: cart.billing_address?.last_name || '',
        email: cart.email || '',
        street_address: cart.billing_address?.address_1 || '',
        postal_code: cart.billing_address?.postal_code || '',
        city: cart.billing_address?.city || '',
        country: cart.billing_address?.country_code?.toUpperCase() || '',
        phone: cart.billing_address?.phone || '',
      }

      const shippingAddress = cart.shipping_address ? {
        given_name: cart.shipping_address.first_name || '',
        family_name: cart.shipping_address.last_name || '',
        email: cart.email || '',
        street_address: cart.shipping_address.address_1 || '',
        postal_code: cart.shipping_address.postal_code || '',
        city: cart.shipping_address.city || '',
        country: cart.shipping_address.country_code?.toUpperCase() || '',
        phone: cart.shipping_address.phone || '',
      } : billingAddress

      // 2. Zavolej Klarna authorize — otevře Klarna popup
      const result = await authorize(billingAddress, shippingAddress)

      if (result.finalize_required) {
        // Některé metody (bank transfer) vyžadují finalize
        const finalResult = await finalize()
        if (!finalResult.approved) {
          setPaymentError('Klarna betaling niet goedgekeurd')
          setSubmitting(false)
          return
        }
        // Pokračuj s finalResult.authorization_token
        await completeOrder(finalResult.authorization_token!)
        return
      }

      if (result.approved && result.authorization_token) {
        // 3. Pošli authorization_token na backend
        await completeOrder(result.authorization_token)
      } else {
        setPaymentError('Klarna betaling niet goedgekeurd. Probeer een andere betaalmethode.')
        setSubmitting(false)
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Er is een fout opgetreden')
      setSubmitting(false)
    }
  }

  const completeOrder = async (authorizationToken: string) => {
    try {
      // Pošli token na backend — backend zavolá Klarna createOrder()
      // Tvůj backend endpoint: authorizePayment() v Klarna provideru
      // Medusa flow: updatePaymentSession s authorization_token → placeOrder

      // PŘEČTI existující placeOrder flow a napoj se na něj
      // authorization_token se pošle jako data v payment session update

      // Po úspěchu → redirect na order confirmation page
    } catch (err: any) {
      setPaymentError(err.message || 'Order creation failed')
      setSubmitting(false)
    }
  }

  return (
    <div>
      {/* Klarna widget container — SDK sem renderuje iframe */}
      <div
        id="klarna-payments-container"
        style={{
          minHeight: widgetShown ? '100px' : '0',
          marginBottom: widgetShown ? '16px' : '0',
          transition: 'all 0.3s ease',
        }}
      />

      {error && (
        <div style={{ color: '#D72C0D', fontSize: '13px', marginBottom: '8px' }}>
          {error}
        </div>
      )}

      {paymentError && (
        <div style={{ color: '#D72C0D', fontSize: '13px', marginBottom: '8px' }}>
          {paymentError}
        </div>
      )}

      <button
        onClick={handlePayment}
        disabled={notReady || submitting || !isReady}
        style={{
          width: '100%',
          padding: '14px',
          backgroundColor: isReady ? '#FFB3C7' : '#E1E3E5',  // Klarna růžová
          color: isReady ? '#0A0B09' : '#8C9196',
          border: 'none',
          borderRadius: '8px',
          fontSize: '15px',
          fontWeight: 600,
          cursor: isReady ? 'pointer' : 'not-allowed',
        }}
      >
        {submitting ? 'Verwerken...' : 'Betaal met Klarna'}
      </button>
    </div>
  )
}
```

**2.2 Zaregistruj KlarnaPaymentButton v payment-button/index.tsx:**

```typescript
// storefront/src/modules/checkout/components/payment-button/index.tsx
import { KlarnaPaymentButton } from '../klarna-payment-button'

// V hlavním PaymentButton switch/if-else:
if (isKlarna(paymentSession?.provider_id)) {
  return <KlarnaPaymentButton cart={cart} notReady={notReady} />
}
```

**ÚKOL:** Přečti existující payment-button/index.tsx a placeOrder flow. KlarnaPaymentButton musí:
1. Po authorize() získat authorization_token
2. Zavolat backend s tímto tokenem (Medusa payment flow)
3. Backend Klarna provider zavolá `createOrder()` s tokenem
4. Po úspěchu redirect na confirmation page

### FÁZE 3: Backend — oprava initiatePayment() pro frontend flow

**3.1 Ověř, že initiatePayment() vrací client_token pro frontend:**

**Soubor:** `backend/src/modules/payment-klarna/service.ts`

Přečti existující `initiatePayment()`. Ověř, že:

```typescript
// V service.ts → initiatePayment()
// Po zavolání this.klarnaClient.createSession():

return {
  data: {
    id: sessionResponse.session_id,
    // KRITICKÉ — tyto dva fieldy musí být v response:
    clientToken: sessionResponse.client_token,     // ← frontend potřebuje toto
    sessionId: sessionResponse.session_id,
    paymentMethodCategories: sessionResponse.payment_method_categories,
    status: 'pending',
  }
}
```

Pokud `clientToken` chybí v response data, přidej ho. Frontend ho potřebuje pro `Klarna.Payments.init()`.

**3.2 Ověř, že authorizePayment() správně volá createOrder():**

```typescript
// V service.ts → authorizePayment()
// Musí přijmout authorization_token z frontend a zavolat:
const orderResponse = await this.klarnaClient.createOrder(authorizationToken, {
  purchase_country,
  purchase_currency,
  order_amount,
  order_tax_amount,
  order_lines,
  billing_address,
  shipping_address,
  merchant_urls: {
    confirmation: `${STORE_URL}/order/confirmed`,
    notification: `${BACKEND_URL}/api/webhooks/klarna`,
  },
  merchant_reference1: context.order_id || context.cart_id,
})

// ULOŽ order_id do session data:
return {
  data: {
    ...existingData,
    klarnaOrderId: orderResponse.order_id,
    status: orderResponse.fraud_status === 'ACCEPTED' ? 'authorized' : 'pending',
  }
}
```

⚠️ authorization_token je platný pouze 60 minut! Pokud vyprší, zákazník musí authorize znovu.

### FÁZE 4: Admin UI — Capture a Refund tlačítka

**4.1 Capture tlačítko na order detail stránce:**

Klarna má authorize-capture model — peníze se strhnou až po expedici. Admin musí mít možnost:
1. Vidět, že objednávka je "Authorized" (ne "Paid")
2. Kliknout "Capture Payment"
3. Backend zavolá Klarna `captureOrder()` API
4. Stav se změní na "Captured"

**Nový endpoint:** `POST /admin/custom/orders/[id]/capture`

```typescript
// backend/src/api/admin/custom/orders/[id]/capture/route.ts
export async function POST(req, res) {
  const { id } = req.params

  // 1. Načti objednávku s payment session
  const order = await orderService.retrieve(id)
  const klarnaOrderId = order.metadata?.klarnaOrderId || order.metadata?.payment_klarna_order_id

  if (!klarnaOrderId) {
    return res.status(400).json({ error: 'No Klarna order ID found' })
  }

  // 2. Načti gateway config pro Klarna credentials
  const gatewayConfig = await getKlarnaGatewayConfig()
  const klarnaClient = new KlarnaApiClient(gatewayConfig)

  // 3. Zavolej Klarna capture API
  const captureResponse = await klarnaClient.captureOrder(klarnaOrderId, {
    captured_amount: order.total,
    description: `Capture for order ${order.display_id}`,
    shipping_info: order.metadata?.tracking_number ? [{
      tracking_number: order.metadata.tracking_number,
      shipping_company: order.metadata.shipping_company || 'PostNL',
    }] : undefined,
  })

  // 4. Aktualizuj metadata
  order.metadata.klarna_capture_id = captureResponse.capture_id
  order.metadata.klarna_captured_at = new Date().toISOString()
  order.metadata.payment_activity_log = [
    ...(order.metadata.payment_activity_log || []),
    {
      timestamp: new Date().toISOString(),
      event: 'capture',
      gateway: 'klarna',
      status: 'success',
      amount: order.total,
      currency: order.currency_code,
      transaction_id: captureResponse.capture_id,
    }
  ]
  await orderService.update(id, { metadata: order.metadata })

  return res.json({ success: true, capture_id: captureResponse.capture_id })
}
```

**4.2 Refund tlačítko na order detail stránce:**

**Nový endpoint:** `POST /admin/custom/orders/[id]/refund`

```typescript
// backend/src/api/admin/custom/orders/[id]/refund/route.ts
export async function POST(req, res) {
  const { id } = req.params
  const { amount, reason } = req.body  // amount v minor units, reason jako text

  const order = await orderService.retrieve(id)
  const klarnaOrderId = order.metadata?.klarnaOrderId || order.metadata?.payment_klarna_order_id

  if (!klarnaOrderId) {
    return res.status(400).json({ error: 'No Klarna order ID found' })
  }

  // Klarna vyžaduje, aby order byl CAPTURED před refundem
  const klarnaClient = new KlarnaApiClient(gatewayConfig)
  const klarnaOrder = await klarnaClient.getOrder(klarnaOrderId)

  if (klarnaOrder.status !== 'CAPTURED' && klarnaOrder.status !== 'PART_CAPTURED') {
    return res.status(400).json({ error: 'Order must be captured before refund. Current status: ' + klarnaOrder.status })
  }

  const refundResponse = await klarnaClient.refundOrder(klarnaOrderId, {
    refunded_amount: amount || order.total,
    description: reason || 'Refund',
  })

  // Aktualizuj metadata
  order.metadata.payment_activity_log = [
    ...(order.metadata.payment_activity_log || []),
    {
      timestamp: new Date().toISOString(),
      event: 'refund',
      gateway: 'klarna',
      status: 'success',
      amount: amount || order.total,
      currency: order.currency_code,
      transaction_id: refundResponse.refund_id,
      detail: reason,
    }
  ]
  await orderService.update(id, { metadata: order.metadata })

  return res.json({ success: true, refund_id: refundResponse.refund_id })
}
```

**4.3 Admin UI tlačítka:**

Na stránce order detail (`/admin/routes/custom-orders/[id]/page.tsx`) přidej:

- Pokud `order.metadata.klarnaOrderId` existuje a stav je "authorized" → zobraz **"Capture Payment"** tlačítko (zelené)
- Pokud stav je "captured" → zobraz **"Refund"** tlačítko (červené) s inputem na částku a důvod
- Zobraz Klarna stav jako badge: AUTHORIZED (žlutý), CAPTURED (zelený), REFUNDED (oranžový)

### FÁZE 5: Webhook verifikace a edge cases

**5.1 Webhook handler — ověř kompletnost:**

Přečti `backend/src/api/webhooks/klarna/route.ts` a ověř:

- Všechny event types jsou mapované (viz API Reference výše)
- Po `order.captured` eventu se aktualizuje order metadata na "captured"
- Po `order.refund.completed` se zapíše refund do activity logu
- Po `order.expired` (28 dní bez capture) se objednávka označí jako expired
- Po `order.cancelled` se objednávka zruší

**5.2 Authorization expiration handling:**

Klarna autorizace vyprší po 28 dnech. Přidej scheduled job:

```typescript
// backend/src/jobs/klarna-authorization-check.ts
// Cron: 0 6 * * * (denně v 6:00)

// 1. Najdi všechny objednávky s klarnaOrderId a status "authorized"
// 2. Pro každou zkontroluj datum autorizace
// 3. Pokud je starší než 25 dní → pošli admin upozornění "Capture before expiration!"
// 4. Pokud je starší než 28 dní → označ jako expired
```

**5.3 Klarna payment method categories na frontendu:**

Klarna vrací `payment_method_categories` v session response. Na frontendu zobraz správné kategorie:

- `pay_later` → "Betaal later" (Pay in 30 days) — Klarna logo
- `pay_over_time` → "Gespreid betalen" (Installments) — Klarna logo s "Spreiding"
- `pay_now` → "Betaal nu" (Direct payment) — Klarna logo s bank icon

Pro každou kategorii zavolej `loadWidget()` s odpovídajícím `payment_method_category`.

---

## VERIFIKACE

### Po FÁZI 1:
- [ ] KlarnaWrapper komponenta existuje a načte SDK script
- [ ] Klarna.Payments.init() se zavolá s client_token
- [ ] Klarna NENÍ v isRedirectPayment()
- [ ] payment-wrapper.tsx obsahuje KlarnaWrapper podmínku

### Po FÁZI 2:
- [ ] KlarnaPaymentButton existuje a zobrazí Klarna widget
- [ ] Widget se načte automaticky po init()
- [ ] Authorize otevře Klarna popup a vrátí authorization_token
- [ ] Token se pošle na backend
- [ ] Po úspěchu redirect na confirmation page
- [ ] Error handling funguje (zamítnutí, timeout)

### Po FÁZI 3:
- [ ] initiatePayment() vrací clientToken v response data
- [ ] authorizePayment() přijme authorization_token a zavolá createOrder()
- [ ] klarnaOrderId se uloží do payment session data
- [ ] Order se vytvoří v Klarna systému

### Po FÁZI 4:
- [ ] POST /admin/custom/orders/[id]/capture endpoint funguje
- [ ] POST /admin/custom/orders/[id]/refund endpoint funguje
- [ ] Admin UI má Capture tlačítko pro authorized Klarna objednávky
- [ ] Admin UI má Refund tlačítko pro captured Klarna objednávky
- [ ] Activity log se aktualizuje po capture/refund

### Po FÁZI 5:
- [ ] Webhook handler pokrývá všechny Klarna event types
- [ ] Scheduled job kontroluje expirující autorizace (25+ dní)
- [ ] Frontend zobrazuje správné Klarna payment categories
- [ ] Celý flow funguje na Klarna Playground (sandbox)

---

## DŮLEŽITÉ POZNÁMKY

- **Klarna Playground credentials:** Zeptej se uživatele na Klarna test API username a password
- **Authorization platnost:** 60 minut pro authorization_token, 28 dní pro order authorization
- **Capture timing:** Musí se capturovat PO expedici, PŘED 28 dny
- **Amounts:** Vždy v minor units (29.99 EUR = 2999)
- **Countries:** Klarna funguje v: NL, BE, DE, AT, SE, FI, DK, NO, UK, US, AU, PL, CZ, IT, ES, FR, PT, IE, CH
- **Testing:** Klarna Playground: use test personal numbers from https://docs.klarna.com/resources/test-environment/
- **Webhook URL:** Musí být veřejně dostupná — pro localhost použij ngrok nebo Klarna docs mock

## KLÍČOVÉ SOUBORY K PŘEČTENÍ PŘED IMPLEMENTACÍ:

1. `backend/src/modules/payment-klarna/service.ts` — existující provider
2. `backend/src/modules/payment-klarna/api-client.ts` — existující API klient
3. `backend/src/api/webhooks/klarna/route.ts` — existující webhook
4. `storefront/src/modules/checkout/components/payment-button/index.tsx` — kam přidat Klarna button
5. `storefront/src/modules/checkout/components/payment-wrapper/index.tsx` — kam přidat KlarnaWrapper
6. `storefront/src/lib/constants.tsx` — kde opravit isRedirectPayment()
7. `storefront/src/modules/checkout/components/payment/index.tsx` — existující payment selector
8. `backend/src/admin/routes/custom-orders/[id]/page.tsx` — kam přidat capture/refund tlačítka
