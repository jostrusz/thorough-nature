var PROJECT_CONFIG = {
  "slug": "biblia-kotow",
  "projectId": "biblia-kotow",
  "domain": "biblia-kotow.pl",
  "medusaUrl": "https://www.marketing-hq.eu",
  "publishableApiKey": "pk_e58360fe1501bfbfb1fab760cb5bf69f4c8cc97c20321c43b468e9c5b819136e",
  "mainProduct": {
    "name": "Biblia kotów",
    "handle": "biblia-kotow",
    "variantId": "variant_01KXJ6MGB6M9YZKN41EFWNJ1N5",
    "price": 89,
    "currency": "PLN",
    "thumbnail": ""
  },
  "upsellProducts": [],
  "upsellProduct": {
    "name": "Psí superživot",
    "handle": "psi-superzivot",
    "variantId": "variant_01KKB4EZYDYVTC1HM9R7VZ8NHW",
    "price": 399,
    "originalPrice": 550,
    "currency": "CZK"
  },
  "bundleOptions": [
    { "qty": 1, "price": 89,  "label": "1 książka + 4 darmowe e-booki", "sublabel": "Dla siebie", "badge": "BESTSELLER", "save": 0 },
    { "qty": 2, "price": 149, "label": "2 książki + 4 darmowe e-booki", "sublabel": "Dla mnie i na prezent", "badge": "NAJPOPULARNIEJSZE", "save": 29, "savings": 29 },
    { "qty": 3, "price": 199, "label": "3 książki + 4 darmowe e-booki", "sublabel": "Dla całej rodziny kociarzy", "badge": "NAJWIĘCEJ OSZCZĘDZASZ", "save": 68, "savings": 68 },
    { "qty": 4, "price": 249, "label": "4 książki + 4 darmowe e-booki", "sublabel": "Obdaruj wszystkich kociarzy", "badge": "NAJLEPSZA OFERTA", "save": 107, "savings": 107 }
  ],
  "regions": {
    "PL": "reg_01KK8N9GTWQK7A55SXAH07KNK1"
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
