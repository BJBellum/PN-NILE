# UKN — Setup Vercel (Guide complet)

## Ce que ça change

| Avant | Après |
|---|---|
| `fetch` → `api.github.com` (rate-limité 60 req/h) | `fetch('/api/data?key=...')` → Vercel KV (~2ms) |
| PAT GitHub dans `localStorage` (visible DevTools) | PAT dans variables d'environnement Vercel (jamais exposé) |
| Token Discord dans l'URL (`#access_token=...`) | Cookie `httpOnly` côté serveur (jamais dans JS) |
| Images catalogue en base64 localStorage | Vercel Blob (CDN mondial, URL permanente) |

---

## Étape 1 — Dépendances

```bash
npm install
```

---

## Étape 2 — Vercel CLI & login

```bash
npm install -g vercel
vercel login
vercel link   # lier à ton projet ukn-seven
```

---

## Étape 3 — Créer les services Vercel

### 3a. Vercel KV (base de données Redis)

1. Ouvrir [vercel.com/dashboard](https://vercel.com/dashboard)
2. Projet UKN → **Storage** → **Create Database** → **KV**
3. Nom : `ukn-kv` → **Create**
4. Onglet **Settings** → **Environments** : cocher `Production` + `Preview`
5. Les variables `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` sont auto-injectées

### 3b. Vercel Blob (stockage images)

1. Projet UKN → **Storage** → **Create Database** → **Blob**
2. Nom : `ukn-blob` → **Create**
3. `BLOB_READ_WRITE_TOKEN` est auto-injecté

---

## Étape 4 — Variables d'environnement

Dans **Vercel Dashboard → Project Settings → Environment Variables**, ajouter :

| Variable | Valeur | Sensible |
|---|---|---|
| `GITHUB_PAT` | Ton Personal Access Token GitHub (scope `repo`) | ✅ oui |
| `GITHUB_REPO` | `BJBellum/UKN` | non |
| `DISCORD_CLIENT_SECRET` | Secret de ton app Discord | ✅ oui |
| `SESSION_SECRET` | Chaîne aléatoire 32 chars (ex: `openssl rand -hex 16`) | ✅ oui |
| `ADMIN_DISCORD_IDS` | `772821169664426025` | non |
| `FAN_DISCORD_IDS` | `772821169664426025,928291843958014014,...` | non |
| `BASE_URL` | `https://ukn-seven.vercel.app` | non |
| `DISCORD_CLIENT_ID` | `1483200078092042300` | non |

> Pour générer SESSION_SECRET dans le terminal : `openssl rand -hex 16`

---

## Étape 5 — App Discord — ajouter le redirect URI

1. [Discord Developer Portal](https://discord.com/developers/applications) → ton app `1483200078092042300`
2. **OAuth2** → **Redirects** → **Add Redirect** :
   ```
   https://ukn-seven.vercel.app/auth/callback/
   ```
   > Remplace l'ancienne URL `github.io` si présente

---

## Étape 6 — Copier les fichiers dans le repo

```
/                          ← racine du repo
├── vercel.json            ← ← ← copier
├── package.json           ← ← ← copier
├── pharos-auth-v2.js      ← ← ← remplace pharos-auth.js
├── auth/
│   └── callback/
│       └── index.html     ← ← ← nouvelle page callback
├── api/
│   ├── data.js            ← ← ← READ endpoint
│   ├── write.js           ← ← ← WRITE endpoint (PAT sécurisé)
│   ├── upload.js          ← ← ← image upload → Blob
│   ├── auth/
│   │   └── discord.js     ← ← ← OAuth Authorization Code Flow
│   └── admin/
│       └── pat.js         ← ← ← vérification session admin
```

### Renommer pharos-auth
```bash
mv pharos-auth.js pharos-auth-v1-backup.js
mv pharos-auth-v2.js pharos-auth.js
```

---

## Étape 7 — Migrer les fetches frontend (optionnel mais recommandé)

```bash
# Voir ce qui changerait
node migrate-fetches.js

# Appliquer
node migrate-fetches.js --write
```

Cela remplace automatiquement dans tous les `.html` :
```js
// AVANT
fetch('https://api.github.com/repos/BJBellum/UKN/contents/data/bourse.json', {
  headers: { 'Accept': 'application/vnd.github.v3.raw' }, cache: 'no-store'
})

// APRÈS
fetch('/api/data?key=bourse')
```

Et dans l'admin, les `PUT` vers GitHub :
```js
// AVANT — PAT en localStorage, write depuis le client
const pat = localStorage.getItem('pharos_gh_pat');
await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}`, {
  method: 'PUT', headers: { Authorization: `token ${pat}` }, ...
})

// APRÈS — session cookie, écriture sécurisée côté serveur
await fetch('/api/write', {
  method: 'POST', credentials: 'include',
  body: JSON.stringify({ key: 'bourse', data: {...} })
})
```

---

## Étape 8 — Premier déploiement

```bash
vercel --prod
```

---

## Étape 9 — Peupler le KV (migration initiale des données)

La première fois, KV est vide. Le fallback dans `/api/data.js` lit depuis GitHub raw automatiquement. Aucune action requise — les données se peuplent au fur et à mesure des visites.

Pour forcer le peuplement immédiat (optionnel) :

```bash
# Script de warm-up (à lancer une seule fois)
curl https://ukn-seven.vercel.app/api/data?key=bourse
curl https://ukn-seven.vercel.app/api/data?key=fan
curl https://ukn-seven.vercel.app/api/data?key=catalogue
curl https://ukn-seven.vercel.app/api/data?key=parlement
```

---

## Architecture finale

```
Browser
  │
  ├── GET /api/data?key=bourse
  │     └── Vercel Edge Cache (60s) → Vercel KV (Redis ~2ms) → GitHub raw (fallback)
  │
  ├── POST /api/write { key, data }
  │     └── Vercel Function → vérifie session cookie → KV.set + GitHub PUT
  │                                                     (GITHUB_PAT en env, jamais exposé)
  │
  ├── POST /api/upload (multipart image)
  │     └── Vercel Function → vérifie session → Vercel Blob → URL CDN permanente
  │
  └── GET /auth/callback/ → /api/auth/discord?code=...
        └── Vercel Function → échange code Discord → session cookie httpOnly
```

---

## Tableau des gains

| Métrique | Avant | Après |
|---|---|---|
| Latence lecture données | 200-500ms (GitHub API) | 1-5ms (KV) + cache CDN |
| Rate limit | 60 req/h (non-auth) | Illimité (KV) |
| Sécurité PAT | `localStorage` visible | Variable d'env Vercel |
| Sécurité token Discord | URL hash (loggable) | Cookie `httpOnly` (invisible JS) |
| Images catalogue | localStorage base64 | CDN Vercel Blob (URL permanente) |
| Cache assets | Aucun | 1 an immutable (CSS, images) |
