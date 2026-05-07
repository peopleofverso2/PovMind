// Obsidian vault importer for PovMind.
// Drag-drop a folder of .md files; each becomes a PovMind Note in the
// chosen vault's localStorage envelope. Auto-sync (if enabled) pushes
// the imported notes to Cloud SQL within ~15 s.
//
// PovMind Note shape (matches cleanNote in app.ts):
//   { id, title, folder, body, createdAt, updatedAt }
// Tags and wikilinks live INLINE in the body and are extracted at
// runtime by PovMind / by the server's snapshot writer.

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const status = $("status");
  const drop = $("drop");
  const fileInput = $("folder-input");
  const targetVaultSel = $("target-vault");
  const folderPrefixInput = $("folder-prefix");
  const newVaultBtn = $("new-vault");
  const reloadBtn = $("reload-povmind");

  function log(msg) {
    status.textContent += "\n" + msg;
    status.scrollTop = status.scrollHeight;
  }
  function reset(msg) {
    status.textContent = msg;
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function uid(prefix) {
    if (window.crypto && window.crypto.randomUUID) {
      return prefix + "_" + window.crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    }
    return prefix + "_" + Math.random().toString(36).slice(2, 14);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  // PovMind's registry shape (cleanVaultRegistry in app.ts):
  //   { activeId, vaults: [{ id, name, createdAt, updatedAt, noteCount, tokenSealed }] }
  function getRegistry() {
    const raw = readJson("povmind:vaults:index", null);
    if (raw && typeof raw === "object" && Array.isArray(raw.vaults)) return raw;
    return { activeId: "", vaults: [] };
  }

  function refreshVaultList() {
    const reg = getRegistry();
    const active = localStorage.getItem("povmind:vaults:active") || reg.activeId || "";
    targetVaultSel.innerHTML = "";
    if (reg.vaults.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "(aucun vault — clique « + Nouveau »)";
      targetVaultSel.appendChild(opt);
      return;
    }
    for (const v of reg.vaults) {
      if (!v || !v.id) continue;
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = (v.name || v.id) + (v.id === active ? " (actif)" : "");
      if (v.id === active) opt.selected = true;
      targetVaultSel.appendChild(opt);
    }
  }

  newVaultBtn.addEventListener("click", () => {
    const name = prompt("Nom du nouveau vault :", "Obsidian Import");
    if (!name) return;
    const id = uid("vlt");
    const reg = getRegistry();
    const createdAt = nowIso();
    reg.vaults.unshift({
      id,
      name,
      createdAt,
      updatedAt: createdAt,
      noteCount: 0,
      tokenSealed: false,
    });
    reg.activeId = id; // make this vault the active one — PovMind will load it on next reload.
    localStorage.setItem("povmind:vaults:index", JSON.stringify(reg, null, 2));
    localStorage.setItem("povmind:vaults:active", id);
    localStorage.setItem(
      "povmind:vault:" + id + ":notes",
      JSON.stringify({ version: 1, activeId: null, starredIds: [], snapshots: [], notes: [] }),
    );
    refreshVaultList();
    targetVaultSel.value = id;
    log("Vault créé : " + name + " (" + id + "). Actif au prochain reload PovMind.");
  });

  // ── Folder traversal ────────────────────────────────────────────────────

  async function readEntriesAll(reader) {
    const all = [];
    while (true) {
      const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) break;
      all.push(...batch);
    }
    return all;
  }

  async function collect(entry, mdFiles, basePath) {
    const path = basePath ? basePath + "/" + entry.name : entry.name;
    if (entry.isFile) {
      if (!entry.name.toLowerCase().endsWith(".md")) return;
      mdFiles.push({ entry, path });
    } else if (entry.isDirectory) {
      if (entry.name === ".obsidian" || entry.name === ".trash" || entry.name.startsWith(".git")) return;
      const reader = entry.createReader();
      const children = await readEntriesAll(reader);
      for (const child of children) {
        await collect(child, mdFiles, path);
      }
    }
  }

  async function readEntryText(entry) {
    return new Promise((resolve, reject) => {
      entry.file((file) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ text: String(reader.result || ""), lastModified: file.lastModified });
        reader.onerror = reject;
        reader.readAsText(file);
      }, reject);
    });
  }

  // ── Markdown parsing ────────────────────────────────────────────────────

  function slugify(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "untitled";
  }

  function parseFrontmatter(content) {
    if (!content.startsWith("---")) return { fm: {}, body: content };
    const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return { fm: {}, body: content };
    const fmRaw = m[1];
    const body = m[2];
    const fm = {};
    let lastKey = null;
    for (const line of fmRaw.split(/\r?\n/)) {
      if (/^\s*-\s+/.test(line) && lastKey) {
        const v = line.replace(/^\s*-\s+/, "").trim();
        if (!Array.isArray(fm[lastKey])) fm[lastKey] = [];
        fm[lastKey].push(v.replace(/^["']|["']$/g, ""));
        continue;
      }
      const kv = line.match(/^([A-Za-z0-9_\-]+)\s*:\s*(.*)$/);
      if (!kv) continue;
      const k = kv[1].trim();
      const vRaw = kv[2].trim();
      lastKey = k;
      if (!vRaw) {
        fm[k] = []; // following list expected
      } else if (vRaw.startsWith("[") && vRaw.endsWith("]")) {
        fm[k] = vRaw.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      } else {
        fm[k] = vRaw.replace(/^["']|["']$/g, "");
      }
    }
    return { fm, body };
  }

  function deriveTitle(filePath, fm, body) {
    if (typeof fm.title === "string" && fm.title.trim()) return fm.title.trim();
    const h1 = body.match(/^#\s+(.+)$/m);
    if (h1) return h1[1].trim();
    return filePath.split("/").pop().replace(/\.md$/i, "");
  }

  function deriveFolder(filePath, prefix) {
    const parts = filePath.split("/");
    parts.pop(); // drop filename
    const obsFolder = parts.join("/");
    const norm = (prefix || "") + (prefix && obsFolder ? "/" : "") + obsFolder;
    return norm.replace(/^\/+|\/+$/g, "");
  }

  function buildNoteFromFile(filePath, content, lastModified, prefix) {
    const { fm, body } = parseFrontmatter(content);
    const title = deriveTitle(filePath, fm, body);
    const folder = deriveFolder(filePath, prefix);
    const created = fm.created || fm.createdAt || (lastModified ? new Date(lastModified).toISOString() : nowIso());
    const updated = fm.updated || fm.updatedAt || (lastModified ? new Date(lastModified).toISOString() : nowIso());
    return {
      id: uid("note"),
      title,
      folder,
      body: content, // keep frontmatter + #tags + [[wikilinks]] inline so PovMind detects them
      createdAt: typeof created === "string" ? created : nowIso(),
      updatedAt: typeof updated === "string" ? updated : nowIso(),
    };
  }

  // ── Import driver ───────────────────────────────────────────────────────

  async function importEntries(entries) {
    const vaultId = targetVaultSel.value;
    if (!vaultId) {
      log("✗ Aucun vault cible.");
      return;
    }

    const mdFiles = [];
    for (const e of entries) {
      if (!e) continue;
      try {
        await collect(e, mdFiles, "");
      } catch (err) {
        log("✗ collect " + e.name + " : " + err.message);
      }
    }
    if (!mdFiles.length) {
      log("Aucun fichier .md trouvé.");
      return;
    }
    log("Trouvé " + mdFiles.length + " fichier(s) .md.");

    const prefix = folderPrefixInput.value.trim();
    const envelopeKey = "povmind:vault:" + vaultId + ":notes";
    const envelope = readJson(envelopeKey, { version: 1, activeId: null, starredIds: [], snapshots: [], notes: [] });
    if (!Array.isArray(envelope.notes)) envelope.notes = [];
    const existingTitles = new Set(envelope.notes.map((n) => n.title));

    let added = 0;
    let skipped = 0;
    for (let i = 0; i < mdFiles.length; i++) {
      const { entry, path } = mdFiles[i];
      try {
        const { text, lastModified } = await readEntryText(entry);
        const note = buildNoteFromFile(path, text, lastModified, prefix);
        if (existingTitles.has(note.title)) {
          // Disambiguate by appending the folder so identical titles in
          // different folders don't collide silently.
          if (note.folder) note.title = note.title + " (" + note.folder.split("/").pop() + ")";
          if (existingTitles.has(note.title)) {
            skipped++;
            continue;
          }
        }
        existingTitles.add(note.title);
        envelope.notes.push(note);
        added++;
        if (i % 25 === 0 || i === mdFiles.length - 1) {
          log("  " + (i + 1) + "/" + mdFiles.length + " parsées (+" + added + ")");
        }
      } catch (err) {
        log("✗ " + path + " : " + err.message);
      }
    }

    try {
      localStorage.setItem(envelopeKey, JSON.stringify(envelope));
      // Bump noteCount on the registry entry so PovMind's vault picker shows
      // the right count immediately (without having to load the vault first).
      const reg = getRegistry();
      const idx = reg.vaults.findIndex((v) => v && v.id === vaultId);
      if (idx >= 0) {
        reg.vaults[idx] = {
          ...reg.vaults[idx],
          noteCount: envelope.notes.length,
          updatedAt: nowIso(),
        };
        localStorage.setItem("povmind:vaults:index", JSON.stringify(reg, null, 2));
      }
    } catch (err) {
      log("✗ Écriture localStorage : " + err.message + " (vault peut-être trop gros pour localStorage)");
      return;
    }

    log("");
    log("✓ Import terminé : +" + added + " note(s), " + skipped + " ignorée(s) (titre déjà présent).");
    log("Total dans le vault : " + envelope.notes.length + " note(s).");
    log("");
    log("→ Recharge PovMind pour voir les notes (bouton ci-dessus).");
    log("→ L'auto-sync (si activée) pousse vers Cloud SQL dans ~15 s.");

    reloadBtn.disabled = false;
  }

  // ── DOM wiring ──────────────────────────────────────────────────────────

  drop.addEventListener("click", () => fileInput.click());
  drop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") fileInput.click();
  });

  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));

  drop.addEventListener("drop", async (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    reset("Lecture du dossier…");
    const items = Array.from(e.dataTransfer.items || []);
    const entries = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
    if (!entries.length) {
      log("✗ Aucun dossier ni fichier détecté. Glisse un dossier complet.");
      return;
    }
    await importEntries(entries);
  });

  fileInput.addEventListener("change", async () => {
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;
    reset("Lecture de " + files.length + " fichier(s)…");
    const prefix = folderPrefixInput.value.trim();
    const vaultId = targetVaultSel.value;
    if (!vaultId) { log("✗ Aucun vault cible."); return; }

    const envelopeKey = "povmind:vault:" + vaultId + ":notes";
    const envelope = readJson(envelopeKey, { version: 1, activeId: null, starredIds: [], snapshots: [], notes: [] });
    if (!Array.isArray(envelope.notes)) envelope.notes = [];
    const existingTitles = new Set(envelope.notes.map((n) => n.title));

    let added = 0, skipped = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.name.toLowerCase().endsWith(".md")) continue;
      const path = f.webkitRelativePath || f.name;
      const text = await f.text();
      const note = buildNoteFromFile(path, text, f.lastModified, prefix);
      if (existingTitles.has(note.title)) { skipped++; continue; }
      existingTitles.add(note.title);
      envelope.notes.push(note);
      added++;
      if (i % 25 === 0 || i === files.length - 1) log("  " + (i + 1) + "/" + files.length + " parsées (+" + added + ")");
    }
    try {
      localStorage.setItem(envelopeKey, JSON.stringify(envelope));
      const reg = getRegistry();
      const idx = reg.vaults.findIndex((v) => v && v.id === vaultId);
      if (idx >= 0) {
        reg.vaults[idx] = { ...reg.vaults[idx], noteCount: envelope.notes.length, updatedAt: nowIso() };
        localStorage.setItem("povmind:vaults:index", JSON.stringify(reg, null, 2));
      }
    } catch (err) { log("✗ Écriture localStorage : " + err.message); return; }
    log("");
    log("✓ Import terminé : +" + added + " note(s), " + skipped + " ignorée(s).");
    log("Total dans le vault : " + envelope.notes.length + " note(s).");
    reloadBtn.disabled = false;
  });

  reloadBtn.addEventListener("click", () => {
    window.location.href = "/";
  });

  refreshVaultList();
})();
