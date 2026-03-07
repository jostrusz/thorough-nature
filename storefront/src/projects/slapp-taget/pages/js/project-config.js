var PROJECT_CONFIG = {
  "slug": "slapp-taget",
  "medusaUrl": "",
  "publishableApiKey": "",
  "mainProduct": {
    "name": "Släpp taget om det som förstör dig",
    "handle": "slapp-taget-om-det-som-forstor-dig",
    "variantId": "",
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
    "SE": ""
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
