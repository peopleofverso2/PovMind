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

## Points couverts

- PWA installable via `manifest.json` et service worker.
- Métadonnées web, Open Graph, canonical et Twitter Card.
- `robots.txt` et `sitemap.xml`.
- Healthchecks `/health`, `/healthz` et `/ready` pour supervision.
- Version publique `/version` pour diagnostic.
- Script `npm run deploy:gcp` pour synchroniser systématiquement local et prod.
- CSP, anti-framing, permissions minimales et referrer policy.
- Dockerfile compatible Cloud Run.
