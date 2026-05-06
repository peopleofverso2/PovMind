# PovMind

PovMind est une app locale de notes Markdown inspirée du principe des vaults connectés : liens `[[wiki]]`, backlinks, graphe, tags, recherche, export/import et export Codex KB.

Elle ne reprend ni le nom, ni les assets, ni l'interface exacte d'Obsidian. C'est une alternative minimale créée en HTML/CSS avec un coeur TypeScript compilé en JavaScript navigateur.

## Principe du vault

Un vault PovMind doit relier trois choses :

- la mémoire humaine : notes, décisions, journal, liens et graphe ;
- la preuve d'état : snapshots horodatés avec hash global SHA-256 ;
- le code réel : manifeste de repo en lecture seule, commit Git, hash d'arbre et fichiers exportés.

L'objectif est qu'un assistant travaille toujours avec un contexte vérifiable : notes + snapshot + repo lié, protégés par un token assistant.

Depuis `0.5.0`, PovMind gère aussi un registre local de vaults : chaque vault isole ses notes, tokens, snapshots, repo, GitHub sync, layout et graphe sous une clé `povmind:vault:{vaultId}:...`.

Depuis `0.6.0`, un vault peut préparer un contexte GitHub versionnable : `AGENTS.md` + dossier `.povmind/`, avec manifest, notes Markdown, graphe, snapshot, politique MCP et repo manifest.

## Lancer l'app

Option simple : ouvre `index.html` dans ton navigateur.

Option recommandée pour activer le mode PWA/cache hors ligne :

```bash
cd povmind-app
npm install
npm run build
npm start
```

Puis ouvre `http://localhost:8080`.

## Déploiement

L'app est packagée pour Cloud Run avec `server.js`, `Dockerfile`, healthchecks `/health`, `/healthz` et `/ready`, endpoint `/version`, headers sécurité, PWA manifest, `robots.txt` et `sitemap.xml`.

URL actuelle : https://povmind-472136847189.europe-west1.run.app

Commande de synchronisation prod :

```bash
npm run deploy:gcp
```

Cette commande synchronise les versions, lance les checks, déploie sur Cloud Run puis vérifie que la version en ligne correspond au local.

Voir `DEPLOYMENT.md` pour les détails.

### Connecteur GitHub Cloud Run

Le panneau “GitHub sync” peut exporter localement le contexte `.povmind/`. Pour activer Push/Pull directement depuis Cloud Run, configure un OAuth App GitHub puis ajoute ces variables d'environnement au service :

```bash
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
GITHUB_TOKEN_ENCRYPTION_KEY="long-secret-random"
PUBLIC_BASE_URL="https://povmind-472136847189.europe-west1.run.app"
```

Le callback OAuth doit pointer vers :

```txt
https://povmind-472136847189.europe-west1.run.app/auth/github/callback
```

Le token GitHub n'est jamais exposé au JavaScript : Cloud Run le chiffre et le garde dans un cookie HttpOnly. Les endpoints disponibles sont `/api/github/status`, `/auth/github/start`, `/api/github/push-context` et `/api/github/pull-context`.

## Repo GitHub

Le repo GitHub doit devenir le registre du code, des revues et de la CI. Le vault PovMind reste la mémoire produit; GitHub devient la preuve exécutable.

Le dépôt contient :

- `.gitignore` pour exclure secrets, exports, caches et artefacts locaux ;
- `.github/workflows/ci.yml` pour vérifier version, build TypeScript, syntaxe et manifest repo ;
- `SECURITY.md` pour documenter le modèle de sécurité actuel ;
- `scripts/repo-manifest.mjs` pour relier un commit Git au vault.

## Architecture TypeScript

Depuis `0.8.0`, `src/app.ts` est la source de vérité de l'interface PovMind. Le fichier `app.js` reste généré et commité pour garder un déploiement Cloud Run statique très simple.

Commandes utiles :

```bash
npm run build
npm run check
```

Le build TypeScript commence par des frontières de types sur les objets critiques : notes, vault registry, layout, sécurité assistant et snapshots. Les prochaines extractions peuvent déplacer ces modèles vers des modules dédiés sans changer l'interface servie.

