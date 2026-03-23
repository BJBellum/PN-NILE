# CLAUDE.md — Projet Résurgence · Royaume-Uni du Nil

Guide de référence pour Claude lors de travaux sur ce dépôt.

---

## Vue d'ensemble

**Portail national fictif** pour un jeu de rôle géopolitique (Projet Résurgence). Simule les institutions d'un État fictif, le **Royaume-Uni du Nil**, avec une esthétique Dune/cyberpunk désertique.

- **Repo** : `BJBellum/UKN`
- **Live** : `https://bjbellum.github.io/UKN/`
- **Type** : Site statique GitHub Pages — HTML/CSS/JS pur, zéro framework, zéro build step

---

## Architecture des fichiers

```
/
├── index.html                  # Portail national (accueil)
├── pharos-auth.js              # Auth Discord OAuth2 partagée (PharosAuth v3)
├── assets/
│   ├── dune.css                # Design system global (NE PAS modifier sans raison)
│   └── images/
│       ├── UKNSite.png         # OG image partagée par toutes les pages
│       └── catalogue/          # Images des équipements du catalogue militaire
├── data/
│   ├── bourse.json             # Données Bourse du Caire
│   ├── fan.json                # Données FAN (bataillons, équipements, production)
│   └── catalogue-militaire.json # Catalogue des équipements militaires
├── admin/index.html            # Dashboard admin (auth requise)
├── fan/
│   ├── index.html              # Hub FAN (auth FAN requise)
│   ├── bataillons/             # Calculateur de bataillons
│   └── production/             # Calculateur de production d'usines
├── catalogues/
│   ├── index.html              # Hub des catalogues
│   └── militaire/index.html   # Catalogue militaire (accès public)
├── pharos-energy/              # Opérateur énergétique national
├── barrage-assouan/            # Infrastructure hydroélectrique
├── barrage-ezbet-adel/
├── barrage-al-khatatba/
├── barrage-al-akhmas/
├── nildu/                      # Réacteur nucléaire NILDU-I
├── memphis/                    # Pile de recherche MEMPHIS
├── centrale-louxor/
├── centrale-hurghada/
├── centrale-matruh/
├── bourse-caire/               # Bourse économique
├── bilan-energie/              # Bilan énergétique national
└── auth/callback/              # Callback OAuth2 Discord
```

---

## Design System

### Palette (dune.css)

| Variable | Valeur | Usage |
|---|---|---|
| `--sand-deep` | `#0C0804` | Fond principal dark |
| `--gold` | `#D4A843` | Accent doré principal |
| `--gold-mid` | `#C8960C` | Doré intermédiaire |
| `--spice` | `#E85C0D` | Orange brûlé — FAN, alertes |
| `--teal` | `#1A8F7A` | Teal — Pharos Energy |
| `--teal-bright` | `#22B89A` | Teal vif |
| `--amber` | `#F0A030` | Ambre |

### Typographie

- **Dune Rise** — Titres, hero, badges importants. **CRITIQUE : pas d'accents** (É→E, À→A, È→E, Ô→O, etc.)
- **IBM Plex Mono** — Corps, labels, données techniques
- **IBM Plex Sans** — Texte courant
- **Noto Kufi Arabic** — Texte arabe

### Règle Dune Rise — Accents interdits

Tout texte affiché en police Dune Rise doit avoir ses accents remplacés :
```html
<!-- ✗ Incorrect -->
<h1 class="hero-title">Énergie & Défense</h1>

<!-- ✓ Correct -->
<h1 class="hero-title">Energie & Defense</h1>
```

---

## Authentification (pharos-auth.js)

### API publique (`window.PharosAuth`)

```javascript
PharosAuth.getUser()    // → objet user depuis localStorage, ou null
PharosAuth.getToken()   // → token Discord, ou null (vérifie expiration)
PharosAuth.isAdmin(u)   // → bool — admin = '772821169664426025'
PharosAuth.logout()     // → efface token + user, recharge la page
PharosAuth.avatarURL(u) // → URL avatar Discord CDN
```

### IDs Discord privilégiés

```javascript
// Admin
ADMIN_IDS = ['772821169664426025']  // BJ_Bellum

// Accès FAN (Forces Armées du Nil)
FAN_IDS = [
  '772821169664426025',   // BJ_Bellum (admin)
  '928291843958014014',
  '1014832884764393523',
  '1113422056525144104',
  '293869524091142144',
  '1302403450566610944',
]
```

### Comportement

- `pharos-auth.js` s'injecte automatiquement dans `.nav-right` de toutes les pages
- Il injecte un badge utilisateur (avatar + nom + "Admin ↗" si admin + "✕" déconnexion)
- **Ne pas ajouter de user-pill manuel** dans les pages — pharos-auth le gère
- OAuth2 Implicit Flow — `client_id: 1483200078092042300`
- Redirect : `https://BJBellum.github.io/UKN/auth/callback/`

