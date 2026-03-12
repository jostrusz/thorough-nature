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
  "inpostGeowidgetToken": "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJzQlpXVzFNZzVlQnpDYU1XU3JvTlBjRWFveFpXcW9Ua2FuZVB3X291LWxvIn0.eyJleHAiOjIwODg2NTI1NzUsImlhdCI6MTc3MzI5MjU3NSwianRpIjoiNWMxNmY4Y2MtZjkyMS00ZjczLWI0NDUtMWMwYjAyMDcxODhlIiwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5pbnBvc3QucGwvYXV0aC9yZWFsbXMvZXh0ZXJuYWwiLCJzdWIiOiJmOjEyNDc1MDUxLTFjMDMtNGU1OS1iYTBjLTJiNDU2OTVlZjUzNTpGcWVIcEpjUllDckNJc1BKa1ZMY1MzWEI2d2IzX0tLdW9GMjI4a0JvOENjTjRyRWd1V1BwcTdoeGdBRFBrVjlVIiwidHlwIjoiQmVhcmVyIiwiYXpwIjoic2hpcHgiLCJzZXNzaW9uX3N0YXRlIjoiMzUwYTJlZjMtNDk3Ny00MWI4LTkwNDItMjk4NDJjYTM1NWQzIiwic2NvcGUiOiJvcGVuaWQgYXBpOmFwaXBvaW50cyIsInNpZCI6IjM1MGEyZWYzLTQ5NzctNDFiOC05MDQyLTI5ODQyY2EzNTVkMyIsImFsbG93ZWRfcmVmZXJyZXJzIjoib2RwdXN0LWtzaWF6a2EucGwiLCJ1dWlkIjoiMTQ1OTI2ZTgtN2Q2ZS00Y2FhLTk5YTAtNWQ5NjM5MTdhNDU5In0.bbFEJD5hUSHIU2TtGir3fpq6LrrcqFRikhRyRCi_ysZHoxvVcLogIDRouIhljIPaMjMHXXPWUR7okU5D9UsKCJUsV7xSt3-1OoJDY8B651yDG6GF3AZhF9ed8ORr3cWEZtdflnnYOs3H4N3NqpFQ8asPV6_MJwfYpdom308E1ZQiji5XTu_MfM6nZ0qnq8mJo9HlUrb8uuTqKMgXMdPLjKhnG0njA1EmQXD4gwoJUAjZa1SSfR9LokueQbBsSXZhJBCBZ_bHiez36zUYpe5H7W4oZAd33h9HnMDo6pv_lEHZWKDDjuLBdLnMBY99oB0A5rWBNUBjwr6X-OL1p3Hicg",
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
