// Standalone sync page: reads localStorage vault data and POSTs to the server.
// Lives outside app.js to keep the diff on the main app surface zero.
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const status = $("status");
  const vaultInfo = $("vault-info");
  const tokenInput = $("token");

  const TOKEN_KEY = "povmind:sync:token"; // remembered locally for convenience

  function setStatus(msg, ok) {
    status.textContent = msg;
    status.style.color = ok === true ? "#0a8" : ok === false ? "#c33" : "";
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("readJson", key, e);
      return fallback;
    }
  }

  function getActiveVaultId() {
    return localStorage.getItem("povmind:vaults:active") || "";
  }

  function vaultKey(vaultId, kind) {
    return "povmind:vault:" + vaultId + ":" + kind;
  }

  function buildSnapshot(vaultId) {
    if (!vaultId) throw new Error("Aucun vault actif détecté.");
    const notes = readJson(vaultKey(vaultId, "notes"), []);
    if (!Array.isArray(notes)) throw new Error("Le vault est chiffré ou indisponible.");
    const registry = readJson("povmind:vaults:index", []);
    const meta = Array.isArray(registry)
      ? registry.find((v) => v && v.id === vaultId) || {}
      : {};
    const security = readJson(vaultKey(vaultId, "security"), null);
    const repo = readJson(vaultKey(vaultId, "repo"), null);

    const cleanNotes = notes.map((n) => ({
      slug: n.slug || (n.title ? slugify(n.title) : "untitled"),
      title: n.title || "Untitled",
      body: n.body || "",
      tags: Array.isArray(n.tags) ? n.tags : [],
      links: Array.isArray(n.links) ? n.links : [],
    }));

    return {
      vaultId,
      name: meta.name || vaultId,
      ownerEmail: meta.ownerEmail || null,
      manifest: {
        povmindVersion: (window.__POVMIND_VERSION__ || ""),
        scopes: (security && security.scopes) || null,
        repo: repo || null,
        registryEntry: meta || null,
      },
      notes: cleanNotes,
    };
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

  function authHeaders() {
    const t = tokenInput.value.trim();
    return t ? { Authorization: "Bearer " + t } : {};
  }

  async function doSync() {
    try {
      const vaultId = getActiveVaultId();
      const snapshot = buildSnapshot(vaultId);
      setStatus("Envoi de " + snapshot.notes.length + " note(s)…");
      const r = await fetch("/api/vaults/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(snapshot),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        setStatus("Erreur " + r.status + " : " + (data.error || r.statusText), false);
        return;
      }
      // Persist the token for next time only on success
      if (tokenInput.value.trim()) localStorage.setItem(TOKEN_KEY, tokenInput.value.trim());
      setStatus("Synchronisé. Vault " + data.vaultId + ", " + data.noteCount + " note(s).", true);
    } catch (err) {
      setStatus("Échec : " + err.message, false);
    }
  }

  async function doPull() {
    try {
      const vaultId = getActiveVaultId();
      if (!vaultId) {
        setStatus("Aucun vault actif.", false);
        return;
      }
      setStatus("Lecture serveur…");
      const r = await fetch("/api/vaults/" + encodeURIComponent(vaultId) + "/pull", {
        headers: authHeaders(),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        setStatus("Erreur " + r.status + " : " + (data.error || r.statusText), false);
        return;
      }
      const v = data.vault;
      setStatus(
        "Serveur : " + v.notes.length + " note(s) · last_synced_at = " + v.lastSyncedAt,
        true,
      );
    } catch (err) {
      setStatus("Échec : " + err.message, false);
    }
  }

  function init() {
    // Restore remembered token
    const saved = localStorage.getItem(TOKEN_KEY) || "";
    if (saved) tokenInput.value = saved;

    const vaultId = getActiveVaultId();
    if (!vaultId) {
      vaultInfo.textContent = "Aucun vault actif. Ouvre PovMind, choisis un vault, puis reviens ici.";
      $("sync-btn").disabled = true;
      $("pull-btn").disabled = true;
      return;
    }
    const notes = readJson(vaultKey(vaultId, "notes"), []);
    const noteCount = Array.isArray(notes) ? notes.length : 0;
    vaultInfo.textContent =
      "Vault actif : " + vaultId + " · " + noteCount + " note(s) en localStorage.";

    $("sync-btn").addEventListener("click", doSync);
    $("pull-btn").addEventListener("click", doPull);

    // Round-trip test: hits /api/vaults with the entered token and reports
    // 200/401/anything-else. Decouples token validity from the localStorage
    // snapshot logic above.
    const testBtn = $("test-btn");
    if (testBtn) {
      testBtn.addEventListener("click", async () => {
        try {
          setStatus("Ping serveur…");
          const r = await fetch("/api/vaults", { headers: authHeaders() });
          const txt = await r.text();
          let body;
          try { body = JSON.parse(txt); } catch { body = txt; }
          setStatus(
            "HTTP " + r.status + " — " + JSON.stringify(body).slice(0, 200),
            r.ok,
          );
        } catch (err) {
          setStatus("Erreur réseau : " + err.message, false);
        }
      });
    }

    // Auto-sync toggle (consumed by auto-sync.js).
    const autoCheckbox = $("auto-sync");
    if (autoCheckbox) {
      autoCheckbox.checked = localStorage.getItem("povmind:sync:auto") === "1";
      autoCheckbox.addEventListener("change", () => {
        if (autoCheckbox.checked) {
          if (!tokenInput.value.trim() && false) {
            // Token is optional unless server enforces VAULT_SYNC_TOKEN.
          }
          localStorage.setItem("povmind:sync:auto", "1");
          if (tokenInput.value.trim()) localStorage.setItem(TOKEN_KEY, tokenInput.value.trim());
          setStatus("Sync auto activée.", true);
        } else {
          localStorage.removeItem("povmind:sync:auto");
          setStatus("Sync auto désactivée.");
        }
      });
    }

    // Surface auto-sync events for visual feedback.
    window.addEventListener("povmind:auto-sync", (e) => {
      const detail = e.detail || {};
      if (detail.ok) setStatus("Auto-sync : vault " + detail.vaultId + " à jour.", true);
      else setStatus("Auto-sync : échec sur " + detail.vaultId, false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
