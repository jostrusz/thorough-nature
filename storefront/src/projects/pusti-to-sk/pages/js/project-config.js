var PROJECT_CONFIG = {
  "slug": "pusti-to-sk",
  "projectId": "pusti-to-sk",
  "domain": "www.pustitocotanici.sk",
  "medusaUrl": "https://www.marketing-hq.eu",
  "publishableApiKey": "pk_6628d5b84f9b78de978519a40586598941ac3779abf4b4de1ed4f501dcf532b5",
  "mainProduct": {
    "name": "Pusti to, čo ťa ničí",
    "handle": "pusti-to",
    "variantId": "variant_01KWVB0CS1A6XBKNB9M3SG5GFK",
    "price": 32.00,
    "originalPrice": 35.00,
    "currency": "EUR",
    "thumbnail": ""
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
    { "qty": 1, "price": 32.00, "originalPrice": 35.00, "label": "1 kniha", "sublabel": "Pre seba", "badge": "NAJPREDÁVANEJŠIE", "save": 0 },
    { "qty": 2, "price": 52.00, "label": "2 knihy", "sublabel": "Pre vás a blízkeho človeka", "badge": "NAJOBĽÚBENEJŠIE", "save": 12.00, "savings": 12.00 },
    { "qty": 3, "price": 70.00, "label": "3 knihy", "sublabel": "Pre celú rodinu", "badge": "NAJVIAC UŠETRÍTE", "save": 26.00, "savings": 26.00 },
    { "qty": 4, "price": 88.00, "label": "4 knihy", "sublabel": "Perfektné ako darček", "badge": "NAJLEPŠIA HODNOTA", "save": 40.00, "savings": 40.00 }
  ],
  "regions": {
    "SK": "reg_01KWVAZVNATPX01HH77MYWKG3M"
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
