var PROJECT_CONFIG = {
  "slug": "lass-los",
  "projectId": "lass-los",
  "medusaUrl": "https://backend-staging-580e.up.railway.app",
  "publishableApiKey": "pk_9ae77cf9edbc080796019dcc29a618e9c133b329614a8b0350cc744210d667aa",
  "mainProduct": {
    "name": "Lass los, was dich kaputt macht",
    "handle": "lass-los-was-dich-kaputt-macht",
    "variantId": "variant_01KKAXMK3JG00Y20C7DV5KZBC2",
    "price": 35,
    "currency": "EUR",
    "thumbnail": "https://www.lasslosbuch.de/lass-los-was-dich-kaputt-macht-pichi.png"
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
    "DE": "reg_01KKAXMJP7NJDD196M0BJC4Y4F",
    "AT": "reg_01KKAXMJP7NJDD196M0BJC4Y4F",
    "LU": "reg_01KKAXMJP7NJDD196M0BJC4Y4F"
  },
  "paymentProviders": {},
  "mollieProfileId": null,
  "orderBumpEnabled": false,
  "upsellEnabled": false,
  "foxentryApiKey": null,
  "homeUrl": "/",
  "checkoutUrl": "/checkout.html",
  "thankYouUrl": "/thank-you.html",
  "catalogContentIds": ["1azgp7ymuv", "82764876", "31epnhw6c4", "dnoiszdeax", "gh1u1icp8r"]
};
PROJECT_CONFIG.getRegionId = function(countryCode) {
  return PROJECT_CONFIG.regions[countryCode] || Object.values(PROJECT_CONFIG.regions)[0];
};
