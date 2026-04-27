# Security Policy

PovMind is designed around local-first vaults, cryptographic assistant tokens, and read-only MCP exports.

## Current Security Model

- Assistant access is protected by `POVMIND_VAULT_TOKEN`.
- PovMind stores `SHA-256(vaultId:token)`, not the full token.
- Repo manifests are read-only and exclude common secret paths, ignored files, generated output, and heavy caches.
- MCP bundles expose notes and optional repo files only after token verification.

## Not Yet Covered

- Notes are not encrypted at rest in browser `localStorage`.
- There is no hosted multi-user authentication layer yet.
- Token rotation is per vault, not per assistant identity.

## Reporting

For now, treat security notes as product backlog items inside the PovMind vault. Do not commit secrets, `.env` files, private keys, exported MCP bundles, or generated `output/` artifacts.
