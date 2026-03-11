# Instrukce pro Claude Code: Dokončení Klarna integrace + oprava payment gaps

## Příkaz pro Claude Code

Pracuj na staging branchi. Proveď kompletní audit a opravy MedusaJS 2.0 payment systému v EverChapter. Klarna integrace existuje ale potřebuje finální opravy: přidej Klarna do webhook mappingu a order metadata subscriberu, implementuj KlarnaPaymentButton na frontendu, ověř capture flow. Pak implementuj refunds pro všechny payment providery (Mollie, Klarna, Comgate, P24, Airwallex), přidej 3D Secure handling pro Mollie, integruj Apple Pay/Google Pay přes Mollie, vytvoř sdílené payment icons na frontendu, dokončuj upsell payment system, a implementuj inline kreditní karty na checkoutu (Mollie Components / Stripe Elements / Airwallex Drop-in — podle toho, která brána má creditcard enabled s nejvyšší prioritou). Vždy čti existující kód NEJDŘÍVE, postupuj podle Mollie patterns, ptej se na API credentials. Po každé fázi git add . && git commit -m 'description' && git push origin staging.

---

## DŮLEŽITÉ PRAVIDLA

1. **Pracuj VŽDY na staging branchi** - nikdy na master
2. **Po každé změně:** `git add . && git commit -m 'popis' && git push origin staging`
3. **NIKDY** nepushuj na master (production)
4. **Nejdříve čti existující kód** - nepiš zbytečně nový
5. **Sleduj patterns z Mollie provideru** - konsistence v codebase
6. **Pokud chybí API credentials** - ptej se uživatele (Klarna, Mollie klíče)
7. Backend v `/backend`, Storefront v `/storefront`

---

## FÁZE 1: Klarna — dokončení integrace

### Existující kód
- `/backend/src/modules/payment-klarna/service.ts` (637 řádků)
- `/backend/src/modules/payment-klarna/api-client.ts` (410 řádků)
- `/backend/src/modules/payment-klarna/webhook/handler.ts` (109 řádků)
- `/storefront/src/modules/checkout/components/payment-method-selector/index.tsx` - Klarna ikona existuje

### 1.1 Ověření a oprava Klarna webhook handleru

**Soubor:** `/backend/src/modules/payment-klarna/webhook/handler.ts`

Ověř, že webhook handler mapuje VŠECHNY Klarna event types:
- `order.created` → payment authorized
- `order.approved` → order approved
- `order.authorization.created` → authorization (28 days)
- `order.authorized` → fully authorized
- `order.released` → capture initiated
- `order.captured` → payment captured
- `order.refund.initiated` → refund started
- `order.refund.completed` → refund completed
- `order.payment_authorized` → payment confirmed

Kód by měl vypadat jako:
```typescript
// /backend/src/modules/payment-klarna/webhook/handler.ts
export async function handleKlarnaWebhook(
  event: KlarnaWebhookEvent,
  paymentService: PaymentService,
  orderService: OrderService
) {
  const { order_id, event_type } = event;

  switch (event_type) {
    case 'order.created':
      // Klarna order created - store klarnaOrderId in session
      break;
    case 'order.authorized':
      // Payment authorized - transition to authorized state
      await paymentService.updatePaymentSession(order_id, {
        status: 'authorized',
        metadata: { event_type, authorized_at: new Date() }
      });
      break;
    case 'order.captured':
      // Payment captured - transition to paid
      await paymentService.capturePayment(order_id);
      break;
    case 'order.refund.completed':
      // Refund completed
      break;
    default:
      console.log(`Unhandled Klarna event: ${event_type}`);
  }
}
```

**Úkol:** Ověř všechny event types v Klarna dokumentaci a zajisti, že handler je v sync s ostatními providery (Mollie, PayPal).

### 1.2 Přidání Klarna do order metadata subscriberu

**Soubor:** `/backend/src/subscribers/order-placed-payment-metadata.ts`

Tento subscriber momentálně zachycuje pouze Mollie payment ID. Přidej Klarna:

```typescript
// /backend/src/subscribers/order-placed-payment-metadata.ts (kolem řádku 50-70)
const handlePaymentMetadata = async (order: Order) => {
  const payment = order.payments?.[0];

  if (!payment) return;

  const metadata = payment.metadata || {};

  // Existující Mollie handling
  if (payment.provider_id === 'mollie' && metadata.molliePaymentId) {
    // copy to order metadata
  }

  // Přidej Klarna
  if (payment.provider_id === 'klarna' && metadata.klarnaOrderId) {
    // Zkopíruj klarnaOrderId z payment.metadata do order.metadata
    order.metadata = {
      ...order.metadata,
      payment_klarna_order_id: metadata.klarnaOrderId,
      payment_klarna_session_id: metadata.klarnaSessionId,
    };
    await orderService.update(order.id, { metadata: order.metadata });
  }
};
```

**Úkol:** Najdi soubor a přidej handling pro klarnaOrderId a klarnaSessionId z payment session metadata.

### 1.3 Vytvoření KlarnaPaymentButton na frontendu

**Nový soubor:** `/storefront/src/modules/checkout/components/klarna-payment-button/index.tsx`

```typescript
'use client'

import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export interface KlarnaPaymentButtonProps {
  paymentSessionId: string
  clientToken: string
  orderId: string
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export const KlarnaPaymentButton = ({
  paymentSessionId,
  clientToken,
  orderId,
  onSuccess,
  onError,
}: KlarnaPaymentButtonProps) => {
  const router = useRouter()

  useEffect(() => {
    // Načti Klarna Payments SDK
    const script = document.createElement('script')
    script.src = 'https://x.klarnacdn.net/kp/lib/v1/api.js'
    script.async = true
    document.body.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  const handleAuthorize = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).Klarna) {
        const klarnaAPI = (window as any).Klarna.Payments

        // Authorize Klarna payment
        const authorized = await new Promise<boolean>((resolve) => {
          klarnaAPI.authorize({}, (response: any) => {
            if (response.approved) {
              resolve(true)
            } else {
              resolve(false)
            }
          })
        })

        if (!authorized) {
          throw new Error('Klarna authorization failed')
        }

        // Call backend to confirm payment
        const response = await fetch(
          `/api/store/custom/orders/${orderId}/payment-confirm`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payment_session_id: paymentSessionId,
              provider: 'klarna',
            }),
          }
        )

        if (!response.ok) {
          throw new Error('Payment confirmation failed')
        }

        onSuccess?.()
        // Redirect to order success
        router.push(`/order/confirmed/${orderId}`)
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      onError?.(err)
      console.error('Klarna payment error:', err)
    }
  }, [paymentSessionId, orderId, onSuccess, onError, router])

  return (
    <button
      onClick={handleAuthorize}
      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg"
      type="button"
    >
      Authorize with Klarna
    </button>
  )
}
```

**Integrace v PaymentButton komponenty:**

**Soubor:** `/storefront/src/modules/checkout/components/payment-button/index.tsx`

```typescript
// Přidej na začátek imports
import { KlarnaPaymentButton } from '../klarna-payment-button'

// V komponenty renderu (kolem řádku 80-120), přidej:
if (paymentSession?.provider_id === 'klarna') {
  return (
    <KlarnaPaymentButton
      paymentSessionId={paymentSession.id}
      clientToken={paymentSession.data?.client_token as string}
      orderId={order.id}
      onSuccess={onSuccess}
      onError={onError}
    />
  )
}
```

**Úkol:** Vytvoř nový KlarnaPaymentButton komponentu, která používá Klarna Payments SDK. Integruj do PaymentButton switche.

### 1.4 Přidání Klarna do test-connection endpointu

**Soubor:** `/backend/src/api/admin/gateway/test-connection/route.ts`

```typescript
// V handlePOST funkci, přidej switch case (kolem řádku 60):
case 'klarna':
  const klarnaService = container.resolve('klarna_payment_service')
  const testAuth = await klarnaService.validateAuth()
  if (!testAuth.success) {
    throw new Error(`Klarna auth failed: ${testAuth.error}`)
  }
  break
```

Klarna service by měl mít metodu `validateAuth()`:

**Soubor:** `/backend/src/modules/payment-klarna/service.ts` (přidej metodu)

