var PROJECT_CONFIG = {
  "slug": "odpusc-ksiazka",
  "projectId": "odpusc-ksiazka",
  "medusaUrl": "",
  "publishableApiKey": "",
  "mainProduct": {
    "name": "Odpuść to, co cię niszczy",
    "handle": "odpusc-to-co-cie-niszczy",
    "variantId": "",
    "price": 129,
    "currency": "PLN",
    "thumbnail": ""
  },
  "upsellProduct": {
    "name": "",
    "handle": "",
    "variantId": "",
    "price": 0,
    "originalPrice": 0,
    "currency": "PLN"
  },
  "bundleOptions": [
    { "qty": 1, "price": 129, "label": "1 książka", "save": 0 },
    { "qty": 2, "price": 199, "label": "2 książki", "save": 59 },
    { "qty": 3, "price": 279, "label": "3 książki", "save": 108 },
    { "qty": 4, "price": 359, "label": "4 książki", "save": 157 }
  ],
  "regions": {
    "PL": ""
  },
  "shippingOptions": {
    "paczkomat": { "name": "Paczkomat InPost", "price": 0, "matchName": "InPost" },
    "homeDelivery": { "name": "Dostawa do domu (Kurier)", "price": 5, "matchName": "Kurier" }
  },
  "inpostGeowidgetToken": "",
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
