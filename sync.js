// Standalone PovChat sync page: reads localStorage vault data and POSTs to the server.
// Lives outside app.js to keep the diff on the main app surface zero.
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const status = $("status");
  const vaultInfo = $("vault-info");
  const tokenInput = $("token");

  const TOKEN_KEY = "povmind:sync:token"; // remembered locally for convenience
  const AUTO_KEY = "povmind:sync:auto";
  const SYNC_STATE_KIND = "povchat-sync";

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

  function syncStateKey(vaultId) {
    return vaultKey(vaultId, SYNC_STATE_KIND);
  }

  function readSyncState(vaultId) {
    const state = readJson(syncStateKey(vaultId), null);
    return state && typeof state === "object" ? state : null;
  }

  function writeSyncState(vaultId, patch) {
    if (!vaultId) return;
    const next = {
      ...(readSyncState(vaultId) || {}),
      ...patch,
      version: 1,
      vaultId,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(syncStateKey(vaultId), JSON.stringify(next, null, 2));
    renderSyncState(vaultId);
  }

  function countChatNotes(notes) {
    return (Array.isArray(notes) ? notes : []).filter((note) => String(note.slug || "").startsWith("chat/")).length;
  }

  function formatDate(iso) {
    if (!iso) return "";
    try {
      return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso));
    } catch {
      return "";
    }
  }

  function describeSyncState(state) {
    const auto = localStorage.getItem(AUTO_KEY) === "1" ? "Auto actif" : "Auto inactif";
    if (!state) {
      return {
        summary: "Aucun état local",
        detail: auto + " · synchronise ou vérifie le serveur pour alimenter ce statut.",
      };
    }
    if (state.lastStatus === "error") {
      return {
        summary: "Erreur sync" + (state.lastErrorAt ? " · " + formatDate(state.lastErrorAt) : ""),
        detail: [state.lastError || "Erreur inconnue", auto].filter(Boolean).join(" · "),
      };
    }
    const pushedAt = state.lastPushedAt || "";
    const pulledAt = state.lastPulledAt || "";
    const latestIsPull = pulledAt && (!pushedAt || new Date(pulledAt).getTime() >= new Date(pushedAt).getTime());
    const summary = latestIsPull
      ? "Serveur vérifié" + (pulledAt ? " · " + formatDate(pulledAt) : "")
      : pushedAt
        ? "Push PovChat · " + formatDate(pushedAt)
        : "Prêt pour PovChat";
    const details = [];
    if (Number.isFinite(Number(state.noteCount))) details.push(Number(state.noteCount) + " notes publiées");
    if (Number.isFinite(Number(state.remoteNoteCount))) details.push(Number(state.remoteNoteCount) + " notes serveur");
    if (Number(state.chatNoteCount) > 0) details.push(Number(state.chatNoteCount) + " notes chat");
    if (state.remoteLastSyncedAt) details.push("distant " + formatDate(state.remoteLastSyncedAt));
    details.push(auto);
    return { summary, detail: details.join(" · ") };
  }

  function renderSyncState(vaultId) {
    const summaryEl = $("sync-summary");
    const detailEl = $("sync-detail");
    if (!summaryEl || !detailEl) return;
    const view = describeSyncState(readSyncState(vaultId));
    summaryEl.textContent = view.summary;
    detailEl.textContent = view.detail;
  }

  function buildSnapshot(vaultId) {
    if (!vaultId) throw new Error("Aucun vault actif détecté.");

    // PovMind writes an envelope under :notes:
    //   { version, activeId, starredIds, snapshots, notes: [...] }
    // Older formats may have used a raw array. Handle both.
    const raw = readJson(vaultKey(vaultId, "notes"), null);
    let notes;
    let activeId = null;
    if (raw === null) {
      // Possible reasons: vault is encrypted (notes were moved to :notes-sealed)
      // OR the vault is brand-new with nothing saved yet.
      const sealed = localStorage.getItem(vaultKey(vaultId, "notes-sealed"));
      if (sealed) {
        throw new Error("Vault verrouillé (chiffré). Déverrouille-le dans PovMind avec ta passphrase, puis reviens ici.");
      }
      notes = [];
    } else if (Array.isArray(raw)) {
      notes = raw;
    } else if (raw && Array.isArray(raw.notes)) {
      notes = raw.notes;
      activeId = raw.activeId || null;
    } else {
      throw new Error("Format inattendu sous povmind:vault:" + vaultId + ":notes — ouvre une issue avec un export du localStorage.");
    }

    // Resolve the user's currently-focused note slug so PovChat can prioritize it
    // as conversation context.
    const activeNote = activeId ? notes.find((n) => n && n.id === activeId) : null;
    const activeSlug = activeNote ? slugify(activeNote.title || "") : null;
    // Registry shape: { activeId, vaults: [...] }
    const registryRaw = readJson("povmind:vaults:index", null);
    const vaults = registryRaw && typeof registryRaw === "object" && Array.isArray(registryRaw.vaults)
      ? registryRaw.vaults
      : Array.isArray(registryRaw) ? registryRaw : [];
    const meta = vaults.find((v) => v && v.id === vaultId) || {};
    const security = readJson(vaultKey(vaultId, "security"), null);
    const repo = readJson(vaultKey(vaultId, "repo"), null);

    const cleanNotes = notes.map((n) => {
      const body = n.body || "";
      // Inline #tags in the body — extracted client-side so the server has them
      // even though PovMind doesn't store a tags field on Note.
      const tagSet = new Set(Array.isArray(n.tags) ? n.tags : []);
      const tagRe = /(?:^|\s)#([\p{L}\p{N}_-]+)/gu;
      let m;
      while ((m = tagRe.exec(body)) !== null) tagSet.add(m[1]);
      // Wikilinks → slug refs.
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
        povmindVersion: (window.__POVMIND_VERSION__ || ""),
        scopes: (security && security.scopes) || null,
        repo: repo || null,
        registryEntry: meta || null,
        activeSlug, // → PovChat prioritizes this note + its wikilink graph as context
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
    const vaultId = getActiveVaultId();
    try {
      const snapshot = buildSnapshot(vaultId);
      setStatus("Envoi de " + snapshot.notes.length + " note(s)…");
      const r = await fetch("/api/vaults/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(snapshot),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        const message = "Erreur " + r.status + " : " + (data.error || r.statusText);
        writeSyncState(vaultId, {
          lastStatus: "error",
          lastSource: "manual",
          lastErrorAt: new Date().toISOString(),
          lastError: message,
        });
        setStatus(message, false);
        return;
      }
      // Persist the token for next time only on success
      if (tokenInput.value.trim()) localStorage.setItem(TOKEN_KEY, tokenInput.value.trim());
      writeSyncState(vaultId, {
        lastStatus: "ok",
        lastSource: "manual",
        lastPushedAt: new Date().toISOString(),
        noteCount: Number(data.noteCount || snapshot.notes.length),
        activeSlug: snapshot.manifest && snapshot.manifest.activeSlug || "",
        lastError: "",
      });
      setStatus("Synchronisé. Vault " + data.vaultId + ", " + data.noteCount + " note(s).", true);
    } catch (err) {
      writeSyncState(vaultId, {
        lastStatus: "error",
        lastSource: "manual",
        lastErrorAt: new Date().toISOString(),
        lastError: err.message,
      });
      setStatus("Échec : " + err.message, false);
    }
  }

  async function doPull() {
    const vaultId = getActiveVaultId();
    try {
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
        const message = "Erreur " + r.status + " : " + (data.error || r.statusText);
        writeSyncState(vaultId, {
          lastStatus: "error",
          lastSource: "pull",
          lastErrorAt: new Date().toISOString(),
          lastError: message,
        });
        setStatus(message, false);
        return;
      }
      const v = data.vault;
      writeSyncState(vaultId, {
        lastStatus: "ok",
        lastSource: "pull",
        lastPulledAt: new Date().toISOString(),
        remoteLastSyncedAt: v.lastSyncedAt,
        remoteNoteCount: Array.isArray(v.notes) ? v.notes.length : 0,
        chatNoteCount: countChatNotes(v.notes),
        lastError: "",
      });
      setStatus(
        "Serveur : " + v.notes.length + " note(s) · last_synced_at = " + v.lastSyncedAt,
        true,
      );
    } catch (err) {
      writeSyncState(vaultId, {
        lastStatus: "error",
        lastSource: "pull",
        lastErrorAt: new Date().toISOString(),
        lastError: err.message,
      });
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
    // Match the same envelope-aware extraction as buildSnapshot.
    const raw = readJson(vaultKey(vaultId, "notes"), null);
    const sealed = !raw && Boolean(localStorage.getItem(vaultKey(vaultId, "notes-sealed")));
    const arr = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.notes) ? raw.notes : []);
    vaultInfo.textContent =
      "Vault actif : " + vaultId + " · " + arr.length + " note(s) en localStorage" +
      (sealed ? " (chiffré, déverrouille-le dans PovMind)" : "") + ".";
    renderSyncState(vaultId);

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
      autoCheckbox.checked = localStorage.getItem(AUTO_KEY) === "1";
      autoCheckbox.addEventListener("change", () => {
        if (autoCheckbox.checked) {
          if (!tokenInput.value.trim() && false) {
            // Token is optional unless server enforces VAULT_SYNC_TOKEN.
          }
          localStorage.setItem(AUTO_KEY, "1");
          if (tokenInput.value.trim()) localStorage.setItem(TOKEN_KEY, tokenInput.value.trim());
          renderSyncState(vaultId);
          setStatus("Sync auto activée.", true);
        } else {
          localStorage.removeItem(AUTO_KEY);
          renderSyncState(vaultId);
          setStatus("Sync auto désactivée.");
        }
      });
    }

    // Surface auto-sync events for visual feedback.
    window.addEventListener("povmind:auto-sync", (e) => {
      const detail = e.detail || {};
      if (detail.vaultId === vaultId) renderSyncState(vaultId);
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