```typescript
async validateAuth(): Promise<{ success: boolean; error?: string }> {
  try {
    // Zkus volat jednoduchý Klarna endpoint k ověření credentials
    const response = await this.apiClient.get('/merchant/info')
    return { success: !!response }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

**Úkol:** Přidej Klarna do test-connection endpointu v admin API. Implementuj validateAuth() metodu.

### 1.5 Ověření Klarna capture flow

**Soubor:** `/backend/src/api/admin/custom/orders/[id]/capture/route.ts` (měl by existovat)

Ověř, že existuje endpoint pro capture a že Klarna je zahrnutý:

```typescript
// Kolem řádku 40-60
if (paymentSession?.provider_id === 'klarna') {
  const klarnaService = container.resolve('klarna_payment_service')
  const captured = await klarnaService.capturePayment(
    paymentSession.data?.klarnaOrderId as string,
    amount
  )

  if (!captured.success) {
    throw new Error(`Klarna capture failed: ${captured.error}`)
  }
}
```

Ověř, že `capturePayment()` v Klarna service je implementován:

```typescript
// /backend/src/modules/payment-klarna/service.ts
async capturePayment(
  klarnaOrderId: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await this.apiClient.releaseOrder(klarnaOrderId, {
      captured_amount: amount,
    })
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

**Úkol:** Ověř capture endpoint existuje. Zajisti, že Klarna je zahrnutý. Implementuj capturePayment() metodu.

---

## FÁZE 2: Refundy — implementace pro všechny providery

### Aktuální stav
- Všichni providery mají stub `refundPayment()` metody
- Admin UI nemá tlačítko pro refund
- Není tracking refund eventů v order metadata

### 2.1 Mollie refundPayment implementace

**Soubor:** `/backend/src/modules/payment-mollie/service.ts` (najdi metodu `refundPayment`)

```typescript
async refundPayment(
  paymentId: string,
  amount: number,
  reason?: string
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  try {
    // Klíč rozhodování: je to payment nebo order?
    const paymentData = await this.apiClient.getPayment(paymentId)

    if (paymentData.orderNumber) {
      // Mollie Orders API
      const refund = await this.apiClient.refundOrder(
        paymentData.orderNumber,
        {
          amount: { value: (amount / 100).toFixed(2), currency: 'EUR' },
          description: reason,
        }
      )
      return {
        success: true,
        refundId: refund.id,
      }
    } else {
      // Mollie Payments API
      const refund = await this.apiClient.refundPayment(paymentId, {
        amount: { value: (amount / 100).toFixed(2), currency: 'EUR' },
        description: reason,
      })
      return {
        success: true,
        refundId: refund.id,
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

### 2.2 Klarna refundPayment implementace

**Soubor:** `/backend/src/modules/payment-klarna/service.ts`

```typescript
async refundPayment(
  klarnaOrderId: string,
  amount: number,
  reason?: string
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  try {
    // Klarna api-client již má refundOrder() metodu
    const refund = await this.apiClient.refundOrder(klarnaOrderId, {
      refunded_amount: amount,
      description: reason,
    })
    return {
      success: true,
      refundId: refund.refund_id,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

### 2.3 Comgate refundPayment implementace

**Soubor:** `/backend/src/modules/payment-comgate/service.ts`

```typescript
async refundPayment(
  transactionId: string,
  amount: number,
  reason?: string
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  try {
    // Comgate refund API call (zkontroluj jejich dokumentaci)
    const refund = await this.apiClient.refund({
      transactionId,
      amount: amount / 100, // convert from cents
      description: reason,
    })
    return {
      success: true,
      refundId: refund.refund_id,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

### 2.4 Przelewy24 refundPayment implementace

**Soubor:** `/backend/src/modules/payment-p24/service.ts`

```typescript
async refundPayment(
  transactionId: string,
  amount: number,
  reason?: string
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  try {
    // POST /api/v1/transaction/refund
    const refund = await this.apiClient.post('/transaction/refund', {
      transactionId,
      amount: amount / 100,
      description: reason,
    })
    return {
      success: true,
      refundId: refund.refund_id,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

### 2.5 Airwallex refundPayment implementace

**Soubor:** `/backend/src/modules/payment-airwallex/service.ts`

```typescript
async refundPayment(
  paymentIntentId: string,
  amount: number,
  reason?: string
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  try {
    // POST /api/v1/pa/payment_intents/{id}/refunds
    const refund = await this.apiClient.post(
      `/pa/payment_intents/${paymentIntentId}/refunds`,
      {
        amount: amount / 100,
        reason,
      }
    )
    return {
      success: true,
      refundId: refund.id,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

### 2.6 Admin refund endpoint

**Nový soubor:** `/backend/src/api/admin/custom/orders/[id]/refund/route.ts`

```typescript
import { MedusaRequest, MedusaResponse } from '@medusajs/medusa'

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const { amount, reason } = req.body
  const container = req.scope

  try {
    const orderService = container.resolve('orderService')
    const paymentService = container.resolve('paymentService')

    const order = await orderService.retrieve(id, {
      relations: ['payments'],
    })

    if (!order.payments || order.payments.length === 0) {
      return res.status(400).json({ error: 'No payment found for this order' })
    }

    const payment = order.payments[0]
    const providerService = container.resolve(
      `${payment.provider_id}_payment_service`
    )

    if (!providerService.refundPayment) {
      return res.status(400).json({
        error: `Refund not supported for ${payment.provider_id}`,
      })
    }

    // Zjisti payment ID podle provideru
    let paymentId = payment.data?.molliePaymentId ||
      payment.data?.klarnaOrderId ||
      payment.data?.transactionId || payment.id

    const refundResult = await providerService.refundPayment(
      paymentId,
      amount,
      reason
    )

    if (!refundResult.success) {
      return res.status(400).json({ error: refundResult.error })
    }

    // Přidej refund event do order metadata
    order.metadata = {
      ...order.metadata,
      payment_refund_log: [
        ...(order.metadata?.payment_refund_log || []),
        {
          refund_id: refundResult.refundId,
          amount,
          reason,
          provider: payment.provider_id,
          timestamp: new Date().toISOString(),
        },
      ],
    }

    await orderService.update(id, { metadata: order.metadata })

    return res.json({
      success: true,
      refund_id: refundResult.refundId,
    })
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
```

### 2.7 Admin UI refund button

**Soubor:** `/admin/routes/orders/[id]/page.tsx` (přidej button v order detail)

```typescript
// Kolem řádku 200-250, v action buttons sekci:
<button
  onClick={handleRefund}
  className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
  disabled={!order.payments?.[0]}
>
  Refund
</button>

// A přidej handler:
const handleRefund = async () => {
  const amount = prompt('Enter refund amount in EUR:')
  if (!amount) return

  const reason = prompt('Refund reason (optional):')

  try {
    const response = await fetch(`/api/admin/custom/orders/${orderId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parseInt(amount) * 100, // convert to cents
        reason,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      alert(`Refund failed: ${error.error}`)
    } else {
      alert('Refund successful!')
      window.location.reload()
    }
  } catch (error) {
    alert(`Error: ${error instanceof Error ? error.message : 'Unknown'}`)
  }
}
```

**Úkol:** Implementuj refundPayment() pro všechny providery. Vytvoř admin refund endpoint a UI button.

---

## FÁZE 3: 3D Secure handling

### 3.1 Mollie 3D Secure detection

**Soubor:** `/backend/src/modules/payment-mollie/service.ts` (v `authorizePayment` metodě)

```typescript
async authorizePayment(
  paymentSessionId: string,
  amount: number
): Promise<{
  success: boolean
  status: string
  redirectUrl?: string
  error?: string
}> {
  try {
    const response = await this.apiClient.createPayment({
      amount: { value: (amount / 100).toFixed(2), currency: 'EUR' },
      description: 'Order payment',
      metadata: { payment_session_id: paymentSessionId },
      redirectUrl: `${this.config.redirectUrl}/payment/mollie/callback`,
    })

    // KLÍČOVÁ ZMĚNA: Zkontroluj status a checkout URL
    if (response.status === 'open' && response._links?.checkout?.href) {
      // 3D Secure nebo jiné action vyžadováno
      return {
        success: true,
        status: 'requires_action',
        redirectUrl: response._links.checkout.href,
      }
    }

    if (response.status === 'paid') {
      return {
        success: true,
        status: 'paid',
      }
    }

    return {
      success: response.status !== 'failed',
      status: response.status,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

### 3.2 Frontend 3D Secure handling

**Soubor:** `/storefront/src/modules/checkout/components/payment-button/index.tsx`

```typescript
// V podmínce kde se renderuj payment button, přidej:
if (paymentSession?.status === 'requires_action' &&
    paymentSession.data?.redirectUrl) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Your payment requires verification. Please click below to complete it.
      </p>
      <a
        href={paymentSession.data.redirectUrl}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg text-center"
      >
        Complete Verification
      </a>
    </div>
  )
}
```

### 3.3 Webhook handling pro 3D Secure completion

**Soubor:** `/backend/src/modules/payment-mollie/webhook/handler.ts`

```typescript
// V handler funkci, přidej:
if (event.status === 'paid' && event.orderNumber) {
  // Tato situace znamená, že platba přešla z "open" (3D Secure) na "paid"
  const paymentSession = await paymentService.retrieveSession(
    event.orderNumber
  )

  if (paymentSession.status === 'requires_action') {
    // Aktualizuj status na authorized
    await paymentService.updatePaymentSession(paymentSession.id, {
      status: 'authorized',
    })
  }
}
```

### 3.4 Stripe 3D Secure (ověření existující implementace)

**Soubor:** `/storefront/src/modules/checkout/components/stripe-payment-button/index.tsx`

Ověř, že button handleuje `confirmCardPayment` a `requires_action`:

```typescript
// Mělo by existovat něco jako:
const result = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: elements.getElement(CardElement),
  },
})

if (result.paymentIntent.status === 'requires_action') {
  // Mollie-like: 3D Secure required
  await stripe.handleCardAction(clientSecret)
}

if (result.paymentIntent.status === 'succeeded') {
  // Payment OK
}
```

**Úkol:** Implementuj 3D Secure detection v Mollie. Přidej redirect UI na frontendu. Ověř Stripe handling.

---

## FÁZE 4: Apple Pay / Google Pay přes Mollie

### 4.1 Mollie wallet integration

**Soubor:** `/backend/src/modules/payment-mollie/service.ts` (v `initiatePayment` metodě)

```typescript
async initiatePayment(
  paymentSessionId: string,
  amount: number,
  gateways: GatewayConfig
): Promise<{
  success: boolean
  sessionData: Record<string, any>
  error?: string
}> {
  try {
    const includeWallets = []

    // Zkontroluj gateway config pro wallet settings
    if (gateways.metadata?.apple_pay_enabled) {
      includeWallets.push('applepay')
    }
    if (gateways.metadata?.google_pay_enabled) {
      includeWallets.push('googlepay')
    }

    const paymentData = {
      amount: { value: (amount / 100).toFixed(2), currency: 'EUR' },
      description: 'Order payment',
      method: 'ideal',
      locale: 'en_US',
      includeWallets, // TOTO JE KLÍČ
    }

    const payment = await this.apiClient.createPayment(paymentData)

    return {
      success: true,
      sessionData: {
        mollie_payment_id: payment.id,
        available_methods: payment._links?.paymentMethods || [],
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

### 4.2 Apple Pay domain verification

**Nový soubor:** `/backend/public/.well-known/apple-developer-merchantid-domain-association`

```
apple-domain-association-file-content-here
```

Pozn: Obsah se bere od Apple po vytvoření merchant identity.

**Soubor:** `/backend/src/api/well-known/apple-developer-merchantid-domain-association/route.ts`

```typescript
import { MedusaRequest, MedusaResponse } from '@medusajs/medusa'

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  const container = _req.scope
  const settingService = container.resolve('settingService')

  try {
    const appleVerificationFile = await settingService.retrieve(
      'apple_pay_verification_file'
    )

    if (!appleVerificationFile) {
      return res.status(404).json({ error: 'Apple Pay verification file not set' })
    }

    res.setHeader('Content-Type', 'application/octet-stream')
    return res.send(appleVerificationFile.value)
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve verification file' })
  }
}
```

### 4.3 Gateway config pro wallet nastavení

**Soubor:** `/backend/src/modules/gateway-config/models/gateway-config.ts` (přidej fields)

```typescript
// V GatewayConfig entity:
@Column({ type: 'simple-json', nullable: true })
metadata: {
  apple_pay_enabled?: boolean
  google_pay_enabled?: boolean
  apple_pay_verification_file?: string
  // ... ostatní fields
}
```

### 4.4 Admin UI pro wallet settings

**Soubor:** `/admin/routes/settings-billing/page.tsx` (v Mollie tab)

```typescript
// V Mollie tab settings, přidej:
<div className="flex items-center gap-2 my-4">
  <input
    type="checkbox"
    id="apple-pay"
    checked={mollieConfig.metadata?.apple_pay_enabled || false}
    onChange={(e) =>
      setMollieConfig({
        ...mollieConfig,
        metadata: {
          ...mollieConfig.metadata,
          apple_pay_enabled: e.target.checked,
        },
      })
    }
  />
  <label htmlFor="apple-pay">Enable Apple Pay</label>
</div>

<div className="flex items-center gap-2 my-4">
  <input
    type="checkbox"
    id="google-pay"
    checked={mollieConfig.metadata?.google_pay_enabled || false}
    onChange={(e) =>
      setMollieConfig({
        ...mollieConfig,
        metadata: {
          ...mollieConfig.metadata,
          google_pay_enabled: e.target.checked,
        },
      })
    }
  />
  <label htmlFor="google-pay">Enable Google Pay</label>
</div>

<div className="my-4">
  <label className="block text-sm font-medium mb-2">
    Apple Pay Verification File Content
  </label>
  <textarea
    value={mollieConfig.metadata?.apple_pay_verification_file || ''}
    onChange={(e) =>
      setMollieConfig({
        ...mollieConfig,
        metadata: {
          ...mollieConfig.metadata,
          apple_pay_verification_file: e.target.value,
        },
      })
    }
    className="w-full h-32 p-2 border rounded"
    placeholder="Paste Apple developer domain association file here"
  />
</div>
```

### 4.5 Frontend payment method selector - Mollie wallets

**Soubor:** `/storefront/src/modules/checkout/components/payment-method-selector/index.tsx`

Ověř, že když jsou wallets dostupné v paymentSession data, zobrazí se Apple Pay a Google Pay ikony:

```typescript
// V componenty, kolem řádku 50-80:
{paymentSession.data?.available_methods?.includes('applepay') && (
  <PaymentMethodOption
    id="applepay"
    name="Apple Pay"
    icon={<ApplePayIcon />}
    selected={selectedMethod === 'applepay'}
    onClick={() => setSelectedMethod('applepay')}
  />
)}

{paymentSession.data?.available_methods?.includes('googlepay') && (
  <PaymentMethodOption
    id="googlepay"
    name="Google Pay"
    icon={<GooglePayIcon />}
    selected={selectedMethod === 'googlepay'}
    onClick={() => setSelectedMethod('googlepay')}
  />
)}
```

### 4.6 Google Pay meta tag (checkout page)

**Soubor:** `/storefront/src/app/checkout/page.tsx` (v HEAD nebo layout)

```typescript
// V metadata nebo layout komponenty:
export const metadata = {
  other: {
    'google-pay-api-version': '2',
  },
}

// Nebo v componenty přímo:
useEffect(() => {
  const script = document.createElement('script')
  script.src = 'https://pay.google.com/gp/p/js/pay.js'
  script.async = true
  document.head.appendChild(script)
}, [])
```

**Úkol:** Implementuj wallet support v Mollie. Přidej Apple Pay verification. Vytvoř admin settings. Přidej wallet ikony na frontendu.

---

## FÁZE 5: Ikony platebních metod na frontendu

### Aktuální problém
- `/storefront/src/modules/checkout/components/payment-method-selector/index.tsx` má SVG ikony pro ~20 metod
- Starší `/storefront/src/modules/checkout/components/payment/index.tsx` používá generický CreditCard icon

### 5.1 Vytvoření sdíleného payment-icons utility

**Nový soubor:** `/storefront/src/modules/checkout/components/payment-icons/index.tsx`

```typescript
export const VisaIcon = () => (
  <svg viewBox="0 0 48 32" className="w-full h-full" aria-label="Visa">
    <rect width="48" height="32" rx="4" fill="#1434CB" />
    <text x="24" y="20" fontSize="14" fill="white" textAnchor="middle" fontWeight="bold">
      VISA
    </text>
  </svg>
)

export const MastercardIcon = () => (
  <svg viewBox="0 0 48 32" className="w-full h-full" aria-label="Mastercard">
    <rect width="48" height="32" rx="4" fill="#FF5F00" />
    <circle cx="18" cy="16" r="6" fill="#EB001B" opacity="0.8" />
    <circle cx="30" cy="16" r="6" fill="#F79E1B" opacity="0.8" />
  </svg>
)

export const iDEALIcon = () => (
  <svg viewBox="0 0 48 32" className="w-full h-full" aria-label="iDEAL">
    <rect width="48" height="32" rx="4" fill="white" stroke="#D0D0D0" strokeWidth="1" />
    <text x="24" y="20" fontSize="10" fill="#003DA5" textAnchor="middle" fontWeight="bold">
      iDEAL
    </text>
  </svg>
)

export const KlarnaIcon = () => (
  <svg viewBox="0 0 48 32" className="w-full h-full" aria-label="Klarna">
    <rect width="48" height="32" rx="4" fill="white" stroke="#D0D0D0" strokeWidth="1" />
    <text x="24" y="20" fontSize="12" fill="#000" textAnchor="middle" fontWeight="bold">
      Klarna
    </text>
  </svg>
)

export const PayPalIcon = () => (
  <svg viewBox="0 0 48 32" className="w-full h-full" aria-label="PayPal">
    <rect width="48" height="32" rx="4" fill="white" stroke="#003087" strokeWidth="1" />
    <text x="24" y="20" fontSize="12" fill="#003087" textAnchor="middle" fontWeight="bold">
      PayPal
    </text>
  </svg>
)

export const ApplePayIcon = () => (
  <svg viewBox="0 0 48 32" className="w-full h-full" aria-label="Apple Pay">
    <rect width="48" height="32" rx="4" fill="black" />
    <text x="24" y="20" fontSize="10" fill="white" textAnchor="middle" fontWeight="bold">
      Apple Pay
    </text>
  </svg>
)

export const GooglePayIcon = () => (
  <svg viewBox="0 0 48 32" className="w-full h-full" aria-label="Google Pay">
    <rect width="48" height="32" rx="4" fill="white" stroke="#D0D0D0" strokeWidth="1" />
    <text x="24" y="20" fontSize="10" fill="#4285F4" textAnchor="middle" fontWeight="bold">
      Google Pay
    </text>
  </svg>
)

export const BancontactIcon = () => (
  <svg viewBox="0 0 48 32" className="w-full h-full" aria-label="Bancontact">
    <rect width="48" height="32" rx="4" fill="#003399" />
    <text x="24" y="20" fontSize="12" fill="white" textAnchor="middle" fontWeight="bold">
      Bancontact
    </text>
  </svg>
)

export const BLIKIcon = () => (
  <svg viewBox="0 0 48 32" className="w-full h-full" aria-label="BLIK">
    <rect width="48" height="32" rx="4" fill="white" stroke="#D0D0D0" strokeWidth="1" />
    <text x="24" y="20" fontSize="12" fill="#E31820" textAnchor="middle" fontWeight="bold">
      BLIK
    </text>
  </svg>
)

export const Przelewy24Icon = () => (
  <svg viewBox="0 0 48 32" className="w-full h-full" aria-label="Przelewy24">
    <rect width="48" height="32" rx="4" fill="white" stroke="#D0D0D0" strokeWidth="1" />
    <text x="24" y="20" fontSize="10" fill="#2E75B6" textAnchor="middle" fontWeight="bold">
      Przelewy24
    </text>
  </svg>
)

export const StripeIcon = () => (
  <svg viewBox="0 0 48 32" className="w-full h-full" aria-label="Stripe">
    <rect width="48" height="32" rx="4" fill="white" stroke="#D0D0D0" strokeWidth="1" />
    <text x="24" y="20" fontSize="12" fill="#6772E5" textAnchor="middle" fontWeight="bold">
      Stripe
    </text>
  </svg>
)

export const EPSIcon = () => (
  <svg viewBox="0 0 48 32" className="w-full h-full" aria-label="eps">
    <rect width="48" height="32" rx="4" fill="white" stroke="#D0D0D0" strokeWidth="1" />
    <text x="24" y="20" fontSize="10" fill="#003087" textAnchor="middle" fontWeight="bold">
      eps
    </text>
  </svg>
)

export const GiropayIcon = () => (
  <svg viewBox="0 0 48 32" className="w-full h-full" aria-label="Giropay">
    <rect width="48" height="32" rx="4" fill="white" stroke="#D0D0D0" strokeWidth="1" />
    <text x="24" y="20" fontSize="10" fill="#E31820" textAnchor="middle" fontWeight="bold">
      giropay
    </text>
  </svg>
)

export const SofortIcon = () => (
  <svg viewBox="0 0 48 32" className="w-full h-full" aria-label="Sofort">
    <rect width="48" height="32" rx="4" fill="white" stroke="#D0D0D0" strokeWidth="1" />
    <text x="24" y="20" fontSize="10" fill="#003087" textAnchor="middle" fontWeight="bold">
      Sofort
    </text>
  </svg>
)

export const ComgateIcon = () => (
  <svg viewBox="0 0 48 32" className="w-full h-full" aria-label="Comgate">
    <rect width="48" height="32" rx="4" fill="white" stroke="#D0D0D0" strokeWidth="1" />
    <text x="24" y="20" fontSize="10" fill="#0052CC" textAnchor="middle" fontWeight="bold">
      Comgate
    </text>
  </svg>
)

export const AirwallexIcon = () => (
  <svg viewBox="0 0 48 32" className="w-full h-full" aria-label="Airwallex">
    <rect width="48" height="32" rx="4" fill="white" stroke="#D0D0D0" strokeWidth="1" />
    <text x="24" y="20" fontSize="10" fill="#666" textAnchor="middle" fontWeight="bold">
      Airwallex
    </text>
  </svg>
)

export const getPaymentMethodIcon = (method: string) => {
  const iconMap: Record<string, () => JSX.Element> = {
    visa: VisaIcon,
    mastercard: MastercardIcon,
    ideal: iDEALIcon,
    klarna: KlarnaIcon,
    paypal: PayPalIcon,
    applepay: ApplePayIcon,
    googlepay: GooglePayIcon,
    bancontact: BancontactIcon,
    blik: BLIKIcon,
    przelewy24: Przelewy24Icon,
    stripe: StripeIcon,
    eps: EPSIcon,
    giropay: GiropayIcon,
    sofort: SofortIcon,
    comgate: ComgateIcon,
    airwallex: AirwallexIcon,
  }

  const IconComponent = iconMap[method.toLowerCase()]
  return IconComponent ? <IconComponent /> : null
}
```

### 5.2 Aktualizace PaymentMethodSelector

**Soubor:** `/storefront/src/modules/checkout/components/payment-method-selector/index.tsx`

```typescript
// Na začátek imports:
import { getPaymentMethodIcon } from '../payment-icons'

// V seznam payment methods, měňte z inline SVG na:
{method && (
  <div className="w-8 h-6">
    {getPaymentMethodIcon(method)}
  </div>
)}
```

### 5.3 Aktualizace Payment (starší komponenty)

**Soubor:** `/storefront/src/modules/checkout/components/payment/index.tsx`

```typescript
// Přidej na začátek:
import { getPaymentMethodIcon } from '../payment-icons'

// Najdi paymentInfoMap a aktualizuj:
const paymentInfoMap = {
  mollie_card: {
    name: 'Credit Card',
    icon: () => <div className="w-8 h-6">{getPaymentMethodIcon('visa')}</div>,
  },
  mollie_ideal: {
    name: 'iDEAL',
    icon: () => <div className="w-8 h-6">{getPaymentMethodIcon('ideal')}</div>,
  },
  mollie_klarna: {
    name: 'Klarna',
    icon: () => <div className="w-8 h-6">{getPaymentMethodIcon('klarna')}</div>,
  },
  mollie_paypal: {
    name: 'PayPal',
    icon: () => <div className="w-8 h-6">{getPaymentMethodIcon('paypal')}</div>,
  },
  klarna: {
    name: 'Klarna',
    icon: () => <div className="w-8 h-6">{getPaymentMethodIcon('klarna')}</div>,
  },
  stripe: {
    name: 'Credit Card',
    icon: () => <div className="w-8 h-6">{getPaymentMethodIcon('stripe')}</div>,
  },
  paypal: {
    name: 'PayPal',
    icon: () => <div className="w-8 h-6">{getPaymentMethodIcon('paypal')}</div>,
  },
  // ... atd pro všechny metody
}
```

**Úkol:** Vytvoř sdílený payment-icons utility. Aktualizuj obě komponenty aby používaly sdílené ikony.

---

## FÁZE 6: Upsell platby — dokončení implementace

### Aktuální stav
- `/backend/src/api/store/custom/orders/[id]/upsell-session/route.ts` (246 řádků)
- `/backend/src/api/store/custom/orders/[id]/upsell-charge/route.ts` (204 řádků) - podporuje jen Stripe a PayPal
- `/backend/src/api/store/custom/orders/[id]/upsell-webhook/route.ts` (179 řádků)
- `/backend/src/api/store/custom/orders/[id]/upsell-accept/route.ts` (49 řádků)
- `/backend/src/subscribers/upsell-invoice.subscriber.ts` (357 řádků)

### 6.1 Mollie customer mandates (one-click payment)

**Soubor:** `/backend/src/modules/payment-mollie/service.ts` (přidej metodu)

```typescript
async createCustomerMandate(
  customerId: string,
  description?: string
): Promise<{ success: boolean; mandateId?: string; error?: string }> {
  try {
    const mandate = await this.apiClient.createMandate(customerId, {
      consumerId: customerId,
      method: 'creditcard',
      description: description || 'Recurring payment mandate',
    })
    return {
      success: true,
      mandateId: mandate.id,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

async chargeWithMandate(
  customerId: string,
  mandateId: string,
  amount: number,
  description: string
): Promise<{ success: boolean; paymentId?: string; error?: string }> {
  try {
    const payment = await this.apiClient.createPayment({
      customerId,
      mandateId,
      amount: { value: (amount / 100).toFixed(2), currency: 'EUR' },
      description,
      sequenceType: 'recurring',
    })
    return {
      success: true,
      paymentId: payment.id,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

### 6.2 Upsell session - Mollie a Klarna paths

**Soubor:** `/backend/src/api/store/custom/orders/[id]/upsell-session/route.ts`

Ověř, že existují paths pro všechny providery:

```typescript
// Kolem řádku 80-150, v switch statement:
case 'mollie':
  {
    const mollieService = container.resolve('mollie_payment_service')
    const mandateId = order.metadata?.mollie_mandate_id

    if (mandateId) {
      // Lze udělat one-click - pošli jen informace
      upsellSession = {
        type: 'one_click',
        provider: 'mollie',
        mandate_id: mandateId,
        amount: upsellAmount,
        customer_id: order.customer_id,
      }
    } else {
      // Vyžaduje nový payment - vytvoř session jako běžný payment
      const sessionResult = await mollieService.initiatePayment(
        generateId(),
        upsellAmount,
        gateways
      )
      upsellSession = {
        type: 'redirect',
        provider: 'mollie',
        payment_id: sessionResult.sessionData?.mollie_payment_id,
        redirect_url: sessionResult.sessionData?.checkout_url,
      }
    }
  }
  break

case 'klarna':
  {
    const klarnaService = container.resolve('klarna_payment_service')
    // Klarna nevýhoduje one-click - vždy vyžaduje nový authorization
    const sessionResult = await klarnaService.initiatePayment(
      generateId(),
      upsellAmount,
      gateways
    )
    upsellSession = {
      type: 'redirect',
      provider: 'klarna',
      session_id: sessionResult.sessionData?.klarna_session_id,
      client_token: sessionResult.sessionData?.client_token,
    }
  }
  break
```

### 6.3 Upsell charge - Mollie one-click support

**Soubor:** `/backend/src/api/store/custom/orders/[id]/upsell-charge/route.ts`

```typescript
// Kolem řádku 40-100, v switch statement:
case 'mollie':
  {
    const mollieService = container.resolve('mollie_payment_service')
    const { mandate_id, customer_id } = req.body

    const chargeResult = await mollieService.chargeWithMandate(
      customer_id,
      mandate_id,
      upsellAmount,
      `Upsell charge for order ${orderId}`
    )

    if (!chargeResult.success) {
      return res.status(400).json({
        error: chargeResult.error || 'Mollie charge failed',
      })
    }

    upsellPayment = {
      provider: 'mollie',
      payment_id: chargeResult.paymentId,
      status: 'pending', // čekat na webhook confirmation
    }
  }
  break

// Existující Stripe a PayPal cases zůstávají stejné
```

### 6.4 Upsell webhook - confirmation handler

**Soubor:** `/backend/src/api/store/custom/orders/[id]/upsell-webhook/route.ts`

Ověř, že webhook handler správně trigguje invoice subscriber:

```typescript
// Kolem řádku 100-140:
if (webhookData.event === 'payment.confirmed') {
  const orderService = container.resolve('orderService')

  // Aktualizuj order metadata s upsell completion
  const order = await orderService.retrieve(orderId)
  order.metadata = {
    ...order.metadata,
    upsell_payment_confirmed: true,
    upsell_payment_id: webhookData.payment_id,
    upsell_confirmed_at: new Date().toISOString(),
  }

  await orderService.update(orderId, { metadata: order.metadata })

  // Trigger invoice subscriber (mělo by být automatické via event emitter)
  container.resolve('eventBusService').emit('upsell.payment.confirmed', {
    orderId,
    paymentId: webhookData.payment_id,
  })
}
```

### 6.5 Upsell invoice subscriber - trigger konfigurace

**Soubor:** `/backend/src/subscribers/upsell-invoice.subscriber.ts`

Ověř, že subscriber je registrován a liší si správné eventy:

```typescript
// Na začátek souboru, event subscription:
eventBusService.subscribe(
  'upsell.payment.confirmed',
  async (data: { orderId: string; paymentId: string }) => {
    // Trigger invoice creation
    const invoiceService = container.resolve('invoiceService')
    await invoiceService.createUpsellInvoice(data.orderId)
  }
)
```

### 6.6 Error handling a rollback

**Soubor:** `/backend/src/api/store/custom/orders/[id]/upsell-charge/route.ts`

Přidej error handling:

```typescript
// V POST handleru:
try {
  // ... payment charge logic ...

  if (!chargeResult.success) {
    // Rollback - mark upsell as failed
    order.metadata = {
      ...order.metadata,
      upsell_status: 'failed',
      upsell_error: chargeResult.error,
      upsell_failed_at: new Date().toISOString(),
    }
    await orderService.update(orderId, { metadata: order.metadata })

    return res.status(400).json({
      error: chargeResult.error,
      upsell_status: 'failed',
    })
  }

  // Success
  order.metadata = {
    ...order.metadata,
    upsell_status: 'processing',
    upsell_charge_id: chargeResult.paymentId,
  }
  await orderService.update(orderId, { metadata: order.metadata })

  return res.json({
    success: true,
    payment_id: chargeResult.paymentId,
  })
} catch (error) {
  // Pokud se stane exception, oznám error
  const errorMsg = error instanceof Error ? error.message : 'Unknown error'

  order.metadata = {
    ...order.metadata,
    upsell_status: 'error',
    upsell_error: errorMsg,
  }
  await orderService.update(orderId, { metadata: order.metadata })

  return res.status(500).json({
    error: errorMsg,
    upsell_status: 'error',
  })
}
```

### 6.7 Ověření všech provider paths v upsell-session

**Soubor:** `/backend/src/api/store/custom/orders/[id]/upsell-session/route.ts`

Zkontroluj, zda všichni providery mají implementované:
- `initiatePayment()` metoda existuje
- Vrací `sessionData` s `sessionId` a `clientToken` nebo `redirectUrl`
- Error handling existuje

Pro každého providera by měl být switch case:
```typescript
case 'airwallex':
  // Musí existovat Airwallex path
  break
case 'comgate':
  // Musí existovat Comgate path
  break
case 'przelewy24':
  // Musí existovat P24 path
  break
// ... atd
```

**Úkol:** Implementuj Mollie mandates pro one-click. Přidej Klarna a ostatní providery do upsell-session. Vylepš error handling a rollback. Ověř webhook integration s invoice subscriber.

---

## VERIFIKACE

### Po FÁZI 1: Klarna — dokončení integrace
- [ ] Klarna webhook handler ověřuje všechny event types
- [ ] `klarnaOrderId` a `klarnaSessionId` se kopírují do order.metadata
- [ ] KlarnaPaymentButton komponenta existuje a je integrována
- [ ] Klarna je v test-connection endpointu (admin UI)
- [ ] Capture endpoint funguje pro Klarna orders
- [ ] Admin UI tlačítko "Capture" je dostupné

### Po FÁZI 2: Refundy — implementace pro všechny providery
- [ ] `refundPayment()` je implementován pro Mollie, Klarna, Comgate, P24, Airwallex
- [ ] POST `/api/admin/custom/orders/[id]/refund` endpoint existuje
- [ ] Admin UI má tlačítko "Refund" na order detail
- [ ] Po refundu se event zapisuje do order.metadata.payment_refund_log
- [ ] Refund je správně zaznamenán v payment activity logu

### Po FÁZI 3: 3D Secure handling
- [ ] Mollie service vrací `requires_action` status když je 3D Secure potřeba
- [ ] Frontend zobrazuje "Complete Verification" button s redirect URL
- [ ] Webhook handler mapuje transition z "open" na "paid"
- [ ] Medusa status se mění na "authorized" po 3D Secure completion
- [ ] Stripe 3D Secure (confirmCardPayment) stále funguje

### Po FÁZI 4: Apple Pay / Google Pay přes Mollie
- [ ] Mollie `initiatePayment()` s `includeWallets` parametrem funguje
- [ ] Apple Pay domain verification file se vrací na `/.well-known/apple-developer-merchantid-domain-association`
- [ ] Admin UI má toggles pro Apple Pay a Google Pay
- [ ] Frontend PaymentMethodSelector zobrazuje Apple Pay a Google Pay ikony
- [ ] Google Pay API je dostupná na checkout stránce

### Po FÁZI 5: Ikony platebních metod na frontendu
- [ ] `payment-icons/index.tsx` utility existuje
- [ ] PaymentMethodSelector používá sdílené ikony
- [ ] Payment komponenta (starší) používá sdílené ikony
- [ ] Všechny payment metody mají ikony: Visa, Mastercard, iDEAL, Bancontact, BLIK, P24, Klarna, PayPal, Apple Pay, Google Pay, EPS, Giropay, Sofort, Comgate, Airwallex
- [ ] Ikony jsou 24x24 nebo 32x32 a vypadají konzistentně

### Po FÁZI 6: Upsell platby — dokončení implementace
- [ ] Mollie mandates se vytvářejí během prvního payment
- [ ] `chargeWithMandate()` Mollie funguje pro one-click charges
- [ ] Upsell session endpoint vrací správné data pro všechny providery
- [ ] Upsell charge endpoint podporuje Mollie (mandates), Stripe, PayPal
- [ ] Klarna upsell je redirect-based (ne one-click)
- [ ] Webhook handler trigguje invoice subscriber
- [ ] Error handling: selhané upsell payment je zaznamenáno v order.metadata
- [ ] Rollback: pokud charge selže, order metadata je aktualizován s error stavem

---

## FÁZE 7: Kreditní karty — inline platba na checkoutu

### Kontext

Kreditní karta není platební brána — je to **platební metoda**, která běží přes jednu z existujících bran (Mollie, Stripe, Airwallex). Zákazník na checkoutu vidí pole na číslo karty, datum a CVV přímo na stránce (žádný redirect). Data karty nikdy nejdou přes náš server — vždy se používají bezpečné iframe komponenty dané brány (PCI compliance).

### Rozhodovací logika — která brána zpracuje kartu

Systém musí automaticky rozhodnout, přes kterou bránu karta pojede:

1. Podívej se do `gateway_config` — které brány mají `payment_method_config` s `code: "creditcard"` a `is_active: true`?
2. Vyfiltruj podle `sales_channel_id`, `currency`, `project_slug`
3. Seřaď podle `priority` (1 = nejvyšší)
4. Použij bránu s nejvyšší prioritou
5. Pokud primární brána selže (API error, is_active=false), fallback na další v pořadí

### 7.1 Rozšíření /store/payment-options endpointu

**Soubor:** `/backend/src/api/store/custom/payment-options/route.ts`

Endpoint musí u kreditní karty vracet navíc metadata pro frontend — jakou komponentu zobrazit a jaký klíč použít:

```typescript
// Při sestavování seznamu platebních metod
const methods = []

for (const gateway of activeGateways) {
  for (const method of gateway.payment_methods) {
    if (!method.is_active) continue

    const methodData: any = {
      code: method.code,
      display_name: method.display_name,
      gateway: gateway.provider,
      gateway_config_id: gateway.id,
      icon: method.icon,
      sort_order: method.sort_order,
    }

    // Kreditní karta potřebuje speciální handling
    if (method.code === 'creditcard') {
      methodData.type = 'embedded'  // inline pole, ne redirect

      // Podle brány urči frontend komponentu a klíč
      const activeKeys = gateway.mode === 'live' ? gateway.live_keys : gateway.test_keys

      switch (gateway.provider) {
        case 'mollie':
          methodData.component = 'mollie-card'
          methodData.client_key = activeKeys.profile_id  // Mollie Profile ID pro Mollie.js
          methodData.locale = 'nl_NL'  // nebo dynamicky podle zákazníka
          break
        case 'stripe':
          methodData.component = 'stripe-card'
          methodData.client_key = activeKeys.publishable_key  // Stripe pk_live_xxx
          break
        case 'airwallex':
          methodData.component = 'airwallex-card'
          methodData.client_key = activeKeys.client_id
          methodData.environment = gateway.mode === 'live' ? 'prod' : 'demo'
          break
        default:
          methodData.type = 'redirect'  // Fallback — přesměrování na platební stránku brány
      }
    } else {
      methodData.type = 'redirect'  // iDEAL, Bancontact, BLIK atd. = vždy redirect
    }

    methods.push(methodData)
  }
}

// Vrať metody seřazené podle sort_order
return res.json({ methods: methods.sort((a, b) => a.sort_order - b.sort_order) })
```

**Úkol:** Přečti existující `/store/payment-options` route. Přidej pole `type`, `component` a `client_key` pro kreditní karty. Zachovej stávající logiku pro ostatní metody.

### 7.2 Frontend — CardInput komponenta

**Nový soubor:** `/storefront/src/modules/checkout/components/card-input/index.tsx`

Hlavní komponenta, která se zobrazí když zákazník vybere kreditní kartu. Podle `component` z API rozhodne, jaký widget načíst:

```typescript
'use client'

import React, { useEffect, useRef, useState } from 'react'
import { StripeCardInput } from './stripe-card-input'
import { MollieCardInput } from './mollie-card-input'
import { AirwallexCardInput } from './airwallex-card-input'

interface CardInputProps {
  method: {
    component: 'mollie-card' | 'stripe-card' | 'airwallex-card'
    client_key: string
    locale?: string
    environment?: string
  }
  onTokenReady: (token: string, provider: string) => void
  onError: (error: string) => void
}

export function CardInput({ method, onTokenReady, onError }: CardInputProps) {
  switch (method.component) {
    case 'stripe-card':
      return (
        <StripeCardInput
          publishableKey={method.client_key}
          onTokenReady={(token) => onTokenReady(token, 'stripe')}
          onError={onError}
        />
      )
    case 'mollie-card':
      return (
        <MollieCardInput
          profileId={method.client_key}
          locale={method.locale || 'en_US'}
          onTokenReady={(token) => onTokenReady(token, 'mollie')}
          onError={onError}
        />
      )
    case 'airwallex-card':
      return (
        <AirwallexCardInput
          clientId={method.client_key}
          environment={method.environment || 'demo'}
          onTokenReady={(token) => onTokenReady(token, 'airwallex')}
          onError={onError}
        />
      )
    default:
      return <div>Unsupported card provider</div>
  }
}
```

### 7.3 Mollie Components integrace

**Nový soubor:** `/storefront/src/modules/checkout/components/card-input/mollie-card-input.tsx`

Mollie Components zobrazí 3 bezpečné iframe pole (číslo karty, datum, CVV):

```typescript
'use client'

import React, { useEffect, useRef, useState } from 'react'

// Mollie.js se načte dynamicky
declare global {
  interface Window {
    Mollie: any
  }
}

interface MollieCardInputProps {
  profileId: string
  locale: string
  onTokenReady: (token: string) => void
  onError: (error: string) => void
}

export function MollieCardInput({ profileId, locale, onTokenReady, onError }: MollieCardInputProps) {
  const mollieRef = useRef<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [cardNumberError, setCardNumberError] = useState('')
  const [expiryError, setExpiryError] = useState('')
  const [cvvError, setCvvError] = useState('')

  useEffect(() => {
    // 1. Dynamicky načti Mollie.js script
    const script = document.createElement('script')
    script.src = 'https://js.mollie.com/v1/mollie.js'
    script.async = true
    script.onload = () => {
      // 2. Inicializuj Mollie s profileId
      const mollie = window.Mollie(profileId, {
        locale,
        testmode: profileId.startsWith('test_'),
      })
      mollieRef.current = mollie

      // 3. Vytvoř komponenty a zamountuj do DOM
      const cardNumber = mollie.createComponent('cardNumber')
      cardNumber.mount('#mollie-card-number')
      cardNumber.addEventListener('change', (event: any) => {
        setCardNumberError(event.error ? event.error : '')
      })

      const expiryDate = mollie.createComponent('expiryDate')
      expiryDate.mount('#mollie-expiry-date')
      expiryDate.addEventListener('change', (event: any) => {
        setExpiryError(event.error ? event.error : '')
      })

      const verificationCode = mollie.createComponent('verificationCode')
      verificationCode.mount('#mollie-cvv')
      verificationCode.addEventListener('change', (event: any) => {
        setCvvError(event.error ? event.error : '')
      })

      setIsLoaded(true)
    }
    document.head.appendChild(script)

    return () => {
      // Cleanup
      if (mollieRef.current) {
        mollieRef.current = null
      }
    }
  }, [profileId, locale])

  // 4. Funkce pro vytvoření tokenu — volá se při submitu formuláře
  const createToken = async () => {
    if (!mollieRef.current) {
      onError('Mollie not initialized')
      return
    }
    try {
      const { token, error } = await mollieRef.current.createToken()
      if (error) {
        onError(error.message)
        return
      }
      onTokenReady(token)  // Token se pošle na backend
    } catch (err: any) {
      onError(err.message || 'Failed to create card token')
    }
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '13px', color: '#6D7175', marginBottom: '4px', display: 'block' }}>
          Kaartnummer
        </label>
        <div
          id="mollie-card-number"
          style={{
            border: '1px solid #E1E3E5',
            borderRadius: '8px',
            padding: '10px 12px',
            minHeight: '40px',
            backgroundColor: '#fff',
          }}
        />
        {cardNumberError && (
          <span style={{ color: '#D72C0D', fontSize: '12px' }}>{cardNumberError}</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '13px', color: '#6D7175', marginBottom: '4px', display: 'block' }}>
            Vervaldatum
          </label>
          <div
            id="mollie-expiry-date"
            style={{
              border: '1px solid #E1E3E5',
              borderRadius: '8px',
              padding: '10px 12px',
              minHeight: '40px',
              backgroundColor: '#fff',
            }}
          />
          {expiryError && (
            <span style={{ color: '#D72C0D', fontSize: '12px' }}>{expiryError}</span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '13px', color: '#6D7175', marginBottom: '4px', display: 'block' }}>
            CVV
          </label>
          <div
            id="mollie-cvv"
            style={{
              border: '1px solid #E1E3E5',
              borderRadius: '8px',
              padding: '10px 12px',
              minHeight: '40px',
              backgroundColor: '#fff',
            }}
          />
          {cvvError && (
            <span style={{ color: '#D72C0D', fontSize: '12px' }}>{cvvError}</span>
          )}
        </div>
      </div>

      {/* Expose createToken pro parent komponentu */}
      <input type="hidden" id="mollie-create-token" data-create-token="true" />
    </div>
  )
}

// Export createToken tak, aby PaymentButton mohl zavolat token creation
export const getMollieToken = async (mollieInstance: any): Promise<string> => {
  const { token, error } = await mollieInstance.createToken()
  if (error) throw new Error(error.message)
  return token
}
```

### 7.4 Stripe Elements integrace

**Soubor:** `/storefront/src/modules/checkout/components/card-input/stripe-card-input.tsx`

Stripe Elements — jednodušší, protože Stripe má jeden unified CardElement:

```typescript
'use client'

import React, { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

interface StripeCardInputProps {
  publishableKey: string
  onTokenReady: (token: string) => void
  onError: (error: string) => void
}

export function StripeCardInput({ publishableKey, onTokenReady, onError }: StripeCardInputProps) {
  const stripePromise = loadStripe(publishableKey)

  return (
    <Elements stripe={stripePromise}>
      <StripeCardForm onTokenReady={onTokenReady} onError={onError} />
    </Elements>
  )
}

function StripeCardForm({
  onTokenReady,
  onError,
}: {
  onTokenReady: (token: string) => void
  onError: (error: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState('')

  const handleChange = (event: any) => {
    setError(event.error ? event.error.message : '')
  }

  // createToken se volá z parent komponenty při submitu
  const createToken = async () => {
    if (!stripe || !elements) {
      onError('Stripe not loaded')
      return
    }
    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      onError('Card element not found')
      return
    }
    const { token, error } = await stripe.createToken(cardElement)
    if (error) {
      onError(error.message || 'Card error')
      return
    }
    if (token) {
      onTokenReady(token.id)
    }
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <label style={{ fontSize: '13px', color: '#6D7175', marginBottom: '4px', display: 'block' }}>
        Kaartgegevens
      </label>
      <div
        style={{
          border: '1px solid #E1E3E5',
          borderRadius: '8px',
          padding: '12px',
          backgroundColor: '#fff',
        }}
      >
        <CardElement
          onChange={handleChange}
          options={{
            style: {
              base: {
                fontSize: '15px',
                color: '#202223',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                '::placeholder': { color: '#8C9196' },
              },
              invalid: { color: '#D72C0D' },
            },
            hidePostalCode: true,
          }}
        />
      </div>
      {error && <span style={{ color: '#D72C0D', fontSize: '12px', marginTop: '4px' }}>{error}</span>}
    </div>
  )
}
```

### 7.5 Airwallex Drop-in integrace

**Soubor:** `/storefront/src/modules/checkout/components/card-input/airwallex-card-input.tsx`

Airwallex Drop-in element pro karty:

```typescript
'use client'

import React, { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    Airwallex: any
  }
}

interface AirwallexCardInputProps {
  clientId: string
  environment: string
  onTokenReady: (token: string) => void
  onError: (error: string) => void
}

export function AirwallexCardInput({ clientId, environment, onTokenReady, onError }: AirwallexCardInputProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Načti Airwallex.js
    const script = document.createElement('script')
    script.src = 'https://checkout.airwallex.com/assets/elements.bundle.min.js'
    script.async = true
    script.onload = () => {
      window.Airwallex.init({
        env: environment,  // 'demo' nebo 'prod'
        origin: window.location.origin,
      })

      // Vytvoř card element
      const card = window.Airwallex.createElement('card')
      card.mount('airwallex-card-container')

      card.on('onReady', () => setIsLoaded(true))
      card.on('onError', (event: any) => onError(event.error?.message || 'Card error'))

      setIsLoaded(true)
    }
    document.head.appendChild(script)
  }, [clientId, environment])

  return (
    <div style={{ marginTop: '16px' }}>
      <label style={{ fontSize: '13px', color: '#6D7175', marginBottom: '4px', display: 'block' }}>
        Card details
      </label>
      <div
        id="airwallex-card-container"
        style={{
          border: '1px solid #E1E3E5',
          borderRadius: '8px',
          padding: '12px',
          minHeight: '40px',
          backgroundColor: '#fff',
        }}
      />
      {!isLoaded && <span style={{ fontSize: '12px', color: '#8C9196' }}>Loading...</span>}
    </div>
  )
}
```

### 7.6 Integrace CardInput do checkout flow

**Soubor:** `/storefront/src/modules/checkout/components/payment-method-selector/index.tsx`

V existující PaymentMethodSelector komponentě přidej zobrazení CardInput když je vybraná kreditní karta:

```typescript
import { CardInput } from '../card-input'

// Uvnitř komponenty, pod radio button pro výběr metody:
{selectedMethod?.code === 'creditcard' && selectedMethod?.type === 'embedded' && (
  <CardInput
    method={{
      component: selectedMethod.component,
      client_key: selectedMethod.client_key,
      locale: selectedMethod.locale,
      environment: selectedMethod.environment,
    }}
    onTokenReady={(token, provider) => {
      // Ulož token do state — pošle se na backend při submitu
      setCardToken(token)
      setCardProvider(provider)
    }}
    onError={(error) => {
      setPaymentError(error)
    }}
  />
)}
```

### 7.7 Backend — zpracování card tokenu v Mollie provideru

**Soubor:** `/backend/src/modules/payment-mollie/service.ts`

V `initiatePayment()` přidej handling pro cardToken:

```typescript
async initiatePayment(context: CreatePaymentProviderSession): Promise<PaymentProviderError | PaymentProviderSessionResponse> {
  const { currency_code, amount, data } = context
  const { cardToken, payment_method } = data || {}

  // ... existující gateway config loading ...

  // Kreditní karta s tokenem — přímá platba, žádný redirect
  if (payment_method === 'creditcard' && cardToken) {
    const payment = await this.mollieClient.createPayment({
      amount: {
        value: this.formatAmount(amount),
        currency: currency_code.toUpperCase(),
      },
      method: 'creditcard',
      cardToken: cardToken,  // Mollie token z Mollie.js Components
      description: `Order ${context.context?.order_id || 'pending'}`,
      redirectUrl: `${process.env.STORE_URL}/order/confirmed`,
      webhookUrl: `${process.env.BACKEND_URL}/api/webhooks/mollie`,
      metadata: {
        cart_id: context.context?.cart_id,
        session_id: context.context?.session_id,
      },
    })

    // Pokud Mollie vrátí status "paid" ihned (bez 3D Secure)
    if (payment.status === 'paid') {
      return {
        data: {
          id: payment.id,
          status: 'captured',
          molliePaymentId: payment.id,
        },
      }
    }

    // Pokud vyžaduje 3D Secure (status "open" s checkout URL)
    if (payment.status === 'open' && payment._links?.checkout) {
      return {
        data: {
          id: payment.id,
          status: 'requires_more',
          molliePaymentId: payment.id,
          redirect_url: payment._links.checkout.href,  // 3D Secure redirect
        },
      }
    }

    return {
      data: {
        id: payment.id,
        status: this.mapMollieStatus(payment.status),
        molliePaymentId: payment.id,
      },
    }
  }

  // ... zbytek existující logiky pro redirect metody ...
}
```

### 7.8 Backend — zpracování card tokenu v Stripe provideru

Stripe je vestavěný Medusa plugin a karty řeší přes PaymentIntents. Ověř, že stávající `StripePaymentButton` na frontendu:

1. Volá `stripe.confirmCardPayment(clientSecret, { payment_method: { card: cardElement } })`
2. Podporuje 3D Secure (automaticky přes Stripe.js)
3. Vrací výsledek na backend

**Úkol:** Přečti existující `payment-button/index.tsx` → `StripePaymentButton`. Pokud už funguje, neměň ho. Pokud ne, uprav ho tak, aby volal `confirmCardPayment` s CardElement z nového CardInput.

### 7.9 Frontend — PaymentButton rozšíření pro card token

**Soubor:** `/storefront/src/modules/checkout/components/payment-button/index.tsx`

Přidej nový CreditCardPaymentButton, který při submitu:

1. Zavolá `createToken()` na příslušné card komponentě (Mollie/Stripe/Airwallex)
2. Token pošle na backend jako součást `initiatePaymentSession` data
3. Pokud backend vrátí `redirect_url` (3D Secure), přesměruje zákazníka
4. Pokud backend vrátí `captured`, dokončí objednávku

```typescript
function CreditCardPaymentButton({
  cart,
  cardToken,
  cardProvider,
  notReady,
}: {
  cart: any
  cardToken: string | null
  cardProvider: string | null
  notReady: boolean
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePayment = async () => {
    if (!cardToken || !cardProvider) {
      setError('Vul je kaartgegevens in')  // "Fill in card details"
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // 1. Iniciuj payment session s card tokenem
      const session = await initiatePaymentSession(cart, {
        provider_id: `pp_${cardProvider}_${cardProvider}`,
        data: {
          payment_method: 'creditcard',
          cardToken: cardToken,
        },
      })

      // 2. Zkontroluj výsledek
      if (session.data?.redirect_url) {
        // 3D Secure — přesměruj zákazníka
        window.location.href = session.data.redirect_url
        return
      }

      if (session.data?.status === 'captured' || session.data?.status === 'authorized') {
        // Platba proběhla — dokonči objednávku
        await placeOrder()
        return
      }

      setError('Betaling niet gelukt. Probeer het opnieuw.')  // "Payment failed"
    } catch (err: any) {
      setError(err.message || 'Er is een fout opgetreden')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={handlePayment}
        disabled={notReady || submitting || !cardToken}
        style={{
          width: '100%',
          padding: '14px',
          backgroundColor: cardToken ? '#008060' : '#E1E3E5',
          color: cardToken ? '#fff' : '#8C9196',
          border: 'none',
          borderRadius: '8px',
          fontSize: '15px',
          fontWeight: 600,
          cursor: cardToken ? 'pointer' : 'not-allowed',
        }}
      >
        {submitting ? 'Verwerken...' : 'Betaal nu'}
      </button>
      {error && (
        <div style={{ color: '#D72C0D', fontSize: '13px', marginTop: '8px', textAlign: 'center' }}>
          {error}
        </div>
      )}
    </>
  )
}
```

### 7.10 Admin UI — nastavení kreditních karet

**Soubor:** `/backend/src/admin/routes/settings-billing/page.tsx`

V sekci Payment Gateways → detail brány → payment methods, rozšiř konfiguraci pro creditcard metodu:

```typescript
// Když je method.code === 'creditcard', zobraz extra nastavení:
{method.code === 'creditcard' && (
  <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#F6F6F7', borderRadius: '8px' }}>
    <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Nastavení kreditních karet</h4>

    {/* Podporované kartové sítě */}
    <div style={{ marginBottom: '8px' }}>
      <label style={{ fontSize: '12px', color: '#6D7175' }}>Povolené kartové sítě</label>
      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        {['visa', 'mastercard', 'amex', 'maestro'].map((network) => (
          <label key={network} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={method.config?.allowed_networks?.includes(network)}
              onChange={(e) => toggleNetwork(method.id, network, e.target.checked)}
            />
            {network.charAt(0).toUpperCase() + network.slice(1)}
          </label>
        ))}
      </div>
    </div>

    {/* 3D Secure nastavení (pokud brána je Mollie) */}
    {gateway.provider === 'mollie' && (
      <div style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '12px', color: '#6D7175' }}>3D Secure</label>
        <select
          value={method.config?.three_d_secure || 'auto'}
          onChange={(e) => updateMethodConfig(method.id, { three_d_secure: e.target.value })}
          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #E1E3E5', marginTop: '4px' }}
        >
          <option value="auto">Automaticky (rozhodne banka)</option>
          <option value="always">Vždy vyžadovat</option>
          <option value="never">Nikdy nevyžadovat</option>
        </select>
      </div>
    )}

    {/* Statement descriptor */}
    <div>
      <label style={{ fontSize: '12px', color: '#6D7175' }}>Text na výpisu z karty (max 16 znaků)</label>
      <input
        type="text"
        maxLength={16}
        value={gateway.statement_descriptor || ''}
        onChange={(e) => updateGateway(gateway.id, { statement_descriptor: e.target.value })}
        placeholder="EVERCHAPTER"
        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #E1E3E5', marginTop: '4px' }}
      />
    </div>
  </div>
)}
```

### 7.11 payment_method_config model rozšíření

**Soubor:** `/backend/src/modules/gateway-config/models/payment-method-config.ts`

Přidej `config` JSON pole pro extra nastavení specifická pro metodu (kartové sítě, 3D Secure):

```typescript
// Přidej do modelu:
config: model.json().nullable(),
// Bude obsahovat: { allowed_networks: ['visa', 'mastercard'], three_d_secure: 'auto' }
```

**Migration:** Přidej sloupec `config JSONB NULL` do tabulky `payment_method_config`.

### 7.12 Celkový checkout flow pro kreditní karty

```
1. Checkout načte → GET /store/payment-options
   → Vrátí: { code: "creditcard", type: "embedded", component: "mollie-card", client_key: "..." }

2. Zákazník vybere "Kreditní karta"
   → PaymentMethodSelector zobrazí CardInput komponentu
   → CardInput podle component renderuje MollieCardInput

3. Mollie.js načte iframe pole (card number, expiry, CVV)
   → Zákazník vyplní údaje
   → Mollie.js validuje v reálném čase (chybné číslo, expirovaná karta)

4. Zákazník klikne "Betaal nu" (Zaplatit)
   → CreditCardPaymentButton zavolá mollie.createToken()
   → Mollie.js vrátí jednorázový cardToken (tok_xxx)

5. Frontend pošle token na backend:
   → POST initiatePaymentSession({ provider_id: "pp_mollie_mollie", data: { cardToken: "tok_xxx", payment_method: "creditcard" } })

6. Backend Mollie provider vytvoří platbu s cardToken:
   → POST https://api.mollie.com/v2/payments { method: "creditcard", cardToken: "tok_xxx" }

7a. Mollie vrátí status "paid" → objednávka dokončena → redirect na thank you page
7b. Mollie vrátí status "open" + checkout URL → 3D Secure potřeba → redirect zákazníka na 3D Secure
   → Po 3D Secure → Mollie webhook → order confirmed

8. Webhook /api/webhooks/mollie → aktualizuje order metadata + payment_activity_log
```

**Úkol:** Implementuj všechny kroky 7.1–7.12. Čti existující kód NEJDŘÍVE. Zachovej stávající patterns. Testuj na Mollie sandbox (test_ klíče).

---

## Dodatečné poznámky

- **API Credentials:** Pro testování Klarna, Mollie, Comgate, P24, Airwallex budou potřeba live nebo sandbox API klíče. Ptej se uživatele.
- **Payment Gateways Admin UI:** Je umístěna na `/admin/routes/settings-billing/page.tsx` - tato stránka potřebuje aktualizace pro nové features (test-connection, wallet settings, apple-pay-verification-file).
- **Order Metadata:** Je to jedinou místem kde se drží payment-related informace po zaplacení - zajisti, že všechny providery do ní zapisují potřebné IDs.
- **Medusa Payment Service:** Standard MedusaJS payment flow: `initiatePayment()` → session → `authorizePayment()` → webhook → capture. Všichni providery by měli tento flow sledovat.
- **Webhook URL:** Zajisti, že Klarna a ostatní providery mají správně nakonfigurované webhook URLs v admin panelu. Webhook handler je na `/api/webhooks/{provider}/route.ts`.
- **Database Migrations:** Pokud se přidávají nové payment_method_config fields (např. apple_pay_enabled), bude potřeba migration. Zkontroluj existující pattern v `/backend/src/migrations/`.

---

### Po FÁZI 7: Kreditní karty — inline platba na checkoutu
- [ ] `/store/payment-options` vrací `type: "embedded"`, `component` a `client_key` pro creditcard
- [ ] CardInput komponenta existuje s 3 sub-komponentami (Mollie, Stripe, Airwallex)
- [ ] MollieCardInput načte Mollie.js, zobrazí 3 iframe pole, vrátí cardToken
- [ ] StripeCardInput načte Stripe Elements, zobrazí CardElement, vrátí token
- [ ] CreditCardPaymentButton zpracuje token a zavolá initiatePaymentSession
- [ ] Mollie provider přijme cardToken a vytvoří platbu přímo (ne redirect)
- [ ] 3D Secure redirect funguje — pokud banka vyžaduje, zákazník je přesměrován a po ověření se platba dokončí
- [ ] Admin UI: creditcard metoda má extra nastavení (kartové sítě, 3D Secure, statement descriptor)
- [ ] payment_method_config má `config` JSON pole pro extra nastavení
- [ ] Celý flow funguje na Mollie sandbox s test klíči
- [ ] Fallback logika: pokud primární brána (Mollie) selže, systém zkusí sekundární (Stripe)

---

**Dokončení:** Tato instrukce pokrývá 7 kompletních fází implementace. Pracuj na staging branchi, po každé fázi commituj změny. Vždy nejdříve čti existující kód, aby se předešlo duplikacím. Pokud potřebuješ clarifikace na jakékoli API, ptej se uživatele.
