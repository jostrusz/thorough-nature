var PROJECT_CONFIG = {
  "slug": "kocici-bible",
  "projectId": "kocici-bible",
  "domain": "www.kocicibible.cz",
  "medusaUrl": "https://www.marketing-hq.eu",
  "publishableApiKey": "pk_5f6d223af5e4a06268b3845132ece0bc81528095902c7b381dd1339ed085811b",
  "mainProduct": {
    "name": "Kočičí bible",
    "handle": "kocici-bible-oficial",
    "variantId": "variant_01KPFP9X5PXD8WPMJPMMS2ZF02",
    "price": 550,
    "currency": "CZK",
    "thumbnail": ""
  },
  "upsellProducts": [
        {
            "id": "pust",
            "name": "Pusť to, co tě ničí",
            "handle": "pust-to-co-te-nici-kb",
            "variantId": "variant_01KXJ13PRW1SJCDBPSVZKKCDDP",
            "price": 599,
            "originalPrice": 749,
            "currency": "CZK",
            "image": "https://bucket-production-b93e.up.railway.app:443/medusa-media/pust-to-co-te-nici-admin-01KTYC1V1ZYVZ92WZYE7SA8X2Z.png",
            "author": "Joris de Vries · 290 stran + pracovní sešit",
            "desc": "Bestseller pro každého, komu v hlavě jede nekonečný proud myšlenek. Jak zastavit přemítání, zklidnit emoce a najít vnitřní klid — postaveno na neurovědě a psychologii, žádné vágní rady.",
            "hook": "Ideální pro vás nebo jako dárek pro někoho, kdo „nedokáže vypnout“."
        },
        {
            "id": "zivot",
            "name": "Život, jaký si zasloužíš",
            "handle": "zivot-ktery-si-zasluzis-kb",
            "variantId": "variant_01KXJ141PFX74JEGZKEG1HD3ZE",
            "price": 599,
            "originalPrice": 749,
            "currency": "CZK",
            "image": "https://bucket-production-b93e.up.railway.app:443/medusa-media/zivos jaky si zaslouzis-01KXD2TK20J0S6PT4NNJNXCA32.png",
            "author": "LIFE RESET™ · 350 stran · 30denní plán",
            "desc": "30denní systém v 5 oblastech (domov, hranice, myšlenky, návyky, energie), který vám krok za krokem pomůže postavit život, co k vám opravdu sedí. Žádné vágní afirmace — praktický plán.",
            "hook": "Pro každého, kdo chce po úklidu v hlavě uklidit i život."
        },
        {
            "id": "psi",
            "name": "Psí superživot",
            "handle": "psi-superzivot-kb",
            "variantId": "variant_01KXJ14CKSB3WQFS7XE30QTW6S",
            "price": 499,
            "originalPrice": 550,
            "currency": "CZK",
            "image": "https://bucket-production-b93e.up.railway.app:443/medusa-media/psi-superzivot-coverr-01KKBV5XSNXVFB49XWWKSZRBVE.png",
            "author": "Michal Peterka · zdraví, výživa & dlouhověkost",
            "desc": "Máte doma i psa? Kompletní průvodce zdravím, výživou a dlouhověkostí vašeho psa od stejného autora. Silná imunita, lesklá srst a spokojený parťák na dlouhá léta.",
            "hook": "Kočka + pes pod jednou střechou = kompletní zvířecí knihovna."
        }
    ],
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
  "upsellEnabled": false,
  "foxentryApiKey": null,
  "homeUrl": "/",
  "checkoutUrl": "/checkout.html",
  "thankYouUrl": "/thank-you.html"
};
PROJECT_CONFIG.getRegionId = function(countryCode) {
  return PROJECT_CONFIG.regions[countryCode] || Object.values(PROJECT_CONFIG.regions)[0];
};
