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
    "thumbnail": "https://www.lasslosbuch.de/lass-loss-was-dich-copy-pichi-1.png"
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
    { "qty": 1, "price": 35, "originalPrice": 0,   "label": "1× Lass los, was dich kaputt macht", "sublabel": "+ 2 Boni", "badge": "FÜR DICH SELBST",       "savings": 0 },
    { "qty": 2, "price": 59, "originalPrice": 70,  "label": "2× Lass los, was dich kaputt macht", "sublabel": "+ 2 Boni", "badge": "MIT FREUND(IN) TEILEN", "savings": 11 },
    { "qty": 3, "price": 79, "originalPrice": 105, "label": "3× Lass los, was dich kaputt macht", "sublabel": "+ 2 Boni", "badge": "PERFEKT ALS GESCHENK", "savings": 26 },
    { "qty": 4, "price": 99, "originalPrice": 140, "label": "4× Lass los, was dich kaputt macht", "sublabel": "+ 2 Boni", "badge": "BESTPREIS",             "savings": 41 }
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
