import { render } from '@react-email/render'
import * as React from 'react'
import * as fs from 'fs'
import * as path from 'path'

import { PsOrderPlacedTemplate } from './src/modules/email-notifications/templates/ps-order-placed'
import { PsShipmentNotificationTemplate } from './src/modules/email-notifications/templates/ps-shipment-notification'
import { AdminOrderNotificationTemplate } from './src/modules/email-notifications/templates/admin-order-notification'
import { PsEbookDeliveryTemplate } from './src/modules/email-notifications/templates/ps-ebook-delivery'

// ── Variant 1: Home delivery + COD ──
const orderHome = {
  order: {
    id: 'order_01KNHJX7RQ',
    display_id: '812',
    metadata: { custom_order_number: 'CZ2026-812', cod_fee: 30 },
    created_at: '2026-04-06T14:23:00.000Z',
    email: 'petra.svobodova@seznam.cz',
    currency_code: 'czk',
    items: [
      { id: 'item-1', title: 'Psí superživot', product_title: 'Psí superživot', variant_title: null, quantity: 2, unit_price: 550, thumbnail: 'https://psisuperzivot.cz/psi-superzivot-kniha-pichi.png' },
      { id: 'item-2', title: 'Příplatek za dobírku', product_title: 'Příplatek za dobírku', variant_title: null, quantity: 1, unit_price: 30, thumbnail: null },
    ],
    summary: { raw_current_order_total: { value: 1150 }, raw_shipping_total: { value: 20 }, raw_tax_total: { value: 201 } },
  },
  shippingAddress: { first_name: 'Petra', last_name: 'Svobodová', address_1: 'Korunní 810/104', city: 'Praha 10', postal_code: '101 00', country_code: 'cz' },
  billingAddress: { first_name: 'Petra', last_name: 'Svobodová', address_1: 'Korunní 810/104', city: 'Praha 10', postal_code: '101 00', country_code: 'cz' },
  paymentMethod: 'Dobírka (platba při převzetí)',
  pickupPoint: null,
}

// ── Variant 2: Pickup point + Paid online ──
const orderPickup = {
  order: {
    id: 'order_01KNHJX8AB',
    display_id: '813',
    metadata: { custom_order_number: 'CZ2026-813' },
    created_at: '2026-04-06T15:45:00.000Z',
    email: 'martin.dvorak@email.cz',
    currency_code: 'czk',
    items: [
      { id: 'item-1', title: 'Psí superživot', product_title: 'Psí superživot', variant_title: null, quantity: 1, unit_price: 550, thumbnail: 'https://psisuperzivot.cz/psi-superzivot-kniha-pichi.png' },
    ],
    summary: { raw_current_order_total: { value: 550 }, raw_shipping_total: { value: 0 }, raw_tax_total: { value: 96 } },
  },
  shippingAddress: { first_name: 'Martin', last_name: 'Dvořák', address_1: 'Českomoravská 2420/15a', city: 'Praha 9', postal_code: '190 00', country_code: 'cz' },
  billingAddress: { first_name: 'Martin', last_name: 'Dvořák', address_1: 'Českomoravská 2420/15a', city: 'Praha 9', postal_code: '190 00', country_code: 'cz' },
  paymentMethod: 'Platba kartou',
  pickupPoint: {
    name: 'Zásilkovna - Albert Českomoravská',
    id: '12345',
    address: 'Českomoravská 2420/15a, 190 00 Praha 9',
  },
}

// ── Shipment: Home delivery ──
const shipHome = {
  order: {
    id: 'order_01KNHJX7RQ', display_id: '812',
    metadata: { custom_order_number: 'CZ2026-812' },
    created_at: '2026-04-06T14:23:00.000Z', email: 'petra.svobodova@seznam.cz', currency_code: 'czk',
    items: [{ id: 'item-1', title: 'Psí superživot', product_title: 'Psí superživot', variant_title: null, quantity: 2, unit_price: 550, thumbnail: 'https://psisuperzivot.cz/psi-superzivot-kniha-pichi.png' }],
  },
  shippingAddress: { first_name: 'Petra', last_name: 'Svobodová', address_1: 'Korunní 810/104', city: 'Praha 10', postal_code: '101 00', country_code: 'cz' },
  trackingNumber: 'Z10009876543', trackingUrl: 'https://tracking.zasilkovna.cz/Z10009876543', trackingCompany: 'Zásilkovna',
  pickupPoint: null,
}

