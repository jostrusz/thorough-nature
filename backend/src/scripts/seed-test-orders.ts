import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Seeds 10 test orders with varied data for visual dashboard testing.
 * Run: medusa exec ./src/scripts/seed-test-orders.ts
 */

interface TestOrder {
  email: string
  firstName: string
  lastName: string
  address1: string
  city: string
  postalCode: string
  countryCode: string
  phone: string
  items: { title: string; quantity: number; unitPrice: number }[]
  shippingMethod: string
  shippingAmount: number
  metadata: Record<string, any>
}

const TEST_ORDERS: TestOrder[] = [
  {
    email: "jan.devries@email.nl",
    firstName: "Jan",
    lastName: "de Vries",
    address1: "Prinsengracht 123",
    city: "Amsterdam",
    postalCode: "1015 DW",
    countryCode: "nl",
    phone: "+31612345678",
    items: [
      { title: "Laat los wat je kapotmaakt (boek) + 2x bonus (e-boek)", quantity: 1, unitPrice: 35 },
    ],
    shippingMethod: "Gratis Verzending (GLS)",
    shippingAmount: 0,
    metadata: {
      book_sent: true,
      tags: "Laat los wat je kapotmaakt",
      baselinker_status: "delivered",
      baselinker_order_id: "BL-10001",
    },
  },
  {
    email: "marie.janssen@email.be",
    firstName: "Marie",
    lastName: "Janssen",
    address1: "Meir 45",
    city: "Antwerpen",
    postalCode: "2000",
    countryCode: "be",
    phone: "+32498765432",
    items: [
      { title: "Laat los wat je kapotmaakt (boek) + 2x bonus (e-boek)", quantity: 2, unitPrice: 35 },
    ],
    shippingMethod: "Koerier GLS",
    shippingAmount: 0,
    metadata: {
      book_sent: true,
      tags: "Laat los wat je kapotmaakt",
      baselinker_status: "sent",
      baselinker_order_id: "BL-10002",
    },
  },
  {
    email: "hans.mueller@email.de",
    firstName: "Hans",
    lastName: "Mueller",
    address1: "Friedrichstrasse 88",
    city: "Berlin",
    postalCode: "10117",
    countryCode: "de",
    phone: "+491761234567",
    items: [
      { title: "Lass los was dich kaputt macht (Buch)", quantity: 1, unitPrice: 32 },
    ],
    shippingMethod: "DHL Paket",
    shippingAmount: 4.95,
    metadata: {
      book_sent: false,
      tags: "Lass los was dich kaputt macht",
      baselinker_status: "processing",
    },
  },
  {
    email: "petra.novakova@email.cz",
    firstName: "Petra",
    lastName: "Novakova",
    address1: "Vodickova 12",
    city: "Praha",
    postalCode: "110 00",
    countryCode: "cz",
    phone: "+420777123456",
    items: [
      { title: "Psi superzivot (kniha)", quantity: 1, unitPrice: 28 },
    ],
    shippingMethod: "Zasilkovna",
    shippingAmount: 3.50,
    metadata: {
      book_sent: false,
      tags: "Psi superzivot",
    },
  },
  {
    email: "anna.kowalska@email.pl",
    firstName: "Anna",
    lastName: "Kowalska",
    address1: "ul. Nowy Swiat 34",
    city: "Warszawa",
    postalCode: "00-100",
    countryCode: "pl",
    phone: "+48601234567",
    items: [
      { title: "Odpusc to co cie niszczy (ksiazka)", quantity: 1, unitPrice: 25 },
    ],
    shippingMethod: "InPost Paczkomat",
    shippingAmount: 2.99,
    metadata: {
      book_sent: false,
      tags: "Odpusc to co cie niszczy",
      baselinker_status: "imported",
    },
  },
  {
    email: "erik.svensson@email.se",
    firstName: "Erik",
    lastName: "Svensson",
    address1: "Storgatan 15",
    city: "Stockholm",
    postalCode: "111 57",
    countryCode: "se",
    phone: "+46701234567",
    items: [
      { title: "Slapp taget om det som forstor dig (bok)", quantity: 1, unitPrice: 30 },
    ],
    shippingMethod: "PostNord",
    shippingAmount: 5.50,
    metadata: {
      book_sent: true,
      tags: "Slapp taget om det som forstor dig",
      baselinker_status: "transit",
      baselinker_order_id: "BL-10006",
    },
  },
  {
    email: "sophie.vandijk@email.nl",
    firstName: "Sophie",
    lastName: "van Dijk",
    address1: "Keizersgracht 456",
    city: "Amsterdam",
    postalCode: "1016 GD",
    countryCode: "nl",
    phone: "+31620987654",
    items: [
      { title: "Laat los wat je kapotmaakt (boek) + 2x bonus (e-boek)", quantity: 1, unitPrice: 35 },
    ],
    shippingMethod: "Gratis Verzending (GLS)",
    shippingAmount: 0,
    metadata: {
      book_sent: false,
      tags: "Laat los wat je kapotmaakt",
      baselinker_status: "returned",
    },
  },
  {
    email: "klaus.schmidt@email.de",
    firstName: "Klaus",
    lastName: "Schmidt",
    address1: "Maximilianstrasse 22",
    city: "Munchen",
    postalCode: "80539",
    countryCode: "de",
    phone: "+491517654321",
    items: [
      { title: "Lass los was dich kaputt macht (Buch)", quantity: 1, unitPrice: 32 },
      { title: "Die Hundebibel", quantity: 1, unitPrice: 23 },
    ],
    shippingMethod: "DHL Paket",
    shippingAmount: 4.95,
    metadata: {
      book_sent: true,
      tags: "Lass los was dich kaputt macht",
      baselinker_status: "delivered",
      baselinker_order_id: "BL-10008",
    },
  },
  {
    email: "katarina.horvath@email.cz",
    firstName: "Katarina",
    lastName: "Horvath",
    address1: "Masarykova 8",
    city: "Brno",
    postalCode: "602 00",
    countryCode: "cz",
    phone: "+420608765432",
    items: [
      { title: "Kocici bible (kniha)", quantity: 1, unitPrice: 26 },
    ],
    shippingMethod: "Zasilkovna",
    shippingAmount: 3.50,
    metadata: {
      book_sent: true,
      tags: "Kocici bible",
      baselinker_status: "sent",
      baselinker_order_id: "BL-10009",
    },
  },
  {
    email: "pieter.vermeer@email.be",
    firstName: "Pieter",
    lastName: "Vermeer",
    address1: "Grote Markt 7",
    city: "Brussel",
    postalCode: "1000",
    countryCode: "be",
    phone: "+32471234567",
    items: [
      { title: "Laat los wat je kapotmaakt (boek) + 2x bonus (e-boek)", quantity: 3, unitPrice: 35 },
    ],
    shippingMethod: "Koerier GLS",
    shippingAmount: 0,
    metadata: {
      book_sent: false,
      tags: "Laat los wat je kapotmaakt",
    },
  },
]

