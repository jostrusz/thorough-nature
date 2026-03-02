# De Hondenbijbel — Brand Design Guide

## Účel tohoto dokumentu

Tento brand guide slouží jako instrukce pro redesign index stránky projektu dehondenbijbel.nl. Když dostaneš HTML kód stránky, tvým úkolem je:

1. **ZACHOVAT všechny texty** přesně tak, jak jsou — nic nepřepisuj, nezkracuj, nepřidávej
2. **APLIKOVAT tento brand design** — barvy, fonty, spacing, layout principy
3. **ZACHOVAT strukturu sekcí** — pořadí sekcí zůstává stejné
4. **VYLEPŠIT vizuální stránku** — moderní, luxusní, conversion-optimized design

---

## 1. Barevná paleta: Sunset Terracotta

### Primární barvy

| Role | Barva | HEX | Použití |
|------|-------|-----|---------|
| **Primary** | Oranžová | `#E87E04` | CTA tlačítka, cenové štítky, urgentní prvky, hlavní akcenty |
| **Secondary** | Terakota | `#BF5B21` | Sekundární tlačítka, bordery, hover stavy, akcentové prvky |
| **Highlight** | Světlý amber | `#FFCC80` | Pozadí badges, highlight textu, ikony, hvězdičky recenzí |
| **Background** | Teplý krém | `#FFFDE7` | Hlavní pozadí stránky, pozadí karet na tmavých sekcích |
| **Text** | Tmavá čokoláda | `#3E2723` | Nadpisy, tělo textu, labely formulářů |

### Doplňkové barvy

| Role | HEX | Použití |
|------|-----|---------|
| **Dark BG** | `#2A1A12` | Hero sekce, patička, tmavé sekce pro kontrast |
| **Warm Gray** | `#5D4037` | Sekundární text, popisky, captions |
| **White** | `#FFFFFF` | Pozadí karet, formulářová pole, čistý prostor |
| **Success Green** | `#2E7D32` | Trust badges, checkmarky, "gratis verzending" |
| **Error Red** | `#D32F2F` | Validační chyby ve formulářích |

### Pravidla použití barev

- **60 %** plochy: pozadí `#FFFDE7` (teplý krém) nebo `#FFFFFF` (bílá)
- **25 %** plochy: strukturální prvky `#3E2723` (tmavé texty, nadpisy) a `#2A1A12` (hero/patička)
- **15 %** plochy: akcenty `#E87E04` (CTA), `#BF5B21` (sekundární), `#FFCC80` (highlights)
- CTA tlačítka jsou VŽDY `#E87E04` s bílým textem
- Nikdy nepoužívej `#E87E04` jako pozadí celé sekce — pouze jako akcent
- Tmavé sekce (hero, patička, sociální důkazy) používají `#2A1A12` nebo `#3E2723`

### Gradient pravidla

```css
/* Hero gradient (tmavé sekce) */
background: linear-gradient(135deg, #2A1A12 0%, #3E2723 100%);

/* CTA hover gradient */
background: linear-gradient(135deg, #E87E04 0%, #BF5B21 100%);

/* Highlight pozadí (trust banner, speciální sekce) */
background: linear-gradient(135deg, #FFCC80 0%, #FFE0B2 100%);
```

---

## 2. Typografie: Bricolage Grotesque + Cabin

### Načtení fontů

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Cabin:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Fontové role

| Element | Font | Váha | Velikost (desktop) | Velikost (mobile) |
|---------|------|------|-------------------|------------------|
| **H1 — Hero nadpis** | Bricolage Grotesque | 800 (ExtraBold) | 52px | 32px |
| **H2 — Sekční nadpisy** | Bricolage Grotesque | 700 (Bold) | 38px | 26px |
| **H3 — Podnadpisy** | Bricolage Grotesque | 600 (SemiBold) | 24px | 20px |
| **Body text** | Cabin | 400 (Regular) | 17px | 16px |
| **Body bold** | Cabin | 700 (Bold) | 17px | 16px |
| **CTA tlačítka** | Bricolage Grotesque | 700 (Bold) | 18px | 16px |
| **Captions, labels** | Cabin | 500 (Medium) | 14px | 13px |
| **Trust badges text** | Cabin | 600 (SemiBold) | 15px | 14px |
| **Cena** | Bricolage Grotesque | 800 (ExtraBold) | 36px | 28px |
| **Přeškrtnutá cena** | Cabin | 400 (Regular) | 20px | 18px |
| **Navigace** | Cabin | 600 (SemiBold) | 15px | 14px |

### CSS základ pro typografii

