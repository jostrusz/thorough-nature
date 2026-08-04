var PROJECT_CONFIG = {
  "slug": "macacia-biblia",
  "projectId": "macacia-biblia",
  "locale": "sk",
  "orderPrefix": "SK2026",
  "domain": "www.macaciabiblia.sk",
  "medusaUrl": "https://www.marketing-hq.eu",
  "publishableApiKey": "pk_6b4c635fd2761f315b9329419ede0f8d2bfa53095b873f2ea31e2b49a2012379",
  "mainProduct": {
    "name": "Mačacia biblia",
    "handle": "macacia-biblia",
    "variantId": "variant_01KZ3AQC81MF93JQ9DRADA9E9T",
    "price": 24,
    "originalPrice": 34,
    "currency": "EUR",
    "thumbnail": "https://www.macaciabiblia.sk/macacia-biblia-cover.webp"
  },
  "upsellProduct": {
    "name": "",
    "handle": "",
    "variantId": "",
    "price": 0,
    "originalPrice": 0,
    "currency": "EUR"
  },
  "bundleOptions": [
    {
      "qty": 1,
      "price": 24,
      "originalPrice": 34,
      "label": "1 kniha + 3× bonusy",
      "sublabel": "Pre seba",
      "badge": "NAJPREDÁVANEJŠIE",
      "save": 0,
      "savings": 0
    },
    {
      "qty": 2,
      "price": 40,
      "originalPrice": 68,
      "label": "2 knihy + 3× bonusy",
      "sublabel": "Pre mňa a darček pre blízkych",
      "badge": "NAJOBĽÚBENEJŠIE",
      "save": 8,
      "savings": 8
    },
    {
      "qty": 3,
      "price": 54,
      "originalPrice": 102,
      "label": "3 knihy + 3× bonusy",
      "sublabel": "Pre celú rodinu mačkárov",
      "badge": "NAJVIAC UŠETRÍTE",
      "save": 18,
      "savings": 18
    },
    {
      "qty": 4,
      "price": 68,
      "originalPrice": 136,
      "label": "4 knihy + 3× bonusy",
      "sublabel": "Obdarujte všetkých mačacích kamarátov",
      "badge": "NAJLEPŠIA HODNOTA",
      "save": 28,
      "savings": 28
    }
  ],
  "regions": {
    "SK": "reg_01KWVAZVNATPX01HH77MYWKG3M"
  },
  "paymentProviders": {},
  "mollieProfileId": null,
  "packetaApiKey": "cbb760f552ef87b3",
  "upsellProducts": [
  {
      "id": "pusti",
      "name": "Pusti to, čo ťa ničí",
      "handle": "pusti-to-co-ta-nici-mb",
      "variantId": "variant_01KZ5B9GACJ6KM2GRBYGNASSAY",
      "price": 25,
      "originalPrice": 32,
      "currency": "EUR",
      "image": "https://bucket-production-b93e.up.railway.app:443/medusa-media/Pusti-to-co-ta-nici-01KX33DPGAPZ6D7NN4KHH4NXPA.png",
      "author": "Joris de Vries · 290 strán + pracovný zošit",
      "desc": "Bestseller pre každého, komu v hlave beží nekonečný prúd myšlienok. Ako zastaviť premýšľanie, upokojiť emócie a nájsť vnútorný pokoj — postavené na neurovede a psychológii, žiadne vágne rady.",
      "hook": "Ideálne pre vás alebo ako darček pre niekoho, kto „nedokáže vypnúť“."
  }
  ],
  "orderBumpEnabled": true,
  "upsellEnabled": false,
  "foxentryApiKey": null,
  "homeUrl": "/",
  "checkoutUrl": "/checkout.html",
  "thankYouUrl": "/thank-you.html"
};
PROJECT_CONFIG.getRegionId = function(countryCode) {
  return PROJECT_CONFIG.regions[countryCode] || Object.values(PROJECT_CONFIG.regions)[0];
};