---

## Données GitHub (GitHub Contents API)

### Lecture (publique)

```javascript
// Lire un fichier JSON
fetch('https://api.github.com/repos/BJBellum/UKN/contents/data/fichier.json', {
  headers: { 'Accept': 'application/vnd.github.v3.raw' },
  cache: 'no-store'
}).then(r => r.json())
```

### Écriture (PAT requis)

Le PAT est stocké dans `localStorage.pharos_gh_pat`. Ne jamais le coder en dur.

```javascript
const pat = localStorage.getItem('pharos_gh_pat');
// PUT avec base64 + SHA de la version existante
```

### Fichiers de données

| Fichier | Contenu | Pages utilisatrices |
|---|---|---|
| `data/bourse.json` | Cours des sociétés (Bourse du Caire) | admin, bourse-caire |
| `data/fan.json` | Bataillons FAN + production + champs custom | admin, fan/* |
| `data/catalogue-militaire.json` | Équipements catalogue militaire | admin, catalogues/militaire |

---

## Cartes Leaflet

Toutes les pages avec carte géographique utilisent **Leaflet 1.9.4** + tuiles **CartoDB Dark**.

### Pattern standard

```html
<!-- Dans <head> -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>

<!-- En bas de <body>, avant </body> -->
<script>
setTimeout(function() {
  var el = document.getElementById('map-ID');
  if (!el || el._leaflet_id) return;
  var m = L.map('map-ID').setView([LAT, LNG], ZOOM);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OSM contributors &copy; CARTO',
    subdomains: 'abcd', maxZoom: 19
  }).addTo(m);
  m.invalidateSize();
  L.marker([LAT, LNG], { icon: L.divIcon({
    html: '<div style="width:16px;height:16px;border-radius:50%;background:#E85C0D;border:2px solid #F0A030;box-shadow:0 0 14px rgba(232,92,13,.8);"></div>',
    className: '', iconAnchor: [8, 8]
  }) }).addTo(m);
}, 400);
</script>
```

> **Important** : utiliser `setTimeout(..., 400)` au niveau script (pas d'IIFE, pas de `window.load`). Le script doit être en bas du `<body>`.

---

## Catalogue Militaire

### Structure des données (`catalogue-militaire.json`)

```json
[
  {
    "id": "cat_1234567890",
    "nom": "BAT-303",
    "categorie": "armes-feu",
    "niveau": 7,
    "fabricant": "YASSIN Heavy Industries",
    "cout_unite": "12500",
    "inspiration": "AK-103",
    "disponibilite": "En service · 4 500 unités",
    "image_path": "assets/images/catalogue/armes-feu-1.jpg",
    "specs": {
      "Calibre": "7,62 × 39 mm",
      "Masse (non chargé)": "3,4 kg",
      "Longueur": "940 mm"
    }
  }
]
```

### Catégories disponibles

| ID | Groupe | Label |
|---|---|---|
| `armes-feu` | Terrestre | Armes à Feu |
| `explosifs` | Terrestre | Explosifs & Grenades |
| `vehicules-terrestres` | Terrestre | Véhicules Terrestres |
| `artillerie` | Terrestre | Artillerie Placée |
| `aeronefs` | Aérien | Véhicules Aériens Militaires |
| `navires` | Naval | Navires de Surface |
| `sous-marins` | Naval | Sous-marins |
| `missiles` | Balistique & Spatial | Missiles & Roquettes |
| `missiles-strategiques` | Balistique & Spatial | Missiles Stratégiques |

### Niveaux technologiques

| NIV | Période |
|---|---|
| 1 | 1910–1919 |
| 2 | 1920–1929 |
| 3 | 1930–1939 |
| 4 | 1940–1949 |
| 5 | 1950–1959 |
| 6 | 1960–1969 |
| 7 | 1970–1979 |
| 8 | 1980–1989 |
| 9 | 1990–1999 |
| 10 | 2000–2009 |
| 11 | 2010–2019 |
| 12 | 2020–∞ |

### Images catalogue

Les images sont nommées `{categorie}-{N}.{ext}` avec N = max global + 1 pour éviter toute collision. Elles sont hébergées dans `assets/images/catalogue/`.

---

## FAN — Forces Armées du Nil

### Structure `fan.json`

```json
{
  "version": "1.0",
  "updated": "YYYY-MM-DD",
  "bataillons": [
    { "id": "bat_01", "nom": "Bataillon de Fusiliers", "quantite": 0, "equip": { "Hommes": 900, "Fusils": 900 } }
  ],
  "production": {
    "usines": [{ "id": "u1", "nom": "Usine Alpha", "categorie": "Terrestre", "niveau": 3 }],
    "equipements": [{ "id": "e1", "nom": "Fusil BAT-303", "categorie": "Infanterie", "niveau_requis": 7, "cout_slots": 150, "cout_prod": 8500, "cout_vente": 12500 }]
  },
  "custom_equip_fields": [{ "nom": "Missile surface-air", "groupe": "Missiles & Roquettes" }],
  "equip_fields_base": ["Hommes", "Fusils", "..."]
}
```

### Capacité de production (slots par niveau d'usine)

`NIV1=15k · NIV2=22.5k · NIV3=33k · NIV4=48k · NIV5=69k · NIV6=102k · NIV7=150k`

---

## Pharos Energy — Bilan énergétique

| Installation | Ref | Production | Puissance |
|---|---|---|---|
| Barrage d'Assouan | ASSOUAN-HDA-001 | 1 500 000 MWh/an | 2 100 MWe |
| Barrage de Ezbet Adel | EZBET-HDA-001 | 200 000 MWh/an | ~27 MWe |
| Barrage de Al-Khatatba | ALKHATATBA-HDA-001 | 150 000 MWh/an | ~21 MWe |
| Barrage de Al-Akhmas | ALAKHMAS-HDA-001 | 150 000 MWh/an | ~21 MWe |
| Centrale de Louxor | GEO-LOX-001 | 315 000 MWh/an | ~36 MWe |
| Centrale d'Hurghada | GEO-HRG-001 | 315 000 MWh/an | ~36 MWe |
| Centrale de Matruh | GEO-MAT-001 | 315 000 MWh/an | ~36 MWe |
| **Total** | | **2 945 000 MWh/an** | **~2 277 MWe** |

---

## Règles de développement

### À toujours faire

- Ajouter `<meta property="og:image" content="https://BJBellum.github.io/UKN/assets/images/UKNSite.png">` et `<link rel="icon">` sur chaque nouvelle page
- Charger `pharos-auth.js` en dernier script de chaque page (`<script src="../pharos-auth.js"></script>`)
- Utiliser `dune.css` comme base CSS et n'ajouter que le CSS spécifique à la page dans un `<style>` local
- Tester la syntaxe JS avec `node --check` avant de commiter

### À ne jamais faire

- Utiliser un framework JS (React, Vue, etc.) — tout est vanilla
- Utiliser `localStorage` pour données sensibles (sauf PAT admin — c'est voulu)
- Coder en dur un PAT GitHub dans le source
- Ajouter des accents dans les textes en police Dune Rise
- Ajouter un `user-pill` manuel dans une nav — pharos-auth.js le gère
- Utiliser des emojis comme icônes — utiliser des SVG inline
- Wraper les scripts de carte Leaflet dans un IIFE ou `window.addEventListener('load', ...)` — utiliser un simple `setTimeout(..., 400)` au niveau du script en bas du body

### Structure d'une nouvelle page

```html
<!DOCTYPE html>
<html lang="fr" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TITRE · Royaume-Uni du Nil</title>
  <meta property="og:image" content="https://BJBellum.github.io/UKN/assets/images/UKNSite.png">
  <meta property="og:image:alt" content="Portail National — Royaume-Uni du Nil">
  <link rel="icon" type="image/png" href="../assets/images/UKNSite.png">
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500&family=IBM+Plex+Sans:wght@300;400;500&family=Noto+Kufi+Arabic:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../assets/dune.css">
  <style>/* CSS spécifique à la page */</style>
