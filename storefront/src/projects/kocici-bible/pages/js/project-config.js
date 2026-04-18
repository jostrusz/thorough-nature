var PROJECT_CONFIG = {
  "slug": "kocici-bible",
  "projectId": "kocici-bible",
  "domain": "www.kocicibible.cz",
  "medusaUrl": "https://www.marketing-hq.eu",
  "publishableApiKey": "pk_5f6d223af5e4a06268b3845132ece0bc81528095902c7b381dd1339ed085811b",
  "mainProduct": {
    "name": "Kočičí bible Oficial",
    "handle": "kocici-bible-oficial",
    "variantId": "variant_01KPFP9X5PXD8WPMJPMMS2ZF02",
    "price": 550,
    "currency": "CZK",
    "thumbnail": ""
  },
  "upsellProduct": {
    "name": "Psí superživot",
    "handle": "psi-superzivot",
    "variantId": "variant_01KKB4EZYDYVTC1HM9R7VZ8NHW",
    "price": 399,
    "originalPrice": 550,
    "currency": "CZK"
  },
  "bundleOptions": [
    { "qty": 1, "price": 550, "label": "1 kniha + 3× bonusy", "sublabel": "Pro sebe", "badge": "NEJPRODÁVANĚJŠÍ", "save": 0 },
    { "qty": 2, "price": 899, "label": "2 knihy + 3× bonusy", "sublabel": "Pro mě a dárek pro blízké", "badge": "NEJOBLÍBENĚJŠÍ", "save": 201, "savings": 201 },
    { "qty": 3, "price": 1199, "label": "3 knihy + 3× bonusy", "sublabel": "Pro celou rodinu koťátkářů", "badge": "NEJVÍC UŠETŘÍTE", "save": 451, "savings": 451 },
    { "qty": 4, "price": 1499, "label": "4 knihy + 3× bonusy", "sublabel": "Obdarujte všechny kočičí kámoše", "badge": "NEJLEPŠÍ HODNOTA", "save": 701, "savings": 701 }
  ],
  "regions": {
    "CZ": "reg_01KKB4EZN0CHFYDG64K4VP0J2A"
  },
  "paymentProviders": {},
  "mollieProfileId": null,
  "packetaApiKey": "cbb760f552ef87b3",
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
