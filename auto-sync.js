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
    // PovMind stores under :notes an envelope { version, notes: [...] };
    // older versions stored the raw array. Handle both, skip if encrypted.
    const raw = read(`povmind:vault:${vaultId}:notes`, null);
    let notes;
    let activeId = null;
    if (raw === null) {
      if (localStorage.getItem(`povmind:vault:${vaultId}:notes-sealed`)) return null;
      notes = [];
    } else if (Array.isArray(raw)) {
      notes = raw;
    } else if (raw && Array.isArray(raw.notes)) {
      notes = raw.notes;
      activeId = raw.activeId || null;
    } else {
      return null;
    }

    // Currently-focused note slug → povchat uses this to prioritize context.
    const activeNote = activeId ? notes.find((n) => n && n.id === activeId) : null;
    const activeSlug = activeNote ? slugify(activeNote.title || "") : null;

    // Registry shape: { activeId, vaults: [...] }
    const registryRaw = read(REGISTRY_KEY, null);
    const vaultsArr = registryRaw && typeof registryRaw === "object" && Array.isArray(registryRaw.vaults)
      ? registryRaw.vaults
      : Array.isArray(registryRaw) ? registryRaw : [];
    const meta = vaultsArr.find((v) => v && v.id === vaultId) || {};
    const security = read(`povmind:vault:${vaultId}:security`, null);
    const repo = read(`povmind:vault:${vaultId}:repo`, null);

    const cleanNotes = notes.map((n) => {
      const body = n.body || "";
      const tagSet = new Set(Array.isArray(n.tags) ? n.tags : []);
      const tagRe = /(?:^|\s)#([\p{L}\p{N}_-]+)/gu;
      let m;
      while ((m = tagRe.exec(body)) !== null) tagSet.add(m[1]);
      const linkSet = new Set(Array.isArray(n.links) ? n.links : []);
      const wlRe = /\[\[([^\]]+?)\]\]/g;
      let w;
      while ((w = wlRe.exec(body)) !== null) {
        const target = w[1].split("|")[0].trim();
        if (target) linkSet.add(slugify(target));
      }
      return {
        slug: n.slug || (n.title ? slugify(n.title) : "untitled"),
        title: n.title || "Untitled",
        body,
        tags: Array.from(tagSet),
        links: Array.from(linkSet),
      };
    });

    return {
      vaultId,
      name: meta.name || vaultId,
      ownerEmail: meta.ownerEmail || null,
      manifest: {
        scopes: (security && security.scopes) || null,
        repo: repo || null,
        registryEntry: meta || null,
        activeSlug, // → povchat prioritizes this note + 1-hop wikilinks as context
      },
      notes: cleanNotes,
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

    // Include activeSlug in the fingerprint so a focus change (user opens a
    // different note in PovMind) triggers a sync, not just note edits.
    const fingerprint = JSON.stringify({
      notes: snapshot.notes,
      activeSlug: snapshot.manifest && snapshot.manifest.activeSlug,
    });
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
