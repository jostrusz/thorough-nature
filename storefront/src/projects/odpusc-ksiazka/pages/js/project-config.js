var PROJECT_CONFIG = {
  "slug": "odpusc-ksiazka",
  "projectId": "odpusc-ksiazka",
  "medusaUrl": "",
  "publishableApiKey": "",
  "mainProduct": {
    "name": "Odpuść to, co cię niszczy",
    "handle": "odpusc-to-co-cie-niszczy",
    "variantId": "",
    "price": 129,
    "currency": "PLN",
    "thumbnail": ""
  },
  "upsellProduct": {
    "name": "",
    "handle": "",
    "variantId": "",
    "price": 0,
    "originalPrice": 0,
    "currency": "PLN"
  },
  "bundleOptions": [
    { "qty": 1, "price": 129, "label": "1 książka", "save": 0 },
    { "qty": 2, "price": 199, "label": "2 książki", "save": 59 },
    { "qty": 3, "price": 279, "label": "3 książki", "save": 108 },
    { "qty": 4, "price": 359, "label": "4 książki", "save": 157 }
  ],
  "regions": {
    "PL": ""
  },
  "shippingOptions": {
    "paczkomat": { "name": "Paczkomat InPost", "price": 0, "matchName": "InPost" },
    "homeDelivery": { "name": "Dostawa do domu (Kurier)", "price": 5, "matchName": "Kurier" }
  },
  "inpostGeowidgetToken": "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJzQlpXVzFNZzVlQnpDYU1XU3JvTlBjRWFveFpXcW9Ua2FuZVB3X291LWxvIn0.eyJleHAiOjIwODg2NTU5NTcsImlhdCI6MTc3MzI5NTk1NywianRpIjoiYTNjOWI3OGUtNDgwMy00NzM5LWI3MGUtNjI1YjY3NDU4YTgzIiwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5pbnBvc3QucGwvYXV0aC9yZWFsbXMvZXh0ZXJuYWwiLCJzdWIiOiJmOjEyNDc1MDUxLTFjMDMtNGU1OS1iYTBjLTJiNDU2OTVlZjUzNTpGcWVIcEpjUllDckNJc1BKa1ZMY1MzWEI2d2IzX0tLdW9GMjI4a0JvOENjTjRyRWd1V1BwcTdoeGdBRFBrVjlVIiwidHlwIjoiQmVhcmVyIiwiYXpwIjoic2hpcHgiLCJzZXNzaW9uX3N0YXRlIjoiNzEzZWFlNDEtNmQyZS00N2FhLTgyNGYtZTJkY2IyNmFmZTQ0Iiwic2NvcGUiOiJvcGVuaWQgYXBpOmFwaXBvaW50cyIsInNpZCI6IjcxM2VhZTQxLTZkMmUtNDdhYS04MjRmLWUyZGNiMjZhZmU0NCIsImFsbG93ZWRfcmVmZXJyZXJzIjoib2RwdXNjLWtzaWF6a2EucGwiLCJ1dWlkIjoiMTQ1OTI2ZTgtN2Q2ZS00Y2FhLTk5YTAtNWQ5NjM5MTdhNDU5In0.iVlHZ1j2OmeeM92TbfW_RrMLcfH9W2JvSjG4XnujTq9KkoCIxO8Hkm1IXfneGCi8eFxVth9NzugeITGvrhQZrTVHdl19AGK2S2UU80M_XfF1r68-oAISlmVPOiBSa2S9qjz7LTOnKlnS4jc3vbQ0On2Igc2fMBbYNmysa5HB_I6nDudRgyi9NQcHDYKRbcSNTraK_vgyO_cZERl8_YE855DPHo2MB0Bb5WKZyRVLuIqCmYdAAHGhJPXo0Git7NzTnr7V9ynUXHSdOujO0fbjfX17191i3oj5F4y_BYgo-ibh5BP6xY3bJdRXmLN81EV3xqn1RyKm2Iq-Lp3RNYjXHA",
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