Publication initiale recommandée :

```bash
git init -b main
git add .
git commit -m "Initial PovMind vault app"
git remote add origin git@github.com:OWNER/povmind.git
git push -u origin main
```

## Fonctionnalités

- Écriture en Markdown avec aperçu instantané.
- Liens entre notes avec `[[Nom de note]]` ou `[[Nom de note|Libellé]]`.
- Création automatique d'une note manquante quand tu cliques sur un lien pointillé.
- Dossiers locaux, favoris et note journalière.
- Palette de commandes avec recherche de commandes et de notes.
- Templates de notes : vide, projet, réunion, recherche et journal.
- Vault interne “Documentation PovMind” pour documenter l'app depuis l'app.
- Registre multi-vault local-first avec création, ouverture et renommage.
- Snapshots versionnés du vault avec hash global SHA-256.
- Connexion à un repo de code via manifeste read-only.
- Synchronisation GitHub du contexte `.povmind/` avec export local, import, OAuth Cloud Run, push et pull.
- Backlinks de la note active.
- Liens sortants de la note active.
- Graphe SVG des connexions avec nœuds déplaçables.
- Recherche plein texte.
- Tags `#tag`.
- Token assistant crypto par vault : secret généré en navigateur, empreinte SHA-256 stockée.
- Export du carnet complet en JSON.
- Import/fusion d'un carnet JSON.
- Export Markdown de la note active.
- Export Codex KB en `.zip` avec `AGENTS.md`, `knowledge/INDEX.md`, `knowledge/notes/*.md`, `manifest.json` et `graph.json`.
- Export MCP sécurisé en `.zip` avec serveur stdio Node, ressources, outils et accès par `POVMIND_VAULT_TOKEN`.
- Raccourcis : `Ctrl/Cmd + N`, `Ctrl/Cmd + K`, `Ctrl/Cmd + P`, `Ctrl/Cmd + D`, `Ctrl/Cmd + E`, `Ctrl/Cmd + S`.

## Code repo

Le panneau “Code repo” fait du repo de code une partie native du vault. Le flux recommandé :

```bash
npm run repo:manifest -- /chemin/du/repo --output=povmind-repo-manifest.json
```

Puis importe le JSON depuis PovMind. Le manifest contient l'identité du repo, la branche, le commit, l'état dirty/clean, un `treeHash`, une politique d'indexation et les fichiers texte autorisés. Les limites par défaut sont `--max-files=220` et `--max-bytes=240000`.

Par défaut, le script exclut les secrets, `.env`, clefs, credentials, tokens, dossiers lourds, caches de test, `node_modules`, `.git`, `output`, et respecte `.gitignore` quand le dossier est un repo Git.

Quand un repo est lié :

- les snapshots incluent `repoCommit` et `repoTreeHash` ;
- l'export du vault embarque le manifest ;
- l'export MCP ajoute `repo/manifest.json` et les fichiers exportés ;
- l'assistant dispose de `povmind.repo_manifest`, `povmind.repo_list_files`, `povmind.repo_search` et `povmind.repo_read_file`.

## Export Codex KB

Le bouton “Exporter Codex KB” génère un zip prêt à copier dans un repo de code :

```txt
AGENTS.md
README-CODEX-EXPORT.md
knowledge/
  INDEX.md
  manifest.json
  graph.json
  notes/
    accueil.md
    projet-alpha.md
    ...
```

Utilisation recommandée :

1. Dézippe l'export.
2. Copie `AGENTS.md` à la racine du repo.
3. Copie le dossier `knowledge/` à la racine du repo.
4. Lance Codex depuis la racine du repo.
5. Demande à Codex de lire `AGENTS.md` et `knowledge/INDEX.md` avant de coder.

Les liens wiki vers des notes existantes sont convertis en liens Markdown classiques dans l'export. Les liens restants pointent vers des notes manquantes ou externes.

## GitHub sync

Le bouton “Export .povmind” génère un zip prêt à déposer dans un repo GitHub :

