# Security Policy

PovMind is designed around local-first vaults, cryptographic assistant tokens, and read-only MCP exports.

## Current Security Model

- Assistant access is protected by `POVMIND_VAULT_TOKEN`.
- PovMind stores `SHA-256(vaultId:token)`, not the full token.
- Local multi-vault storage isolates notes, assistant tokens, repo manifests, snapshots, layout, and graph data under `povmind:vault:{vaultId}:...`.
- Optional local vault encryption derives an AES-GCM-256 key from the vault passphrase with PBKDF2-SHA-256; the key is kept in memory only.
- When local encryption is enabled, notes and snapshots are stored in `povmind:vault:{vaultId}:notes-sealed`, and plaintext note/snapshot keys are removed.
- Repo manifests are read-only and exclude common secret paths, ignored files, generated output, and heavy caches.
- MCP bundles expose notes and optional repo files only after token verification.
- GitHub sync exports `AGENTS.md` and `.povmind/` context files; it does not include the full assistant token.
- GitHub OAuth tokens are intended to stay on Cloud Run only, encrypted in an HttpOnly cookie when `GITHUB_TOKEN_ENCRYPTION_KEY` is configured.

## Not Yet Covered

- There is no hosted multi-user authentication layer yet.
- Local encryption does not protect data while the vault is unlocked in a compromised browser session.
- Exports created from an unlocked vault intentionally contain plaintext notes and must be handled as sensitive files.
- Token rotation is per vault, not per assistant identity.
- Vault deletion, restore, and account-based cloud sync are not implemented yet.
- GitHub Push/Pull requires Cloud Run OAuth secrets to be configured; without them the app falls back to local export/import.

## Reporting

For now, treat security notes as product backlog items inside the PovMind vault. Do not commit secrets, `.env` files, private keys, exported MCP bundles, or generated `output/` artifacts.
