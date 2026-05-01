# Déploiement PovMind

PovMind est prêt pour Cloud Run avec un serveur Node statique, des healthchecks, des headers de sécurité et les fichiers PWA essentiels.

## URL actuelle

https://povmind-472136847189.europe-west1.run.app

## Vérifier localement

```bash
npm run check
PORT=8080 npm start
```

Puis ouvrir `http://localhost:8080`.

## Redéployer sur Cloud Run

Commande obligatoire pour garder la prod synchronisée :

```bash
npm run deploy:gcp
```

Cette commande :

- synchronise la version entre `package.json`, `index.html`, `sw.js` et `app.js` ;
- lance `npm run check` ;
- déploie Cloud Run ;
- vérifie que `/version`, `/health` et le HTML public servent la même version que le local.

Commande manuelle équivalente, uniquement si tu dois diagnostiquer :

```bash
gcloud run deploy povmind \
  --source . \
  --project campaign-truth-prod \
  --region europe-west1 \
  --allow-unauthenticated
```

## Vérifier la révision en ligne

```bash
npm run verify:online
curl -I https://povmind-472136847189.europe-west1.run.app/
curl https://povmind-472136847189.europe-west1.run.app/health
curl https://povmind-472136847189.europe-west1.run.app/version
```

## Activer le connecteur GitHub

Créer une OAuth App GitHub avec ce callback :

```txt
https://povmind-472136847189.europe-west1.run.app/auth/github/callback
```

Puis ajouter les secrets au service Cloud Run :

```bash
gcloud run services update povmind \
  --project campaign-truth-prod \
  --region europe-west1 \
  --set-env-vars PUBLIC_BASE_URL=https://povmind-472136847189.europe-west1.run.app,GITHUB_CLIENT_ID=...,GITHUB_CLIENT_SECRET=...,GITHUB_TOKEN_ENCRYPTION_KEY=...
```

`GITHUB_TOKEN_ENCRYPTION_KEY` doit être une valeur longue et aléatoire. Le token OAuth GitHub reste côté Cloud Run dans un cookie HttpOnly chiffré; il n'est pas exposé au JavaScript.

## Points couverts

- PWA installable via `manifest.json` et service worker.
- Métadonnées web, Open Graph, canonical et Twitter Card.
- `robots.txt` et `sitemap.xml`.
- Healthchecks `/health`, `/healthz` et `/ready` pour supervision.
- Version publique `/version` pour diagnostic.
- Script `npm run deploy:gcp` pour synchroniser systématiquement local et prod.
- CSP, anti-framing, permissions minimales et referrer policy.
- Endpoints GitHub OAuth et Push/Pull `.povmind/` prêts pour secrets Cloud Run.
- Dockerfile compatible Cloud Run.