export default async function seedTestOrders({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orderModuleService = container.resolve(Modules.ORDER)

  logger.info("[Test Orders] Starting seed of 10 test orders...")

  for (let i = 0; i < TEST_ORDERS.length; i++) {
    const to = TEST_ORDERS[i]

    try {
      const itemsTotal = to.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0
      )
      const total = itemsTotal + to.shippingAmount

      const order = await orderModuleService.createOrders({
        currency_code: "eur",
        email: to.email,
        shipping_address: {
          first_name: to.firstName,
          last_name: to.lastName,
          address_1: to.address1,
          city: to.city,
          postal_code: to.postalCode,
          country_code: to.countryCode,
          phone: to.phone,
        },
        billing_address: {
          first_name: to.firstName,
          last_name: to.lastName,
          address_1: to.address1,
          city: to.city,
          postal_code: to.postalCode,
          country_code: to.countryCode,
          phone: to.phone,
        },
        items: to.items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        })),
        shipping_methods: [
          {
            name: to.shippingMethod,
            amount: to.shippingAmount,
          },
        ],
        metadata: to.metadata,
      })

      logger.info(
        `[Test Orders] Created order ${i + 1}/10: ${to.firstName} ${to.lastName} (${to.countryCode.toUpperCase()}) - \u20AC${total.toFixed(2)}`
      )
    } catch (err: any) {
      logger.error(
        `[Test Orders] Failed to create order ${i + 1}: ${err.message}`
      )
    }
  }

  logger.info("[Test Orders] Seed complete! 10 test orders created.")
}
