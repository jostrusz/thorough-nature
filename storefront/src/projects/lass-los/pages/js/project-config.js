var PROJECT_CONFIG = {
  "slug": "lass-los",
  "projectId": "lass-los",
  "medusaUrl": "https://backend-staging-580e.up.railway.app",
  "publishableApiKey": "pk_e083604eefa6f6c1e62f4b39fe622d7585c3234adbf1b21cd8756c4e13b59357",
  "mainProduct": {
    "name": "Lass los, was dich kaputt macht",
    "handle": "lass-los-was-dich-kaputt-macht",
    "variantId": "variant_01KK9FYYF8Z5YXMSR6H67MPHTB",
    "price": 35,
    "currency": "EUR",
    "thumbnail": ""
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
    { "qty": 1, "price": 35, "label": "1 Buch", "save": 0 },
    { "qty": 2, "price": 59, "label": "2 Bücher", "save": 11 },
    { "qty": 3, "price": 79, "label": "3 Bücher", "save": 26 },
    { "qty": 4, "price": 99, "label": "4 Bücher", "save": 41 }
  ],
  "regions": {
    "DE": "reg_01KK9FYYBDZ6DP61G25YNR1DJK",
    "AT": "reg_01KK9FYYBDZ6DP61G25YNR1DJK",
    "LU": "reg_01KK9FYYBDZ6DP61G25YNR1DJK"
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
