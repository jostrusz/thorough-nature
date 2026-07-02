var PROJECT_CONFIG = {
  "slug": "engedd-el",
  "projectId": "engedd-el",
  "domain": "www.REPLACE-DOMAIN.hu",
  "medusaUrl": "https://www.marketing-hq.eu",
  "publishableApiKey": "pk_9ff81c26523f6624c3f3f3458cb61de124ee95cbc94f9d0442bcb81ed2df7026",
  "mainProduct": {
    "name": "Engedd el, ami tönkretesz",
    "handle": "engedd-el-ami-tonkretesz",
    "variantId": "variant_01KWG6WMYKCZ14WF29MR1N6J1T",
    "price": 11990,
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
    { "qty": 1, "price": 11990, "label": "1 könyv", "sublabel": "Magadnak", "badge": "LEGNÉPSZERŰBB", "save": 0 },
    { "qty": 2, "price": 19990, "label": "2 könyv", "sublabel": "Neked és egy szeretett embernek", "badge": "LEGKEDVELTEBB", "save": 3990, "savings": 3990 },
    { "qty": 3, "price": 25990, "label": "3 könyv", "sublabel": "Az egész családnak", "badge": "LEGTÖBB MEGTAKARÍTÁS", "save": 9980, "savings": 9980 },
    { "qty": 4, "price": 31990, "label": "4 könyv", "sublabel": "Tökéletes ajándék", "badge": "LEGJOBB ÉRTÉK", "save": 15970, "savings": 15970 }
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