// ── Shipment: Pickup point ──
const shipPickup = {
  order: {
    id: 'order_01KNHJX8AB', display_id: '813',
    metadata: { custom_order_number: 'CZ2026-813' },
    created_at: '2026-04-06T15:45:00.000Z', email: 'martin.dvorak@email.cz', currency_code: 'czk',
    items: [{ id: 'item-1', title: 'Psí superživot', product_title: 'Psí superživot', variant_title: null, quantity: 1, unit_price: 550, thumbnail: 'https://psisuperzivot.cz/psi-superzivot-kniha-pichi.png' }],
  },
  shippingAddress: { first_name: 'Martin', last_name: 'Dvořák', address_1: 'Českomoravská 2420/15a', city: 'Praha 9', postal_code: '190 00', country_code: 'cz' },
  trackingNumber: 'Z10009876544', trackingUrl: 'https://tracking.zasilkovna.cz/Z10009876544', trackingCompany: 'Zásilkovna',
  pickupPoint: {
    name: 'Zásilkovna - Albert Českomoravská',
    id: '12345',
    address: 'Českomoravská 2420/15a, 190 00 Praha 9',
  },
}

async function main() {
  const outDir = path.resolve(__dirname, '..', 'email-previews')
  fs.mkdirSync(outDir, { recursive: true })

  // ── Variant 3: Home delivery + Paid ──
  const orderHomePaid = {
    ...orderHome,
    order: { ...orderHome.order, metadata: { custom_order_number: 'CZ2026-814' }, display_id: '814' },
    paymentMethod: 'Platba kartou',
    pickupPoint: null,
  }
  // fix: remove cod_fee from summary
  orderHomePaid.order.items = [orderHome.order.items[0]]
  orderHomePaid.order.summary = { raw_current_order_total: { value: 1120 }, raw_shipping_total: { value: 20 }, raw_tax_total: { value: 196 } }

  // ── Variant 4: Pickup + COD ──
  const orderPickupCod = {
    ...orderPickup,
    order: {
      ...orderPickup.order,
      metadata: { custom_order_number: 'CZ2026-815', cod_fee: 30 },
      display_id: '815',
      items: [
        ...orderPickup.order.items,
        { id: 'item-2', title: 'Příplatek za dobírku', product_title: 'Příplatek za dobírku', variant_title: null, quantity: 1, unit_price: 30, thumbnail: null },
      ],
      summary: { raw_current_order_total: { value: 580 }, raw_shipping_total: { value: 0 }, raw_tax_total: { value: 101 } },
    },
    paymentMethod: 'Dobírka (platba při převzetí)',
    pickupPoint: orderPickup.pickupPoint,
  }

  const files = [
    { name: 'ps-order-home-cod.html', el: React.createElement(PsOrderPlacedTemplate, orderHome as any) },
    { name: 'ps-order-home-paid.html', el: React.createElement(PsOrderPlacedTemplate, orderHomePaid as any) },
    { name: 'ps-order-pickup-paid.html', el: React.createElement(PsOrderPlacedTemplate, orderPickup as any) },
    { name: 'ps-order-pickup-cod.html', el: React.createElement(PsOrderPlacedTemplate, orderPickupCod as any) },
    { name: 'ps-shipment-home.html', el: React.createElement(PsShipmentNotificationTemplate, shipHome as any) },
    { name: 'ps-shipment-pickup.html', el: React.createElement(PsShipmentNotificationTemplate, shipPickup as any) },
    // Ebook delivery
    { name: 'ps-ebook-delivery.html', el: React.createElement(PsEbookDeliveryTemplate, {
      firstName: 'Petra',
      downloadUrl: 'https://psi-superzivot.cz/download/abc123-test-token',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    } as any) },
    // Admin notification
    { name: 'admin-notification.html', el: React.createElement(AdminOrderNotificationTemplate, {
      order: {
        id: 'order_01KNHJX7RQ', display_id: '812',
        metadata: { custom_order_number: 'CZ2026-812', project_id: 'psi-superzivot' },
        created_at: '2026-04-06T14:23:00.000Z', email: 'petra.svobodova@seznam.cz', currency_code: 'czk',
        items: [
          { id: 'item-1', title: 'Psí superživot', product_title: 'Psí superživot', variant_title: null, quantity: 2, unit_price: 550, thumbnail: null },
          { id: 'item-2', title: 'Příplatek za dobírku', product_title: 'Příplatek za dobírku', variant_title: null, quantity: 1, unit_price: 30, thumbnail: null },
        ],
        summary: { raw_current_order_total: { value: 1150 }, raw_shipping_total: { value: 20 }, raw_tax_total: { value: 201 } },
      },
      shippingAddress: { first_name: 'Petra', last_name: 'Svobodová', address_1: 'Korunní 810/104', city: 'Praha 10', postal_code: '101 00', country_code: 'cz' },
      paymentMethod: 'Dobírka', type: 'new_order', variantIndex: 0,
    } as any) },
  ]

  for (const f of files) {
    const html = await render(f.el)
    fs.writeFileSync(path.join(outDir, f.name), html)
    console.log(`Rendered ${f.name}`)
  }

  const indexHtml = `<!DOCTYPE html>
<html><head><title>Email Previews - Psi superzivot</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 640px; margin: 40px auto; padding: 20px; }
  h1 { color: #EA580C; }
  h2 { color: #3F3F46; font-size: 15px; margin: 28px 0 8px; }
  a { display: block; padding: 14px 18px; margin: 8px 0; background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 10px; color: #EA580C; text-decoration: none; font-weight: 600; font-size: 14px; }
  a:hover { background: #FFEDD5; }
  .desc { color: #71717A; font-size: 12px; font-weight: 400; margin-top: 3px; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; margin-left: 8px; }
  .cod { background: #FFFBEB; color: #92400E; }
  .paid { background: #F0FDF4; color: #166534; }
  .home { background: #EFF6FF; color: #1E40AF; }
  .pickup { background: #FDF4FF; color: #7E22CE; }
</style></head>
<body>
  <h1>Email Previews</h1>
  <p style="color:#71717A">Psi superzivot — 4 varianty emailu</p>

  <h2>Potvrzeni objednavky</h2>
  <a href="ps-order-home-cod.html">
    Na adresu + Dobirka <span class="tag home">Na adresu</span><span class="tag cod">Dobirka</span>
    <div class="desc">Petra Svobodova, 2x Psi superzivot, Korunni 810/104, Praha 10</div>
  </a>
  <a href="ps-order-home-paid.html">
    Na adresu + Zaplaceno <span class="tag home">Na adresu</span><span class="tag paid">Zaplaceno</span>
    <div class="desc">Petra Svobodova, 2x Psi superzivot, kartou online</div>
  </a>
  <a href="ps-order-pickup-paid.html">
    Vydejni misto + Zaplaceno <span class="tag pickup">Vydejni misto</span><span class="tag paid">Zaplaceno</span>
    <div class="desc">Martin Dvorak, 1x Psi superzivot, Zasilkovna Albert Ceskomoravska</div>
  </a>
  <a href="ps-order-pickup-cod.html">
    Vydejni misto + Dobirka <span class="tag pickup">Vydejni misto</span><span class="tag cod">Dobirka</span>
    <div class="desc">Martin Dvorak, 1x Psi superzivot + dobirka, Zasilkovna Albert</div>
  </a>

  <h2>Doručení e-booku</h2>
  <a href="ps-ebook-delivery.html">
    E-book ke stažení <span class="tag paid">E-book</span>
    <div class="desc">Petra Svobodová, odkaz ke stažení Psí superživot</div>
  </a>

  <h2>Admin notifikace</h2>
  <a href="admin-notification.html">
    Admin — nova objednavka <span class="tag paid">Interní</span>
    <div class="desc">Motivacni email pro admina po vytvoreni objednavky</div>
  </a>

  <h2>Oznameni o odeslani</h2>
  <a href="ps-shipment-home.html">
    Odeslano — doruceni na adresu <span class="tag home">Na adresu</span>
    <div class="desc">Petra Svobodova, tracking Z10009876543</div>
  </a>
  <a href="ps-shipment-pickup.html">
    Odeslano — vydejni misto <span class="tag pickup">Vydejni misto</span>
    <div class="desc">Martin Dvorak, tracking Z10009876544, Zasilkovna Albert</div>
  </a>
</body></html>`
  fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml)
  console.log('Rendered index.html')
}

main().catch(console.error)