```txt
AGENTS.md
.povmind/
  manifest.json
  README.md
  vaults/{vaultId}/
    manifest.json
    INDEX.md
    graph.json
    mcp-policy.json
    repo-manifest.json
    snapshots/latest.json
    notes/*.md
```

`AGENTS.md` devient le contrat de contexte pour Codex : lire `.povmind/manifest.json`, le manifest du vault actif, les notes pertinentes, puis le dernier snapshot si une décision doit citer un état figé.

Le Push/Pull GitHub passe par Cloud Run. Le navigateur envoie uniquement les fichiers de contexte; le token OAuth GitHub reste côté serveur dans un cookie HttpOnly chiffré. Le token assistant `POVMIND_VAULT_TOKEN` reste séparé et n'est pas utilisé pour GitHub.

## Stockage

Les notes sont stockées dans `localStorage` du navigateur. Pour sauvegarder hors navigateur, utilise “Exporter le carnet” ou “Exporter Codex KB”.

Le manifest repo est lui aussi stocké localement sous `povmind:repo`; il reste read-only et peut être régénéré depuis le repo source à tout moment.

Le stockage multi-vault utilise :

```txt
povmind:vaults:index
povmind:vaults:active
povmind:vault:{vaultId}:notes
povmind:vault:{vaultId}:security
povmind:vault:{vaultId}:repo
povmind:vault:{vaultId}:snapshots
povmind:vault:{vaultId}:github-sync
```

Les anciennes clés mono-vault sont migrées doucement vers le premier vault local.

## Accès assistant sécurisé

Le panneau “Accès assistant” génère un token `povm_...` avec Web Crypto. PovMind stocke seulement `SHA-256(vaultId:token)`, pas le secret complet.

L'export MCP contient :

- `mcp/povmind-server.mjs` : serveur MCP stdio sans dépendance.
- `mcp/access.json` : `vaultId`, empreinte du token, indice du token et scopes (`notes:*`, `manifest:read`, `repo:*`).
- `knowledge/` : notes Markdown, manifeste et graphe.
- `repo/` : manifest repo et fichiers code exportés quand un repo est lié.

Le serveur MCP exige :

```bash
POVMIND_VAULT_TOKEN="povm_..." node mcp/povmind-server.mjs
```

Le même panneau permet aussi de chiffrer le vault local : la passphrase dérive une clé AES-GCM-256 via PBKDF2-SHA-256, la clé reste en mémoire uniquement, et les notes + snapshots sont stockés dans `povmind:vault:{vaultId}:notes-sealed`. Les exports JSON, MCP, Codex KB ou GitHub restent volontairement en clair quand le vault est déverrouillé.

## Snapshots du vault

Le panneau “Snapshots” permet de figer l'état complet du vault à un instant donné.

Chaque snapshot contient :

- les notes complètes ;
- le graphe, les positions, la note active, les favoris et le layout ;
- le manifest de connaissance et la politique token assistant ;
- les informations MCP utiles ;
- un `contentHash` SHA-256 calculé sur un JSON canonique.

Le journal reste la mémoire narrative. Le snapshot est la preuve d'état exacte utilisée pour retrouver ou auditer un contexte.

## Limites du MVP

- Pas encore de synchronisation cloud multi-appareil avec comptes et équipes.
- Push/Pull GitHub exige encore la configuration des secrets OAuth sur Cloud Run.
- Pas de vrai système de fichiers local natif.
- Pas encore de suppression/restauration forte de vault.
- Markdown volontairement simple, sans toutes les extensions avancées.
- Graphe simplifié : les positions déplacées sont mémorisées localement, sans moteur physique complet.
- Intégration repo par manifeste statique : elle ne clone pas le repo source et ne modifie que le dossier `.povmind/` lors d'une sync GitHub.

## Idées d'amélioration

- Ajouter une base IndexedDB.
- Ajouter un mode desktop avec Tauri ou Electron.
- Ajouter une synchronisation Git ou WebDAV.
- Ajouter un backend en ligne avec auth, stockage Markdown et sync Git.
- Ajouter un serveur MCP privé pour exposer la base de connaissance à Codex.
