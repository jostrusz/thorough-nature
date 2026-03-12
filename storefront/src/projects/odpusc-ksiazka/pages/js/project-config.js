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
  "inpostGeowidgetToken": "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJzQlpXVzFNZzVlQnpDYU1XU3JvTlBjRWFveFpXcW9Ua2FuZVB3X291LWxvIn0.eyJleHAiOjIwODg2NTkwMTIsImlhdCI6MTc3MzI5OTAxMiwianRpIjoiM2RkYWQ3ZWYtZWM2Zi00M2FlLTlkOTQtOWEzZWUzMDVjZjYzIiwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5pbnBvc3QucGwvYXV0aC9yZWFsbXMvZXh0ZXJuYWwiLCJzdWIiOiJmOjEyNDc1MDUxLTFjMDMtNGU1OS1iYTBjLTJiNDU2OTVlZjUzNTpGcWVIcEpjUllDckNJc1BKa1ZMY1MzWEI2d2IzX0tLdW9GMjI4a0JvOENjTjRyRWd1V1BwcTdoeGdBRFBrVjlVIiwidHlwIjoiQmVhcmVyIiwiYXpwIjoic2hpcHgiLCJzZXNzaW9uX3N0YXRlIjoiZGE5YTQzMzktN2FkZS00NWVjLTk0MDAtODhhMjZjZjY2NzVmIiwic2NvcGUiOiJvcGVuaWQgYXBpOmFwaXBvaW50cyIsInNpZCI6ImRhOWE0MzM5LTdhZGUtNDVlYy05NDAwLTg4YTI2Y2Y2Njc1ZiIsImFsbG93ZWRfcmVmZXJyZXJzIjoiIiwidXVpZCI6IjE0NTkyNmU4LTdkNmUtNGNhYS05OWEwLTVkOTYzOTE3YTQ1OSJ9.QOhr2q7rkHDyQb6mgx-__j8DDrM80B2KxyGpe53oWmJIUtuXO6Z8Jtm0_yC5XDSpc2EU0siohngOYHwCcFmJcs7uBzwEr7uZUVRHSaxJxL9yXCsKa2uoghBsmYRei85TkQowZGAIkXLxFpnJMeYXob9hMoQ2OROwkoDd_1z2NleaRLe7W5SoiXiXjUW_P5SvlZTkxAS_3zFB2XSSPZQrkKhK7p2VAwwFhSVQG-ePxm9FjVMPHpYzzdiHZIv2AQJhnaMBErIiVBT4Ex9Yeo0njyuimN-91HtLqXMZXRjupxRrCDqMrzJvS41uL7vNeQTcEHBB4BkVRq3NdHMAioTU5Q",
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
