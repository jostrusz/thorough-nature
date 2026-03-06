var PROJECT_CONFIG = {
  "slug": "slapp-taget",
  "medusaUrl": "https://backend-staging-580e.up.railway.app",
  "publishableApiKey": "pk_fcc7f4690d287adde9a5f707303021ebcb799c23f00f4d4f0cc9f2b825ad413d",
  "mainProduct": {
    "name": "Släpp taget om det som förstör dig",
    "handle": "slapp-taget-om-det-som-forstor-dig",
    "variantId": "variant_01KK1MEDS5TERM6HX7SH8BMV92",
    "price": 399,
    "currency": "SEK",
    "thumbnail": ""
  },
  "upsellProduct": {
    "name": "",
    "handle": "",
    "variantId": "",
    "price": 0,
    "originalPrice": 0,
    "currency": "SEK"
  },
  "bundleOptions": [
    { "qty": 1, "price": 399, "label": "1 bok", "save": 0 },
    { "qty": 2, "price": 699, "label": "2 böcker", "save": 99 },
    { "qty": 3, "price": 949, "label": "3 böcker", "save": 248 },
    { "qty": 4, "price": 1199, "label": "4 böcker", "save": 397 }
  ],
  "regions": {
    "SE": "reg_01KK1M7G5KWH78ZJA9PQZ45JTX"
  },
  "paymentProviders": {},
  "mollieProfileId": null,
  "orderBumpEnabled": false,
  "upsellEnabled": false,
  "foxentryApiKey": null,
  "homeUrl": "/",
  "checkoutUrl": "/checkout.html",
  "thankYouUrl": "/thank-you.html"
};
PROJECT_CONFIG.getRegionId = function(countryCode) {
  return PROJECT_CONFIG.regions[countryCode] || Object.values(PROJECT_CONFIG.regions)[0];
};
