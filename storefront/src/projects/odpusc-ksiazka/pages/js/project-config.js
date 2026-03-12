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
  "inpostGeowidgetToken": "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJzQlpXVzFNZzVlQnpDYU1XU3JvTlBjRWFveFpXcW9Ua2FuZVB3X291LWxvIn0.eyJleHAiOjIwODg2NTg1NDYsImlhdCI6MTc3MzI5ODU0NiwianRpIjoiNGIwMjVlOTYtNDEyNS00YTVhLWE5OGUtMDQ3MjEzNTU0NGRkIiwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5pbnBvc3QucGwvYXV0aC9yZWFsbXMvZXh0ZXJuYWwiLCJzdWIiOiJmOjEyNDc1MDUxLTFjMDMtNGU1OS1iYTBjLTJiNDU2OTVlZjUzNTpGcWVIcEpjUllDckNJc1BKa1ZMY1MzWEI2d2IzX0tLdW9GMjI4a0JvOENjTjRyRWd1V1BwcTdoeGdBRFBrVjlVIiwidHlwIjoiQmVhcmVyIiwiYXpwIjoic2hpcHgiLCJzZXNzaW9uX3N0YXRlIjoiNTJiMWM4ZDQtYjEzNi00Nzg1LTgzNzctMTZlOTFkZjY0MzdjIiwic2NvcGUiOiJvcGVuaWQgYXBpOmFwaXBvaW50cyIsInNpZCI6IjUyYjFjOGQ0LWIxMzYtNDc4NS04Mzc3LTE2ZTkxZGY2NDM3YyIsImFsbG93ZWRfcmVmZXJyZXJzIjoib2RwdXNjLWtzaWF6a2EucGwiLCJ1dWlkIjoiMTQ1OTI2ZTgtN2Q2ZS00Y2FhLTk5YTAtNWQ5NjM5MTdhNDU5In0.D4wb-LhoptQWQG5Lw-PUoNg6M4KPfwUJjqz4CUbzmzc4B3sCELgOPMkSUNh7uMxuVONGK6EduWodO_vHQlzT4-GxNSIuTLjgM7nAmRZ1MIMLNYjgHQ9JzIsb1XBoAg8PDYl9BPjJQvoKBQfFZL6AGFlEKVL75RP2nO0Cvln_345OP8P8RVvdzZJeAaf4vXj4B9MK1Hw3znCYlX-ox31m3uIHWGFzk8LncaNT0zIvTCSoProMWYxxEzJOagQFwOaLjEcDKiS84JLTEpi5SUrwiNbsAavElA1xYXfkfCeVj4b0cOh1XdqTdUt9-1LlMz52-PrcSZtXcxVLU1GpUyEktg",
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
