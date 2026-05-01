# Security Policy

PovMind is designed around local-first vaults, cryptographic assistant tokens, and read-only MCP exports.

## Current Security Model

- Assistant access is protected by `POVMIND_VAULT_TOKEN`.
- PovMind stores `SHA-256(vaultId:token)`, not the full token.
- Local multi-vault storage isolates notes, assistant tokens, repo manifests, snapshots, layout, and graph data under `povmind:vault:{vaultId}:...`.
- Repo manifests are read-only and exclude common secret paths, ignored files, generated output, and heavy caches.
- MCP bundles expose notes and optional repo files only after token verification.
- GitHub sync exports `AGENTS.md` and `.povmind/` context files; it does not include the full assistant token.
- GitHub OAuth tokens are intended to stay on Cloud Run only, encrypted in an HttpOnly cookie when `GITHUB_TOKEN_ENCRYPTION_KEY` is configured.

## Not Yet Covered

- Notes are not encrypted at rest in browser `localStorage`.
- There is no hosted multi-user authentication layer yet.
- Token rotation is per vault, not per assistant identity.
- Vault deletion, restore, and account-based cloud sync are not implemented yet.
- GitHub Push/Pull requires Cloud Run OAuth secrets to be configured; without them the app falls back to local export/import.

## Reporting

For now, treat security notes as product backlog items inside the PovMind vault. Do not commit secrets, `.env` files, private keys, exported MCP bundles, or generated `output/` artifacts.