```css
:root {
  --font-heading: 'Bricolage Grotesque', sans-serif;
  --font-body: 'Cabin', sans-serif;

  --color-primary: #E87E04;
  --color-secondary: #BF5B21;
  --color-highlight: #FFCC80;
  --color-bg: #FFFDE7;
  --color-dark: #3E2723;
  --color-dark-bg: #2A1A12;
  --color-warm-gray: #5D4037;
  --color-white: #FFFFFF;
  --color-success: #2E7D32;
  --color-error: #D32F2F;
}

body {
  font-family: var(--font-body);
  font-size: 17px;
  line-height: 1.7;
  color: var(--color-dark);
  background-color: var(--color-bg);
}

h1, h2, h3, h4 {
  font-family: var(--font-heading);
  line-height: 1.2;
  color: var(--color-dark);
}

h1 { font-size: 52px; font-weight: 800; }
h2 { font-size: 38px; font-weight: 700; }
h3 { font-size: 24px; font-weight: 600; }

@media (max-width: 768px) {
  h1 { font-size: 32px; }
  h2 { font-size: 26px; }
  h3 { font-size: 20px; }
  body { font-size: 16px; }
}
```

---

## 3. Layout a spacing

### Obecná pravidla

- **Max-width obsahu:** 780px (sales page), centrováno
- **Padding sekcí:** 80px nahoře a dole (desktop), 48px (mobile)
- **Gap mezi elementy uvnitř sekce:** 24px
- **Border-radius karet:** 16px
- **Border-radius tlačítek:** 12px
- **Border-radius obrázků:** 12px

### Sekce padding

```css
.section {
  padding: 80px 24px;
  max-width: 780px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .section { padding: 48px 16px; }
}
```

---

## 4. Komponenty

### CTA tlačítko (primární)

```css
.cta-button {
  font-family: var(--font-heading);
  font-size: 18px;
  font-weight: 700;
  color: #FFFFFF;
  background: #E87E04;
  border: none;
  border-radius: 12px;
  padding: 18px 40px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(232, 126, 4, 0.3);
  width: 100%;
  max-width: 480px;
  text-align: center;
}

.cta-button:hover {
  background: linear-gradient(135deg, #E87E04, #BF5B21);
  box-shadow: 0 6px 25px rgba(232, 126, 4, 0.4);
  transform: translateY(-2px);
}
```

### CTA tlačítko (sekundární)

```css
.cta-secondary {
  font-family: var(--font-heading);
  font-size: 16px;
  font-weight: 600;
  color: #BF5B21;
  background: transparent;
  border: 2px solid #BF5B21;
  border-radius: 12px;
  padding: 14px 32px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.cta-secondary:hover {
  background: #BF5B21;
  color: #FFFFFF;
}
```

### Karta (benefit, feature)

```css
.card {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 2px 12px rgba(62, 39, 35, 0.06);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(62, 39, 35, 0.1);
}
```

### Trust badge

```css
.trust-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 15px;
  color: var(--color-dark);
}

.trust-badge svg, .trust-badge img {
  color: var(--color-success);
  width: 20px;
  height: 20px;
}
```

### Trust banner

```css
.trust-banner {
  background: linear-gradient(135deg, #FFCC80, #FFE0B2);
  border-radius: 16px;
  padding: 20px 32px;
  display: flex;
  justify-content: center;
  gap: 32px;
  flex-wrap: wrap;
}
```

### Testimonial / recenze

```css
.testimonial {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 28px;
  border-left: 4px solid #E87E04;
  box-shadow: 0 2px 12px rgba(62, 39, 35, 0.06);
}

.testimonial-stars {
  color: #FFCC80;
  font-size: 20px;
  margin-bottom: 12px;
}

.testimonial-text {
  font-family: var(--font-body);
  font-size: 16px;
  font-style: italic;
  color: var(--color-dark);
  line-height: 1.7;
  margin-bottom: 12px;
}

.testimonial-author {
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 15px;
  color: var(--color-secondary);
}
```

### Cenový blok

```css
.price-block {
  text-align: center;
}

.price-old {
  font-family: var(--font-body);
  font-size: 20px;
  color: var(--color-warm-gray);
  text-decoration: line-through;
}

.price-new {
  font-family: var(--font-heading);
  font-size: 36px;
  font-weight: 800;
  color: var(--color-primary);
}

.price-note {
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--color-warm-gray);
}
```

### FAQ accordion

