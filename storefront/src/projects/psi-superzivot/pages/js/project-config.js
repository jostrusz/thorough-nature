var PROJECT_CONFIG = {
  "slug": "psi-superzivot",
  "projectId": "psi-superzivot",
  "domain": "www.psi-superzivot.cz",
  "medusaUrl": "https://backend-staging-580e.up.railway.app",
  "publishableApiKey": "pk_9ae77cf9edbc080796019dcc29a618e9c133b329614a8b0350cc744210d667aa",
  "mainProduct": {
    "name": "Psí Superživot",
    "handle": "psi-superzivot",
    "variantId": "",
    "price": 550,
    "currency": "CZK",
    "thumbnail": "psi-superzivot-kniha-pichi.png"
  },
  "upsellProduct": {
    "name": "Kočičí bible",
    "handle": "kocici-bible",
    "variantId": "",
    "price": 399,
    "originalPrice": 550,
    "currency": "CZK"
  },
  "bundleOptions": [
    { "qty": 1, "price": 550, "label": "1 kniha + 3× bonusy", "sublabel": "Pro sebe", "badge": "NEJPRODÁVANĚJŠÍ", "save": 0 },
    { "qty": 2, "price": 899, "label": "2 knihy + 3× bonusy", "sublabel": "Pro mě a dárek pro blízké", "badge": "NEJOBLÍBENĚJŠÍ", "save": 201, "savings": 201 },
    { "qty": 3, "price": 1199, "label": "3 knihy + 3× bonusy", "sublabel": "Pro celou rodinu pejskařů", "badge": "NEJVÍC UŠETŘÍTE", "save": 451, "savings": 451 },
    { "qty": 4, "price": 1499, "label": "4 knihy + 3× bonusy", "sublabel": "Obdarujte všechny kámoše z venčáku", "badge": "NEJLEPŠÍ HODNOTA", "save": 701, "savings": 701 }
  ],
  "regions": {
    "CZ": "reg_01KKBXQSFW6CCV6MMZEYAAW0VA"
  },
  "paymentProviders": {},
  "mollieProfileId": null,
  "orderBumpEnabled": true,
  "upsellEnabled": true,
  "foxentryApiKey": null,
  "homeUrl": "/",
  "checkoutUrl": "/checkout.html",
  "thankYouUrl": "/thank-you.html"
};
PROJECT_CONFIG.getRegionId = function(countryCode) {
  return PROJECT_CONFIG.regions[countryCode] || Object.values(PROJECT_CONFIG.regions)[0];
};
