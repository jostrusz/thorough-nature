// @ts-nocheck
/**
 * Facts extracted from each project's live landing page
 * (storefront/src/projects/<slug>/pages/index.html) — claim, promise, price,
 * key sections. Injected into the translation prompt next to PROJECT_CONTEXT
 * so the AI adapts ads with the real on-page messaging and the real price.
 *
 * Extracted 2026-07-20. Re-run the extractor after major landing-page rewrites.
 */
export const PAGE_CONTEXT: Record<string, {
  url: string; price: string; claim: string; promise: string; sections: string[];
}> = {
  loslatenboek: {
    url: "https://www.loslatenboek.nl/", price: "35 €",
    claim: "Ontdek de verrassende methode die helpt om de stortvloed aan gedachten te stoppen, je emoties te kalmeren en innerlijke rust te vinden",
    promise: "Metoda proti overthinkingu — zastavit příval myšlenek, zklidnit emoce, najít vnitřní klid. Bez meditací a terapie.",
    sections: ["stortvloed aan gedachten stoppen", "emoties kalmeren", "innerlijke rust", "bonus e-books"],
  },
  "lass-los": {
    url: "https://www.jetztloslassen.de/", price: "35 €",
    claim: "Entdecke die überraschende Methode, die dir hilft, die Lawine deiner Gedanken zu stoppen, deine Emotionen zu beruhigen und innere Ruhe zu finden",
    promise: "Grübeln stoppen, innere Ruhe finden. Buch von Joris de Vries, kostenlose Lieferung.",
    sections: ["Gedankenlawine stoppen", "Emotionen beruhigen", "innere Ruhe", "Bonus-E-Books"],
  },
  "odpusc-ksiazka": {
    url: "https://www.odpusc-ksiazka.pl/", price: "129 zł",
    claim: "Odkryj zaskakującą metodę, która pomoże ci zatrzymać lawinę myśli, uspokoić emocje i znaleźć wewnętrzny spokój",
    promise: "Zatrzymać natłok myśli, uspokoić emocje, odnaleźć wewnętrzny spokój — bez medytacji i terapii.",
    sections: ["lawina myśli", "spokój emocji", "wewnętrzny spokój", "bonusowe e-booki"],
  },
  "odpust-knizka": {
    url: "https://www.pusttocotenici.cz/", price: "749 Kč",
    claim: "Objev překvapivou metodu, která ti pomůže zastavit příval myšlenek, zklidnit emoce a najít vnitřní klid — bez meditací a terapie",
    promise: "Kniha proti overthinkingu od Jorise de Vriese — zastavit příval myšlenek, zklidnit emoce.",
    sections: ["příval myšlenek", "zklidnění emocí", "vnitřní klid", "bonusové e-booky"],
  },
  "pusti-to-sk": {
    url: "https://www.pustitocotanici.sk/", price: "32 €",
    claim: "Objav prekvapivú metódu, ktorá ti pomôže zastaviť príval myšlienok, upokojiť emócie a nájsť vnútorný pokoj",
    promise: "Kniha proti overthinkingu — zastaviť príval myšlienok, upokojiť emócie, bez meditácií a terapie.",
    sections: ["príval myšlienok", "upokojenie emócií", "vnútorný pokoj", "bonusové e-booky"],
  },
  "slapp-taget": {
    url: "https://www.slapptagetboken.se/", price: "399 kr",
    claim: "Upptäck den överraskande metoden som hjälper dig att stoppa tankeflödet, lugna dina känslor och hitta inre frid",
    promise: "Stoppa tankarna, lugna känslorna, hitta inre frid — utan meditation eller terapi.",
    sections: ["stoppa tankeflödet", "lugna känslorna", "inre frid", "bonusböcker"],
  },
  "slipp-taket": {
    url: "https://www.slipptaketboken.no/", price: "499 kr",
    claim: "Oppdag den overraskende metoden som hjelper deg å stoppe tankekjøret, roe ned følelsene og finne indre ro",
    promise: "Stoppe tankekjøret, roe ned følelsene, finne indre ro — uten meditasjon eller terapi.",
    sections: ["stoppe tankekjøret", "roe følelsene", "indre ro", "bonusbøker"],
  },
  "engedd-el": {
    url: "https://www.engeddelkonyv.hu/", price: "10 999 Ft",
    claim: "Fedezd fel a meglepő módszert, amely segít megállítani a gondolatok áradatát, lecsillapítani az érzelmeidet és megtalálni a belső nyugalmat",
    promise: "Engedd el, ami tönkretesz — megállítani a gondolatok áradatát (overthinking), 336 oldal, csomagpont.",
    sections: ["gondolatáradat megállítása", "érzelmek lecsillapítása", "belső nyugalom", "bónusz e-könyvek"],
  },
  "lache-livre": {
    url: "https://www.lacheprise-livre.fr/", price: "36 €",
    claim: "Découvre la méthode surprenante qui t'aide à stopper le flot incessant de pensées, à apaiser tes émotions et à trouver la paix intérieure",
    promise: "Stopper le flot de pensées, apaiser les émotions, paix intérieure — livraison offerte, 2 e-books bonus.",
    sections: ["flot de pensées", "apaiser les émotions", "paix intérieure", "e-books bonus"],
  },
  "het-leven": {
    url: "https://www.pakjeleventerug.nl/", price: "36 €",
    claim: "Van buiten lijk je het prima te redden. Vanbinnen val je stilletjes uit elkaar en niemand ziet het.",
    promise: "LIFE RESET™ methode: 340-pagina boek, in 30 dagen huis opruimen, grenzen stellen, energie terugkrijgen.",
    sections: ["LIFE RESET™ metoda", "30denní plán", "5 pilířů", "pro ženy, které pečují o všechny kromě sebe"],
  },
  "zivot-zaslugy": {
    url: "https://www.nejdriv-ja.cz/", price: "749 Kč",
    claim: "Objev překvapivě jednoduchou metodu, která ti pomůže uklidit domov, zklidnit myšlenky a získat zpátky energii",
    promise: "Kniha pro ženy, které se starají o všechny kromě sebe. Metoda LIFE RESET™ od Anny de Vries: 340 stran, 5 pilířů.",
    sections: ["LIFE RESET™ metoda", "úklid domova", "zklidnění myšlenek", "energie zpátky", "5 pilířů"],
  },
  "zycie-zaslugy": {
    url: "https://www.najpierw-ja.pl/", price: "129 zł",
    claim: "Z zewnątrz wyglądasz, jakbyś świetnie sobie radziła. W środku po cichu się rozsypujesz — i nikt tego nie widzi.",
    promise: "„Życie, jakiego nigdy sobie nie pozwoliłaś” — Anna de Vries, metoda LIFE RESET™ w 5 filarach.",
    sections: ["metoda LIFE RESET™", "5 filarów", "dla kobiet, które dbają o wszystkich oprócz siebie"],
  },
  dehondenbijbel: {
    url: "https://www.dehondenbijbel.nl/", price: "35 €",
    claim: "Leer de wetenschappelijk onderbouwde aanpak — die speciaal is ontwikkeld voor gewone hondeneigenaren — om een hond opnieuw te leren luisteren",
    promise: "Vědecky podložená metoda, jak naučit psa znovu poslouchat. 270+ stran, 3 bonusové e-knihy zdarma.",
    sections: ["wetenschappelijke aanpak", "opnieuw leren luisteren", "270+ pagina's", "3 gratis e-books"],
  },
  "psi-superzivot": {
    url: "https://www.psi-superzivot.cz/", price: "550 Kč",
    claim: "Objevte vědecky podloženou metodu — vysvětlenou pro běžné majitele psů — jak naučit „nezvladatelného” psa znovu poslouchat",
    promise: "Vědecky podložená metoda, jak naučit psa poslouchat. 270+ stran, 3 bonusové e-knihy zdarma.",
    sections: ["vědecká metoda", "poslušnost bez trestů", "270+ stran", "3 bonusové e-knihy"],
  },
  "kocici-bible": {
    url: "https://www.kocicibible.cz/", price: "550 Kč",
    claim: "Proč vaše kočka čůrá vedle záchodu, ničí gauč a dělá, že neexistujete — a jak to otočit, bez trestů a bez zaříkávačů",
    promise: "Porozumějte konečně své kočce: 220 stran o kočičím chování, zdraví a výživě. Od Michala Peterky, 3 bonusové e-knihy.",
    sections: ["kočičí chování", "zdraví a výživa", "bez trestů", "3 bonusové e-knihy"],
  },
  "biblia-kotow": {
    url: "https://www.biblia-kotow.pl/", price: "89 zł",
    claim: "Dlaczego Twój kot sika obok kuwety, niszczy kanapę i udaje, że nie istniejesz — i jak to odwrócić, bez kar",
    promise: "Zrozum wreszcie swojego kota: 235 stron o kocim zachowaniu, zdrowiu i żywieniu. Michał Peterka, 4 bonusowe e-booki.",
    sections: ["kocie zachowanie", "zdrowie i żywienie", "bez kar", "4 bonusowe e-booki"],
  },
}
