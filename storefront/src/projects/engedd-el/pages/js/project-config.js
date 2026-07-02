var PROJECT_CONFIG = {
  "slug": "engedd-el",
  "projectId": "engedd-el",
  "domain": "www.engeddelkonyv.hu",
  "medusaUrl": "https://www.marketing-hq.eu",
  "publishableApiKey": "pk_9ff81c26523f6624c3f3f3458cb61de124ee95cbc94f9d0442bcb81ed2df7026",
  "mainProduct": {
    "name": "Engedd el, ami tönkretesz",
    "handle": "engedd-el-ami-tonkretesz",
    "variantId": "variant_01KWG6WMYKCZ14WF29MR1N6J1T",
    "price": 10999,
    "currency": "HUF",
    "thumbnail": ""
  },
  "upsellProduct": {
    "name": "",
    "handle": "",
    "variantId": "",
    "price": 0,
    "originalPrice": 0,
    "currency": "HUF"
  },
  "bundleOptions": [
    { "qty": 1, "price": 10999, "label": "1 könyv", "sublabel": "Magadnak", "badge": "BESTSELLER", "save": 0 },
    { "qty": 2, "price": 17999, "label": "2 könyv", "sublabel": "Neked és egy szerettednek", "badge": "LEGNÉPSZERŰBB", "save": 3999, "savings": 3999 },
    { "qty": 3, "price": 23999, "label": "3 könyv", "sublabel": "Az egész családnak", "badge": "LEGNAGYOBB MEGTAKARÍTÁS", "save": 8998, "savings": 8998 },
    { "qty": 4, "price": 29999, "label": "4 könyv", "sublabel": "Tökéletes ajándék", "badge": "LEGJOBB ÁR-ÉRTÉK", "save": 13997, "savings": 13997 }
  ],
  "regions": {
    "HU": "reg_01KWG6W2W6Z2YR8GVBRM3CEVHX"
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
