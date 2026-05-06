// Background sync daemon for PovMind.
// Loaded from every page (index.html, sync.html). Opt-in: requires both
//   localStorage["povmind:sync:auto"]   = "1"
//   localStorage["povmind:sync:token"]  = "<bearer>" (if VAULT_SYNC_TOKEN is set on the server)
// Polls every POLL_MS, hashes the active vault's notes, and POSTs to
// /api/vaults/sync when the hash changes (debounced).
(function () {
  "use strict";

  if (typeof window === "undefined" || !window.localStorage) return;

  const POLL_MS = 15_000;
  const DEBOUNCE_MS = 3_000;
  const ACTIVE_KEY = "povmind:vaults:active";
  const REGISTRY_KEY = "povmind:vaults:index";
  const TOKEN_KEY = "povmind:sync:token";
  const AUTO_KEY = "povmind:sync:auto";
  const LAST_HASH_KEY = "povmind:sync:lastHash";

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  async function sha256(text) {
    if (!window.crypto || !window.crypto.subtle) return text; // fallback: raw text
    const buf = new TextEncoder().encode(text);
    const hash = await window.crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function slugify(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "untitled";
  }

  function buildSnapshot(vaultId) {
    const notes = read(`povmind:vault:${vaultId}:notes`, []);
    if (!Array.isArray(notes)) return null; // sealed/encrypted vault, skip
    const registry = read(REGISTRY_KEY, []);
    const meta = Array.isArray(registry) ? registry.find((v) => v && v.id === vaultId) || {} : {};
    const security = read(`povmind:vault:${vaultId}:security`, null);
    const repo = read(`povmind:vault:${vaultId}:repo`, null);

    return {
      vaultId,
      name: meta.name || vaultId,
      ownerEmail: meta.ownerEmail || null,
      manifest: {
        scopes: (security && security.scopes) || null,
        repo: repo || null,
        registryEntry: meta || null,
      },
      notes: notes.map((n) => ({
        slug: n.slug || (n.title ? slugify(n.title) : "untitled"),
        title: n.title || "Untitled",
        body: n.body || "",
        tags: Array.isArray(n.tags) ? n.tags : [],
        links: Array.isArray(n.links) ? n.links : [],
      })),
    };
  }

  async function postSync(snapshot) {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    const r = await fetch("/api/vaults/sync", {
      method: "POST",
      headers,
      body: JSON.stringify(snapshot),
    });
    return r.ok;
  }

  let pendingTimer = null;
  let lastSyncedHash = "";

  async function checkAndMaybeSync() {
    if (localStorage.getItem(AUTO_KEY) !== "1") return;
    const vaultId = localStorage.getItem(ACTIVE_KEY) || "";
    if (!vaultId) return;
    const snapshot = buildSnapshot(vaultId);
    if (!snapshot) return;

    const fingerprint = JSON.stringify(snapshot.notes);
    const hash = await sha256(fingerprint);
    if (hash === lastSyncedHash) return;
    if (hash === localStorage.getItem(LAST_HASH_KEY)) {
      lastSyncedHash = hash;
      return;
    }

    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(async () => {
      try {
        const ok = await postSync(snapshot);
        if (ok) {
          lastSyncedHash = hash;
          localStorage.setItem(LAST_HASH_KEY, hash);
          // Soft signal for the UI; harmless if nothing listens.
          window.dispatchEvent(new CustomEvent("povmind:auto-sync", { detail: { vaultId, ok: true } }));
        } else {
          window.dispatchEvent(new CustomEvent("povmind:auto-sync", { detail: { vaultId, ok: false } }));
        }
      } catch (err) {
        console.warn("[auto-sync] failed:", err);
      } finally {
        pendingTimer = null;
      }
    }, DEBOUNCE_MS);
  }

  // Restore last hash from previous session so we don't push on each cold reload.
  lastSyncedHash = localStorage.getItem(LAST_HASH_KEY) || "";

  // Run on load and on a steady cadence.
  setTimeout(checkAndMaybeSync, 2_000);
  setInterval(checkAndMaybeSync, POLL_MS);

  // Also react to cross-tab edits.
  window.addEventListener("storage", (e) => {
    if (!e.key) return;
    if (
      e.key === ACTIVE_KEY ||
      e.key === AUTO_KEY ||
      e.key.indexOf("povmind:vault:") === 0
    ) {
      checkAndMaybeSync();
    }
  });
})();
