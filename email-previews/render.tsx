import { render } from '@react-email/render'
import * as React from 'react'
import * as fs from 'fs'
import * as path from 'path'

// Import templates
import { PsOrderPlacedTemplate } from '../backend/src/modules/email-notifications/templates/ps-order-placed'
import { PsShipmentNotificationTemplate } from '../backend/src/modules/email-notifications/templates/ps-shipment-notification'

const orderPlacedProps = {
  order: {
    id: 'order_01KNHJX7RQ',
    display_id: '812',
    metadata: { custom_order_number: 'CZ2026-812' },
    created_at: '2026-04-06T14:23:00.000Z',
    email: 'petra.svobodova@seznam.cz',
    currency_code: 'czk',
    items: [
      {
        id: 'item-1',
        title: 'Psí superživot',
        product_title: 'Psí superživot',
        variant_title: null,
        quantity: 2,
        unit_price: 550,
        thumbnail: 'https://psisuperzivot.cz/psi-superzivot-kniha-pichi.png',
      },
      {
        id: 'item-2',
        title: 'Příplatek za dobírku',
        product_title: 'Příplatek za dobírku',
        variant_title: null,
        quantity: 1,
        unit_price: 30,
        thumbnail: null,
      },
    ],
    summary: {
      raw_current_order_total: { value: 1150 },
      raw_shipping_total: { value: 20 },
      raw_tax_total: { value: 201 },
    },
  },
  shippingAddress: {
    first_name: 'Petra',
    last_name: 'Svobodová',
    address_1: 'Korunní 810/104',
    city: 'Praha 10',
    postal_code: '101 00',
    country_code: 'cz',
    phone: '+420 777 123 456',
  },
  billingAddress: {
    first_name: 'Petra',
    last_name: 'Svobodová',
    address_1: 'Korunní 810/104',
    city: 'Praha 10',
    postal_code: '101 00',
    country_code: 'cz',
  },
  paymentMethod: 'Dobírka (platba při převzetí)',
  billingEntity: {
    legal_name: 'EverChapter OÜ',
    registration_id: '16938029',
    address: { city: 'Tallinn', district: 'Estonia' },
  },
}

const shipmentProps = {
  order: {
    id: 'order_01KNHJX7RQ',
    display_id: '812',
    metadata: { custom_order_number: 'CZ2026-812' },
    created_at: '2026-04-06T14:23:00.000Z',
    email: 'petra.svobodova@seznam.cz',
    currency_code: 'czk',
    items: [
      {
        id: 'item-1',
        title: 'Psí superživot',
        product_title: 'Psí superživot',
        variant_title: null,
        quantity: 2,
        unit_price: 550,
        thumbnail: 'https://psisuperzivot.cz/psi-superzivot-kniha-pichi.png',
      },
    ],
  },
  shippingAddress: {
    first_name: 'Petra',
    last_name: 'Svobodová',
    address_1: 'Korunní 810/104',
    city: 'Praha 10',
    postal_code: '101 00',
    country_code: 'cz',
  },
  trackingNumber: 'Z10009876543',
  trackingUrl: 'https://tracking.zasilkovna.cz/Z10009876543',
  trackingCompany: 'Zásilkovna',
  billingEntity: {
    legal_name: 'EverChapter OÜ',
    registration_id: '16938029',
    address: { city: 'Tallinn', district: 'Estonia' },
  },
}

async function main() {
  const outDir = path.resolve(__dirname)

  // Render order placed
  const orderHtml = await render(React.createElement(PsOrderPlacedTemplate, orderPlacedProps as any))
  fs.writeFileSync(path.join(outDir, 'ps-order-placed.html'), orderHtml)
  console.log('Rendered ps-order-placed.html')

  // Render shipment notification
  const shipmentHtml = await render(React.createElement(PsShipmentNotificationTemplate, shipmentProps as any))
  fs.writeFileSync(path.join(outDir, 'ps-shipment-notification.html'), shipmentHtml)
  console.log('Rendered ps-shipment-notification.html')

  // Create index page
  const indexHtml = `<!DOCTYPE html>
<html><head><title>Email Previews - Psí superživot</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
  h1 { color: #EA580C; }
  a { display: block; padding: 16px 20px; margin: 12px 0; background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 10px; color: #EA580C; text-decoration: none; font-weight: 600; font-size: 15px; }
  a:hover { background: #FFEDD5; }
  .desc { color: #71717A; font-size: 13px; font-weight: 400; margin-top: 4px; }
</style></head>
<body>
  <h1>Email Previews</h1>
  <p style="color:#71717A">Psí superživot — zákazník z Česka</p>
  <a href="ps-order-placed.html">
    1. Potvrzení objednávky
    <div class="desc">Email po úspěšné objednávce — CZ2026-812, 2x Psí superživot, dobírka</div>
  </a>
  <a href="ps-shipment-notification.html">
    2. Oznámení o odeslání
    <div class="desc">Email po odeslání zásilky — tracking Zásilkovna Z10009876543</div>
  </a>
</body></html>`
  fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml)
  console.log('Rendered index.html')
}

main().catch(console.error)
