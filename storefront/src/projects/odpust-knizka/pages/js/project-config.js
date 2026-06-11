var PROJECT_CONFIG = {
  "slug": "odpust-knizka",
  "projectId": "odpust-knizka",
  "domain": "www.odpust-knizka.cz",
  "medusaUrl": "https://www.marketing-hq.eu",
  "publishableApiKey": "",
  "mainProduct": {
    "name": "Odpusť to, co tě ničí",
    "handle": "odpust-to-co-te-nici",
    "variantId": "",
    "price": 550,
    "currency": "CZK",
    "thumbnail": ""
  },
  "upsellProduct": {
    "name": "",
    "handle": "",
    "variantId": "",
    "price": 0,
    "originalPrice": 0,
    "currency": "CZK"
  },
  "bundleOptions": [
    { "qty": 1, "price": 550, "label": "1 kniha", "sublabel": "Pro sebe", "badge": "NEJPRODÁVANĚJŠÍ", "save": 0 },
    { "qty": 2, "price": 899, "label": "2 knihy", "sublabel": "Pro vás a pro blízkého člověka", "badge": "NEJOBLÍBENĚJŠÍ", "save": 201, "savings": 201 },
    { "qty": 3, "price": 1199, "label": "3 knihy", "sublabel": "Pro celou rodinu", "badge": "NEJVÍC UŠETŘÍTE", "save": 451, "savings": 451 },
    { "qty": 4, "price": 1499, "label": "4 knihy", "sublabel": "Perfektní jako dárek", "badge": "NEJLEPŠÍ HODNOTA", "save": 701, "savings": 701 }
  ],
  "regions": {
    "CZ": "reg_01KKB4EZN0CHFYDG64K4VP0J2A"
  },
  "paymentProviders": {},
  "mollieProfileId": null,
  "packetaApiKey": "cbb760f552ef87b3",
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