```css
.faq-item {
  border-bottom: 1px solid rgba(62, 39, 35, 0.1);
  padding: 20px 0;
}

.faq-question {
  font-family: var(--font-heading);
  font-size: 18px;
  font-weight: 600;
  color: var(--color-dark);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.faq-answer {
  font-family: var(--font-body);
  font-size: 16px;
  color: var(--color-warm-gray);
  line-height: 1.7;
  padding-top: 12px;
}
```

---

## 5. Struktura sekcí (doporučené pozadí)

Střídej světlé a tmavé sekce pro vizuální rytmus:

| Sekce | Pozadí | Text |
|-------|--------|------|
| **Hero** | `#2A1A12` (tmavé) | Bílý nadpis, `#FFCC80` podnadpis |
| **Trust banner** | gradient `#FFCC80 → #FFE0B2` | `#3E2723` text |
| **Benefits / features** | `#FFFDE7` (krémové) | `#3E2723` nadpisy, `#5D4037` text |
| **Social proof / recenze** | `#FFFFFF` (bílé) | `#3E2723` text |
| **Obsah knihy** | `#FFFDE7` (krémové) | `#3E2723` text |
| **CTA sekce** | `#3E2723` (tmavé) | Bílý text, `#E87E04` tlačítko |
| **O autorovi** | `#FFFFFF` (bílé) | `#3E2723` text |
| **FAQ** | `#FFFDE7` (krémové) | `#3E2723` text |
| **Garance** | `#FFFFFF` (bílé) s `#E87E04` borderem | `#3E2723` text |
| **Patička** | `#2A1A12` (tmavé) | `#FFCC80` text, `#5D4037` sekundární |

### Hero sekce specifika

```css
.hero {
  background: linear-gradient(135deg, #2A1A12, #3E2723);
  padding: 100px 24px 80px;
  text-align: center;
}

.hero h1 {
  font-family: var(--font-heading);
  font-size: 52px;
  font-weight: 800;
  color: #FFFFFF;
  margin-bottom: 16px;
}

.hero .subtitle {
  font-family: var(--font-body);
  font-size: 20px;
  color: #FFCC80;
  margin-bottom: 32px;
}

.hero .cta-button {
  margin: 0 auto;
  display: inline-block;
}
```

---

## 6. Ikonky a vizuální prvky

- Pro checkmarky a trust ikony používej SVG v barvě `#2E7D32` (zelená) nebo `#E87E04` (oranžová)
- Hvězdičky recenzí: `#FFCC80`
- Ikony v benefit kartách: oranžový kruh (`#E87E04`, opacity 10%) s ikonou v `#E87E04`
- Šipky v CTA: `→` za textem tlačítka (např. "Bestel nu →")

---

## 7. Specifické instrukce pro redesign

### Co ZMĚNIT:

1. **Všechny barvy** — nahraď stávající paletu (fialová, žlutá, coral) za Sunset Terracotta paletu
2. **Všechny fonty** — nahraď Inter za Bricolage Grotesque (nadpisy) + Cabin (tělo)
3. **Border-radius** — sjednoť na 16px (karty) a 12px (tlačítka)
4. **Box-shadow** — jemné stíny: `0 2px 12px rgba(62, 39, 35, 0.06)` pro karty
5. **Spacing** — sjednoť na 80px mezi sekcemi
6. **CTA tlačítka** — oranžová `#E87E04`, bez tvrdého černého borderu, s jemným stínem
7. **Trust banner** — gradient amber místo žlutého

### Co ZACHOVAT:

1. **Veškeré texty** — beze změny, v nizozemštině
2. **Strukturu sekcí** — pořadí sekcí zůstává stejné
3. **Funkčnost** — veškerý JavaScript, formuláře, checkout logika
4. **Obrázky** — všechny obrázky zůstávají na místě
5. **Responzivitu** — mobile-first přístup musí zůstat
6. **SEO elementy** — meta tagy, alt texty, heading hierarchie

### Kontrolní seznam po redesignu:

- [ ] Všechny H1/H2/H3 používají Bricolage Grotesque
- [ ] Veškerý body text používá Cabin
- [ ] CTA tlačítka jsou `#E87E04` s bílým textem
- [ ] Pozadí stránky je `#FFFDE7`
- [ ] Tmavé sekce (hero, patička) používají `#2A1A12`
- [ ] Žádné zbytky staré fialové/žluté/coral palety
- [ ] Trust banner má amber gradient
- [ ] Karty mají border-radius 16px a jemný stín
- [ ] Fonty jsou správně načteny z Google Fonts
- [ ] Stránka vypadá dobře na mobilu i desktopu
- [ ] Všechny texty zůstaly nezměněné