</head>
<body>
<nav class="topnav"><!-- ... --></nav>
<!-- Contenu -->
<script>
  // JS de la page
  function applyTheme(t){document.documentElement.setAttribute('data-theme',t);localStorage.setItem('run-theme',t);}
  function toggleTheme(){applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');}
  (function(){const s=localStorage.getItem('run-theme'),mq=window.matchMedia('(prefers-color-scheme: dark)');applyTheme(s||(mq.matches?'dark':'light'));})();
</script>
<script src="../pharos-auth.js"></script><!-- TOUJOURS EN DERNIER -->
</body>
</html>
```

---

## Contexte lore (pour cohérence éditoriale)

- **Royaume-Uni du Nil** — État fédéral fictif couvrant la vallée du Nil (Égypte + Soudan du Nord fictifs)
- **Capitale** : Le Caire
- **Calendrier** : Exercice 2305–2306 (futur proche fictif)
- **Monnaie** : Livre Nilotique (N£)
- **Langue** : Français + Arabe (bilingue officiel)
- **Pharos Energy** — Opérateur énergétique d'État (hydroélectrique + géothermique + nucléaire NILDU)
- **FAN** — Forces Armées du Nil
- **NILDU** — Nile Deuterium Uranium — filière nucléaire nationale (réacteurs D₂O à tubes de force horizontaux, développée en interne — ne jamais mentionner CANDU)
- **MEMPHIS** — Pile de recherche nucléaire, produit l'eau lourde D₂O pour NILDU via procédé Girdler
- **Bourse du Caire** — بورصة القاهرة — marché financier national

---

*Projet Résurgence © 2026 · Police Dune Rise — Fontswan (SIL OFL 1.1)*
