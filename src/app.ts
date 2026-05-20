const APP_NAME = "PovMind";
const APP_VERSION = "0.14.0";
const STORAGE_KEY = "povmind:v1";
const VIEW_KEY = "povmind:view";
const GRAPH_LAYOUT_KEY = "povmind:graph-layout";
const STARRED_KEY = "povmind:starred";
const LAYOUT_KEY = "povmind:layout";
const SECURITY_KEY = "povmind:security";
const DOC_VAULT_KEY = "povmind:doc-vault:v1";
const SNAPSHOTS_KEY = "povmind:snapshots";
const REPO_KEY = "povmind:repo";
const GITHUB_SYNC_KEY = "povmind:github-sync";
const LEARNING_MEMORY_KEY = "povmind:learning-memory";
const ENRICHMENT_RUNS_KEY = "povmind:enrichment-runs";
const COGNITIVE_CYCLES_KEY = "povmind:cognitive-cycles";
const VAULTS_INDEX_KEY = "povmind:vaults:index";
const ACTIVE_VAULT_KEY = "povmind:vaults:active";
const LEGACY_STORAGE_KEY = "graphnotes:v1";
const LEGACY_VIEW_KEY = "graphnotes:view";
const LEGACY_GRAPH_LAYOUT_KEY = "graphnotes:graph-layout";
const LEGACY_STARRED_KEY = "graphnotes:starred";
const MAX_GRAPH_NODES = 80;
const MAX_SNAPSHOTS = 24;
const MAX_ENRICHMENT_RUNS = 20;
const MAX_COGNITIVE_CYCLES = 30;
const MAX_REPO_FILES_RENDERED = 8;
const MAX_DEV_CONTEXT_FILES = 80;
const MAX_DEV_CONTEXT_NOTE_BYTES = 16000;
const VAULT_CRYPTO_ITERATIONS = 310000;
const ROOT_FOLDER = "Racine";
const OBSIDIAN_IGNORED_DIRS = new Set([".obsidian", ".git", ".trash", ".stfolder", "node_modules"]);

const MEMORY_TYPES = [
  { id: "raw", label: "Brute", detail: "Documents, notes, logs" },
  { id: "structured", label: "Structurée", detail: "Wiki, concepts, liens" },
  { id: "strategic", label: "Stratégique", detail: "Décisions, convictions" },
  { id: "symbolic", label: "Symbolique", detail: "Métaphores, intuitions" },
  { id: "agentic", label: "Agentique", detail: "Actions, runs, logs" },
  { id: "relational", label: "Relationnelle", detail: "Personnes, contextes" },
  { id: "prospective", label: "Prospective", detail: "Hypothèses, scénarios" },
];

type JsonObject = Record<string, any>;

interface LayoutSettings {
  sidebarWidth: number;
  inspectorWidth: number;
  editorPaneWidth: number | null;
  graphHeight: number;
}

interface Note {
  id: string;
  title: string;
  folder: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  memoryTypes?: string[];
}

interface NoteTemplate {
  id: string;
  name: string;
  folder: string;
  body: (title: string) => string;
}

interface VaultRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  noteCount: number;
  tokenSealed: boolean;
}

interface VaultRegistry {
  version: number;
  activeId: string;
  vaults: VaultRecord[];
}

interface SecurityState {
  version: number;
  vaultId: string;
  tokenHash: string;
  tokenHint: string;
  tokenCreatedAt: string;
  tokenRotatedAt: string;
  algorithm: string;
  scopes: string[];
  encryption: VaultEncryptionState;
}

interface VaultEncryptionState {
  enabled: boolean;
  algorithm: string;
  kdf: string;
  iterations: number;
  salt: string;
  encryptedAt: string;
  updatedAt: string;
}

interface VaultSnapshot {
  version: number;
  id: string;
  createdAt: string;
  hash: string;
  hashAlgorithm: string;
  summary: JsonObject;
  payload: JsonObject | null;
}

interface EnrichmentProposal {
  id: string;
  type: string;
  title: string;
  detail: string;
  status: string;
  confidence: number;
  risk: string;
  targetId: string;
  targetTitle: string;
  evidence: JsonObject[];
  createdAt: string;
  appliedAt: string;
}

interface EnrichmentRun {
  id: string;
  createdAt: string;
  source: string;
  mode: string;
  input: JsonObject;
  proposals: EnrichmentProposal[];
}

interface CognitiveCycle {
  id: string;
  createdAt: string;
  phase: string;
  source: string;
  runId: string;
  snapshotId: string;
  snapshotHash: string;
  score: JsonObject;
  summary: string;
  outputs: JsonObject[];
}

interface GraphPosition {
  x: number;
  y: number;
}

interface AppState {
  notes: Note[];
  activeId: string | null;
  search: string;
  tagFilter: string | null;
  folderFilter: string | null;
  view: string;
  saveTimer: any;
  starredIds: Set<string>;
  commandItems: any[];
  commandIndex: number;
  vaultDialogMode: string;
  layout: LayoutSettings;
  layoutDragging: any;
  graphFullscreen: boolean;
  graphPositions: Record<string, GraphPosition>;
  graphRuntimePositions: Record<string, GraphPosition>;
  graphDragging: any;
  graphClickSuppressed: boolean;
  security: SecurityState;
  assistantToken: string;
  vaultCryptoKey: CryptoKey | null;
  vaultUnlocked: boolean;
  snapshots: VaultSnapshot[];
  repo: JsonObject;
  githubSync: JsonObject;
  learningMemory: JsonObject;
  enrichmentRuns: EnrichmentRun[];
  cognitiveCycles: CognitiveCycle[];
}

const DEFAULT_LAYOUT: LayoutSettings = {
  sidebarWidth: 316,
  inspectorWidth: 350,
  editorPaneWidth: null,
  graphHeight: 300,
};

const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "blank",
    name: "Note vide",
    folder: ROOT_FOLDER,
    body: (title) => `# ${title}\n\n`,
  },
  {
    id: "project",
    name: "Projet",
    folder: "Projets",
    body: (title) => `# ${title}\n\n## Objectif\n\n\n## Contexte\n\n\n## Décisions\n\n- \n\n## Prochaines actions\n\n- [ ] \n\n#projet`,
  },
  {
    id: "meeting",
    name: "Réunion",
    folder: "Réunions",
    body: (title) => `# ${title}\n\nDate : ${formatLongDate(new Date())}\n\n## Participants\n\n- \n\n## Points discutés\n\n- \n\n## Décisions\n\n- \n\n## Actions\n\n- [ ] \n\n#reunion`,
  },
  {
    id: "research",
    name: "Recherche",
    folder: "Recherche",
    body: (title) => `# ${title}\n\n## Question\n\n\n## Sources\n\n- \n\n## Synthèse\n\n\n## À vérifier\n\n- [ ] \n\n#recherche`,
  },
  {
    id: "daily",
    name: "Journal",
    folder: "Journal",
    body: (title) => `# ${title}\n\n## Notes\n\n\n## Tâches\n\n- [ ] \n\n## Liens\n\n- [[Accueil]]\n\n#journal`,
  },
];

const els: Record<string, any> = {
  ribbonNewNoteBtn: document.getElementById("ribbonNewNoteBtn"),
  ribbonSearchBtn: document.getElementById("ribbonSearchBtn"),
  ribbonGraphBtn: document.getElementById("ribbonGraphBtn"),
  ribbonDailyBtn: document.getElementById("ribbonDailyBtn"),
  ribbonMcpBtn: document.getElementById("ribbonMcpBtn"),
  newNoteBtn: document.getElementById("newNoteBtn"),
  docVaultBtn: document.getElementById("docVaultBtn"),
  importBtn: document.getElementById("importBtn"),
  importInput: document.getElementById("importInput"),
  importObsidianBtn: document.getElementById("importObsidianBtn"),
  obsidianInput: document.getElementById("obsidianInput"),
  searchInput: document.getElementById("searchInput"),
  tagFilters: document.getElementById("tagFilters"),
  notesList: document.getElementById("notesList"),
  vaultSelect: document.getElementById("vaultSelect"),
  newVaultBtn: document.getElementById("newVaultBtn"),
  renameVaultBtn: document.getElementById("renameVaultBtn"),
  vaultRegistryMeta: document.getElementById("vaultRegistryMeta"),
  exportVaultBtn: document.getElementById("exportVaultBtn"),
  exportMcpBtn: document.getElementById("exportMcpBtn"),
  exportCodexBtn: document.getElementById("exportCodexBtn"),
  resetDemoBtn: document.getElementById("resetDemoBtn"),
  vaultStats: document.getElementById("vaultStats"),
  dailyNoteBtn: document.getElementById("dailyNoteBtn"),
  commandPaletteBtn: document.getElementById("commandPaletteBtn"),
  titleInput: document.getElementById("titleInput"),
  folderInput: document.getElementById("folderInput"),
  folderSuggestions: document.getElementById("folderSuggestions"),
  savedStatus: document.getElementById("savedStatus"),
  wordCount: document.getElementById("wordCount"),
  starNoteBtn: document.getElementById("starNoteBtn"),
  templateBtn: document.getElementById("templateBtn"),
  viewModeBtn: document.getElementById("viewModeBtn"),
  exportMdBtn: document.getElementById("exportMdBtn"),
  deleteNoteBtn: document.getElementById("deleteNoteBtn"),
  activeTabTitle: document.getElementById("activeTabTitle"),
  graphTabBtn: document.getElementById("graphTabBtn"),
  tabNewNoteBtn: document.getElementById("tabNewNoteBtn"),
  folderFilters: document.getElementById("folderFilters"),
  starredList: document.getElementById("starredList"),
  editorGrid: document.getElementById("editorGrid"),
  editor: document.getElementById("editor"),
  preview: document.getElementById("preview"),
  backlinkCount: document.getElementById("backlinkCount"),
  backlinks: document.getElementById("backlinks"),
  noteTags: document.getElementById("noteTags"),
  outgoingCount: document.getElementById("outgoingCount"),
  outgoingLinks: document.getElementById("outgoingLinks"),
  graphStats: document.getElementById("graphStats"),
  graphCard: document.getElementById("graphCard"),
  graph: document.getElementById("graph"),
  graphFullscreenBtn: document.getElementById("graphFullscreenBtn"),
  graphRelayoutBtn: document.getElementById("graphRelayoutBtn"),
  graphResizeHandle: document.getElementById("graphResizeHandle"),
  toast: document.getElementById("toast"),
  commandPalette: document.getElementById("commandPalette"),
  commandInput: document.getElementById("commandInput"),
  commandResults: document.getElementById("commandResults"),
  templatePicker: document.getElementById("templatePicker"),
  templateList: document.getElementById("templateList"),
  closeTemplateBtn: document.getElementById("closeTemplateBtn"),
  vaultDialog: document.getElementById("vaultDialog"),
  vaultDialogTitle: document.getElementById("vaultDialogTitle"),
  vaultDialogInput: document.getElementById("vaultDialogInput"),
  vaultDialogCancelBtn: document.getElementById("vaultDialogCancelBtn"),
  vaultDialogSecondaryBtn: document.getElementById("vaultDialogSecondaryBtn"),
  vaultDialogConfirmBtn: document.getElementById("vaultDialogConfirmBtn"),
  sidebarResizer: document.getElementById("sidebarResizer"),
  inspectorResizer: document.getElementById("inspectorResizer"),
  editorResizer: document.getElementById("editorResizer"),
  securityStatus: document.getElementById("securityStatus"),
  vaultKeyLabel: document.getElementById("vaultKeyLabel"),
  assistantTokenOutput: document.getElementById("assistantTokenOutput"),
  generateTokenBtn: document.getElementById("generateTokenBtn"),
  copyTokenBtn: document.getElementById("copyTokenBtn"),
  securityExportMcpBtn: document.getElementById("securityExportMcpBtn"),
  vaultLockStatus: document.getElementById("vaultLockStatus"),
  vaultPassphraseInput: document.getElementById("vaultPassphraseInput"),
  enableVaultCryptoBtn: document.getElementById("enableVaultCryptoBtn"),
  unlockVaultBtn: document.getElementById("unlockVaultBtn"),
  lockVaultBtn: document.getElementById("lockVaultBtn"),
  snapshotCount: document.getElementById("snapshotCount"),
  snapshotHashLabel: document.getElementById("snapshotHashLabel"),
  createSnapshotBtn: document.getElementById("createSnapshotBtn"),
  exportSnapshotBtn: document.getElementById("exportSnapshotBtn"),
  snapshotsList: document.getElementById("snapshotsList"),
  learningStatus: document.getElementById("learningStatus"),
  memoryTypeChips: document.getElementById("memoryTypeChips"),
  immediateContextSummary: document.getElementById("immediateContextSummary"),
  runEnrichmentBtn: document.getElementById("runEnrichmentBtn"),
  createEnrichmentReportBtn: document.getElementById("createEnrichmentReportBtn"),
  learningMetrics: document.getElementById("learningMetrics"),
  cognitiveScore: document.getElementById("cognitiveScore"),
  cycleMetrics: document.getElementById("cycleMetrics"),
  runDayCycleBtn: document.getElementById("runDayCycleBtn"),
  runNightCycleBtn: document.getElementById("runNightCycleBtn"),
  runWakeCycleBtn: document.getElementById("runWakeCycleBtn"),
  exportCognitiveCronBtn: document.getElementById("exportCognitiveCronBtn"),
  cognitiveCyclesList: document.getElementById("cognitiveCyclesList"),
  suggestionsList: document.getElementById("suggestionsList"),
  repoStatus: document.getElementById("repoStatus"),
  repoNameLabel: document.getElementById("repoNameLabel"),
  repoMetaLine: document.getElementById("repoMetaLine"),
  importRepoBtn: document.getElementById("importRepoBtn"),
  exportRepoBtn: document.getElementById("exportRepoBtn"),
  codeRepoNoteBtn: document.getElementById("codeRepoNoteBtn"),
  repoManifestInput: document.getElementById("repoManifestInput"),
  repoFilesList: document.getElementById("repoFilesList"),
  githubStatus: document.getElementById("githubStatus"),
  githubRepoInput: document.getElementById("githubRepoInput"),
  githubBranchInput: document.getElementById("githubBranchInput"),
  githubPathInput: document.getElementById("githubPathInput"),
  githubMetaLine: document.getElementById("githubMetaLine"),
  githubConnectBtn: document.getElementById("githubConnectBtn"),
  githubScanBtn: document.getElementById("githubScanBtn"),
  githubEnrichBtn: document.getElementById("githubEnrichBtn"),
  githubPushBtn: document.getElementById("githubPushBtn"),
  githubPullBtn: document.getElementById("githubPullBtn"),
  exportGithubContextBtn: document.getElementById("exportGithubContextBtn"),
  importGithubContextBtn: document.getElementById("importGithubContextBtn"),
  githubContextInput: document.getElementById("githubContextInput"),
};

let vaultRegistry: VaultRegistry = initializeVaultRegistry() as VaultRegistry;
let activeVaultId = vaultRegistry.activeId;

const state: AppState = {
  notes: [],
  activeId: null,
  search: "",
  tagFilter: null,
  folderFilter: null,
  view: readVaultStoredValue("view", VIEW_KEY, LEGACY_VIEW_KEY) || "split",
  saveTimer: null,
  starredIds: loadStarredIds(),
  commandItems: [],
  commandIndex: 0,
  vaultDialogMode: "",
  layout: loadLayoutSettings(),
  layoutDragging: null,
  graphFullscreen: false,
  graphPositions: loadGraphPositions(),
  graphRuntimePositions: {},
  graphDragging: null,
  graphClickSuppressed: false,
  security: loadSecurityState(),
  assistantToken: "",
  vaultCryptoKey: null,
  vaultUnlocked: false,
  snapshots: loadSnapshots() as VaultSnapshot[],
  repo: loadRepoState() as JsonObject,
  githubSync: loadGithubSyncState() as JsonObject,
  learningMemory: loadLearningMemory() as JsonObject,
  enrichmentRuns: loadEnrichmentRuns() as EnrichmentRun[],
  cognitiveCycles: loadCognitiveCycles() as CognitiveCycle[],
};

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `note_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function randomBase64Url(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  const padded = String(value || "").replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(String(value || "").length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function createVaultId() {
  return `vlt_${randomBase64Url(18)}`;
}

function vaultStorageKey(kind, vaultId = activeVaultId) {
  return `povmind:vault:${vaultId}:${kind}`;
}

function readVaultStoredValue(kind, primaryLegacyKey = null, secondaryLegacyKey = null, vaultId = activeVaultId) {
  const current = localStorage.getItem(vaultStorageKey(kind, vaultId));
  if (current !== null) return current;
  const primary = primaryLegacyKey ? localStorage.getItem(primaryLegacyKey) : null;
  if (primary !== null) return primary;
  return secondaryLegacyKey ? localStorage.getItem(secondaryLegacyKey) : null;
}

function cleanVaultName(name, fallback = "Vault PovMind") {
  return String(name || fallback).trim().replace(/\s+/g, " ").slice(0, 64) || fallback;
}

function cleanVaultRegistry(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.vaults)) return null;
  const seen = new Set();
  const vaults = value.vaults
    .map((vault) => {
      if (!vault || typeof vault !== "object") return null;
      const id = String(vault.id || "").trim();
      if (!id || seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        name: cleanVaultName(vault.name, "Vault PovMind"),
        createdAt: String(vault.createdAt || nowIso()),
        updatedAt: String(vault.updatedAt || vault.createdAt || nowIso()),
        noteCount: Number.isFinite(Number(vault.noteCount)) ? Number(vault.noteCount) : 0,
        tokenSealed: Boolean(vault.tokenSealed),
      };
    })
    .filter(Boolean);
  if (!vaults.length) return null;
  const storedActive = String(localStorage.getItem(ACTIVE_VAULT_KEY) || value.activeId || "");
  const activeId = vaults.some((vault) => vault.id === storedActive) ? storedActive : vaults[0].id;
  return { version: 1, activeId, vaults };
}

function persistVaultRegistry() {
  vaultRegistry = cleanVaultRegistry(vaultRegistry) || vaultRegistry;
  vaultRegistry.activeId = activeVaultId;
  localStorage.setItem(VAULTS_INDEX_KEY, JSON.stringify(vaultRegistry, null, 2));
  localStorage.setItem(ACTIVE_VAULT_KEY, activeVaultId);
}

function migrateLegacyVaultToNamespaced(vaultId, security) {
  const pairs = [
    ["notes", readStoredValue(STORAGE_KEY, LEGACY_STORAGE_KEY)],
    ["view", readStoredValue(VIEW_KEY, LEGACY_VIEW_KEY)],
    ["graph-layout", readStoredValue(GRAPH_LAYOUT_KEY, LEGACY_GRAPH_LAYOUT_KEY)],
    ["starred", readStoredValue(STARRED_KEY, LEGACY_STARRED_KEY)],
    ["layout", localStorage.getItem(LAYOUT_KEY)],
    ["security", JSON.stringify(security, null, 2)],
    ["doc-vault", localStorage.getItem(DOC_VAULT_KEY)],
    ["snapshots", localStorage.getItem(SNAPSHOTS_KEY)],
    ["repo", localStorage.getItem(REPO_KEY)],
    ["github-sync", localStorage.getItem(GITHUB_SYNC_KEY)],
    ["learning-memory", localStorage.getItem(LEARNING_MEMORY_KEY)],
    ["enrichment-runs", localStorage.getItem(ENRICHMENT_RUNS_KEY)],
    ["cognitive-cycles", localStorage.getItem(COGNITIVE_CYCLES_KEY)],
  ];

  for (const [kind, raw] of pairs) {
    const key = vaultStorageKey(kind, vaultId);
    if (raw !== null && localStorage.getItem(key) === null) localStorage.setItem(key, raw);
  }
}

function initializeVaultRegistry() {
  let parsedRegistry = null;
  try {
    parsedRegistry = JSON.parse(localStorage.getItem(VAULTS_INDEX_KEY) || "null");
  } catch {
    parsedRegistry = null;
  }
  const existing = cleanVaultRegistry(parsedRegistry);
  if (existing) {
    localStorage.setItem(ACTIVE_VAULT_KEY, existing.activeId);
    return existing;
  }

  let legacySecurity = null;
  try {
    legacySecurity = JSON.parse(localStorage.getItem(SECURITY_KEY) || "null");
  } catch {
    legacySecurity = null;
  }
  const security = cleanSecurityState(legacySecurity);
  const now = nowIso();
  const registry = {
    version: 1,
    activeId: security.vaultId,
    vaults: [{
      id: security.vaultId,
      name: "PovMind principal",
      createdAt: now,
      updatedAt: now,
      noteCount: 0,
      tokenSealed: Boolean(security.tokenHash),
    }],
  };
  migrateLegacyVaultToNamespaced(security.vaultId, security);
  localStorage.setItem(VAULTS_INDEX_KEY, JSON.stringify(registry, null, 2));
  localStorage.setItem(ACTIVE_VAULT_KEY, security.vaultId);
  return registry;
}

function activeVaultRecord() {
  return vaultRegistry.vaults.find((vault) => vault.id === activeVaultId) || vaultRegistry.vaults[0] || null;
}

function touchActiveVault() {
  const record = activeVaultRecord();
  if (!record) return;
  record.updatedAt = nowIso();
  record.noteCount = state.notes.length;
  record.tokenSealed = Boolean(state.security?.tokenHash);
  persistVaultRegistry();
}

async function persistActiveVaultBeforeLeaving() {
  if (vaultLocked()) return;
  clearTimeout(state.saveTimer);
  state.saveTimer = null;
  if (vaultEncrypted() && state.vaultCryptoKey) {
    await persistEncryptedNotes(false);
    return;
  }
  persistNow(false);
}

async function sha256Hex(value) {
  if (!crypto.subtle) {
    throw new Error("Web Crypto SHA-256 indisponible dans ce navigateur.");
  }
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cleanEncryptionState(value): VaultEncryptionState {
  const salt = String(value?.salt || "");
  return {
    enabled: Boolean(value?.enabled && salt),
    algorithm: String(value?.algorithm || "AES-GCM-256"),
    kdf: String(value?.kdf || "PBKDF2-SHA-256"),
    iterations: Number.isFinite(Number(value?.iterations)) ? Number(value.iterations) : VAULT_CRYPTO_ITERATIONS,
    salt,
    encryptedAt: String(value?.encryptedAt || ""),
    updatedAt: String(value?.updatedAt || ""),
  };
}

function cleanSecurityState(value, forcedVaultId = null) {
  const encryption = cleanEncryptionState(value?.encryption || null);
  const fallback = {
    version: 1,
    vaultId: forcedVaultId || createVaultId(),
    tokenHash: "",
    tokenHint: "",
    tokenCreatedAt: "",
    tokenRotatedAt: "",
    algorithm: "sha256(vaultId:token)",
    scopes: ["notes:read", "notes:search", "manifest:read", "repo:read", "repo:search"],
    encryption,
  };

  if (!value || typeof value !== "object") return fallback;
  const importedVaultId = String(value.vaultId || "");
  const vaultId = String(forcedVaultId || importedVaultId || fallback.vaultId);
  const tokenStillValid = !forcedVaultId || !importedVaultId || importedVaultId === forcedVaultId;
  return {
    ...fallback,
    vaultId,
    tokenHash: tokenStillValid ? String(value.tokenHash || "") : "",
    tokenHint: tokenStillValid ? String(value.tokenHint || "") : "",
    tokenCreatedAt: String(value.tokenCreatedAt || ""),
    tokenRotatedAt: String(value.tokenRotatedAt || value.tokenCreatedAt || ""),
    algorithm: String(value.algorithm || fallback.algorithm),
    scopes: Array.isArray(value.scopes) ? [...new Set([...value.scopes.map(String), ...fallback.scopes])] : fallback.scopes,
    encryption,
  };
}

function loadSecurityState() {
  try {
    return cleanSecurityState(JSON.parse(localStorage.getItem(vaultStorageKey("security")) || "null"), activeVaultId);
  } catch {
    return cleanSecurityState(null, activeVaultId);
  }
}

function persistSecurityState() {
  localStorage.setItem(vaultStorageKey("security"), JSON.stringify(state.security, null, 2));
  touchActiveVault();
}

function vaultEncrypted() {
  return Boolean(state.security?.encryption?.enabled);
}

function vaultLocked() {
  return vaultEncrypted() && !state.vaultCryptoKey;
}

function encryptedNotesKey(vaultId = activeVaultId) {
  return vaultStorageKey("notes-sealed", vaultId);
}

function requireVaultUnlocked(action = "cette action") {
  if (!vaultLocked()) return true;
  toast(`Déverrouille le vault pour ${action}.`);
  return false;
}

async function deriveVaultCryptoKey(passphrase: string) {
  if (!crypto.subtle) throw new Error("Web Crypto indisponible");
  const salt = state.security.encryption.salt;
  if (!salt) throw new Error("Sel de chiffrement manquant");
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64UrlToBytes(salt),
      iterations: state.security.encryption.iterations || VAULT_CRYPTO_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function notesPlainPayload() {
  return {
    version: 1,
    activeId: state.activeId,
    starredIds: [...state.starredIds],
    snapshots: state.snapshots,
    learningMemory: learningMemoryExportPayload(),
    enrichmentRuns: enrichmentRunsExportPayload(),
    cognitiveCycles: cognitiveCyclesExportPayload(),
    notes: state.notes,
  };
}

async function encryptJsonPayload(payload: JsonObject, key: CryptoKey) {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    version: 1,
    format: "povmind-encrypted-notes",
    algorithm: state.security.encryption.algorithm,
    kdf: state.security.encryption.kdf,
    iterations: state.security.encryption.iterations,
    salt: state.security.encryption.salt,
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(encrypted)),
    updatedAt: nowIso(),
    noteCount: state.notes.length,
  };
}

async function decryptJsonPayload(sealed: JsonObject, key: CryptoKey) {
  const iv = base64UrlToBytes(sealed.iv);
  const ciphertext = base64UrlToBytes(sealed.ciphertext);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function persistEncryptedNotes(showSaved = true) {
  if (!state.vaultCryptoKey) return;
  const sealed = await encryptJsonPayload(notesPlainPayload(), state.vaultCryptoKey);
  localStorage.setItem(encryptedNotesKey(), JSON.stringify(sealed));
  localStorage.removeItem(vaultStorageKey("notes"));
  localStorage.removeItem(vaultStorageKey("snapshots"));
  localStorage.removeItem(vaultStorageKey("starred"));
  localStorage.removeItem(vaultStorageKey("learning-memory"));
  localStorage.removeItem(vaultStorageKey("enrichment-runs"));
  localStorage.removeItem(vaultStorageKey("cognitive-cycles"));
  state.security.encryption.updatedAt = sealed.updatedAt;
  persistSecurityState();
  if (showSaved) els.savedStatus.textContent = "Chiffré";
  touchActiveVault();
}

async function unlockEncryptedVault(passphrase: string) {
  const raw = localStorage.getItem(encryptedNotesKey());
  if (!raw) throw new Error("Aucune donnée chiffrée trouvée");
  const key = await deriveVaultCryptoKey(passphrase);
  const parsed = await decryptJsonPayload(JSON.parse(raw), key);
  state.vaultCryptoKey = key;
  state.vaultUnlocked = true;
  state.notes = Array.isArray(parsed.notes) ? parsed.notes.map(cleanNote).filter(Boolean) : [];
  state.activeId = parsed.activeId && state.notes.some((note) => note.id === parsed.activeId)
    ? parsed.activeId
    : state.notes[0]?.id || null;
  state.starredIds = new Set(Array.isArray(parsed.starredIds)
    ? parsed.starredIds.map(String).filter((id) => state.notes.some((note) => note.id === id))
    : []);
  state.snapshots = Array.isArray(parsed.snapshots)
    ? parsed.snapshots.map(cleanSnapshot).filter(Boolean).slice(0, MAX_SNAPSHOTS)
    : [];
  state.learningMemory = cleanLearningMemory(parsed.learningMemory || null);
  state.enrichmentRuns = Array.isArray(parsed.enrichmentRuns)
    ? parsed.enrichmentRuns.map(cleanEnrichmentRun).filter(Boolean).slice(0, MAX_ENRICHMENT_RUNS) as EnrichmentRun[]
    : [];
  state.cognitiveCycles = Array.isArray(parsed.cognitiveCycles)
    ? parsed.cognitiveCycles.map(cleanCognitiveCycle).filter(Boolean).slice(0, MAX_COGNITIVE_CYCLES) as CognitiveCycle[]
    : [];
  if (!state.starredIds.size && state.activeId) state.starredIds.add(state.activeId);
  persistStarredIds();
}

function assistantTokenHint(token) {
  return `${token.slice(0, 10)}…${token.slice(-8)}`;
}

function securityExportPayload() {
  return {
    version: state.security.version,
    vaultId: state.security.vaultId,
    tokenHash: state.security.tokenHash,
    tokenHint: state.security.tokenHint,
    tokenCreatedAt: state.security.tokenCreatedAt,
    tokenRotatedAt: state.security.tokenRotatedAt,
    algorithm: state.security.algorithm,
    scopes: state.security.scopes,
    encryption: {
      enabled: state.security.encryption.enabled,
      algorithm: state.security.encryption.algorithm,
      kdf: state.security.encryption.kdf,
      iterations: state.security.encryption.iterations,
      encryptedAt: state.security.encryption.encryptedAt,
      updatedAt: state.security.encryption.updatedAt,
    },
  };
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function cleanSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const payload = snapshot.payload && typeof snapshot.payload === "object" ? snapshot.payload : null;
  const createdAt = String(snapshot.createdAt || payload?.createdAt || nowIso());
  const hash = String(snapshot.hash || snapshot.contentHash || payload?.contentHash || "");
  if (!hash) return null;
  return {
    version: 1,
    id: String(snapshot.id || payload?.snapshotId || `vault@${createdAt}`),
    createdAt,
    hash,
    hashAlgorithm: String(snapshot.hashAlgorithm || payload?.hashAlgorithm || "sha256(canonical snapshot.content)"),
    summary: snapshot.summary && typeof snapshot.summary === "object" ? snapshot.summary : {},
    payload,
  };
}

function loadSnapshots() {
  try {
    const parsed = JSON.parse(localStorage.getItem(vaultStorageKey("snapshots")) || "[]");
    return Array.isArray(parsed) ? parsed.map(cleanSnapshot).filter(Boolean).slice(0, MAX_SNAPSHOTS) : [];
  } catch {
    return [];
  }
}

function persistSnapshots() {
  if (vaultEncrypted()) {
    localStorage.removeItem(vaultStorageKey("snapshots"));
    void persistEncryptedNotes(false).catch((error) => {
      console.error(error);
      toast("Sauvegarde chiffrée des snapshots impossible.");
    });
    return;
  }
  localStorage.setItem(vaultStorageKey("snapshots"), JSON.stringify(state.snapshots.slice(0, MAX_SNAPSHOTS), null, 2));
  touchActiveVault();
}

function latestSnapshot() {
  return state.snapshots[0] || null;
}

function previousSnapshotFor(snapshot = latestSnapshot()) {
  if (!snapshot) return null;
  return state.snapshots.find((item) => item.id !== snapshot.id) || null;
}

function cleanRepoFile(file) {
  if (!file || typeof file !== "object") return null;
  const filePath = String(file.path || "").replaceAll("\\", "/").replace(/^\/+/, "");
  if (!filePath) return null;
  return {
    path: filePath,
    bytes: Number.isFinite(Number(file.bytes)) ? Number(file.bytes) : 0,
    hash: String(file.hash || ""),
    language: String(file.language || ""),
    preview: String(file.preview || "").slice(0, 1200),
    content: typeof file.content === "string" ? file.content : "",
    exportPath: String(file.exportPath || ""),
  };
}

function cleanRepoState(value) {
  const fallback = {
    format: "povmind-repo-manifest",
    version: 1,
    linked: false,
    importedAt: "",
    generatedAt: "",
    name: "",
    root: "",
    localPath: "",
    remote: "",
    branch: "",
    commit: "",
    dirty: null,
    treeHash: "",
    fileCount: 0,
    indexedCount: 0,
    policy: {
      mode: "read-only",
      secretsExcluded: true,
      respectsGitignore: true,
    },
    files: [],
  };

  if (!value || typeof value !== "object") return fallback;
  const files = Array.isArray(value.files) ? value.files.map(cleanRepoFile).filter(Boolean) : [];
  return {
    ...fallback,
    ...value,
    format: String(value.format || fallback.format),
    version: Number(value.version || 1),
    linked: Boolean(value.linked || files.length || value.treeHash),
    importedAt: String(value.importedAt || ""),
    generatedAt: String(value.generatedAt || ""),
    name: String(value.name || value.root || fallback.name),
    root: String(value.root || ""),
    localPath: String(value.localPath || ""),
    remote: String(value.remote || ""),
    branch: String(value.branch || ""),
    commit: String(value.commit || ""),
    dirty: typeof value.dirty === "boolean" ? value.dirty : null,
    treeHash: String(value.treeHash || ""),
    fileCount: Number.isFinite(Number(value.fileCount)) ? Number(value.fileCount) : files.length,
    indexedCount: Number.isFinite(Number(value.indexedCount)) ? Number(value.indexedCount) : files.length,
    policy: value.policy && typeof value.policy === "object" ? { ...fallback.policy, ...value.policy } : fallback.policy,
    files,
  };
}

function loadRepoState() {
  try {
    return cleanRepoState(JSON.parse(localStorage.getItem(vaultStorageKey("repo")) || "null"));
  } catch {
    return cleanRepoState(null);
  }
}

function persistRepoState() {
  localStorage.setItem(vaultStorageKey("repo"), JSON.stringify(state.repo, null, 2));
  touchActiveVault();
}

function repoIsLinked() {
  return Boolean(state.repo?.linked && (state.repo.treeHash || state.repo.files?.length || state.repo.name));
}

function repoSummaryPayload() {
  const repo = cleanRepoState(state.repo);
  return {
    linked: repoIsLinked(),
    name: repo.name,
    root: repo.root,
    remote: repo.remote,
    branch: repo.branch,
    commit: repo.commit,
    dirty: repo.dirty,
    generatedAt: repo.generatedAt,
    importedAt: repo.importedAt,
    treeHash: repo.treeHash,
    fileCount: repo.fileCount,
    indexedCount: repo.indexedCount,
    policy: repo.policy,
  };
}

function repoExportPayload(includeFiles = true) {
  const repo = cleanRepoState(state.repo);
  return {
    format: "povmind-repo-manifest",
    version: 1,
    exportedAt: nowIso(),
    ...repoSummaryPayload(),
    files: includeFiles ? repo.files.map((file) => ({ ...file })) : [],
  };
}

function cleanGithubRepoFullName(value) {
  const withoutUrl = String(value || "")
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\.git$/i, "")
    .split(/[?#]/)[0]
    .replace(/^\/+|\/+$/g, "");
  const parts = withoutUrl.split("/").filter(Boolean).slice(0, 2);
  if (parts.length !== 2) return "";
  return parts
    .map((part) => part.replace(/[^a-z0-9_.-]/gi, "").slice(0, 64))
    .filter(Boolean)
    .join("/");
}

function cleanGithubBranch(value) {
  return String(value || "main")
    .trim()
    .replace(/[^a-z0-9_./-]/gi, "")
    .replace(/^\/+|\/+$/g, "")
    .slice(0, 120) || "main";
}

function cleanGithubBasePath(value) {
  const clean = String(value || ".povmind")
    .trim()
    .replaceAll("\\", "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/")
    .slice(0, 160);
  return clean || ".povmind";
}

function cleanGithubSyncState(value) {
  const fallback = {
    format: "povmind-github-sync",
    version: 1,
    provider: "github",
    repoFullName: "",
    branch: "main",
    basePath: ".povmind",
    lastSyncedAt: "",
    lastCommit: "",
    lastDirection: "",
    connector: {
      configured: false,
      authenticated: false,
      tokenStorage: "server-http-only",
    },
  };

  if (!value || typeof value !== "object") return fallback;
  return {
    ...fallback,
    ...value,
    format: "povmind-github-sync",
    version: Number(value.version || 1),
    provider: "github",
    repoFullName: cleanGithubRepoFullName(value.repoFullName || value.repo || value.remote),
    branch: cleanGithubBranch(value.branch),
    basePath: cleanGithubBasePath(value.basePath || value.path),
    lastSyncedAt: String(value.lastSyncedAt || ""),
    lastCommit: String(value.lastCommit || ""),
    lastDirection: String(value.lastDirection || ""),
    connector: {
      ...fallback.connector,
      ...(value.connector && typeof value.connector === "object" ? value.connector : {}),
    },
  };
}

function loadGithubSyncState() {
  try {
    return cleanGithubSyncState(JSON.parse(localStorage.getItem(vaultStorageKey("github-sync")) || "null"));
  } catch {
    return cleanGithubSyncState(null);
  }
}

function persistGithubSyncState() {
  state.githubSync = cleanGithubSyncState(state.githubSync);
  localStorage.setItem(vaultStorageKey("github-sync"), JSON.stringify(state.githubSync, null, 2));
  touchActiveVault();
}

function githubSyncExportPayload() {
  const sync = cleanGithubSyncState(state.githubSync);
  return {
    format: sync.format,
    version: sync.version,
    provider: sync.provider,
    repoFullName: sync.repoFullName,
    branch: sync.branch,
    basePath: sync.basePath,
    lastSyncedAt: sync.lastSyncedAt,
    lastCommit: sync.lastCommit,
    lastDirection: sync.lastDirection,
    connector: {
      configured: Boolean(sync.connector.configured),
      authenticated: Boolean(sync.connector.authenticated),
      tokenStorage: "server-http-only",
    },
  };
}

function memoryTypeIds() {
  return MEMORY_TYPES.map((type) => type.id);
}

function memoryTypeById(typeId) {
  return MEMORY_TYPES.find((type) => type.id === typeId) || null;
}

function cleanMemoryTypes(value) {
  const allowed = new Set(memoryTypeIds());
  const values = Array.isArray(value) ? value : String(value || "").split(/[,\s]+/);
  return [...new Set(values.map((item) => String(item || "").trim()).filter((item) => allowed.has(item)))];
}

function defaultMemoryWeights() {
  return Object.fromEntries(MEMORY_TYPES.map((type) => [type.id, 1]));
}

function cleanLearningMemory(value) {
  const feedback = value?.feedback && typeof value.feedback === "object" ? value.feedback : {};
  const weights = value?.memoryWeights && typeof value.memoryWeights === "object" ? value.memoryWeights : {};
  return {
    format: "povmind-learning-memory",
    version: 1,
    updatedAt: String(value?.updatedAt || ""),
    feedback: {
      accepted: Number.isFinite(Number(feedback.accepted)) ? Number(feedback.accepted) : 0,
      rejected: Number.isFinite(Number(feedback.rejected)) ? Number(feedback.rejected) : 0,
      modified: Number.isFinite(Number(feedback.modified)) ? Number(feedback.modified) : 0,
      autoApplied: Number.isFinite(Number(feedback.autoApplied)) ? Number(feedback.autoApplied) : 0,
    },
    acceptedPatterns: Array.isArray(value?.acceptedPatterns) ? value.acceptedPatterns.slice(0, 80) : [],
    rejectedPatterns: Array.isArray(value?.rejectedPatterns) ? value.rejectedPatterns.slice(0, 80) : [],
    confidenceRules: Array.isArray(value?.confidenceRules) ? value.confidenceRules.slice(0, 40) : [],
    memoryWeights: {
      ...defaultMemoryWeights(),
      ...Object.fromEntries(Object.entries(weights).map(([key, number]) => [key, Number.isFinite(Number(number)) ? Number(number) : 1])),
    },
    lastReward: Number.isFinite(Number(value?.lastReward)) ? Number(value.lastReward) : 0,
  };
}

function loadLearningMemory() {
  try {
    return cleanLearningMemory(JSON.parse(readVaultStoredValue("learning-memory", LEARNING_MEMORY_KEY) || "null"));
  } catch {
    return cleanLearningMemory(null);
  }
}

function persistLearningMemory() {
  state.learningMemory = cleanLearningMemory({
    ...state.learningMemory,
    updatedAt: nowIso(),
  });
  if (vaultEncrypted()) {
    localStorage.removeItem(vaultStorageKey("learning-memory"));
    void persistEncryptedNotes(false).catch((error) => {
      console.error(error);
      toast("Sauvegarde chiffrée de la mémoire impossible.");
    });
    return;
  }
  localStorage.setItem(vaultStorageKey("learning-memory"), JSON.stringify(state.learningMemory, null, 2));
  touchActiveVault();
}

function cleanProposal(proposal) {
  if (!proposal || typeof proposal !== "object") return null;
  const createdAt = String(proposal.createdAt || nowIso());
  return {
    id: String(proposal.id || `proposal_${uid()}`),
    type: String(proposal.type || "review"),
    title: String(proposal.title || "Suggestion"),
    detail: String(proposal.detail || ""),
    status: ["pending", "accepted", "rejected", "modified"].includes(String(proposal.status)) ? String(proposal.status) : "pending",
    confidence: clamp(Number(proposal.confidence || 0.65), 0, 1),
    risk: String(proposal.risk || "low"),
    targetId: String(proposal.targetId || ""),
    targetTitle: String(proposal.targetTitle || ""),
    evidence: Array.isArray(proposal.evidence) ? proposal.evidence.slice(0, 12) : [],
    createdAt,
    appliedAt: String(proposal.appliedAt || ""),
  };
}

function cleanEnrichmentRun(run) {
  if (!run || typeof run !== "object") return null;
  const createdAt = String(run.createdAt || nowIso());
  const proposals = Array.isArray(run.proposals) ? run.proposals.map(cleanProposal).filter(Boolean) : [];
  return {
    id: String(run.id || `enrich@${createdAt}`),
    createdAt,
    source: String(run.source || "vault-local"),
    mode: String(run.mode || "review"),
    input: run.input && typeof run.input === "object" ? run.input : {},
    proposals,
  };
}

function loadEnrichmentRuns() {
  try {
    const parsed = JSON.parse(readVaultStoredValue("enrichment-runs", ENRICHMENT_RUNS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(cleanEnrichmentRun).filter(Boolean).slice(0, MAX_ENRICHMENT_RUNS) : [];
  } catch {
    return [];
  }
}

function persistEnrichmentRuns() {
  state.enrichmentRuns = state.enrichmentRuns.map(cleanEnrichmentRun).filter(Boolean).slice(0, MAX_ENRICHMENT_RUNS) as EnrichmentRun[];
  if (vaultEncrypted()) {
    localStorage.removeItem(vaultStorageKey("enrichment-runs"));
    void persistEncryptedNotes(false).catch((error) => {
      console.error(error);
      toast("Sauvegarde chiffrée des analyses impossible.");
    });
    return;
  }
  localStorage.setItem(vaultStorageKey("enrichment-runs"), JSON.stringify(state.enrichmentRuns, null, 2));
  touchActiveVault();
}

function learningMemoryExportPayload() {
  return cleanLearningMemory(state.learningMemory);
}

function enrichmentRunsExportPayload() {
  return state.enrichmentRuns.map(cleanEnrichmentRun).filter(Boolean);
}

function cleanCognitiveCycle(cycle) {
  if (!cycle || typeof cycle !== "object") return null;
  const createdAt = String(cycle.createdAt || nowIso());
  return {
    id: String(cycle.id || `cycle@${createdAt}`),
    createdAt,
    phase: String(cycle.phase || "day"),
    source: String(cycle.source || "manual"),
    runId: String(cycle.runId || ""),
    snapshotId: String(cycle.snapshotId || ""),
    snapshotHash: String(cycle.snapshotHash || ""),
    score: cycle.score && typeof cycle.score === "object" ? cycle.score : {},
    summary: String(cycle.summary || ""),
    outputs: Array.isArray(cycle.outputs) ? cycle.outputs.slice(0, 12) : [],
  };
}

function loadCognitiveCycles() {
  try {
    const parsed = JSON.parse(readVaultStoredValue("cognitive-cycles", COGNITIVE_CYCLES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(cleanCognitiveCycle).filter(Boolean).slice(0, MAX_COGNITIVE_CYCLES) : [];
  } catch {
    return [];
  }
}

function persistCognitiveCycles() {
  state.cognitiveCycles = state.cognitiveCycles.map(cleanCognitiveCycle).filter(Boolean).slice(0, MAX_COGNITIVE_CYCLES) as CognitiveCycle[];
  if (vaultEncrypted()) {
    localStorage.removeItem(vaultStorageKey("cognitive-cycles"));
    void persistEncryptedNotes(false).catch((error) => {
      console.error(error);
      toast("Sauvegarde chiffrée des cycles impossible.");
    });
    return;
  }
  localStorage.setItem(vaultStorageKey("cognitive-cycles"), JSON.stringify(state.cognitiveCycles, null, 2));
  touchActiveVault();
}

function cognitiveCyclesExportPayload() {
  return state.cognitiveCycles.map(cleanCognitiveCycle).filter(Boolean);
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeTitle(title) {
  return (title || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR");
}

function normalizeFolder(folder) {
  return String(folder || ROOT_FOLDER).trim().replace(/\s+/g, " ") || ROOT_FOLDER;
}

function normalizePathKey(path) {
  return String(path || "")
    .replaceAll("\\", "/")
    .replace(/\.md$/i, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fr-FR");
}

function decodeObsidianPath(value) {
  const text = String(value || "").replaceAll("\\", "/").trim();
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function stripMarkdownExtension(value) {
  return String(value || "").replace(/\.md$/i, "");
}

function basenameWithoutMarkdown(path) {
  const cleanPath = stripMarkdownExtension(decodeObsidianPath(path).replaceAll("\\", "/"));
  return cleanPath.split("/").filter(Boolean).pop() || "Sans titre";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function attr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function clampText(value, limit = 120) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function truncateText(value, limit = 12000) {
  const text = String(value || "");
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n[contenu tronqué par PovMind : ${text.length - limit} caractère(s) restant(s)]`;
}

function formatDate(iso) {
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

function readStoredValue(key, legacyKey) {
  const current = localStorage.getItem(key);
  if (current !== null) return current;
  return legacyKey ? localStorage.getItem(legacyKey) : null;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function loadLayoutSettings() {
  try {
    const parsed = JSON.parse(readVaultStoredValue("layout", LAYOUT_KEY) || "{}");
    return {
      sidebarWidth: finiteNumber(parsed.sidebarWidth) || DEFAULT_LAYOUT.sidebarWidth,
      inspectorWidth: finiteNumber(parsed.inspectorWidth) || DEFAULT_LAYOUT.inspectorWidth,
      editorPaneWidth: finiteNumber(parsed.editorPaneWidth),
      graphHeight: finiteNumber(parsed.graphHeight) || DEFAULT_LAYOUT.graphHeight,
    };
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

function persistLayoutSettings() {
  localStorage.setItem(
    vaultStorageKey("layout"),
    JSON.stringify({
      version: 1,
      sidebarWidth: state.layout.sidebarWidth,
      inspectorWidth: state.layout.inspectorWidth,
      editorPaneWidth: state.layout.editorPaneWidth,
      graphHeight: state.layout.graphHeight,
    })
  );
}

function clampLayout(preferredKind = null) {
  const total = window.innerWidth || 1280;
  const minWorkspace = total >= 1440 ? 640 : 600;
  const handles = 16;
  const minSidebar = 240;
  const minInspector = 280;
  const maxCombinedSidebars = Math.max(minSidebar + minInspector, total - handles - minWorkspace);
  const maxSidebar = Math.min(480, Math.max(minSidebar, maxCombinedSidebars - minInspector));
  const maxInspector = Math.min(540, Math.max(minInspector, maxCombinedSidebars - minSidebar));

  state.layout.sidebarWidth = clamp(state.layout.sidebarWidth, minSidebar, maxSidebar);
  state.layout.inspectorWidth = clamp(state.layout.inspectorWidth, minInspector, maxInspector);

  const combined = state.layout.sidebarWidth + state.layout.inspectorWidth;
  if (combined > maxCombinedSidebars) {
    if (preferredKind === "sidebar") {
      state.layout.sidebarWidth = clamp(maxCombinedSidebars - state.layout.inspectorWidth, minSidebar, maxSidebar);
    } else if (preferredKind === "inspector") {
      state.layout.inspectorWidth = clamp(maxCombinedSidebars - state.layout.sidebarWidth, minInspector, maxInspector);
    } else {
      state.layout.inspectorWidth = clamp(maxCombinedSidebars - state.layout.sidebarWidth, minInspector, maxInspector);
      if (state.layout.sidebarWidth + state.layout.inspectorWidth > maxCombinedSidebars) {
        state.layout.sidebarWidth = clamp(maxCombinedSidebars - state.layout.inspectorWidth, minSidebar, maxSidebar);
      }
    }
  }

  if (state.layout.editorPaneWidth) {
    state.layout.editorPaneWidth = clampEditorPaneWidth(state.layout.editorPaneWidth);
  }
  state.layout.graphHeight = clampGraphHeight(state.layout.graphHeight);
}

function clampGraphHeight(height) {
  return clamp(finiteNumber(height) || DEFAULT_LAYOUT.graphHeight, 260, Math.max(420, Math.min(820, window.innerHeight - 120)));
}

function clampEditorPaneWidth(width) {
  const grid = els.editorGrid;
  const gridWidth = grid?.getBoundingClientRect().width || 0;
  if (!gridWidth) return width;
  const resizerWidth = 8;
  const gaps = 16;
  const available = gridWidth - resizerWidth - gaps;
  const minPane = 260;
  if (available < minPane * 2) return Math.max(180, available / 2);
  return clamp(width, minPane, available - minPane);
}

function applyLayoutSettings(preferredKind = null) {
  clampLayout(preferredKind);
  const root = document.documentElement;
  root.style.setProperty("--sidebar-width", `${state.layout.sidebarWidth}px`);
  root.style.setProperty("--inspector-width", `${state.layout.inspectorWidth}px`);
  root.style.setProperty(
    "--editor-pane-width",
    state.layout.editorPaneWidth ? `${state.layout.editorPaneWidth}px` : "1fr"
  );
  root.style.setProperty("--graph-height", `${state.layout.graphHeight}px`);
}

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLongDate(date = new Date()) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function loadStarredIds(): Set<string> {
  try {
    const parsed = JSON.parse(readVaultStoredValue("starred", STARRED_KEY, LEGACY_STARRED_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

function persistStarredIds() {
  if (vaultEncrypted()) {
    localStorage.removeItem(vaultStorageKey("starred"));
    touchActiveVault();
    return;
  }
  localStorage.setItem(vaultStorageKey("starred"), JSON.stringify([...state.starredIds]));
  touchActiveVault();
}

function isStarred(noteId) {
  return state.starredIds.has(noteId);
}

function seedNotes() {
  const createdAt = nowIso();
  return [
    {
      id: uid(),
      title: "Accueil",
      folder: ROOT_FOLDER,
      body: `# Bienvenue dans ${APP_NAME}\n\nCette app est un vault Markdown local pensé pour des carnets de notes connectés, avec une trajectoire vers des accès assistants sécurisés.\n\nCommence par créer une note, puis relie-la avec des liens de type [[Projet Alpha]] ou [[Idées]].\n\n## Fonctions incluses\n\n- Éditeur Markdown avec aperçu instantané\n- Liens wiki entre notes : [[Projet Alpha]]\n- Backlinks automatiques\n- Dossiers, favoris et templates\n- Graphe des connexions\n- Recherche et tags comme #demo ou #productivité\n- Export/import du carnet en JSON\n\n> Astuce : clique sur un lien bleu en pointillés pour créer la note manquante.`,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uid(),
      title: "Projet Alpha",
      folder: "Projets",
      body: `# Projet Alpha\n\nObjectif : construire une base de connaissances personnelle.\n\n## Liens utiles\n\n- Retour à [[Accueil]]\n- Brainstorming dans [[Idées]]\n- Suivi hebdomadaire dans [[Journal]]\n\n## Prochaine action\n\nCréer une vraie page pour chaque sujet important. #projet`,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uid(),
      title: "Idées",
      folder: "Recherche",
      body: `# Idées\n\n- Ajouter une palette de commandes\n- Ajouter une synchronisation fichier plus tard\n- Créer des modèles de notes\n- Transformer certains backlinks en tâches\n\nRelié à [[Accueil]] et [[Projet Alpha]]. #brainstorm`,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uid(),
      title: "Journal",
      folder: "Journal",
      body: `# Journal\n\n## Aujourd'hui\n\nJ'ai installé ${APP_NAME} et testé les liens [[Accueil]] → [[Projet Alpha]].\n\n## Notes rapides\n\nUtilise #journal pour retrouver les entrées quotidiennes.`,
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

function documentationVaultNotes() {
  return [
    {
      title: "PovMind - Index",
      folder: "Documentation PovMind",
      body: `# PovMind - Index\n\nCe dossier documente l'app PovMind de l'intérieur. Il sert de contexte vivant pour améliorer le produit en conditions réelles.\n\n## Cartographie\n\n- [[PovMind - Architecture]]\n- [[PovMind - Interface Obsidian]]\n- [[PovMind - Sécurité et tokens]]\n- [[PovMind - Auth et multivault]]\n- [[PovMind - MCP assistant]]\n- [[PovMind - Snapshots du vault]]\n- [[PovMind - Code repo]]\n- [[PovMind - Repo en vault dev]]\n- [[PovMind - GitHub repo]]\n- [[PovMind - GitHub sync]]\n- [[PovMind - Boucle cognitive]]\n- [[PovMind - Déploiement Cloud Run]]\n- [[PovMind - Backlog contexte]]\n\n## Usage grandeur nature\n\n1. On documente une décision dans ce vault.\n2. On exporte le bundle MCP ou Codex KB.\n3. L'assistant lit ce contexte et propose une amélioration.\n4. On réinjecte la décision dans PovMind.\n\n#povmind #documentation #contexte`,
    },
    {
      title: "PovMind - Architecture",
      folder: "Documentation PovMind",
      body: `# PovMind - Architecture\n\nPovMind est une application HTML/CSS avec un coeur TypeScript compile en JavaScript navigateur. Elle reste servie comme un vault statique local-first.\n\n## Fichiers principaux\n\n- \`index.html\` : structure de l'interface.\n- \`styles.css\` : identité visuelle People of Verso, panneaux redimensionnables et responsive.\n- \`src/app.ts\` : source TypeScript du modèle de notes, rendu Markdown, backlinks, graphe, exports et sécurité.\n- \`app.js\` : fichier généré par \`npm run build\` et chargé par le navigateur.\n- \`tsconfig.json\` : configuration de compilation TypeScript vers un bundle navigateur sans framework.\n- \`server.js\` : serveur statique Node pour Cloud Run avec headers sécurité et connecteur GitHub OAuth.\n- \`sw.js\` et \`manifest.json\` : PWA/cache.\n- \`.github/workflows/ci.yml\` : vérification GitHub Actions avec build TypeScript.\n\n## Stockage local\n\nLes notes sont stockées dans \`localStorage\` sous \`povmind:vault:{vaultId}:notes\`. Les préférences de vue, graphe, favoris, layout, repo, snapshots, GitHub sync et accès assistant utilisent des clés isolées par vault.\n\n## Surfaces métier\n\n- Éditeur Markdown + aperçu.\n- Liens wiki \`[[note]]\`, backlinks et liens sortants.\n- Graphe navigable et redimensionnable.\n- Import Obsidian depuis un dossier local, export JSON, export Codex KB et export MCP.\n- Connexion à un repo de code via manifeste ou scan GitHub en vault de contexte dev.\n- Publication GitHub avec CI comme source exécutable.\n- Synchronisation d'un contexte \`.povmind/\` avec \`AGENTS.md\` pour relier notes, snapshots et repo.\n\n## Frontières TypeScript\n\nLes premiers types couvrent \`Note\`, \`VaultRegistry\`, \`SecurityState\`, \`VaultSnapshot\`, \`LayoutSettings\` et \`AppState\`. La prochaine étape est d'extraire ces modèles dans des modules dédiés.\n\nVoir aussi [[PovMind - Sécurité et tokens]], [[PovMind - Code repo]], [[PovMind - Repo en vault dev]], [[PovMind - GitHub repo]] et [[PovMind - GitHub sync]]. #povmind #architecture #typescript`,
    },
    {
      title: "PovMind - Interface Obsidian",
      folder: "Documentation PovMind",
      body: `# PovMind - Interface Obsidian\n\nDécision du 2026-05-06 : PovMind doit se manipuler comme un vrai workbench de connaissance, proche de la structure Obsidian, tout en gardant l'identité People of Verso.\n\n## Structure retenue\n\n- Rail gauche d'actions rapides : nouvelle note, recherche, graphe, journal, export MCP.\n- Explorateur de vault à gauche : vault actif, création/renommage, notes, dossiers et recherche.\n- Onglets de travail au centre : note active, vue graphique et création rapide.\n- Workspace central : titre, dossier, actions de note, éditeur Markdown et aperçu.\n- Panneau contexte à droite : accès assistant, snapshots, repo de code, backlinks et graphe.\n- Redimensionnement conservé pour la navigation, l'éditeur, le panneau contexte et le graphe.\n- Graphe accessible depuis un onglet et affichable en plein écran même quand le panneau droit est masqué.\n\n## Intention UX\n\nL'app ne doit pas ressembler à une landing page. Elle doit être un cockpit dense, lisible et durable pour travailler avec des notes, un repo, des snapshots et des assistants sécurisés.\n\n## Style\n\n- Fond sombre, panneaux sobres, séparateurs nets.\n- Rouge People of Verso réservé aux actions primaires et états actifs.\n- Cartes limitées aux vrais modules fonctionnels, sans décoration marketing.\n- Typographie compacte et scannable pour une utilisation répétée.\n\nVoir [[PovMind - Architecture]], [[PovMind - Auth et multivault]] et [[PovMind - MCP assistant]]. #povmind #ui #obsidian`,
    },
    {
      title: "PovMind - Sécurité et tokens",
      folder: "Documentation PovMind",
      body: `# PovMind - Sécurité et tokens\n\nL'objectif est de donner à chaque vault une clef solide pour contrôler l'accès local et l'accès assistant.\n\n## Ce qui est en place\n\n- Chaque vault possède un \`vaultId\` cryptographiquement aléatoire.\n- Le bouton “Nouveau token” génère un token aléatoire \`povm_...\` avec \`crypto.getRandomValues\`.\n- PovMind stocke seulement l'empreinte \`SHA-256(vaultId:token)\`, jamais le secret complet.\n- L'export MCP embarque l'empreinte et le \`vaultId\`; le serveur MCP demande le token via \`POVMIND_VAULT_TOKEN\`.\n- La politique d'accès déclare les scopes \`notes:read\`, \`notes:search\`, \`manifest:read\`, \`repo:read\` et \`repo:search\`.\n- Le vault peut être chiffré localement avec Web Crypto : passphrase -> PBKDF2-SHA-256 -> clé AES-GCM-256.\n- Quand le chiffrement est actif, les notes sont stockées dans \`povmind:vault:{vaultId}:notes-sealed\` et la clé reste uniquement en mémoire.\n- Le verrouillage efface les notes de l'état UI et retire la clé de session.\n\n## Ce que cela protège\n\nLe bundle MCP ne peut pas être lu par un assistant sans le token correspondant. Les notes locales chiffrées ne sont pas lisibles dans \`localStorage\` sans la passphrase du vault.\n\n## Limites assumées\n\n- La passphrase n'est pas récupérable si elle est perdue.\n- Un export JSON, Codex ou MCP réalisé vault déverrouillé contient volontairement les notes en clair dans le fichier exporté.\n- Les métadonnées non sensibles comme le registre de vaults, certains réglages et l'existence du vault restent locales hors chiffrement.\n- Un navigateur déjà compromis peut lire ce qui est déverrouillé en mémoire.\n\n## À ajouter plus tard\n\n- Rotation de passphrase avec réchiffrement.\n- Tokens par assistant ou par rôle.\n- Journal d'accès côté backend si PovMind devient multi-utilisateur.\n- Mode cloud avec objets chiffrés avant synchronisation.\n\nVoir [[PovMind - MCP assistant]] et [[PovMind - Auth et multivault]]. #povmind #securite`,
    },
    {
      title: "PovMind - Auth et multivault",
      folder: "Documentation PovMind",
      body: `# PovMind - Auth et multivault

État produit au 2026-05-06 : l'auth assistant est fonctionnelle, le multivault local-first est en place, la sync GitHub est amorcée via Cloud Run/OAuth et le chiffrement local du vault est disponible.

## Déjà en place

- \`vaultId\` cryptographique par vault.
- Registre local \`povmind:vaults:index\` avec vault actif.
- Stockage isolé par \`povmind:vault:{vaultId}:...\` pour sécurité, repo, GitHub sync, layout et graphe.
- Notes et snapshots chiffrables localement dans \`povmind:vault:{vaultId}:notes-sealed\`.
- Sélecteur de vault dans la sidebar : ouvrir, créer, renommer.
- Migration douce du vault historique vers le premier vault local.
- Token assistant \`povm_...\` généré côté navigateur.
- Stockage uniquement de \`SHA-256(vaultId:token)\`.
- Export MCP verrouillé par \`POVMIND_VAULT_TOKEN\`.
- Scopes déjà modélisés : \`notes:read\`, \`notes:search\`, \`manifest:read\`, \`repo:read\`, \`repo:search\`.
- Snapshots reliés au vault, au commit repo, au \`repoTreeHash\` et à la cible GitHub.
- Export \`.povmind/\` + \`AGENTS.md\` pour versionner le contexte dans un repo.

## Pas encore en place

- Pas de login utilisateur complet.
- Pas de backend de comptes et d'équipes.
- Pas encore de token par assistant, de révocation fine ou de journal d'accès.
- Pas encore de rotation de passphrase avec réchiffrement.
- Pas encore de suppression/restauration de vault avec confirmation forte.
- Le connecteur GitHub doit encore être configuré en production avec les secrets OAuth.

## Architecture actuelle

\`\`\`txt
povmind:vaults:index
povmind:vaults:active
povmind:vault:{vaultId}:notes
povmind:vault:{vaultId}:notes-sealed
povmind:vault:{vaultId}:security
povmind:vault:{vaultId}:repo
povmind:vault:{vaultId}:snapshots
povmind:vault:{vaultId}:github-sync
povmind:vault:{vaultId}:layout
povmind:vault:{vaultId}:graph-layout
povmind:vault:{vaultId}:starred
\`\`\`

Quand le chiffrement est actif, \`notes\`, \`snapshots\` et \`starred\` en clair sont retirés et remplacés par \`notes-sealed\`.

## Ordre d'implémentation recommandé

1. Ajouter import “comme nouveau vault”.
2. Ajouter export complet du registre de vaults.
3. Ajouter les tokens par assistant avec scopes et révocation.
4. Ajouter rotation de passphrase et réchiffrement.
5. Durcir le connecteur Cloud Run GitHub avec audit log et révocation.
6. Ajouter auth utilisateur Google/GitHub quand la sync cloud devient multi-appareil.

## Décision produit

Le coeur de PovMind doit rester local-first. Le cloud doit synchroniser des vaults verrouillés, pas devenir la source unique de confiance.

Voir [[PovMind - Sécurité et tokens]], [[PovMind - MCP assistant]], [[PovMind - GitHub sync]] et [[PovMind - Backlog contexte]]. #auth #multivault #securite`,
    },
    {
      title: "PovMind - Snapshots du vault",
      folder: "Documentation PovMind",
      body: `# PovMind - Snapshots du vault\n\nUn snapshot fige l'état exact du vault à un instant donné. Le journal raconte le pourquoi; le snapshot conserve le quoi.\n\n## Contenu d'un snapshot\n\n- Notes complètes.\n- Note active et favoris.\n- Graphe et positions de nœuds.\n- Layout et mode de vue.\n- Manifest Codex/MCP.\n- Manifest repo lié, commit et \`repoTreeHash\`.\n- Politique token assistant, sans secret complet.\n- Hash global \`contentHash\` calculé sur un JSON canonique.\n\n## Rôle du hash global\n\nLe hash permet à un assistant de dire : “je travaille sur le contexte exact \`sha256:...\`”. Si le vault change, le prochain snapshot aura un autre hash.\n\n## Delta\n\nLe cycle Réveil compare les deux derniers snapshots et produit un agenda humain : ajouts, modifications, retraits, changement de repo et prochaine action à valider.\n\n## Relation avec le journal\n\nLe journal reste utile pour les décisions humaines. Le snapshot sert de preuve d'état et de point de restauration/export.\n\n## À améliorer\n\n- Restaurer un snapshot après confirmation.\n- Créer un changelog depuis le journal.\n- Ajouter des snapshots signés avec une clef du vault.\n- Comparer un snapshot avec un commit repo.\n\n#povmind #snapshot #versioning`,
    },
    {
      title: "PovMind - Code repo",
      folder: "Documentation PovMind",
      body: `# PovMind - Code repo\n\nLe principe du vault est d'ancrer la mémoire au code réel. Un vault utile doit connaître le repo auquel il se rapporte.\n\n## Rôle du repo dans PovMind\n\n- Le vault documente les décisions, le contexte et les liens.\n- Le repo contient le code exécutable, les tests et l'historique Git.\n- Le snapshot lie les deux avec \`vaultHash\` + \`repoCommit\` + \`repoTreeHash\`.\n- L'export MCP expose le repo en lecture seule pour que l'assistant cite et inspecte le code réel.\n\n## Flux recommandé\n\n1. Depuis le repo, générer un manifeste : \`npm run repo:manifest -- /chemin/du/repo\`.\n2. Importer le JSON dans le panneau “Code repo”.\n3. Créer un snapshot du vault.\n4. Exporter MCP pour donner à l'assistant le contexte notes + code.\n\n## Sécurité\n\nLe manifeste exclut \`.env\`, secrets, tokens, dossiers lourds et fichiers ignorés par Git quand possible. L'intégration est read-only par défaut.\n\n## Outils MCP liés\n\n- \`povmind.repo_manifest\`\n- \`povmind.repo_list_files\`\n- \`povmind.repo_search\`\n- \`povmind.repo_read_file\`\n\n#povmind #repo #code`,
    },
    {
      title: "PovMind - Repo en vault dev",
      folder: "Documentation PovMind",
      body: `# PovMind - Repo en vault dev\n\nDécision : un repo GitHub peut être traduit directement en vault PovMind pour garder un contexte de développement durable.\n\n## Deux modes\n\n- Scanner en vault : crée un nouveau vault \`Dev - {repo}\` avec manifest, carte, fichiers et patterns.\n- Enrichir actif : ajoute ou met à jour ce contexte dans le vault ouvert, sans dupliquer les notes générées au rescan.\n\n## Patterns communs\n\nChaque vault généré reçoit une structure commune :\n\n- Dev Index.\n- Carte du repo.\n- Entrées techniques.\n- Manifest repo.\n- Journal de décisions.\n- Runbook.\n- Tests et qualité.\n- Sécurité et accès.\n- Questions ouvertes.\n\n## Sécurité\n\nLe scan passe par Cloud Run et l'API GitHub. Les secrets, tokens, dossiers lourds, \`.git\`, \`.povmind\`, locks et caches sont exclus. Pour les repos privés, le token GitHub reste côté serveur via cookie HttpOnly chiffré.\n\n## Intérêt assistant\n\nUn assistant peut entrer dans un repo par la carte et les points d'entrée plutôt que relire tout le code sans structure. Le vault devient le contexte vivant du développement.\n\nVoir [[PovMind - Code repo]], [[PovMind - GitHub sync]] et [[PovMind - MCP assistant]]. #github #dev #pattern #contexte`,
    },
    {
      title: "PovMind - GitHub repo",
      folder: "Documentation PovMind",
      body: `# PovMind - GitHub repo\n\nGitHub est le registre exécutable de PovMind : code, revues, CI, historique et liens vers les snapshots du vault.\n\n## Contrat\n\n- \`main\` doit rester déployable.\n- Chaque changement durable doit passer par \`npm run check\`.\n- La CI GitHub vérifie la synchronisation de version, la syntaxe et le manifest repo.\n- Le repo ne doit jamais contenir \`.env\`, tokens, exports MCP, zips ou dossiers \`output/\`.\n\n## Fichiers GitHub\n\n- \`.gitignore\` : exclusions locales et secrets.\n- \`.github/workflows/ci.yml\` : contrôle continu.\n- \`SECURITY.md\` : modèle de sécurité actuel.\n- \`.povmind/\` : contexte versionnable du vault quand la sync est activée.\n- \`AGENTS.md\` : consignes racine pour l'assistant de code.\n\n## Lien avec le vault\n\nUn snapshot doit pouvoir citer un commit Git et un \`repoTreeHash\`. L'assistant peut ensuite lire les notes, le manifest repo et les fichiers exportés via MCP.\n\nVoir [[PovMind - Code repo]], [[PovMind - GitHub sync]] et [[PovMind - Snapshots du vault]]. #github #repo #ci`,
    },
    {
      title: "PovMind - GitHub sync",
      folder: "Documentation PovMind",
      body: `# PovMind - GitHub sync\n\nLa synchronisation GitHub fait du vault un contexte versionnable au même endroit que le code.\n\n## Format versionné\n\nPovMind exporte un dossier \`.povmind/\` et un \`AGENTS.md\` racine :\n\n\`\`\`txt\nAGENTS.md\n.povmind/\n  manifest.json\n  README.md\n  vaults/{vaultId}/\n    manifest.json\n    INDEX.md\n    graph.json\n    mcp-policy.json\n    repo-manifest.json\n    snapshots/latest.json\n    notes/*.md\n\`\`\`\n\n## Principe\n\n- \`AGENTS.md\` indique à Codex quoi lire avant de coder.\n- \`.povmind/manifest.json\` décrit le vault actif, la cible GitHub, le repo lié et le dernier snapshot.\n- \`snapshots/latest.json\` fige notes, graphe, repo et politique token avec un hash global.\n- \`mcp-policy.json\` ne contient pas le secret complet, seulement la politique d'accès.\n\n## Connecteur Cloud Run\n\nLe navigateur ne stocke pas de token GitHub longue durée. Le flux attendu est :\n\n1. OAuth GitHub depuis Cloud Run.\n2. Token chiffré côté serveur dans un cookie HttpOnly.\n3. Push/Pull du dossier \`.povmind/\` via les endpoints Cloud Run.\n4. Le token assistant \`POVMIND_VAULT_TOKEN\` reste séparé du token GitHub.\n\n## Endpoints prévus\n\n- \`GET /api/github/status\`\n- \`GET /auth/github/start\`\n- \`GET /auth/github/callback\`\n- \`POST /api/github/push-context\`\n- \`POST /api/github/pull-context\`\n\n## Décision produit\n\nGitHub versionne le contexte; MCP autorise l'accès assistant; les snapshots prouvent l'état. Ces trois couches ne doivent pas partager le même secret.\n\nVoir [[PovMind - GitHub repo]], [[PovMind - MCP assistant]] et [[PovMind - Snapshots du vault]]. #github #sync #contexte`,
    },
    {
      title: "PovMind - MCP assistant",
      folder: "Documentation PovMind",
      body: `# PovMind - MCP assistant\n\nPovMind exporte un bundle MCP pour connecter le vault à un assistant sans exposer toute l'app web.\n\n## Transport\n\nLe bundle utilise le transport MCP \`stdio\`, donc le client lance un serveur local Node qui communique en JSON-RPC ligne par ligne.\n\n## Authentification\n\nLe serveur lit \`POVMIND_VAULT_TOKEN\`, calcule \`SHA-256(vaultId:token)\` et compare cette empreinte à celle exportée avec le vault.\n\n## Outils exposés\n\n- \`povmind.search\` : rechercher dans les notes.\n- \`povmind.read_note\` : lire une note par titre, slug ou chemin.\n- \`povmind.list_notes\` : lister les notes avec filtres simples.\n- \`povmind.vault_manifest\` : lire les métadonnées du vault.\n- \`povmind.repo_manifest\` : lire le repo lié au vault.\n- \`povmind.repo_list_files\` : découvrir les chemins exportés.\n- \`povmind.repo_search\` : chercher dans le code exporté.\n- \`povmind.repo_read_file\` : lire un fichier code précis.\n\n## Ressources exposées\n\n- \`povmind://vault/manifest\`\n- \`povmind://notes/{slug}\`\n- \`povmind://repo/manifest\`\n- \`povmind://repo/files/{path}\`\n\n## Principe produit\n\nL'assistant ne devient puissant que si le contexte est clair. Le vault “Documentation PovMind” sert donc de banc d'essai pour documenter décisions, limites, repo lié et backlog.\n\n#povmind #mcp #assistant`,
    },
    {
      title: "PovMind - Déploiement Cloud Run",
      folder: "Documentation PovMind",
      body: `# PovMind - Déploiement Cloud Run\n\nPovMind est déployé sur Cloud Run via un conteneur Node statique.\n\n## URL actuelle\n\nhttps://povmind-472136847189.europe-west1.run.app\n\n## Commande de déploiement\n\n\`\`\`bash\ngcloud run deploy povmind \\\n  --source . \\\n  --project campaign-truth-prod \\\n  --region europe-west1 \\\n  --allow-unauthenticated\n\`\`\`\n\n## Points de production\n\n- \`/healthz\` pour la supervision.\n- \`/version\` pour diagnostiquer la révision.\n- CSP, anti-framing, permissions minimales et referrer policy.\n- PWA manifest, service worker, robots et sitemap.\n- Connecteur GitHub OAuth pour pousser/tirer le contexte \`.povmind/\` sans stocker de token longue durée dans le navigateur.\n\n## Secrets GitHub requis\n\n- \`GITHUB_CLIENT_ID\`\n- \`GITHUB_CLIENT_SECRET\`\n- \`GITHUB_TOKEN_ENCRYPTION_KEY\`\n- \`PUBLIC_BASE_URL\`\n\nVoir [[PovMind - GitHub sync]] et [[PovMind - Backlog contexte]]. #povmind #cloudrun`,
    },
    {
      title: "PovMind - Boucle cognitive",
      folder: "Documentation PovMind",
      body: `# PovMind - Boucle cognitive\n\nLa boucle cognitive transforme le vault en système auto-apprenant traçable sans perdre le contrôle humain.\n\n## Phases\n\n- Jour : capture, action, contexte court, analyse déterministe, snapshot.\n- Nuit : compression, notes froides, consolidation symbolique, mode rêve.\n- Réveil : agenda de validation, delta snapshots, feedback accepté/refusé, prochaine action.\n\n## Score\n\nLe ratio d'auto-amélioration agrège la couverture mémoire, la densité de liens, la fraîcheur du snapshot, le feedback humain, l'ancrage repo, la continuité des cycles, la pression de suggestions et les notes froides.\n\n## Réveil\n\nLe réveil transforme les sorties nocturnes en décisions : relire le delta, accepter ou rejeter les propositions, puis créer un nouveau snapshot après arbitrage. C'est la couche reward signal de PovMind.\n\n## Cron GitHub\n\nL'export de contexte ajoute :\n\n- \`.povmind/automation/cognitive-loop.json\`\n- \`.povmind/automation/cognitive-loop.md\`\n- \`.github/workflows/povmind-cognitive-loop.yml\`\n\nLe cron GitHub audite la fraîcheur du contexte versionné. Il ne lit pas le vault local du navigateur et ne merge jamais automatiquement les sorties de rêve.\n\n## Garde-fous\n\n- Le rêve produit des hypothèses, pas des décisions.\n- Le reward signal vient du feedback humain.\n- Le snapshot fige le quoi; le journal explique le pourquoi.\n- Le repo reste la source exécutable.\n\nVoir [[PovMind - GitHub sync]], [[PovMind - Snapshots du vault]] et [[PovMind - Backlog contexte]]. #cycle-cognitif #auto-apprentissage #cron`,
    },
    {
      title: "PovMind - Backlog contexte",
      folder: "Documentation PovMind",
      body: `# PovMind - Backlog contexte

Ce backlog sert à tester PovMind sur lui-même : chaque amélioration doit pouvoir être justifiée par une note, un lien, un export ou une lecture assistant.

## Fait

- [x] Implémenter le Vault Registry local décrit dans [[PovMind - Auth et multivault]].
- [x] Ajouter un sélecteur de vault : créer, ouvrir, renommer.
- [x] Ajouter l'export \`.povmind/\` + \`AGENTS.md\` décrit dans [[PovMind - GitHub sync]].
- [x] Ajouter le scaffold Cloud Run OAuth GitHub sans token longue durée dans le navigateur.
- [x] Structurer l'interface comme un workbench type Obsidian décrit dans [[PovMind - Interface Obsidian]].
- [x] Migrer l'entrée applicative vers \`src/app.ts\` avec build TypeScript vers \`app.js\`.
- [x] Chiffrer localement notes, favoris et snapshots avec AES-GCM via passphrase.
- [x] Importer un dossier Obsidian en nouveau vault PovMind avec dossiers et liens wiki.
- [x] Scanner un repo GitHub en vault dev ou enrichir le vault actif avec des patterns communs.
- [x] Ajouter le cycle Réveil avec agenda de validation et delta snapshots.

## À prioriser

- [ ] Extraire les modèles \`Note\`, \`Vault\`, \`Snapshot\`, \`SecurityPolicy\` dans des modules TypeScript dédiés.
- [ ] Configurer les secrets OAuth GitHub sur Cloud Run.
- [ ] Importer un JSON comme nouveau vault.
- [ ] Exporter/restaurer tout le registre multivault.
- [ ] Tester l'export MCP avec un vrai client assistant.
- [ ] Ajouter un écran de statut pour expliquer ce que le token protège.
- [ ] Comparer un snapshot et un commit repo.
- [ ] Ajouter un import/export de bundles MCP.
- [ ] Ajouter rotation de passphrase et révocation fine par assistant.
- [ ] Ajouter un audit log du connecteur GitHub.

## Questions produit

- Quels assistants ont accès à quel vault ?
- Faut-il un token par assistant ou un token par vault ?
- Comment afficher les accès sans rendre l'interface anxiogène ?
- Quelle partie de PovMind doit rester 100% locale ?
- Quel niveau de code doit entrer dans le manifeste repo ?
- À quel moment l'auth utilisateur devient-elle nécessaire : avant ou après la sync cloud ?

#povmind #backlog #contexte`,
    },
  ];
}

function ensureDocumentationVault(options: { select?: boolean; silent?: boolean } = {}) {
  if (vaultLocked()) return;
  const { select = false, silent = false } = options;
  const createdAt = nowIso();
  const created = [];
  const updated = [];
  for (const doc of documentationVaultNotes()) {
    const existing = findNoteByTitle(doc.title);
    if (existing) {
      if (existing.folder === doc.folder && existing.body !== doc.body) {
        existing.body = doc.body;
        existing.updatedAt = createdAt;
        updated.push(existing);
      }
      continue;
    }
    created.push({
      id: uid(),
      title: doc.title,
      folder: doc.folder,
      body: doc.body,
      createdAt,
      updatedAt: createdAt,
    });
  }

  if (created.length || updated.length) {
    state.notes = [...created, ...state.notes];
    localStorage.setItem(vaultStorageKey("doc-vault"), nowIso());
    persistNow(false);
  }

  const indexNote = findNoteByTitle("PovMind - Index");
  if (select && indexNote) {
    state.folderFilter = "Documentation PovMind";
    state.search = "";
    els.searchInput.value = "";
    state.activeId = indexNote.id;
    persistNow(false);
  }

  if (created.length || updated.length || select) renderAll();
  if (!silent) toast(created.length || updated.length ? "Vault documentation PovMind mis à jour." : "Vault documentation PovMind ouvert.");
}

function loadStore() {
  if (vaultEncrypted()) {
    state.notes = [];
    state.activeId = null;
    state.starredIds = new Set<string>();
    state.snapshots = [];
    state.learningMemory = cleanLearningMemory(null);
    state.enrichmentRuns = [];
    state.cognitiveCycles = [];
    state.vaultUnlocked = Boolean(state.vaultCryptoKey);
    return;
  }

  const raw = readVaultStoredValue("notes", STORAGE_KEY, LEGACY_STORAGE_KEY);
  if (!raw) {
    state.notes = seedNotes();
    state.activeId = state.notes[0]?.id || null;
    state.starredIds = new Set(state.activeId ? [state.activeId] : []);
    persistStarredIds();
    persistNow(false);
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    state.notes = Array.isArray(parsed.notes) ? parsed.notes.map(cleanNote).filter(Boolean) : [];
    state.activeId = parsed.activeId && state.notes.some((note) => note.id === parsed.activeId)
      ? parsed.activeId
      : state.notes[0]?.id || null;
    if (Array.isArray(parsed.starredIds)) {
      state.starredIds = new Set(parsed.starredIds.map(String).filter((id) => state.notes.some((note) => note.id === id)));
      persistStarredIds();
    }
    if (parsed.learningMemory) state.learningMemory = cleanLearningMemory(parsed.learningMemory);
    if (Array.isArray(parsed.enrichmentRuns)) {
      state.enrichmentRuns = parsed.enrichmentRuns.map(cleanEnrichmentRun).filter(Boolean).slice(0, MAX_ENRICHMENT_RUNS) as EnrichmentRun[];
    }
    if (Array.isArray(parsed.cognitiveCycles)) {
      state.cognitiveCycles = parsed.cognitiveCycles.map(cleanCognitiveCycle).filter(Boolean).slice(0, MAX_COGNITIVE_CYCLES) as CognitiveCycle[];
    }
    if (!state.notes.length) {
      state.notes = seedNotes();
      state.activeId = state.notes[0].id;
      state.starredIds = new Set([state.activeId]);
      persistStarredIds();
    }
  } catch {
    state.notes = seedNotes();
    state.activeId = state.notes[0].id;
    state.starredIds = new Set([state.activeId]);
    persistStarredIds();
    toast("Données locales réparées avec la démo.");
  }
}

function cleanNote(note) {
  if (!note || typeof note !== "object") return null;
  const createdAt = note.createdAt || nowIso();
  const clean: any = {
    id: String(note.id || uid()),
    title: String(note.title || "Sans titre"),
    folder: normalizeFolder(note.folder),
    body: String(note.body || ""),
    createdAt,
    updatedAt: note.updatedAt || createdAt,
  };
  const memoryTypes = cleanMemoryTypes(note.memoryTypes);
  if (memoryTypes.length) clean.memoryTypes = memoryTypes;
  return clean;
}

function persistNow(showSaved = true) {
  if (vaultLocked()) {
    els.savedStatus.textContent = "Verrouillé";
    return;
  }
  if (vaultEncrypted()) {
    void persistEncryptedNotes(showSaved).catch((error) => {
      console.error(error);
      toast("Sauvegarde chiffrée impossible.");
    });
    return;
  }
  localStorage.setItem(
    vaultStorageKey("notes"),
    JSON.stringify(notesPlainPayload())
  );
  if (showSaved) {
    els.savedStatus.textContent = "Sauvegardé";
  }
  touchActiveVault();
}

function queueSave() {
  els.savedStatus.textContent = "Sauvegarde…";
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => persistNow(true), 220);
}

function activeNote() {
  return state.notes.find((note) => note.id === state.activeId) || null;
}

function findNoteByTitle(title) {
  const wanted = normalizeTitle(title);
  return state.notes.find((note) => normalizeTitle(note.title) === wanted) || null;
}

function uniqueTitle(baseTitle) {
  const base = String(baseTitle || "Nouvelle note").trim() || "Nouvelle note";
  if (!findNoteByTitle(base)) return base;
  let index = 2;
  while (findNoteByTitle(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
}

function uniqueTitleFromSet(baseTitle, usedTitles) {
  const base = String(baseTitle || "Sans titre").trim() || "Sans titre";
  let candidate = base;
  let index = 2;
  while (usedTitles.has(normalizeTitle(candidate))) {
    candidate = `${base} ${index}`;
    index += 1;
  }
  usedTitles.add(normalizeTitle(candidate));
  return candidate;
}

function createNote(title = "Nouvelle note", body = "", options: { folder?: string } = {}) {
  if (!requireVaultUnlocked("créer une note")) return null;
  const createdAt = nowIso();
  const note = {
    id: uid(),
    title: uniqueTitle(title),
    folder: normalizeFolder(options.folder || state.folderFilter || activeNote()?.folder || ROOT_FOLDER),
    body,
    createdAt,
    updatedAt: createdAt,
  };
  state.notes.unshift(note);
  state.activeId = note.id;
  queueSave();
  renderAll();
  requestAnimationFrame(() => els.titleInput.select());
  toast("Note créée.");
  return note;
}

function deleteActiveNote() {
  if (!requireVaultUnlocked("supprimer une note")) return;
  const note = activeNote();
  if (!note) return;
  const ok = confirm(`Supprimer définitivement « ${note.title} » ?`);
  if (!ok) return;
  const index = state.notes.findIndex((item) => item.id === note.id);
  state.notes.splice(index, 1);
  state.starredIds.delete(note.id);
  persistStarredIds();
  state.activeId = state.notes[Math.max(0, index - 1)]?.id || state.notes[0]?.id || null;
  if (!state.activeId) createNote("Accueil", "# Accueil\n\nTon carnet est prêt.");
  queueSave();
  renderAll();
  toast("Note supprimée.");
}

function selectNote(id) {
  if (!requireVaultUnlocked("ouvrir une note")) return;
  if (!state.notes.some((note) => note.id === id)) return;
  state.activeId = id;
  persistNow(false);
  renderAll();
}

function updateActiveNote(patch) {
  if (vaultLocked()) return;
  const note = activeNote();
  if (!note) return;
  Object.assign(note, patch, { updatedAt: nowIso() });
  queueSave();
}

function extractWikiLinks(text) {
  const links = [];
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let match;
  while ((match = regex.exec(text || ""))) {
    const title = match[1].trim();
    if (title) links.push(title);
  }
  return links;
}

function rewriteWikiLinkTargets(markdown, targetMap) {
  return String(markdown || "").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, rawTarget, rawAlias) => {
    const nextTarget = targetMap.get(normalizeTitle(rawTarget)) || rawTarget;
    const alias = String(rawAlias || "").trim();
    return alias ? `[[${nextTarget}|${alias}]]` : `[[${nextTarget}]]`;
  });
}

function extractTags(text) {
  const tags = new Set<string>();
  const regex = /(^|[\s([{])#([\p{L}\p{N}_-]{2,})/gu;
  let match;
  while ((match = regex.exec(text || ""))) {
    tags.add(match[2].toLocaleLowerCase("fr-FR"));
  }
  return [...tags].sort((a, b) => a.localeCompare(b, "fr"));
}

function textIncludesAny(text, words) {
  const haystack = String(text || "").toLocaleLowerCase("fr-FR");
  return words.some((word) => haystack.includes(String(word).toLocaleLowerCase("fr-FR")));
}

function inferMemoryTypesForNote(note) {
  if (!note) return ["structured"];
  const text = `${note.title}\n${note.folder}\n${note.body}`;
  const types = new Set<string>();

  if (textIncludesAny(text, ["log", "journal", "document", "source", "transcript", "capture", "import", "brut"]) || /```[\s\S]*?```/.test(note.body || "")) {
    types.add("raw");
  }
  if (extractWikiLinks(note.body).length || extractTags(text).length || textIncludesAny(text, ["index", "wiki", "concept", "cartographie", "architecture", "structure"])) {
    types.add("structured");
  }
  if (textIncludesAny(text, ["décision", "decision", "stratégie", "strategie", "conviction", "arbitrage", "principe", "politique", "sécurité"])) {
    types.add("strategic");
  }
  if (textIncludesAny(text, ["rêve", "reve", "symbolique", "métaphore", "metaphore", "intuition", "verset", "paradox", "onirique"])) {
    types.add("symbolic");
  }
  if (textIncludesAny(text, ["action", "run", "agent", "commande", "mcp", "snapshot", "cron", "git", "deploy", "exécutée", "executee", "audit"])) {
    types.add("agentic");
  }
  if (textIncludesAny(text, ["personne", "relation", "client", "équipe", "equipe", "frederic", "contexte relationnel", "stakeholder"])) {
    types.add("relational");
  }
  if (textIncludesAny(text, ["hypothèse", "hypothese", "futur", "prospective", "roadmap", "scénario", "scenario", "question ouverte", "risque", "opportunité"])) {
    types.add("prospective");
  }

  if (!types.size) types.add("structured");
  return cleanMemoryTypes([...types]);
}

function effectiveMemoryTypes(note) {
  const explicit = cleanMemoryTypes(note?.memoryTypes);
  return explicit.length ? explicit : inferMemoryTypesForNote(note);
}

function toggleActiveNoteMemoryType(typeId) {
  if (!requireVaultUnlocked("classifier cette note")) return;
  const note = activeNote();
  const type = memoryTypeById(typeId);
  if (!note || !type) return;
  const current = new Set(cleanMemoryTypes(note.memoryTypes));
  if (current.has(typeId)) current.delete(typeId);
  else current.add(typeId);
  const next = cleanMemoryTypes([...current]);
  if (next.length) note.memoryTypes = next;
  else delete note.memoryTypes;
  note.updatedAt = nowIso();
  queueSave();
  renderLearningPanel();
  toast(`Mémoire ${type.label.toLocaleLowerCase("fr-FR")} ${current.has(typeId) ? "ajoutée" : "retirée"}.`);
}

function tagsForNote(note) {
  return extractTags(`${note.title}\n${note.body}`);
}

function allTags() {
  const counts = new Map();
  for (const note of state.notes) {
    for (const tag of tagsForNote(note)) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
}

function allFolders() {
  const counts = new Map();
  for (const note of state.notes) {
    const folder = normalizeFolder(note.folder);
    counts.set(folder, (counts.get(folder) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => {
    if (a[0] === ROOT_FOLDER) return -1;
    if (b[0] === ROOT_FOLDER) return 1;
    return a[0].localeCompare(b[0], "fr");
  });
}

function graphStats() {
  const { edges } = buildGraph();
  return {
    notes: state.notes.length,
    folders: allFolders().length,
    links: edges.length,
  };
}

function filteredNotes() {
  const query = state.search.trim().toLocaleLowerCase("fr-FR");
  return state.notes
    .filter((note) => {
      const haystack = `${note.title}\n${note.body}`.toLocaleLowerCase("fr-FR");
      const queryOk = !query || haystack.includes(query);
      const tagOk = !state.tagFilter || tagsForNote(note).includes(state.tagFilter);
      const folderOk = !state.folderFilter || normalizeFolder(note.folder) === state.folderFilter;
      return queryOk && tagOk && folderOk;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function renderVaultSwitcher() {
  const active = activeVaultRecord();
  els.vaultSelect.innerHTML = vaultRegistry.vaults
    .map((vault) => `<option value="${attr(vault.id)}">${escapeHtml(vault.name)}</option>`)
    .join("");
  els.vaultSelect.value = activeVaultId;
  els.vaultRegistryMeta.textContent = `${vaultRegistry.vaults.length} vault(s) local-first · ${active ? shortHash(active.id) : "—"}`;
}

function renderVaultStats() {
  const stats = graphStats();
  els.vaultStats.innerHTML = `
    <div class="vault-stat"><strong>${stats.notes}</strong><span>notes</span></div>
    <div class="vault-stat"><strong>${stats.links}</strong><span>liens</span></div>
    <div class="vault-stat"><strong>${stats.folders}</strong><span>dossiers</span></div>`;
}

function renderSecurityPanel() {
  const sealed = Boolean(state.security.tokenHash);
  const encrypted = vaultEncrypted();
  const locked = vaultLocked();
  els.securityStatus.textContent = encrypted ? (locked ? "Verrouillé" : "Chiffré") : sealed ? "Scellé" : "À sceller";
  els.vaultKeyLabel.textContent = state.security.vaultId;
  els.assistantTokenOutput.value = state.assistantToken || "";
  els.assistantTokenOutput.placeholder = sealed
    ? `Token actif : ${state.security.tokenHint || "hash enregistré"}`
    : "Générer un token assistant";
  els.copyTokenBtn.disabled = !state.assistantToken;
  els.securityExportMcpBtn.disabled = locked;
  els.exportMcpBtn.disabled = locked;
  els.exportCodexBtn.disabled = locked;
  els.exportVaultBtn.disabled = locked;
  els.vaultLockStatus.textContent = encrypted ? (locked ? "Verrouillé" : "Déverrouillé") : "Non chiffré";
  els.enableVaultCryptoBtn.disabled = encrypted || locked;
  els.unlockVaultBtn.disabled = !encrypted || !locked;
  els.lockVaultBtn.disabled = !encrypted || locked;
}

function formatSnapshotDate(iso) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function renderSnapshotsPanel() {
  if (vaultLocked()) {
    els.snapshotCount.textContent = "0";
    els.snapshotHashLabel.textContent = "Verrouillé";
    els.createSnapshotBtn.disabled = true;
    els.exportSnapshotBtn.disabled = true;
    els.snapshotsList.innerHTML = `<div class="empty-state">Snapshots verrouillés avec les notes du vault.</div>`;
    return;
  }
  const latest = latestSnapshot();
  els.snapshotCount.textContent = String(state.snapshots.length);
  els.snapshotHashLabel.textContent = latest ? `${latest.hash.slice(0, 12)}…` : "Aucun";
  els.createSnapshotBtn.disabled = false;
  els.exportSnapshotBtn.disabled = !latest;

  if (!state.snapshots.length) {
    els.snapshotsList.innerHTML = `<div class="empty-state">Aucun snapshot. Crée un point stable avant un gros changement.</div>`;
    return;
  }

  els.snapshotsList.innerHTML = state.snapshots
    .slice(0, 6)
    .map((snapshot) => {
      const summary = snapshot.summary || {};
      const active = summary.activeTitle ? ` · ${summary.activeTitle}` : "";
      return `
        <button class="snapshot-row" type="button" data-snapshot-id="${attr(snapshot.id)}" title="Exporter ${attr(snapshot.id)}">
          <span>
            <strong>${escapeHtml(formatSnapshotDate(snapshot.createdAt))}</strong>
            <small>${escapeHtml(snapshot.hash.slice(0, 16))}</small>
          </span>
          <em>${Number(summary.noteCount || 0)} notes · ${Number(summary.linkCount || 0)} liens${escapeHtml(active)}</em>
        </button>`;
    })
    .join("");
}

function latestEnrichmentRun() {
  return state.enrichmentRuns[0] || null;
}

function pendingEnrichmentProposals() {
  const run = latestEnrichmentRun();
  return run ? run.proposals.filter((proposal) => proposal.status === "pending") : [];
}

function makeProposal(type, title, detail, options: JsonObject = {}) {
  return cleanProposal({
    id: `${type}:${safeFilename(options.targetId || options.targetTitle || title)}:${uid().slice(0, 8)}`,
    type,
    title,
    detail,
    status: "pending",
    confidence: options.confidence ?? 0.68,
    risk: options.risk || "low",
    targetId: options.targetId || "",
    targetTitle: options.targetTitle || "",
    evidence: options.evidence || [],
    createdAt: nowIso(),
  }) as EnrichmentProposal;
}

function snapshotNeedsRefresh() {
  const latest = latestSnapshot();
  if (!latest) return true;
  const stats = graphStats();
  const summary = latest.summary || {};
  return Number(summary.noteCount || 0) !== stats.notes
    || Number(summary.linkCount || 0) !== stats.links
    || String(summary.repoTreeHash || "") !== String(state.repo?.treeHash || "")
    || Boolean(summary.githubLinked) !== Boolean(state.githubSync?.repoFullName);
}

function hasTodaysEnrichmentReport() {
  const today = formatLocalDate(new Date());
  return state.notes.some((note) => normalizeTitle(note.title).startsWith(normalizeTitle(`Rapport d'enrichissement - ${today}`)));
}

function buildDeterministicEnrichmentProposals() {
  const proposals: EnrichmentProposal[] = [];
  const active = activeNote();
  const untypedNotes = state.notes
    .filter((note) => !cleanMemoryTypes(note.memoryTypes).length)
    .slice(0, 16);

  if (untypedNotes.length) {
    proposals.push(makeProposal(
      "assign_memory",
      "Classifier les mémoires",
      `${untypedNotes.length} note(s) peuvent recevoir une couche mémoire explicite.`,
      {
        confidence: 0.78,
        risk: "low",
        evidence: untypedNotes.map((note) => ({
          id: note.id,
          title: note.title,
          inferred: inferMemoryTypesForNote(note),
        })),
      }
    ));
  }

  if (active && !findNoteByTitle("Contexte court - Session")) {
    proposals.push(makeProposal(
      "create_context",
      "Créer la mémoire immédiate",
      "Synthétiser la note active en contexte court pour réduire la charge mentale.",
      {
        targetId: active.id,
        targetTitle: active.title,
        confidence: 0.72,
        risk: "low",
        evidence: [{ id: active.id, title: active.title, memoryTypes: effectiveMemoryTypes(active) }],
      }
    ));
  }

  if (snapshotNeedsRefresh()) {
    proposals.push(makeProposal(
      "create_snapshot",
      "Figer un snapshot du vault",
      "Le vault ou son repo lié a changé depuis le dernier hash stable.",
      {
        confidence: 0.82,
        risk: "low",
        evidence: [{ latestSnapshot: latestSnapshot()?.id || null, repoTreeHash: state.repo?.treeHash || "", notes: state.notes.length }],
      }
    ));
  }

  if (repoIsLinked()) {
    const repo = cleanRepoState(state.repo);
    const repoNoteTitle = `Code Repo - ${repo.name || repo.root || "Repo"}`;
    if (!findNoteByTitle(repoNoteTitle)) {
      proposals.push(makeProposal(
        "repo_note",
        "Créer la note du repo",
        "Ancrer le vault au repo exécutable avec commit, branche et fichiers indexés.",
        {
          targetTitle: repoNoteTitle,
          confidence: 0.8,
          risk: "low",
          evidence: [{ repo: repo.name || repo.root, commit: repo.commit, treeHash: repo.treeHash }],
        }
      ));
    }
  }

  if (active && textIncludesAny(`${active.title}\n${active.body}`, ["paradoxe", "contradiction", "tension", "inverse", "mais aussi"])) {
    const tensionTitle = `Tension - ${active.title}`;
    if (!findNoteByTitle(tensionTitle)) {
      proposals.push(makeProposal(
        "create_tension",
        "Isoler une tension paradoxale",
        "La note active contient un conflit fertile qui mérite une fiche de clarification.",
        {
          targetId: active.id,
          targetTitle: tensionTitle,
          confidence: 0.66,
          risk: "medium",
          evidence: [{ id: active.id, title: active.title }],
        }
      ));
    }
  }

  const hasDreamVocabulary = state.notes.some((note) => textIncludesAny(`${note.title}\n${note.body}`, ["mode rêve", "cycle rêve", "rem paradoxal", "onirique"]));
  if (hasDreamVocabulary && !findNoteByTitle("Cycle rêve - Journal")) {
    proposals.push(makeProposal(
      "dream_cycle",
      "Préparer un cycle rêve",
      "Créer une note de consolidation nocturne : compression, mutation, oubli doux et scénarios.",
      {
        targetTitle: "Cycle rêve - Journal",
        confidence: 0.63,
        risk: "medium",
        evidence: [{ motif: "mode rêve" }],
      }
    ));
  }

  if (proposals.length && !hasTodaysEnrichmentReport()) {
    proposals.push(makeProposal(
      "create_report",
      "Documenter l'analyse",
      "Créer une note de rapport pour garder la boucle auto-apprenante auditée.",
      {
        confidence: 0.7,
        risk: "low",
        evidence: [{ proposals: proposals.length }],
      }
    ));
  }

  return proposals;
}

function runDeterministicEnrichment(showToast = true) {
  if (!requireVaultUnlocked("analyser le vault")) return null;
  persistNow(false);
  const stats = graphStats();
  const proposals = buildDeterministicEnrichmentProposals();
  const run = cleanEnrichmentRun({
    id: `enrich@${nowIso()}`,
    createdAt: nowIso(),
    source: "vault-local",
    mode: "review",
    input: {
      noteCount: stats.notes,
      linkCount: stats.links,
      folderCount: stats.folders,
      activeTitle: activeNote()?.title || "",
      repoLinked: repoIsLinked(),
      repoTreeHash: state.repo?.treeHash || "",
      latestSnapshot: latestSnapshot()?.id || "",
    },
    proposals,
  }) as EnrichmentRun;

  state.enrichmentRuns = [run, ...state.enrichmentRuns.filter((item) => item.id !== run.id)].slice(0, MAX_ENRICHMENT_RUNS);
  persistEnrichmentRuns();
  renderLearningPanel();
  if (showToast) toast(proposals.length ? `${proposals.length} suggestion(s) générée(s).` : "Analyse terminée : rien d'urgent.");
  return run;
}

function upsertSystemNote(title, folder, body, select = true) {
  const existing = findNoteByTitle(title);
  if (existing) {
    existing.folder = normalizeFolder(folder);
    existing.body = body;
    existing.updatedAt = nowIso();
    if (select) state.activeId = existing.id;
    queueSave();
    return existing;
  }

  const createdAt = nowIso();
  const note = {
    id: uid(),
    title,
    folder: normalizeFolder(folder),
    body,
    createdAt,
    updatedAt: createdAt,
    memoryTypes: inferMemoryTypesForNote({ title, folder, body }),
  };
  state.notes.unshift(note);
  if (select) state.activeId = note.id;
  queueSave();
  return note;
}

function createShortContextNote() {
  const note = activeNote();
  if (!note) return null;
  const outgoing = outgoingTargetsForNote(note).map((target) => target.title);
  const backlinks = state.notes
    .filter((candidate) => candidate.id !== note.id)
    .filter((candidate) => extractWikiLinks(candidate.body).some((title) => normalizeTitle(title) === normalizeTitle(note.title)))
    .map((candidate) => candidate.title);
  const memoryLabels = effectiveMemoryTypes(note).map((typeId) => memoryTypeById(typeId)?.label || typeId);
  const body = `# Contexte court - Session\n\n` +
    `Mis à jour : ${formatLongDate(new Date())}\n\n` +
    `## Mémoire immédiate\n\n` +
    `- Note active : [[${note.title}]]\n` +
    `- Dossier : ${normalizeFolder(note.folder)}\n` +
    `- Types : ${memoryLabels.join(", ") || "à préciser"}\n` +
    `- Dernière édition : ${formatDate(note.updatedAt)}\n\n` +
    `## Charge mentale à déléguer\n\n` +
    `- Clarifier la prochaine décision durable.\n` +
    `- Garder les hypothèses séparées des convictions.\n` +
    `- Transformer les actions exécutées en journal agentique.\n\n` +
    `## Liens sortants\n\n${outgoing.map((title) => `- [[${title}]]`).join("\n") || "- Aucun lien sortant."}\n\n` +
    `## Backlinks\n\n${backlinks.map((title) => `- [[${title}]]`).join("\n") || "- Aucun backlink."}\n\n` +
    `## Mémoire longue à consulter\n\n` +
    `- [[Exocortex apprenant - Index]]\n` +
    `- [[Taxonomie des mémoires]]\n` +
    `- [[Boucle auto-apprenante]]\n\n` +
    `#contexte #memoire-immediate #systeme1`;
  return upsertSystemNote("Contexte court - Session", "Mémoire immédiate", body, true);
}

function createTensionNote(sourceTitle = activeNote()?.title || "À qualifier") {
  const source = findNoteByTitle(sourceTitle) || activeNote();
  const title = source ? `Tension - ${source.title}` : "Tension - À qualifier";
  const body = `# ${title}\n\n` +
    `Source : ${source ? `[[${source.title}]]` : "à relier"}\n\n` +
    `## Pôle A\n\n- \n\n` +
    `## Pôle B\n\n- \n\n` +
    `## Question paradoxale\n\nComment conserver les deux vérités sans réduire trop vite la tension ?\n\n` +
    `## Hypothèse d'amélioration\n\n- \n\n` +
    `#paradoxe #tension #strategie`;
  return upsertSystemNote(title, "Mémoire stratégique", body, true);
}

function createDreamCycleNote() {
  const body = `# Cycle rêve - Journal\n\n` +
    `Cette note accueille les branches oniriques du vault : idées folles, analogies, inversions et simulations non mergées automatiquement.\n\n` +
    `## Sommeil léger\n\n- Reclassement rapide\n- Détection des doublons\n- Notes froides vers archive profonde\n\n` +
    `## Sommeil profond\n\n- Compression\n- Consolidation\n- Synthèse de décisions\n\n` +
    `## REM paradoxal\n\n- Métaphores inattendues\n- Contradictions maximales\n- Scénarios fictifs\n- Mutations improbables\n\n` +
    `## Réveil\n\n- Garder : \n- Rejeter : \n- Transformer en action : \n\n` +
    `#reve #symbolique #prospective #anti-convergence`;
  return upsertSystemNote("Cycle rêve - Journal", "Mémoire symbolique", body, true);
}

function createEnrichmentReport(run = latestEnrichmentRun()) {
  if (!requireVaultUnlocked("créer le rapport d'enrichissement")) return null;
  const currentRun = run || runDeterministicEnrichment(false);
  if (!currentRun) return null;
  const date = formatLocalDate(new Date(currentRun.createdAt));
  const title = `Rapport d'enrichissement - ${date}`;
  const proposals = currentRun.proposals || [];
  const feedback = state.learningMemory?.feedback || {};
  const body = `# ${title}\n\n` +
    `Run : \`${currentRun.id}\`\n\n` +
    `## État du vault\n\n` +
    `- Notes : ${currentRun.input.noteCount || state.notes.length}\n` +
    `- Liens : ${currentRun.input.linkCount || graphStats().links}\n` +
    `- Dossiers : ${currentRun.input.folderCount || allFolders().length}\n` +
    `- Repo lié : ${currentRun.input.repoLinked ? "oui" : "non"}\n` +
    `- Snapshot : ${currentRun.input.latestSnapshot || "à créer"}\n\n` +
    `## Suggestions\n\n${proposals.map((proposal) => `- [${proposal.status === "accepted" ? "x" : " "}] ${proposal.title} — ${proposal.detail} (${proposal.status}, confiance ${Math.round(proposal.confidence * 100)}%)`).join("\n") || "- Aucune suggestion."}\n\n` +
    `## Feedback appris\n\n` +
    `- Acceptées : ${Number(feedback.accepted || 0)}\n` +
    `- Refusées : ${Number(feedback.rejected || 0)}\n` +
    `- Modifiées : ${Number(feedback.modified || 0)}\n` +
    `- Reward approximatif : ${Number(state.learningMemory?.lastReward || 0).toFixed(2)}\n\n` +
    `## Prochaine amélioration logique\n\n- \n\n` +
    `#enrichissement #audit #memoire-agentique`;
  return upsertSystemNote(title, "Mémoire agentique", body, true);
}

function findProposalWithRun(proposalId) {
  for (const run of state.enrichmentRuns) {
    const proposal = run.proposals.find((item) => item.id === proposalId);
    if (proposal) return { run, proposal };
  }
  return null;
}

function recordLearningFeedback(kind, proposal) {
  const memory = cleanLearningMemory(state.learningMemory);
  memory.feedback[kind] = Number(memory.feedback[kind] || 0) + 1;
  const entry = {
    at: nowIso(),
    type: proposal.type,
    title: proposal.title,
    targetTitle: proposal.targetTitle || "",
    confidence: proposal.confidence,
  };
  if (kind === "accepted") memory.acceptedPatterns = [entry, ...(memory.acceptedPatterns || [])].slice(0, 80);
  if (kind === "rejected") memory.rejectedPatterns = [entry, ...(memory.rejectedPatterns || [])].slice(0, 80);
  const total = Number(memory.feedback.accepted || 0) + Number(memory.feedback.rejected || 0) + Number(memory.feedback.modified || 0);
  memory.lastReward = total ? (Number(memory.feedback.accepted || 0) - Number(memory.feedback.rejected || 0)) / total : 0;
  state.learningMemory = memory;
  persistLearningMemory();
}

async function applyEnrichmentProposal(proposalId) {
  if (!requireVaultUnlocked("appliquer cette suggestion")) return;
  const found = findProposalWithRun(proposalId);
  if (!found || found.proposal.status !== "pending") return;
  const { proposal } = found;

  if (proposal.type === "assign_memory") {
    let changed = 0;
    for (const item of proposal.evidence || []) {
      const note = state.notes.find((candidate) => candidate.id === item.id);
      if (!note || cleanMemoryTypes(note.memoryTypes).length) continue;
      note.memoryTypes = cleanMemoryTypes(item.inferred || inferMemoryTypesForNote(note));
      note.updatedAt = nowIso();
      changed += 1;
    }
    if (changed) queueSave();
  }

  if (proposal.type === "create_snapshot") {
    await createVaultSnapshot({ silent: true });
  }

  if (proposal.type === "create_context") {
    createShortContextNote();
  }

  if (proposal.type === "repo_note") {
    ensureCodeRepoNote();
  }

  if (proposal.type === "create_tension") {
    createTensionNote(proposal.targetTitle.replace(/^Tension - /, "") || activeNote()?.title);
  }

  if (proposal.type === "dream_cycle") {
    createDreamCycleNote();
  }

  if (proposal.type === "create_report") {
    createEnrichmentReport(found.run);
  }

  proposal.status = "accepted";
  proposal.appliedAt = nowIso();
  recordLearningFeedback("accepted", proposal);
  persistEnrichmentRuns();
  renderAll();
  toast("Suggestion appliquée et mémorisée.");
}

function rejectEnrichmentProposal(proposalId) {
  if (!requireVaultUnlocked("ignorer cette suggestion")) return;
  const found = findProposalWithRun(proposalId);
  if (!found || found.proposal.status !== "pending") return;
  found.proposal.status = "rejected";
  found.proposal.appliedAt = nowIso();
  recordLearningFeedback("rejected", found.proposal);
  persistEnrichmentRuns();
  renderLearningPanel();
  toast("Suggestion ignorée, signal conservé.");
}

function backlinksForNoteId(noteId) {
  const note = state.notes.find((candidate) => candidate.id === noteId);
  if (!note) return [];
  const wanted = normalizeTitle(note.title);
  return state.notes
    .filter((candidate) => candidate.id !== note.id)
    .filter((candidate) => extractWikiLinks(candidate.body).some((title) => normalizeTitle(title) === wanted));
}

function coldNotes(limit = 6) {
  return [...state.notes]
    .map((note) => ({
      note,
      outgoing: outgoingTargetsForNote(note).length,
      backlinks: backlinksForNoteId(note.id).length,
      updatedAt: new Date(note.updatedAt || note.createdAt || 0).getTime(),
    }))
    .filter((entry) => entry.outgoing + entry.backlinks === 0)
    .sort((a, b) => a.updatedAt - b.updatedAt)
    .slice(0, limit);
}

function recurrentSignals(limit = 8) {
  const tags = allTags().slice(0, limit).map(([tag, count]) => ({ type: "tag", label: `#${tag}`, count }));
  const folders = allFolders().slice(0, limit).map(([folder, count]) => ({ type: "folder", label: folder, count }));
  return [...tags, ...folders]
    .sort((a, b) => Number(b.count) - Number(a.count) || a.label.localeCompare(b.label, "fr"))
    .slice(0, limit);
}

function snapshotContent(snapshot) {
  const content = snapshot?.payload?.content;
  return content && typeof content === "object" ? content : null;
}

function snapshotSummary(snapshot) {
  const content = snapshotContent(snapshot);
  return snapshot?.summary && typeof snapshot.summary === "object"
    ? snapshot.summary
    : content?.summary && typeof content.summary === "object"
      ? content.summary
      : {};
}

function snapshotNotes(snapshot) {
  const notes = snapshotContent(snapshot)?.notes;
  return Array.isArray(notes) ? notes.filter((note) => note && typeof note === "object") : [];
}

function snapshotNoteKey(note) {
  return String(note.id || normalizeTitle(note.title || "") || safeFilename(note.title || "note"));
}

function snapshotNoteFingerprint(note) {
  return stableJson({
    title: String(note.title || ""),
    folder: String(note.folder || ROOT_FOLDER),
    body: String(note.body || ""),
    memoryTypes: Array.isArray(note.memoryTypes) ? note.memoryTypes.map(String).sort() : [],
  });
}

function snapshotNoteSummary(note) {
  return {
    id: String(note.id || ""),
    title: String(note.title || "Sans titre"),
    folder: String(note.folder || ROOT_FOLDER),
    memoryTypes: Array.isArray(note.memoryTypes) ? note.memoryTypes.map(String) : [],
  };
}

function snapshotNumber(summary, key, fallback = 0) {
  return finiteNumber(summary?.[key]) ?? fallback;
}

function compareSnapshots(current, previous = previousSnapshotFor(current)) {
  const currentNotes = new Map(snapshotNotes(current).map((note) => [snapshotNoteKey(note), note]));
  const previousNotes = new Map(snapshotNotes(previous).map((note) => [snapshotNoteKey(note), note]));
  const currentSummary = snapshotSummary(current);
  const previousSummary = snapshotSummary(previous);
  const added = [...currentNotes.entries()]
    .filter(([key]) => !previousNotes.has(key))
    .map(([, note]) => snapshotNoteSummary(note));
  const removed = [...previousNotes.entries()]
    .filter(([key]) => !currentNotes.has(key))
    .map(([, note]) => snapshotNoteSummary(note));
  const updated = [...currentNotes.entries()]
    .filter(([key, note]) => {
      const before = previousNotes.get(key);
      return Boolean(before && snapshotNoteFingerprint(note) !== snapshotNoteFingerprint(before));
    })
    .map(([, note]) => snapshotNoteSummary(note));
  const currentNoteCount = snapshotNumber(currentSummary, "noteCount", currentNotes.size);
  const previousNoteCount = snapshotNumber(previousSummary, "noteCount", previousNotes.size);
  const currentLinkCount = snapshotNumber(currentSummary, "linkCount", 0);
  const previousLinkCount = snapshotNumber(previousSummary, "linkCount", 0);
  const repoTreeHashFrom = String(previousSummary.repoTreeHash || "");
  const repoTreeHashTo = String(currentSummary.repoTreeHash || "");

  return {
    from: previous?.id || "",
    to: current?.id || "",
    fromHash: previous?.hash || "",
    toHash: current?.hash || "",
    baseline: !previous,
    addedCount: added.length,
    removedCount: removed.length,
    updatedCount: updated.length,
    noteDelta: currentNoteCount - previousNoteCount,
    linkDelta: currentLinkCount - previousLinkCount,
    repoChanged: repoTreeHashFrom !== repoTreeHashTo,
    repoTreeHashFrom,
    repoTreeHashTo,
    githubChanged: Boolean(previous) && Boolean(previousSummary.githubLinked) !== Boolean(currentSummary.githubLinked),
    added: added.slice(0, 24),
    removed: removed.slice(0, 24),
    updated: updated.slice(0, 24),
  };
}

function snapshotDeltaSummary(delta) {
  if (!delta) return "Aucun delta disponible.";
  if (delta.baseline) {
    return `Snapshot de référence : ${Number(delta.addedCount || 0)} note(s), ${Number(delta.linkDelta || 0)} lien(s) depuis zéro.`;
  }
  const noteDelta = Number(delta.noteDelta || 0);
  const linkDelta = Number(delta.linkDelta || 0);
  const parts = [
    `${Number(delta.addedCount || 0)} ajout(s)`,
    `${Number(delta.updatedCount || 0)} modification(s)`,
    `${Number(delta.removedCount || 0)} retrait(s)`,
    `notes ${noteDelta >= 0 ? "+" : ""}${noteDelta}`,
    `liens ${linkDelta >= 0 ? "+" : ""}${linkDelta}`,
  ];
  if (delta.repoChanged) parts.push("repo changé");
  return parts.join(" · ");
}

function snapshotDeltaItemsMarkdown(title, items) {
  const rows = Array.isArray(items) ? items : [];
  return `### ${title}\n\n${rows.length
    ? rows.slice(0, 10).map((item) => `- [[${item.title || "Sans titre"}]] (${item.folder || ROOT_FOLDER})`).join("\n")
    : "- Aucun."}\n`;
}

function formatSnapshotDeltaMarkdown(delta) {
  if (!delta) return "Aucun delta disponible.";
  const hashes = delta.fromHash || delta.toHash
    ? `\n- De : ${delta.fromHash ? `\`${shortHash(delta.fromHash)}\`` : "aucun"}\n- Vers : ${delta.toHash ? `\`${shortHash(delta.toHash)}\`` : "aucun"}`
    : "";
  const repo = delta.repoChanged
    ? `\n- Repo : \`${shortHash(delta.repoTreeHashFrom)}\` -> \`${shortHash(delta.repoTreeHashTo)}\``
    : "";
  return `## Delta snapshots\n\n` +
    `- Résumé : ${snapshotDeltaSummary(delta)}${hashes}${repo}\n\n` +
    `${snapshotDeltaItemsMarkdown("Ajouts", delta.added)}` +
    `\n${snapshotDeltaItemsMarkdown("Modifications", delta.updated)}` +
    `\n${snapshotDeltaItemsMarkdown("Retraits", delta.removed)}`;
}

function calculateLearningScore() {
  const stats = graphStats();
  const totalNotes = Math.max(1, state.notes.length);
  const explicitMemoryNotes = state.notes.filter((note) => cleanMemoryTypes(note.memoryTypes).length).length;
  const memoryCoverage = explicitMemoryNotes / totalNotes;
  const linkDensity = Math.min(1, stats.links / Math.max(1, totalNotes * 1.6));
  const snapshotFreshness = snapshotNeedsRefresh() ? 0 : 1;
  const feedback = state.learningMemory?.feedback || {};
  const feedbackTotal = Number(feedback.accepted || 0) + Number(feedback.rejected || 0) + Number(feedback.modified || 0);
  const feedbackQuality = feedbackTotal
    ? (Number(feedback.accepted || 0) + Number(feedback.modified || 0) * 0.7) / feedbackTotal
    : 0.5;
  const pendingPressure = Math.min(1, pendingEnrichmentProposals().length / Math.max(1, totalNotes / 4));
  const repoAnchor = repoIsLinked() ? 1 : 0.45;
  const cycleContinuity = Math.min(1, state.cognitiveCycles.length / 7);
  const coldPressure = Math.min(1, coldNotes(12).length / Math.max(1, totalNotes / 3));
  const ratio = clamp(
    memoryCoverage * 0.22 +
    linkDensity * 0.18 +
    snapshotFreshness * 0.16 +
    feedbackQuality * 0.16 +
    repoAnchor * 0.12 +
    cycleContinuity * 0.08 +
    (1 - pendingPressure) * 0.04 +
    (1 - coldPressure) * 0.04,
    0,
    1
  );

  return {
    ratio,
    memoryCoverage,
    linkDensity,
    snapshotFreshness,
    feedbackQuality,
    pendingPressure,
    repoAnchor,
    cycleContinuity,
    coldPressure,
    noteCount: state.notes.length,
    linkCount: stats.links,
    pendingSuggestions: pendingEnrichmentProposals().length,
    coldNotes: coldNotes(6).map((entry) => entry.note.title),
    recurrentSignals: recurrentSignals(8),
    measuredAt: nowIso(),
  };
}

function cyclePhaseLabel(phase) {
  if (phase === "day") return "Jour";
  if (phase === "night") return "Nuit";
  if (phase === "wake") return "Réveil";
  if (phase === "cron") return "Cron";
  return String(phase || "Cycle");
}

function recordCognitiveCycle(input) {
  const cycle = cleanCognitiveCycle({
    id: `cycle@${nowIso()}`,
    createdAt: nowIso(),
    source: "manual",
    outputs: [],
    ...input,
  }) as CognitiveCycle;
  state.cognitiveCycles = [cycle, ...state.cognitiveCycles.filter((item) => item.id !== cycle.id)].slice(0, MAX_COGNITIVE_CYCLES);
  persistCognitiveCycles();
  return cycle;
}

function createNightSynthesisNote(run = latestEnrichmentRun()) {
  const score = calculateLearningScore();
  const cold = coldNotes(8).map((entry) => `- [[${entry.note.title}]] — froide, ${entry.outgoing} sortant(s), ${entry.backlinks} backlink(s)`).join("\n");
  const signals = recurrentSignals(8).map((signal) => `- ${signal.label} (${signal.count})`).join("\n");
  const pending = (run?.proposals || []).filter((proposal) => proposal.status === "pending");
  const title = `Synthèse nocturne - ${formatLocalDate(new Date())}`;
  const body = `# ${title}\n\n` +
    `Cycle : nuit / consolidation / rêve contrôlé.\n\n` +
    `## Compression\n\n` +
    `- Ratio d'auto-amélioration : ${Math.round(score.ratio * 100)}%\n` +
    `- Couverture mémoire : ${Math.round(score.memoryCoverage * 100)}%\n` +
    `- Densité de liens : ${Math.round(score.linkDensity * 100)}%\n` +
    `- Pression de suggestions : ${Math.round(score.pendingPressure * 100)}%\n\n` +
    `## Motifs récurrents\n\n${signals || "- Aucun motif dominant."}\n\n` +
    `## Idées froides à archiver ou réactiver\n\n${cold || "- Aucune note froide détectée."}\n\n` +
    `## REM paradoxal\n\n` +
    `- Inverser une conviction : quelle note serait vraie si son contraire était utile ?\n` +
    `- Fusion improbable : combiner une mémoire symbolique et une mémoire agentique.\n` +
    `- Simulation extrême : que casserait une automatisation totale sans validation humaine ?\n\n` +
    `## Au réveil\n\n${pending.map((proposal) => `- [ ] ${proposal.title} — ${proposal.detail}`).join("\n") || "- [ ] Relancer une analyse après les prochaines notes."}\n\n` +
    `#reve #consolidation #memoire-symbolique #auto-apprentissage`;
  return upsertSystemNote(title, "Mémoire symbolique", body, true);
}

function createWakeAgendaNote(run = latestEnrichmentRun(), snapshot = latestSnapshot(), delta = compareSnapshots(snapshot)) {
  const score = calculateLearningScore();
  const pending = (run?.proposals || []).filter((proposal) => proposal.status === "pending");
  const lastCycle = state.cognitiveCycles[0];
  const feedback = state.learningMemory?.feedback || {};
  const title = `Agenda réveil - ${formatLocalDate(new Date())}`;
  const pendingRows = pending.slice(0, 12).map((proposal) =>
    `- [ ] ${proposal.title} (${Math.round(Number(proposal.confidence || 0) * 100)}%, ${proposal.risk})\n` +
    `  - ${proposal.detail}\n` +
    `  - Décision : accepter / ignorer / transformer en action`
  ).join("\n");
  const lastCycleRows = lastCycle
    ? `- Dernier cycle : ${cyclePhaseLabel(lastCycle.phase)} (${formatDate(lastCycle.createdAt)})\n` +
      `- Synthèse : ${lastCycle.summary || "Cycle enregistré."}\n` +
      `${(lastCycle.outputs || []).slice(0, 5).map((output) => `- Sortie : ${output.type} ${output.title || output.id || ""}`.trim()).join("\n")}`
    : "- Aucun cycle précédent.";
  const body = `# ${title}\n\n` +
    `Phase : réveil / arbitrage humain / reward signal.\n\n` +
    `## Score\n\n` +
    `- Ratio d'auto-amélioration : ${Math.round(Number(score.ratio || 0) * 100)}%\n` +
    `- Suggestions ouvertes : ${pending.length}\n` +
    `- Feedback accepté : ${Number(feedback.accepted || 0)}\n` +
    `- Feedback refusé : ${Number(feedback.rejected || 0)}\n\n` +
    `${formatSnapshotDeltaMarkdown(delta)}\n\n` +
    `## À valider\n\n${pendingRows || "- [ ] Rien d'urgent. Choisir une prochaine action volontaire."}\n\n` +
    `## Trace du cycle précédent\n\n${lastCycleRows}\n\n` +
    `## Prochaine action\n\n` +
    `- [ ] Valider au moins une suggestion ou noter pourquoi elle est rejetée.\n` +
    `- [ ] Convertir le meilleur signal en note stratégique ou agentique.\n` +
    `- [ ] Créer un nouveau snapshot après arbitrage.\n\n` +
    `#reveil #reward-signal #memoire-agentique #snapshot-delta`;
  return upsertSystemNote(title, "Mémoire agentique", body, true);
}

function createCognitiveCycleReport(cycle, run, snapshot) {
  const score = cycle.score || calculateLearningScore();
  const title = `Cycle cognitif - ${formatLocalDate(new Date(cycle.createdAt))} - ${cyclePhaseLabel(cycle.phase)}`;
  const proposals = run?.proposals || [];
  const body = `# ${title}\n\n` +
    `Phase : ${cyclePhaseLabel(cycle.phase)}\n` +
    `Run : ${cycle.runId ? `\`${cycle.runId}\`` : "aucun"}\n` +
    `Snapshot : ${snapshot ? `\`${snapshot.hash}\`` : "aucun"}\n\n` +
    `## Score\n\n` +
    `- Ratio d'auto-amélioration : ${Math.round(Number(score.ratio || 0) * 100)}%\n` +
    `- Couverture mémoire : ${Math.round(Number(score.memoryCoverage || 0) * 100)}%\n` +
    `- Densité de liens : ${Math.round(Number(score.linkDensity || 0) * 100)}%\n` +
    `- Fraîcheur snapshot : ${Math.round(Number(score.snapshotFreshness || 0) * 100)}%\n` +
    `- Qualité feedback : ${Math.round(Number(score.feedbackQuality || 0) * 100)}%\n\n` +
    `## Sorties\n\n${(cycle.outputs || []).map((output) => `- ${output.type}: ${output.title || output.id || "ok"}`).join("\n") || "- Aucune sortie."}\n\n` +
    `## Suggestions ouvertes\n\n${proposals.filter((proposal) => proposal.status === "pending").map((proposal) => `- [ ] ${proposal.title} — ${proposal.detail}`).join("\n") || "- Aucune suggestion ouverte."}\n\n` +
    `## Lecture humaine\n\n${cycle.summary || "Cycle enregistré."}\n\n` +
    `#cycle-cognitif #memoire-agentique #audit`;
  return upsertSystemNote(title, "Mémoire agentique", body, true);
}

async function runCognitiveDayCycle() {
  if (!requireVaultUnlocked("lancer le cycle jour")) return null;
  const run = runDeterministicEnrichment(false);
  const contextNote = createShortContextNote();
  const snapshot = await createVaultSnapshot({ silent: true });
  const score = calculateLearningScore();
  const cycle = recordCognitiveCycle({
    phase: "day",
    runId: run?.id || "",
    snapshotId: snapshot?.id || "",
    snapshotHash: snapshot?.hash || "",
    score,
    summary: "Capture, contexte court, analyse relisible et snapshot de travail.",
    outputs: [
      contextNote ? { type: "note", title: contextNote.title, id: contextNote.id } : null,
      snapshot ? { type: "snapshot", title: snapshot.id, hash: snapshot.hash } : null,
      run ? { type: "run", title: run.id, proposals: run.proposals.length } : null,
    ].filter(Boolean),
  });
  createCognitiveCycleReport(cycle, run, snapshot);
  renderAll();
  toast(`Cycle jour enregistré : ${Math.round(score.ratio * 100)}%.`);
  return cycle;
}

async function runCognitiveNightCycle() {
  if (!requireVaultUnlocked("lancer le cycle nuit")) return null;
  const run = runDeterministicEnrichment(false);
  const dream = createDreamCycleNote();
  const synthesis = createNightSynthesisNote(run);
  const snapshot = await createVaultSnapshot({ silent: true });
  const score = calculateLearningScore();
  const cycle = recordCognitiveCycle({
    phase: "night",
    runId: run?.id || "",
    snapshotId: snapshot?.id || "",
    snapshotHash: snapshot?.hash || "",
    score,
    summary: "Compression nocturne, détection de notes froides, REM paradoxal et consolidation symbolique.",
    outputs: [
      dream ? { type: "note", title: dream.title, id: dream.id } : null,
      synthesis ? { type: "note", title: synthesis.title, id: synthesis.id } : null,
      snapshot ? { type: "snapshot", title: snapshot.id, hash: snapshot.hash } : null,
      run ? { type: "run", title: run.id, proposals: run.proposals.length } : null,
    ].filter(Boolean),
  });
  createCognitiveCycleReport(cycle, run, snapshot);
  renderAll();
  toast(`Cycle nuit enregistré : ${Math.round(score.ratio * 100)}%.`);
  return cycle;
}

async function runCognitiveWakeCycle() {
  if (!requireVaultUnlocked("lancer le cycle réveil")) return null;
  const run = latestEnrichmentRun() || runDeterministicEnrichment(false);
  let referenceSnapshot = latestSnapshot();
  if (!referenceSnapshot || snapshotNeedsRefresh()) {
    referenceSnapshot = await createVaultSnapshot({ silent: true });
  }
  const delta = compareSnapshots(referenceSnapshot, previousSnapshotFor(referenceSnapshot));
  const agenda = createWakeAgendaNote(run, referenceSnapshot, delta);
  const snapshot = await createVaultSnapshot({ silent: true });
  const score = calculateLearningScore();
  const cycle = recordCognitiveCycle({
    phase: "wake",
    runId: run?.id || "",
    snapshotId: snapshot?.id || referenceSnapshot?.id || "",
    snapshotHash: snapshot?.hash || referenceSnapshot?.hash || "",
    score,
    summary: "Réveil cognitif : delta snapshots, validation humaine, reward signal et prochaine action.",
    outputs: [
      agenda ? { type: "note", title: agenda.title, id: agenda.id } : null,
      snapshot ? { type: "snapshot", title: snapshot.id, hash: snapshot.hash } : null,
      { type: "delta", title: snapshotDeltaSummary(delta), added: delta.addedCount, updated: delta.updatedCount, removed: delta.removedCount },
      run ? { type: "run", title: run.id, proposals: run.proposals.length } : null,
    ].filter(Boolean),
  });
  createCognitiveCycleReport(cycle, run, snapshot || referenceSnapshot);
  renderAll();
  toast(`Cycle réveil prêt : ${snapshotDeltaSummary(delta)}.`);
  return cycle;
}

function makeCognitiveLoopSpec(snapshot = latestSnapshot(), score = calculateLearningScore()) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris";
  const latestDelta = snapshot ? compareSnapshots(snapshot, previousSnapshotFor(snapshot)) : null;
  return {
    format: "povmind-cognitive-loop",
    version: 1,
    exportedAt: nowIso(),
    timezone,
    schedule: {
      dayCycle: "manual or after meaningful notes/code changes",
      nightCycleCron: "21 2 * * *",
      wakeReview: "manual after night cycle before accepting changes",
      weeklyReviewCron: "34 8 * * 1",
    },
    phases: [
      { id: "day", role: "capture/action/exploration", outputs: ["short-context", "enrichment-run", "snapshot"] },
      { id: "night", role: "compression/consolidation/controlled-noise", outputs: ["dream-note", "night-synthesis", "snapshot"] },
      { id: "wake", role: "human validation", outputs: ["wake-agenda", "snapshot-delta", "accepted-patterns", "rejected-patterns", "next-action"] },
    ],
    score,
    latestSnapshot: snapshot ? {
      id: snapshot.id,
      createdAt: snapshot.createdAt,
      contentHash: snapshot.hash,
    } : null,
    latestSnapshotDelta: latestDelta,
    guardrails: [
      "Never merge dream outputs automatically.",
      "Human feedback is the reward signal.",
      "Snapshots freeze state; journal notes explain why.",
      "Cron may audit context freshness, but browser-local vault data remains local-first.",
    ],
    expectedFiles: [
      ".povmind/automation/cognitive-loop.json",
      ".povmind/automation/cognitive-loop.md",
      ".github/workflows/povmind-cognitive-loop.yml",
    ],
  };
}

function makeCognitiveLoopMarkdown(spec) {
  return `# PovMind cognitive loop\n\n` +
    `Exporté : ${spec.exportedAt}\n\n` +
    `## Score actuel\n\n` +
    `- Ratio d'auto-amélioration : ${Math.round(Number(spec.score?.ratio || 0) * 100)}%\n` +
    `- Couverture mémoire : ${Math.round(Number(spec.score?.memoryCoverage || 0) * 100)}%\n` +
    `- Densité de liens : ${Math.round(Number(spec.score?.linkDensity || 0) * 100)}%\n` +
    `- Suggestions ouvertes : ${Number(spec.score?.pendingSuggestions || 0)}\n\n` +
    `## Rythme\n\n` +
    `- Jour : capture, action, exploration, contexte court.\n` +
    `- Nuit : compression, consolidation, bruit contrôlé, synthèse rêve.\n` +
    `- Réveil : agenda de validation, delta snapshots, acceptation/refus, prochaine action.\n\n` +
    `## Dernier delta\n\n` +
    `${snapshotDeltaSummary(spec.latestSnapshotDelta)}\n\n` +
    `## GitHub cron\n\n` +
    `Le workflow \`.github/workflows/povmind-cognitive-loop.yml\` audite la fraîcheur du contexte versionné. Il ne lit pas le vault local du navigateur et ne remplace pas la validation humaine.\n\n` +
    `## Garde-fous\n\n${spec.guardrails.map((line) => `- ${line}`).join("\n")}\n`;
}

function makeGithubCognitiveWorkflow(basePath) {
  return `name: PovMind cognitive loop\n\n` +
    `on:\n` +
    `  schedule:\n` +
    `    - cron: '21 2 * * *'\n` +
    `  workflow_dispatch:\n\n` +
    `permissions:\n` +
    `  contents: read\n\n` +
    `jobs:\n` +
    `  audit-context:\n` +
    `    runs-on: ubuntu-latest\n` +
    `    steps:\n` +
    `      - uses: actions/checkout@v4\n` +
    `      - name: Audit PovMind context freshness\n` +
    `        shell: bash\n` +
    `        run: |\n` +
    `          set -euo pipefail\n` +
    `          SPEC=\"${basePath}/automation/cognitive-loop.json\"\n` +
    `          MANIFEST=\"${basePath}/manifest.json\"\n` +
    `          if [ ! -f \"$SPEC\" ]; then\n` +
    `            echo \"::warning::PovMind cognitive loop spec missing at $SPEC\"\n` +
    `            exit 0\n` +
    `          fi\n` +
    `          if [ ! -f \"$MANIFEST\" ]; then\n` +
    `            echo \"::warning::PovMind manifest missing at $MANIFEST\"\n` +
    `            exit 0\n` +
    `          fi\n` +
    `          node - <<'NODE'\n` +
    `          const fs = require('fs');\n` +
    `          const spec = JSON.parse(fs.readFileSync(process.env.SPEC || '${basePath}/automation/cognitive-loop.json', 'utf8'));\n` +
    `          const manifest = JSON.parse(fs.readFileSync(process.env.MANIFEST || '${basePath}/manifest.json', 'utf8'));\n` +
    `          const ratio = Math.round(Number(spec.score?.ratio || 0) * 100);\n` +
    `          console.log('PovMind score:', ratio + '%');\n` +
    `          console.log('Vault:', manifest.activeVault?.name || manifest.activeVaultId || 'unknown');\n` +
    `          console.log('Latest snapshot:', manifest.snapshot?.contentHash || 'none');\n` +
    `          if (!manifest.snapshot?.contentHash) console.log('::warning::No PovMind snapshot hash in manifest');\n` +
    `          if (ratio < 55) console.log('::warning::PovMind auto-improvement ratio below 55%');\n` +
    `          NODE\n`;
}

function createCognitiveCronNote(snapshot = latestSnapshot()) {
  const spec = makeCognitiveLoopSpec(snapshot, calculateLearningScore());
  const title = "Cron auto-analytique - GitHub";
  const body = `# ${title}\n\n` +
    `Cette note décrit le pont entre le vault local-first, les snapshots et le cron GitHub versionnable.\n\n` +
    `## Rythme proposé\n\n` +
    `- Jour : contexte court, run d'enrichissement, snapshot.\n` +
    `- Nuit : synthèse nocturne, cycle rêve, détection des notes froides.\n` +
    `- Réveil : validation humaine des suggestions.\n` +
    `- GitHub cron : audit de fraîcheur du contexte \`.povmind/\`, sans lire les secrets ni le vault local du navigateur.\n\n` +
    `## Fichiers exportés\n\n${spec.expectedFiles.map((file) => `- \`${file}\``).join("\n")}\n\n` +
    `## Score actuel\n\n` +
    `- Ratio : ${Math.round(Number(spec.score.ratio || 0) * 100)}%\n` +
    `- Snapshot : ${snapshot ? `\`${snapshot.hash}\`` : "à créer"}\n\n` +
    `## Dernier delta\n\n${snapshotDeltaSummary(spec.latestSnapshotDelta)}\n\n` +
    `#cron #github #auto-apprentissage #memoire-agentique`;
  return upsertSystemNote(title, "Mémoire agentique", body, true);
}

async function exportCognitiveCronBundle() {
  if (!requireVaultUnlocked("exporter le cron cognitif")) return null;
  createCognitiveCronNote();
  const snapshot = await createVaultSnapshot({ silent: true });
  const { context, files } = buildPovmindContextFiles(snapshot);
  const zipBytes = createZipArchive(files);
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(`povmind-cognitive-loop-${date}.zip`, new Blob([zipBytes], { type: "application/zip" }));
  renderAll();
  toast(`Bundle cron exporté : ${context.files.length} note(s).`);
  return { context, files, snapshot };
}

function renderLearningPanel() {
  if (!els.learningStatus) return;
  if (vaultLocked()) {
    els.learningStatus.textContent = "Verrouillé";
    els.runEnrichmentBtn.disabled = true;
    els.createEnrichmentReportBtn.disabled = true;
    els.runDayCycleBtn.disabled = true;
    els.runNightCycleBtn.disabled = true;
    els.runWakeCycleBtn.disabled = true;
    els.exportCognitiveCronBtn.disabled = true;
    els.memoryTypeChips.innerHTML = "";
    els.immediateContextSummary.innerHTML = `<div class="empty-state">Déverrouille le vault pour lire la mémoire apprenante.</div>`;
    els.learningMetrics.innerHTML = "";
    els.cycleMetrics.innerHTML = "";
    els.cognitiveScore.textContent = "0%";
    els.cognitiveCyclesList.innerHTML = "";
    els.suggestionsList.innerHTML = "";
    return;
  }

  const note = activeNote();
  const explicitTypes = new Set(cleanMemoryTypes(note?.memoryTypes));
  const activeTypes = new Set(effectiveMemoryTypes(note));
  const pending = pendingEnrichmentProposals();
  const latest = latestEnrichmentRun();
  const feedback = state.learningMemory?.feedback || {};
  const totalFeedback = Number(feedback.accepted || 0) + Number(feedback.rejected || 0) + Number(feedback.modified || 0);
  const score = calculateLearningScore();

  els.learningStatus.textContent = pending.length ? `${pending.length} à relire` : latest ? "Stable" : "À analyser";
  els.runEnrichmentBtn.disabled = false;
  els.createEnrichmentReportBtn.disabled = false;
  els.runDayCycleBtn.disabled = false;
  els.runNightCycleBtn.disabled = false;
  els.runWakeCycleBtn.disabled = false;
  els.exportCognitiveCronBtn.disabled = false;

  els.memoryTypeChips.innerHTML = MEMORY_TYPES
    .map((type) => {
      const active = activeTypes.has(type.id);
      const inferred = active && !explicitTypes.has(type.id);
      const classes = ["memory-type-chip", active ? "active" : "", inferred ? "inferred" : ""].filter(Boolean).join(" ");
      return `<button class="${classes}" type="button" data-memory-type="${attr(type.id)}" title="${attr(type.detail)}">${escapeHtml(type.label)}</button>`;
    })
    .join("");

  if (!note) {
    els.immediateContextSummary.innerHTML = `<div class="empty-state">Aucune note active.</div>`;
  } else {
    const outgoing = outgoingTargetsForNote(note).length;
    const backlinks = state.notes
      .filter((candidate) => candidate.id !== note.id)
      .filter((candidate) => extractWikiLinks(candidate.body).some((title) => normalizeTitle(title) === normalizeTitle(note.title))).length;
    const types = [...activeTypes].map((typeId) => memoryTypeById(typeId)?.label || typeId).join(", ");
    els.immediateContextSummary.innerHTML = `
      <strong>${escapeHtml(note.title)}</strong>
      <span>${escapeHtml(types)} · ${outgoing} sortant(s) · ${backlinks} backlink(s)</span>`;
  }

  els.learningMetrics.innerHTML = `
    <span>${state.enrichmentRuns.length} run(s)</span>
    <span>${Number(feedback.accepted || 0)} ok</span>
    <span>${Number(feedback.rejected || 0)} non</span>
    <span>reward ${totalFeedback ? Number(state.learningMemory?.lastReward || 0).toFixed(2) : "0.00"}</span>`;

  els.cognitiveScore.textContent = `${Math.round(score.ratio * 100)}%`;
  els.cycleMetrics.innerHTML = `
    <span>mémoire ${Math.round(score.memoryCoverage * 100)}%</span>
    <span>liens ${Math.round(score.linkDensity * 100)}%</span>
    <span>snapshot ${Math.round(score.snapshotFreshness * 100)}%</span>
    <span>froid ${Math.round(score.coldPressure * 100)}%</span>`;

  els.cognitiveCyclesList.innerHTML = state.cognitiveCycles.length
    ? state.cognitiveCycles.slice(0, 4).map((cycle) => `
        <button class="cycle-row" type="button" data-cycle-id="${attr(cycle.id)}" title="${attr(cycle.summary)}">
          <strong>${escapeHtml(cyclePhaseLabel(cycle.phase))}</strong>
          <span>${Math.round(Number(cycle.score?.ratio || 0) * 100)}% · ${escapeHtml(formatDate(cycle.createdAt))}</span>
        </button>`).join("")
    : `<div class="empty-state">Aucun cycle enregistré.</div>`;

  if (!latest) {
    els.suggestionsList.innerHTML = `<div class="empty-state">Lance une analyse pour générer des améliorations relisibles.</div>`;
    return;
  }

  if (!pending.length) {
    els.suggestionsList.innerHTML = `<div class="empty-state">Dernier run traité. Relance l'analyse après un changement important.</div>`;
    return;
  }

  els.suggestionsList.innerHTML = pending
    .map((proposal) => `
      <article class="suggestion-card">
        <header>
          <strong>${escapeHtml(proposal.title)}</strong>
          <span>${Math.round(proposal.confidence * 100)}% · ${escapeHtml(proposal.risk)}</span>
        </header>
        <p>${escapeHtml(proposal.detail)}</p>
        <div class="suggestion-actions">
          <button class="primary-btn" type="button" data-proposal-accept="${attr(proposal.id)}">Appliquer</button>
          <button class="ghost-btn" type="button" data-proposal-reject="${attr(proposal.id)}">Ignorer</button>
        </div>
      </article>`)
    .join("");
}

function shortHash(value) {
  return value ? `${String(value).slice(0, 12)}…` : "—";
}

function renderRepoPanel() {
  const linked = repoIsLinked();
  const repo = cleanRepoState(state.repo);
  const locked = vaultLocked();
  els.repoStatus.textContent = linked ? "Lié" : "Non lié";
  els.repoNameLabel.textContent = linked ? (repo.name || repo.root || "Repo") : "—";
  els.importRepoBtn.disabled = locked;
  els.exportRepoBtn.disabled = locked || !linked;
  els.codeRepoNoteBtn.disabled = locked || !linked;

  if (!linked) {
    els.repoMetaLine.textContent = "Importe un manifeste généré depuis le repo.";
    els.repoFilesList.innerHTML = `<div class="empty-state">Aucun repo lié. Lance npm run repo:manifest puis importe le JSON.</div>`;
    return;
  }

  const status = repo.dirty === true ? "dirty" : repo.dirty === false ? "clean" : "inconnu";
  const branch = repo.branch || "branche ?";
  const commit = repo.commit ? repo.commit.slice(0, 8) : "commit ?";
  els.repoMetaLine.textContent = `${branch} @ ${commit} · ${status} · ${repo.indexedCount} fichier(s) indexé(s) · ${shortHash(repo.treeHash)}`;

  if (!repo.files.length) {
    els.repoFilesList.innerHTML = `<div class="empty-state">Repo lié sans fichiers exportés.</div>`;
    return;
  }

  els.repoFilesList.innerHTML = repo.files
    .slice(0, MAX_REPO_FILES_RENDERED)
    .map((file) => `
      <div class="repo-file-row">
        <strong>${escapeHtml(file.path)}</strong>
        <span>${escapeHtml(file.language || "texte")} · ${Number(file.bytes || 0)} o · ${escapeHtml(shortHash(file.hash))}</span>
      </div>`)
    .join("");
}

function renderGithubPanel() {
  if (!els.githubStatus) return;
  const sync = cleanGithubSyncState(state.githubSync);
  const locked = vaultLocked();
  const connected = Boolean(sync.connector.configured && sync.connector.authenticated);
  const configured = Boolean(sync.connector.configured);
  els.githubStatus.textContent = connected ? "Connecté" : configured ? "OAuth prêt" : "Local";
  els.githubRepoInput.value = sync.repoFullName;
  els.githubBranchInput.value = sync.branch;
  els.githubPathInput.value = sync.basePath;
  els.githubScanBtn.disabled = locked || !sync.repoFullName;
  els.githubEnrichBtn.disabled = locked || !sync.repoFullName;
  els.githubPushBtn.disabled = locked || !sync.repoFullName || !configured;
  els.githubPullBtn.disabled = locked || !sync.repoFullName || !configured;
  els.exportGithubContextBtn.disabled = locked;
  els.importGithubContextBtn.disabled = locked;

  const last = sync.lastSyncedAt ? ` · sync ${formatDate(sync.lastSyncedAt)}` : "";
  const commit = sync.lastCommit ? ` · ${sync.lastCommit.slice(0, 8)}` : "";
  const mode = connected
    ? "Token GitHub gardé côté serveur."
    : configured
      ? "OAuth configuré. Connecte ton compte pour pousser/tirer."
      : "Export local prêt. Configure Cloud Run pour le push/pull.";
  els.githubMetaLine.textContent = `${sync.repoFullName || "Repo GitHub non renseigné"} · ${sync.branch} · ${sync.basePath}${commit}${last}. ${mode}`;
}

function renderNotesList() {
  if (vaultLocked()) {
    els.notesList.innerHTML = `<div class="empty-state">Vault chiffré verrouillé. Entre la passphrase dans Accès assistant.</div>`;
    return;
  }
  const notes = filteredNotes();
  if (!notes.length) {
    els.notesList.innerHTML = `<div class="empty-state">Aucune note trouvée. Crée une note ou retire le filtre actif.</div>`;
    return;
  }

  const groups = new Map();
  for (const note of notes) {
    const folder = normalizeFolder(note.folder);
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push(note);
  }

  els.notesList.innerHTML = [...groups.entries()]
    .map(([folder, groupNotes]) => `
      <section class="note-group">
        <div class="note-group-title"><span>${escapeHtml(folder)}</span><span>${groupNotes.length}</span></div>
        ${groupNotes.map((note) => {
          const active = note.id === state.activeId ? " active" : "";
          const snippet = clampText(note.body.replace(/[#*_`\[\]]/g, ""), 94) || "Note vide";
          const star = isStarred(note.id) ? `<span class="note-row-star" aria-hidden="true">★</span>` : "";
          return `
            <button class="note-row${active}" type="button" data-note-id="${attr(note.id)}">
              <span class="note-row-title">
                <span>${escapeHtml(note.title)}</span>
                <span>${star}<span class="note-row-time">${escapeHtml(formatDate(note.updatedAt))}</span></span>
              </span>
              <span class="note-row-snippet">${escapeHtml(snippet)}</span>
            </button>`;
        }).join("")}
      </section>`)
    .join("");
}

function renderTagFilters() {
  const tags = allTags();
  if (!tags.length) {
    els.tagFilters.innerHTML = "";
    return;
  }

  const clear = state.tagFilter
    ? `<button class="tag-chip active" type="button" data-tag-clear="true">Tous ×</button>`
    : "";

  els.tagFilters.innerHTML =
    clear +
    tags
      .slice(0, 16)
      .map(([tag, count]) => {
        const active = tag === state.tagFilter ? " active" : "";
        return `<button class="tag-chip${active}" type="button" data-tag="${attr(tag)}">#${escapeHtml(tag)} <small>${count}</small></button>`;
      })
      .join("");
}

function renderFolderFilters() {
  const folders = allFolders();
  if (!folders.length) {
    els.folderFilters.innerHTML = "";
    return;
  }

  const clearActive = state.folderFilter ? "" : " active";
  const clear = `
    <button class="folder-chip folder-chip-all${clearActive}" type="button" data-folder-clear="true">
      <span class="folder-chip-label">Tous</span>
      <small>${state.notes.length}</small>
    </button>`;

  els.folderFilters.innerHTML =
    clear +
    folders
      .map(([folder, count]) => {
        const active = folder === state.folderFilter ? " active" : "";
        return `
          <button class="folder-chip${active}" type="button" data-folder="${attr(folder)}" title="${attr(folder)}">
            <span class="folder-chip-label">${escapeHtml(folder)}</span>
            <small>${count}</small>
          </button>`;
      })
      .join("");
}

function renderFolderSuggestions() {
  els.folderSuggestions.innerHTML = allFolders()
    .map(([folder]) => `<option value="${attr(folder)}"></option>`)
    .join("");
}

function renderStarredList() {
  const starred = state.notes
    .filter((note) => isStarred(note.id))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  if (!starred.length) {
    els.starredList.innerHTML = `<div class="empty-state">Aucun favori.</div>`;
    return;
  }

  els.starredList.innerHTML = starred
    .map((note) => `
      <button class="mini-note" type="button" data-note-id="${attr(note.id)}">
        ${escapeHtml(note.title)}
        <span>${escapeHtml(normalizeFolder(note.folder))}</span>
      </button>`)
    .join("");
}

function renderActiveNote() {
  if (vaultLocked()) {
    els.titleInput.disabled = true;
    els.folderInput.disabled = true;
    els.editor.disabled = true;
    els.starNoteBtn.disabled = true;
    els.templateBtn.disabled = true;
    els.exportMdBtn.disabled = true;
    els.deleteNoteBtn.disabled = true;
    els.titleInput.value = "Vault verrouillé";
    els.activeTabTitle.textContent = "Vault verrouillé";
    els.folderInput.value = "";
    els.editor.value = "";
    els.editor.placeholder = "Déverrouille le vault pour lire et éditer les notes.";
    els.wordCount.textContent = "0 mot";
    els.savedStatus.textContent = "Verrouillé";
    els.starNoteBtn.setAttribute("aria-pressed", "false");
    return;
  }
  const note = activeNote();
  if (!note) return;
  els.titleInput.disabled = false;
  els.folderInput.disabled = false;
  els.editor.disabled = false;
  els.starNoteBtn.disabled = false;
  els.templateBtn.disabled = false;
  els.exportMdBtn.disabled = false;
  els.deleteNoteBtn.disabled = false;
  els.editor.placeholder = "Écris en Markdown. Exemple : [[Accueil]], #tag, **gras**…";
  els.titleInput.value = note.title;
  els.activeTabTitle.textContent = clampText(note.title || "Sans titre", 34);
  els.folderInput.value = normalizeFolder(note.folder);
  els.editor.value = note.body;
  els.savedStatus.textContent = vaultEncrypted() ? "Chiffré" : "Sauvegardé";
  els.wordCount.textContent = `${countWords(note.body)} ${countWords(note.body) > 1 ? "mots" : "mot"}`;
  els.editorGrid.dataset.view = state.view;
  els.viewModeBtn.textContent = state.view === "split" ? "Split" : state.view === "edit" ? "Éditeur" : "Aperçu";
  const starred = isStarred(note.id);
  els.starNoteBtn.textContent = starred ? "★" : "☆";
  els.starNoteBtn.setAttribute("aria-pressed", String(starred));
  els.starNoteBtn.setAttribute("aria-label", starred ? "Retirer des favoris" : "Ajouter aux favoris");
  els.starNoteBtn.title = starred ? "Retirer des favoris" : "Ajouter aux favoris";
}

function countWords(text) {
  return (String(text || "").trim().match(/[\p{L}\p{N}’'-]+/gu) || []).length;
}

function renderPreview() {
  if (vaultLocked()) {
    els.preview.innerHTML = `<p>Vault chiffré verrouillé. La clé dérivée de la passphrase n'est pas en mémoire.</p>`;
    return;
  }
  const note = activeNote();
  if (!note) {
    els.preview.innerHTML = `<p>Aucune note active.</p>`;
    return;
  }
  els.preview.innerHTML = markdownToHtml(note.body || "");
}

function markdownToHtml(markdown) {
  const codeBlocks = [];
  let source = String(markdown || "");

  source = source.replace(/```([\w-]+)?\n?([\s\S]*?)```/g, (_, lang, code) => {
    const token = `@@CODE_BLOCK_${codeBlocks.length}@@`;
    codeBlocks.push(`<pre><code${lang ? ` data-lang="${attr(lang)}"` : ""}>${escapeHtml(code.trimEnd())}</code></pre>`);
    return `\n${token}\n`;
  });

  source = escapeHtml(source);
  source = source.replace(/\r\n/g, "\n");
  source = source.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, rawTitle, rawLabel) => {
    const title = String(rawTitle || "").trim();
    const label = String(rawLabel || rawTitle || "").trim();
    const exists = !!findNoteByTitle(unescapeHtml(title));
    return `<a href="#" class="wikilink${exists ? "" : " missing"}" data-note-title="${attr(unescapeHtml(title))}">${escapeHtml(unescapeHtml(label))}</a>`;
  });
  source = source.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, `<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>`);
  source = source.replace(/`([^`]+)`/g, `<code>$1</code>`);
  source = source.replace(/\*\*([^*]+)\*\*/g, `<strong>$1</strong>`);
  source = source.replace(/__([^_]+)__/g, `<strong>$1</strong>`);
  source = source.replace(/(^|\s)\*([^*\n]+)\*/g, `$1<em>$2</em>`);
  source = source.replace(/(^|\s)_([^_\n]+)_/g, `$1<em>$2</em>`);
  source = source.replace(/~~([^~]+)~~/g, `<del>$1</del>`);

  const lines = source.split("\n");
  const out = [];
  let inUl = false;
  let inOl = false;
  let inBlockquote = false;

  const closeLists = () => {
    if (inUl) out.push("</ul>");
    if (inOl) out.push("</ol>");
    inUl = false;
    inOl = false;
  };
  const closeBlockquote = () => {
    if (inBlockquote) out.push("</blockquote>");
    inBlockquote = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeLists();
      closeBlockquote();
      continue;
    }

    if (/^@@CODE_BLOCK_\d+@@$/.test(trimmed)) {
      closeLists();
      closeBlockquote();
      out.push(trimmed);
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      closeLists();
      closeBlockquote();
      out.push("<hr>");
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeLists();
      closeBlockquote();
      const level = heading[1].length;
      out.push(`<h${level}>${heading[2]}</h${level}>`);
      continue;
    }

    const quote = trimmed.match(/^&gt;\s?(.+)$/);
    if (quote) {
      closeLists();
      if (!inBlockquote) {
        out.push("<blockquote>");
        inBlockquote = true;
      }
      out.push(`<p>${quote[1]}</p>`);
      continue;
    }

    const task = trimmed.match(/^[-*+]\s+\[( |x|X)\]\s+(.+)$/);
    if (task) {
      closeBlockquote();
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      const checked = task[1].toLocaleLowerCase("fr-FR") === "x" ? " checked" : "";
      out.push(`<li class="task-item"><input type="checkbox" disabled${checked}> <span>${task[2]}</span></li>`);
      continue;
    }

    const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
    if (unordered) {
      closeBlockquote();
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${unordered[1]}</li>`);
      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      closeBlockquote();
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${ordered[1]}</li>`);
      continue;
    }

    closeLists();
    closeBlockquote();
    out.push(`<p>${trimmed}</p>`);
  }

  closeLists();
  closeBlockquote();

  let html = out.join("\n");
  codeBlocks.forEach((block, index) => {
    html = html.replace(`@@CODE_BLOCK_${index}@@`, block);
  });
  return html || `<p class="empty-state">Note vide.</p>`;
}

function unescapeHtml(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function renderBacklinks() {
  const note = activeNote();
  if (!note) {
    els.backlinkCount.textContent = "0";
    els.backlinks.innerHTML = vaultLocked()
      ? `<div class="empty-state">Backlinks verrouillés avec les notes du vault.</div>`
      : `<div class="empty-state">Aucune note active.</div>`;
    return;
  }
  const wanted = normalizeTitle(note.title);
  const backlinks = state.notes.filter((candidate) => {
    if (candidate.id === note.id) return false;
    return extractWikiLinks(candidate.body).some((title) => normalizeTitle(title) === wanted);
  });

  els.backlinkCount.textContent = String(backlinks.length);
  if (!backlinks.length) {
    els.backlinks.innerHTML = `<div class="empty-state">Aucune note ne pointe encore vers celle-ci.</div>`;
    return;
  }

  els.backlinks.innerHTML = backlinks
    .map((item) => {
      const snippet = backlinkSnippet(item.body, note.title);
      return `
        <button class="backlink-card" type="button" data-note-id="${attr(item.id)}">
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(snippet || clampText(item.body, 110))}</p>
        </button>`;
    })
    .join("");
}

function backlinkSnippet(body, title) {
  const plain = String(body || "").replace(/\s+/g, " ").trim();
  const link = `[[${title}`.toLocaleLowerCase("fr-FR");
  const index = plain.toLocaleLowerCase("fr-FR").indexOf(link);
  if (index < 0) return clampText(plain, 110);
  const start = Math.max(0, index - 42);
  return clampText(`${start > 0 ? "…" : ""}${plain.slice(start, index + 68)}`, 120);
}

function renderNoteTags() {
  const note = activeNote();
  const tags = note ? tagsForNote(note) : [];
  if (!tags.length) {
    els.noteTags.innerHTML = `<div class="empty-state">Aucun tag dans cette note.</div>`;
    return;
  }
  els.noteTags.innerHTML = tags
    .map((tag) => `<button class="tag-chip" type="button" data-tag="${attr(tag)}">#${escapeHtml(tag)}</button>`)
    .join("");
}

function outgoingTargetsForNote(note) {
  if (!note) return [];
  return uniqueWikiTargets(note.body).map((target) => {
    const linked = findNoteByTitle(target.title);
    return {
      title: target.title,
      note: linked,
      missing: !linked,
    };
  });
}

function renderOutgoingLinks() {
  const note = activeNote();
  const targets = outgoingTargetsForNote(note);
  els.outgoingCount.textContent = String(targets.length);

  if (!targets.length) {
    els.outgoingLinks.innerHTML = `<div class="empty-state">Aucun lien wiki sortant.</div>`;
    return;
  }

  els.outgoingLinks.innerHTML = targets
    .map((target) => {
      const folder = target.note ? normalizeFolder(target.note.folder) : "Note manquante";
      const idAttr = target.note ? ` data-note-id="${attr(target.note.id)}"` : "";
      return `
        <button class="link-card${target.missing ? " missing" : ""}" type="button" data-note-title="${attr(target.title)}"${idAttr}>
          ${escapeHtml(target.title)}
          <span>${escapeHtml(folder)}</span>
        </button>`;
    })
    .join("");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampGraphPosition(position) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: clamp(x, 28, 512),
    y: clamp(y, 32, 348),
  };
}

function loadGraphPositions() {
  try {
    const raw = readVaultStoredValue("graph-layout", GRAPH_LAYOUT_KEY, LEGACY_GRAPH_LAYOUT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const positions = parsed?.positions && typeof parsed.positions === "object" ? parsed.positions : parsed;
    if (!positions || typeof positions !== "object") return {};

    return Object.fromEntries(
      Object.entries(positions)
        .map(([nodeId, position]) => [nodeId, clampGraphPosition(position)])
        .filter(([, position]) => position)
    );
  } catch {
    return {};
  }
}

function persistGraphPositions() {
  localStorage.setItem(
    vaultStorageKey("graph-layout"),
    JSON.stringify({
      version: 1,
      updatedAt: nowIso(),
      positions: state.graphPositions,
    })
  );
}

// Force-directed defaults — repulsion between every pair, attraction along
// edges, gentle gravity toward center. The active note is pinned at the
// centre so the user's current focus stays in view.
const GRAPH_FORCE_DEFAULTS = {
  repelStrength: 1400,
  linkStrength: 0.05,
  linkRestLength: 75,
  gravity: 0.02,
  damping: 0.85,
  iterations: 280,
} as const;

function forceDirectedGraphPositions(
  nodes,
  edges,
  settings = GRAPH_FORCE_DEFAULTS,
): Map<string, GraphPosition> {
  const width = 540;
  const height = 380;
  const cx = width / 2;
  const cy = height / 2;
  const positions = new Map<string, GraphPosition>();

  if (nodes.length === 0) return positions;
  if (nodes.length === 1) {
    positions.set(nodes[0].id, { x: cx, y: cy });
    return positions;
  }

  // Deterministic initial layout: golden-angle spiral from the centre. Same
  // seed across renders means the same vault gets the same starting shape,
  // so re-running the sim doesn't jitter wildly between sessions.
  const pos = nodes.map((n, i) => {
    if (n.id === state.activeId) return { x: cx, y: cy };
    const angle = i * 2.39996; // golden angle in radians
    const r = 60 + Math.sqrt(i) * 18;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });
  const vel = nodes.map(() => ({ x: 0, y: 0 }));
  const nodeIndex: Map<string, number> = new Map();
  nodes.forEach((n, i) => nodeIndex.set(n.id, i));
  const pinned = nodes.map((n) => n.id === state.activeId);

  for (let iter = 0; iter < settings.iterations; iter++) {
    // Repulsion across all pairs (O(n²) — fine for n ≤ 80).
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = pos[j].x - pos[i].x;
        const dy = pos[j].y - pos[i].y;
        const distSq = dx * dx + dy * dy + 0.01;
        const dist = Math.sqrt(distSq);
        const f = settings.repelStrength / distSq;
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        vel[i].x -= fx;
        vel[i].y -= fy;
        vel[j].x += fx;
        vel[j].y += fy;
      }
    }

    // Attraction along edges (linear spring toward rest length).
    for (const edge of edges) {
      const i = nodeIndex.get(edge.from);
      const j = nodeIndex.get(edge.to);
      if (i === undefined || j === undefined) continue;
      const dx = pos[j].x - pos[i].x;
      const dy = pos[j].y - pos[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy + 0.01);
      const f = (dist - settings.linkRestLength) * settings.linkStrength;
      const fx = (dx / dist) * f;
      const fy = (dy / dist) * f;
      vel[i].x += fx;
      vel[i].y += fy;
      vel[j].x -= fx;
      vel[j].y -= fy;
    }

    // Gravity + damping + integrate. Pinned nodes (active) stay put.
    for (let i = 0; i < nodes.length; i++) {
      if (pinned[i]) {
        vel[i].x = 0;
        vel[i].y = 0;
        pos[i].x = cx;
        pos[i].y = cy;
        continue;
      }
      vel[i].x += (cx - pos[i].x) * settings.gravity;
      vel[i].y += (cy - pos[i].y) * settings.gravity;
      vel[i].x *= settings.damping;
      vel[i].y *= settings.damping;
      pos[i].x += vel[i].x;
      pos[i].y += vel[i].y;
      pos[i].x = clamp(pos[i].x, 28, 512);
      pos[i].y = clamp(pos[i].y, 32, 348);
    }
  }

  nodes.forEach((n, i) => positions.set(n.id, { x: pos[i].x, y: pos[i].y }));
  return positions;
}

function buildDefaultGraphPositions(nodes, edges = []): Map<string, GraphPosition> {
  return forceDirectedGraphPositions(nodes, edges);
}

function resolveGraphPositions(nodes, edges = []): Map<string, GraphPosition> {
  const defaults = buildDefaultGraphPositions(nodes, edges);
  const resolved: Record<string, GraphPosition> = {};
  let newlyPlaced = 0;

  for (const node of nodes) {
    const stored = clampGraphPosition(state.graphPositions[node.id]);
    if (stored) {
      resolved[node.id] = stored;
    } else {
      const computed = defaults.get(node.id);
      if (computed) {
        resolved[node.id] = computed;
        // Persist the freshly computed position so the sim doesn't re-run on
        // every render for the same node set. User drags overwrite as before.
        state.graphPositions[node.id] = computed;
        newlyPlaced++;
      }
    }
  }
  if (newlyPlaced > 0) {
    try { persistGraphPositions(); } catch (_) { /* ignore localStorage quota */ }
  }

  state.graphRuntimePositions = resolved;
  return new Map(Object.entries(resolved));
}

function graphPointFromEvent(event) {
  const matrix = els.graph.getScreenCTM();
  if (!matrix) return null;
  const point = els.graph.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(matrix.inverse());
}

function graphNodeElement(nodeId) {
  return [...els.graph.querySelectorAll("[data-node-id]")].find((node) => node.dataset.nodeId === nodeId) || null;
}

function updateGraphNodePosition(nodeId, position) {
  const node = graphNodeElement(nodeId);
  if (node) node.setAttribute("transform", `translate(${position.x.toFixed(1)} ${position.y.toFixed(1)})`);
  updateGraphEdges();
}

function updateGraphEdges() {
  for (const line of els.graph.querySelectorAll("line[data-edge-from][data-edge-to]")) {
    const from = state.graphRuntimePositions[line.dataset.edgeFrom];
    const to = state.graphRuntimePositions[line.dataset.edgeTo];
    if (!from || !to) continue;
    line.setAttribute("x1", from.x.toFixed(1));
    line.setAttribute("y1", from.y.toFixed(1));
    line.setAttribute("x2", to.x.toFixed(1));
    line.setAttribute("y2", to.y.toFixed(1));
  }
}

function handleGraphPointerDown(event) {
  const node = event.target.closest("[data-node-id]");
  if (!node || !els.graph.contains(node)) return;

  const start = graphPointFromEvent(event);
  if (!start) return;

  const nodeId = node.dataset.nodeId;
  const current = state.graphRuntimePositions[nodeId] || clampGraphPosition(state.graphPositions[nodeId]);
  if (!current) return;

  state.graphDragging = {
    nodeId,
    pointerId: event.pointerId,
    startX: start.x,
    startY: start.y,
    baseX: current.x,
    baseY: current.y,
    moved: false,
  };

  node.classList.add("dragging");
  els.graph.classList.add("dragging");
  els.graph.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function handleGraphPointerMove(event) {
  const drag = state.graphDragging;
  if (!drag || drag.pointerId !== event.pointerId) return;

  const point = graphPointFromEvent(event);
  if (!point) return;

  const dx = point.x - drag.startX;
  const dy = point.y - drag.startY;
  if (Math.hypot(dx, dy) > 3) drag.moved = true;

  const next = clampGraphPosition({
    x: drag.baseX + dx,
    y: drag.baseY + dy,
  });
  if (!next) return;

  state.graphPositions[drag.nodeId] = next;
  state.graphRuntimePositions[drag.nodeId] = next;
  updateGraphNodePosition(drag.nodeId, next);
  event.preventDefault();
}

function handleGraphPointerUp(event) {
  const drag = state.graphDragging;
  if (!drag || drag.pointerId !== event.pointerId) return;

  const node = graphNodeElement(drag.nodeId);
  node?.classList.remove("dragging");
  els.graph.classList.remove("dragging");
  els.graph.releasePointerCapture?.(event.pointerId);
  state.graphDragging = null;

  if (drag.moved) {
    state.graphClickSuppressed = true;
    setTimeout(() => {
      state.graphClickSuppressed = false;
    }, 160);
    persistGraphPositions();
  } else {
    state.graphClickSuppressed = true;
    setTimeout(() => {
      state.graphClickSuppressed = false;
    }, 160);
    openGraphNode(drag.nodeId, node?.dataset.noteTitle);
  }
}

function openGraphNode(nodeId, title) {
  const cleanTitle = title || "Nouvelle note";
  if (nodeId.startsWith("missing:")) {
    const previousPosition = state.graphRuntimePositions[nodeId] || state.graphPositions[nodeId];
    const note = createNote(cleanTitle, `# ${cleanTitle}\n\n`);
    if (!note) return;
    if (previousPosition) {
      state.graphPositions[note.id] = previousPosition;
      delete state.graphPositions[nodeId];
      persistGraphPositions();
    }
    selectNote(note.id);
  } else {
    selectNote(nodeId);
  }
  revealActiveNoteFromGraph();
}

function revealActiveNoteFromGraph() {
  if (state.graphFullscreen) toggleGraphFullscreen(false);
  const note = activeNote();
  requestAnimationFrame(() => {
    document.querySelector(".workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    els.titleInput.focus({ preventScroll: true });
    if (note) toast(`Note ouverte : ${note.title}`);
  });
}

function graphNodeDegreeMap(edges) {
  const degree = new Map();
  for (const edge of edges) {
    degree.set(edge.from, (degree.get(edge.from) || 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
  }
  return degree;
}

function graphNodeRadius(node, isActive, maxDegree) {
  const degree = Number(node.degree || 0);
  const normalized = maxDegree > 0 ? Math.sqrt(degree) / Math.sqrt(maxDegree) : 0;
  const base = node.missing ? 7 : 8;
  const spread = node.missing ? 6 : 18;
  const radius = base + normalized * spread + (isActive ? 5 : 0);
  return clamp(radius, node.missing ? 7 : 8, isActive ? 31 : 26);
}

function buildGraph() {
  const nodes = new Map();
  const edges = [];
  for (const note of state.notes) {
    nodes.set(note.id, { id: note.id, title: note.title, missing: false });
  }

  for (const note of state.notes) {
    const uniqueTargets = [...new Set(extractWikiLinks(note.body).map(normalizeTitle))];
    for (const normalizedTarget of uniqueTargets) {
      const rawTitle = extractWikiLinks(note.body).find((title) => normalizeTitle(title) === normalizedTarget);
      const target = state.notes.find((candidate) => normalizeTitle(candidate.title) === normalizedTarget);
      if (target) {
        if (target.id !== note.id) edges.push({ from: note.id, to: target.id });
      } else if (rawTitle) {
        const missingId = `missing:${normalizedTarget}`;
        nodes.set(missingId, { id: missingId, title: rawTitle, missing: true });
        edges.push({ from: note.id, to: missingId });
      }
    }
  }

  const degree = graphNodeDegreeMap(edges);
  const rankedNodes = [...nodes.values()]
    .map((node) => ({ ...node, degree: degree.get(node.id) || 0 }))
    .sort((a, b) => {
      if (a.id === state.activeId) return -1;
      if (b.id === state.activeId) return 1;
      if (a.missing !== b.missing) return a.missing ? 1 : -1;
      return b.degree - a.degree || a.title.localeCompare(b.title, "fr");
    })
    .slice(0, MAX_GRAPH_NODES);

  return { nodes: rankedNodes, edges };
}

function renderGraph() {
  const { nodes, edges } = buildGraph();
  const active = activeNote();
  els.graphStats.textContent = `${edges.length} ${edges.length > 1 ? "liens" : "lien"} · glisse`;

  if (!nodes.length) {
    els.graph.innerHTML = "";
    state.graphRuntimePositions = {};
    return;
  }

  const positions = resolveGraphPositions(nodes, edges);
  const visibleIds = new Set(nodes.map((node) => node.id));
  const maxDegree = Math.max(1, ...nodes.map((node) => Number(node.degree || 0)));
  const lineMarkup = edges
    .filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to) && positions.has(edge.from) && positions.has(edge.to))
    .map((edge) => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      const classes = ["edge", active && (edge.from === active.id || edge.to === active.id) ? "active" : ""].filter(Boolean).join(" ");
      return `<line class="${classes}" data-edge-from="${attr(edge.from)}" data-edge-to="${attr(edge.to)}" x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" x2="${to.x.toFixed(1)}" y2="${to.y.toFixed(1)}"></line>`;
    })
    .join("");

  const nodeMarkup = nodes
    .map((node) => {
      const pos = positions.get(node.id);
      const isActive = node.id === state.activeId;
      const classes = ["node", isActive ? "active" : "", node.missing ? "missing" : ""].filter(Boolean).join(" ");
      const radius = graphNodeRadius(node, isActive, maxDegree);
      const labelLimit = radius >= 22 ? 26 : radius >= 15 ? 20 : 14;
      const label = clampText(node.title, labelLimit);
      const degreeLabel = `${node.degree || 0} lien${node.degree > 1 ? "s" : ""}`;
      const actionLabel = node.missing ? `Créer « ${node.title} »` : `Ouvrir l'article « ${node.title} »`;
      return `
        <g class="${classes}" role="${node.missing ? "button" : "link"}" tabindex="0" aria-label="${attr(`${actionLabel} · ${degreeLabel}`)}" data-node-id="${attr(node.id)}" data-note-title="${attr(node.title)}" data-degree="${attr(node.degree || 0)}" transform="translate(${pos.x.toFixed(1)} ${pos.y.toFixed(1)})">
          <title>${escapeHtml(`${actionLabel} · ${degreeLabel}`)}</title>
          <circle class="node-hitbox" r="${radius + 17}"></circle>
          <circle class="node-glow" r="${radius + Math.max(7, radius * 0.42)}"></circle>
          <circle class="node-core" r="${radius.toFixed(1)}"></circle>
          <text y="${(radius + 16).toFixed(1)}">${escapeHtml(label)}</text>
        </g>`;
    })
    .join("");

  const limitCaption = nodes.length >= MAX_GRAPH_NODES
    ? `<text class="graph-caption" x="12" y="368">Affichage limité à ${MAX_GRAPH_NODES} nœuds</text>`
    : "";
  const hint = `<text class="graph-hint" x="528" y="368" text-anchor="end">Glisse les nœuds</text>`;

  els.graph.innerHTML = `${lineMarkup}${nodeMarkup}${limitCaption}${hint}`;
}
function renderAll() {
  renderVaultSwitcher();
  renderSecurityPanel();
  renderSnapshotsPanel();
  renderLearningPanel();
  renderRepoPanel();
  renderGithubPanel();
  renderVaultStats();
  renderTagFilters();
  renderFolderFilters();
  renderFolderSuggestions();
  renderStarredList();
  renderNotesList();
  renderActiveNote();
  renderPreview();
  renderBacklinks();
  renderNoteTags();
  renderOutgoingLinks();
  renderGraph();
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 400);
}

function downloadFile(filename, content, mime = "text/plain;charset=utf-8") {
  downloadBlob(filename, new Blob([content], { type: mime }));
}

async function generateAssistantToken(showToast = true) {
  try {
    const token = `povm_${randomBase64Url(32)}`;
    const createdAt = nowIso();
    state.security.tokenHash = await sha256Hex(`${state.security.vaultId}:${token}`);
    state.security.tokenHint = assistantTokenHint(token);
    state.security.tokenCreatedAt = state.security.tokenCreatedAt || createdAt;
    state.security.tokenRotatedAt = createdAt;
    state.assistantToken = token;
    persistSecurityState();
    renderSecurityPanel();
    requestAnimationFrame(() => {
      els.assistantTokenOutput.focus();
      els.assistantTokenOutput.select();
    });
    if (showToast) toast("Token crypto généré. Copie-le maintenant : le secret n'est pas stocké.");
    return token;
  } catch (error) {
    console.error(error);
    toast("Token impossible : Web Crypto indisponible.");
    return "";
  }
}

async function copyAssistantToken() {
  if (!state.assistantToken) {
    toast("Génère d'abord un token assistant.");
    return;
  }
  try {
    await navigator.clipboard.writeText(state.assistantToken);
    toast("Token copié.");
  } catch {
    els.assistantTokenOutput.select();
    document.execCommand("copy");
    toast("Token sélectionné.");
  }
}

function currentVaultPassphrase() {
  return String(els.vaultPassphraseInput.value || "");
}

function clearVaultPassphrase() {
  els.vaultPassphraseInput.value = "";
}

async function enableVaultEncryption() {
  if (vaultEncrypted()) {
    toast("Ce vault est déjà chiffré.");
    return;
  }
  const passphrase = currentVaultPassphrase();
  if (passphrase.length < 10) {
    toast("Choisis une passphrase d'au moins 10 caractères.");
    return;
  }
  try {
    const now = nowIso();
    state.security.encryption = {
      enabled: true,
      algorithm: "AES-GCM-256",
      kdf: "PBKDF2-SHA-256",
      iterations: VAULT_CRYPTO_ITERATIONS,
      salt: randomBase64Url(16),
      encryptedAt: now,
      updatedAt: now,
    };
    state.vaultCryptoKey = await deriveVaultCryptoKey(passphrase);
    state.vaultUnlocked = true;
    await persistEncryptedNotes(true);
    clearVaultPassphrase();
    renderSecurityPanel();
    toast("Vault chiffré localement. La clé reste en mémoire jusqu'au verrouillage.");
  } catch (error) {
    console.error(error);
    state.security.encryption = cleanEncryptionState(null);
    state.vaultCryptoKey = null;
    state.vaultUnlocked = false;
    persistSecurityState();
    renderSecurityPanel();
    toast("Chiffrement impossible : Web Crypto indisponible.");
  }
}

async function unlockVault() {
  if (!vaultEncrypted()) {
    toast("Ce vault n'est pas encore chiffré.");
    return;
  }
  if (!vaultLocked()) {
    toast("Vault déjà déverrouillé.");
    return;
  }
  const passphrase = currentVaultPassphrase();
  if (!passphrase) {
    toast("Entre la passphrase du vault.");
    return;
  }
  try {
    await unlockEncryptedVault(passphrase);
    clearVaultPassphrase();
    renderAll();
    toast("Vault déverrouillé.");
  } catch (error) {
    console.warn("Déverrouillage du vault refusé.", error);
    state.vaultCryptoKey = null;
    state.vaultUnlocked = false;
    renderSecurityPanel();
    toast("Passphrase invalide ou vault chiffré illisible.");
  }
}

async function lockVault() {
  if (!vaultEncrypted()) {
    toast("Ce vault n'est pas chiffré.");
    return;
  }
  if (state.vaultCryptoKey) {
    await persistEncryptedNotes(false).catch((error) => console.error(error));
  }
  state.vaultCryptoKey = null;
  state.vaultUnlocked = false;
  state.notes = [];
  state.activeId = null;
  state.starredIds = new Set<string>();
  state.snapshots = [];
  clearVaultPassphrase();
  renderAll();
  toast("Vault verrouillé.");
}

async function ensureAssistantTokenForExport() {
  if (state.security.tokenHash) return state.assistantToken;
  return generateAssistantToken(false);
}

function safeFilename(name) {
  return String(name || "note")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLocaleLowerCase("fr-FR") || "note";
}

const ZIP_UTF8_FLAG = 0x0800;
let CRC32_TABLE = null;

function getCrc32Table() {
  if (CRC32_TABLE) return CRC32_TABLE;
  CRC32_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    CRC32_TABLE[n] = c >>> 0;
  }
  return CRC32_TABLE;
}

function crc32(bytes) {
  const table = getCrc32Table();
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = (crc >>> 8) ^ table[(crc ^ bytes[index]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function setUint16(buffer, offset, value) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
}

function setUint32(buffer, offset, value) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
  buffer[offset + 3] = (value >>> 24) & 0xff;
}

function concatUint8(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function dosDateTime(value) {
  const input = value ? new Date(value) : new Date();
  const date = Number.isNaN(input.getTime()) ? new Date() : input;
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
}

function createZipArchive(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  const entries = [];
  let offset = 0;

  for (const file of files) {
    const cleanPath = String(file.path || "file.txt").replace(/^\/+/, "").replaceAll("\\", "/");
    const nameBytes = encoder.encode(cleanPath);
    const data = file.content instanceof Uint8Array ? file.content : encoder.encode(String(file.content ?? ""));
    const checksum = crc32(data);
    const { date, time } = dosDateTime(file.date || nowIso());

    const localHeader = new Uint8Array(30 + nameBytes.length);
    setUint32(localHeader, 0, 0x04034b50);
    setUint16(localHeader, 4, 20);
    setUint16(localHeader, 6, ZIP_UTF8_FLAG);
    setUint16(localHeader, 8, 0);
    setUint16(localHeader, 10, time);
    setUint16(localHeader, 12, date);
    setUint32(localHeader, 14, checksum);
    setUint32(localHeader, 18, data.length);
    setUint32(localHeader, 22, data.length);
    setUint16(localHeader, 26, nameBytes.length);
    setUint16(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);
    entries.push({ nameBytes, data, checksum, date, time, offset });
    offset += localHeader.length + data.length;
  }

  const centralOffset = offset;
  for (const entry of entries) {
    const centralHeader = new Uint8Array(46 + entry.nameBytes.length);
    setUint32(centralHeader, 0, 0x02014b50);
    setUint16(centralHeader, 4, 20);
    setUint16(centralHeader, 6, 20);
    setUint16(centralHeader, 8, ZIP_UTF8_FLAG);
    setUint16(centralHeader, 10, 0);
    setUint16(centralHeader, 12, entry.time);
    setUint16(centralHeader, 14, entry.date);
    setUint32(centralHeader, 16, entry.checksum);
    setUint32(centralHeader, 20, entry.data.length);
    setUint32(centralHeader, 24, entry.data.length);
    setUint16(centralHeader, 28, entry.nameBytes.length);
    setUint16(centralHeader, 30, 0);
    setUint16(centralHeader, 32, 0);
    setUint16(centralHeader, 34, 0);
    setUint16(centralHeader, 36, 0);
    setUint32(centralHeader, 38, 0);
    setUint32(centralHeader, 42, entry.offset);
    centralHeader.set(entry.nameBytes, 46);
    centralParts.push(centralHeader);
    offset += centralHeader.length;
  }

  const centralSize = offset - centralOffset;
  const end = new Uint8Array(22);
  setUint32(end, 0, 0x06054b50);
  setUint16(end, 4, 0);
  setUint16(end, 6, 0);
  setUint16(end, 8, entries.length);
  setUint16(end, 10, entries.length);
  setUint32(end, 12, centralSize);
  setUint32(end, 16, centralOffset);
  setUint16(end, 20, 0);

  return concatUint8([...localParts, ...centralParts, end]);
}

function getUint16(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8);
}

function getUint32(buffer, offset) {
  return (buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24)) >>> 0;
}

async function readStoredZipEntries(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const decoder = new TextDecoder();
  const entries = {};
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const signature = getUint32(bytes, offset);
    if (signature === 0x02014b50 || signature === 0x06054b50) break;
    if (signature !== 0x04034b50) {
      offset += 1;
      continue;
    }

    const flags = getUint16(bytes, offset + 6);
    const method = getUint16(bytes, offset + 8);
    const compressedSize = getUint32(bytes, offset + 18);
    const uncompressedSize = getUint32(bytes, offset + 22);
    const fileNameLength = getUint16(bytes, offset + 26);
    const extraLength = getUint16(bytes, offset + 28);
    const dataOffset = offset + 30 + fileNameLength + extraLength;
    const dataEnd = dataOffset + compressedSize;
    if (dataEnd > bytes.length) throw new Error("Archive ZIP tronquée");
    if (method !== 0) throw new Error("ZIP compressé non supporté par cet import léger");
    if (flags & 0x0008) throw new Error("ZIP avec data descriptor non supporté");
    if (compressedSize !== uncompressedSize) throw new Error("Entrée ZIP incohérente");

    const name = decoder.decode(bytes.slice(offset + 30, offset + 30 + fileNameLength)).replaceAll("\\", "/");
    if (name && !name.endsWith("/")) entries[name] = decoder.decode(bytes.slice(dataOffset, dataEnd));
    offset = dataEnd;
  }

  return entries;
}

function uniqueWikiTargets(markdown) {
  const targets = new Map();
  for (const title of extractWikiLinks(markdown)) {
    const normalized = normalizeTitle(title);
    if (!targets.has(normalized)) targets.set(normalized, { normalized, title });
  }
  return [...targets.values()];
}

function escapeMarkdownLinkLabel(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("]", "\\]");
}

function escapeMarkdownText(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");
}

function buildCodexContext(exportedAt = nowIso()) {
  const usedSlugs = new Set();
  const idToFile = new Map();
  const titleToFile = new Map();
  const files = [...state.notes]
    .sort((a, b) => a.title.localeCompare(b.title, "fr", { sensitivity: "base" }))
    .map((note) => {
      const base = safeFilename(note.title || "note");
      let slug = base || "note";
      let suffix = 2;
      while (usedSlugs.has(slug)) {
        slug = `${base}-${suffix}`;
        suffix += 1;
      }
      usedSlugs.add(slug);
      const file = {
        id: note.id,
        note,
        title: note.title,
        slug,
        path: `knowledge/notes/${slug}.md`,
        relativePath: `notes/${slug}.md`,
      };
      idToFile.set(note.id, file);
      titleToFile.set(normalizeTitle(note.title), file);
      return file;
    });

  const edges = [];
  for (const file of files) {
    for (const target of uniqueWikiTargets(file.note.body)) {
      const targetFile = titleToFile.get(target.normalized);
      edges.push({
        fromId: file.id,
        fromSlug: file.slug,
        fromTitle: file.title,
        toId: targetFile?.id || null,
        toSlug: targetFile?.slug || null,
        toTitle: targetFile?.title || target.title,
        missing: !targetFile,
      });
    }
  }

  return {
    exportedAt,
    files,
    idToFile,
    titleToFile,
    edges,
  };
}

function linksForFile(file, context) {
  return context.edges.filter((edge) => edge.fromId === file.id);
}

function backlinksForFile(file, context) {
  return context.edges.filter((edge) => edge.toId === file.id);
}

function convertWikiLinksForCodex(markdown, context) {
  return String(markdown || "").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (full, rawTitle, rawLabel) => {
    const title = String(rawTitle || "").trim();
    const label = String(rawLabel || title).trim();
    const target = context.titleToFile.get(normalizeTitle(title));
    if (!target) return full;
    return `[${escapeMarkdownLinkLabel(label)}](./${target.slug}.md)`;
  });
}

function yamlString(value) {
  return JSON.stringify(String(value || ""));
}

function makeCodexNoteMarkdown(file, context) {
  const note = file.note;
  const links = linksForFile(file, context).map((edge) => edge.toTitle);
  const backlinks = backlinksForFile(file, context).map((edge) => edge.fromTitle);
  const tags = tagsForNote(note);
  const memoryTypes = effectiveMemoryTypes(note);
  const body = convertWikiLinksForCodex((note.body || `# ${note.title}\n\n`).trimEnd(), context);

  return `---\n` +
    `title: ${yamlString(note.title)}\n` +
    `slug: ${yamlString(file.slug)}\n` +
    `folder: ${yamlString(note.folder)}\n` +
    `createdAt: ${yamlString(note.createdAt)}\n` +
    `updatedAt: ${yamlString(note.updatedAt)}\n` +
    `starred: ${isStarred(note.id) ? "true" : "false"}\n` +
    `memoryTypes: ${JSON.stringify(memoryTypes)}\n` +
    `tags: ${JSON.stringify(tags)}\n` +
    `links: ${JSON.stringify(links)}\n` +
    `backlinks: ${JSON.stringify(backlinks)}\n` +
    `---\n\n` +
    `${body}\n`;
}

function makeCodexIndexMarkdown(context) {
  const tagMap = new Map();
  const folderMap = new Map();
  for (const file of context.files) {
    const folder = normalizeFolder(file.note.folder);
    if (!folderMap.has(folder)) folderMap.set(folder, []);
    folderMap.get(folder).push(file);
    for (const tag of tagsForNote(file.note)) {
      if (!tagMap.has(tag)) tagMap.set(tag, []);
      tagMap.get(tag).push(file);
    }
  }

  const noteLines = context.files.map((file) => {
    const tags = tagsForNote(file.note).map((tag) => `#${tag}`).join(", ") || "aucun tag";
    const links = linksForFile(file, context).length;
    const backlinks = backlinksForFile(file, context).length;
    return `- [${escapeMarkdownLinkLabel(file.title)}](${file.relativePath}) — ${escapeMarkdownText(file.note.folder)}; ${tags}; ${links} lien(s), ${backlinks} backlink(s)`;
  });

  const tagLines = [...tagMap.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "fr"))
    .map(([tag, files]) => `- #${tag} (${files.length}) — ${files.map((file) => `[${escapeMarkdownLinkLabel(file.title)}](${file.relativePath})`).join(", ")}`);

  const folderLines = [...folderMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "fr"))
    .map(([folder, files]) => `- ${escapeMarkdownText(folder)} (${files.length}) — ${files.map((file) => `[${escapeMarkdownLinkLabel(file.title)}](${file.relativePath})`).join(", ")}`);

  const starredLines = context.files
    .filter((file) => isStarred(file.id))
    .map((file) => `- [${escapeMarkdownLinkLabel(file.title)}](${file.relativePath})`);

  const edgeLines = context.edges.length
    ? context.edges.map((edge) => {
        const target = edge.missing ? `${escapeMarkdownText(edge.toTitle)} (note manquante)` : escapeMarkdownText(edge.toTitle);
        return `- ${escapeMarkdownText(edge.fromTitle)} -> ${target}`;
      })
    : ["- Aucun lien wiki détecté."];

  return `# Knowledge index\n\n` +
    `Exporté depuis ${APP_NAME} le ${context.exportedAt}.\n\n` +
    `Cette base est destinée à être lue par Codex ou par un autre agent de code. Commence par ce fichier, puis ouvre les notes pertinentes dans \`knowledge/notes/\`.\n\n` +
    `## Notes\n\n${noteLines.join("\n") || "- Aucune note."}\n\n` +
    `## Dossiers\n\n${folderLines.join("\n") || "- Aucun dossier."}\n\n` +
    `## Favoris\n\n${starredLines.join("\n") || "- Aucun favori."}\n\n` +
    `## Tags\n\n${tagLines.join("\n") || "- Aucun tag."}\n\n` +
    `## Graphe des liens\n\n${edgeLines.join("\n")}\n\n` +
    `## Fichiers générés\n\n` +
    `- \`AGENTS.md\` : instructions à placer à la racine du repo.\n` +
    `- \`knowledge/INDEX.md\` : index lisible par Codex.\n` +
    `- \`knowledge/notes/*.md\` : notes Markdown exportées.\n` +
    `- \`knowledge/manifest.json\` : métadonnées de notes.\n` +
    `- \`knowledge/graph.json\` : nœuds et liens du graphe.\n`;
}

function makeCodexAgentsMarkdown(context) {
  return `# AGENTS.md\n\n` +
    `## Base de connaissance\n\n` +
    `Cette base de connaissance a été exportée depuis ${APP_NAME}. Avant de modifier le code, lis d'abord :\n\n` +
    `- \`knowledge/INDEX.md\`\n` +
    `- Les notes pertinentes dans \`knowledge/notes/\`\n` +
    `- Les métadonnées dans \`knowledge/manifest.json\` si tu dois comprendre les tags, backlinks ou liens manquants\n\n` +
    `Les notes d'origine utilisent parfois des liens wiki du type \`[[note]]\`. Dans cet export, les liens vers des notes existantes sont convertis en liens Markdown classiques. Les liens wiki restants pointent vers des notes manquantes ou externes.\n\n` +
    `## Règles de travail\n\n` +
    `- Ne change pas une décision documentée sans expliquer pourquoi.\n` +
    `- Si le code réel contredit la base de connaissance, signale la contradiction.\n` +
    `- Après une modification importante, propose une mise à jour des notes concernées.\n` +
    `- Quand tu ajoutes une convention durable, propose de l'ajouter dans une note dédiée, par exemple \`knowledge/notes/conventions.md\`.\n` +
    `- Garde les notes en Markdown simple, lisible et versionnable.\n\n` +
    `## Organisation\n\n` +
    `- Nombre de notes exportées : ${context.files.length}\n` +
    `- Nombre de liens détectés : ${context.edges.length}\n` +
    `- Dossier principal : \`knowledge/notes/\`\n`;
}

function makeCodexReadmeMarkdown() {
  return `# Export Codex KB\n\n` +
    `Ce zip a été généré par ${APP_NAME}.\n\n` +
    `## Utilisation recommandée\n\n` +
    `1. Copie \`AGENTS.md\` à la racine de ton repo.\n` +
    `2. Copie le dossier \`knowledge/\` à la racine du même repo.\n` +
    `3. Lance Codex depuis la racine du repo.\n` +
    `4. Demande à Codex de lire \`AGENTS.md\` et \`knowledge/INDEX.md\` avant de coder.\n\n` +
    `## Contenu\n\n` +
    `- \`AGENTS.md\` : consignes projet pour l'agent.\n` +
    `- \`knowledge/INDEX.md\` : sommaire de la base.\n` +
    `- \`knowledge/notes/*.md\` : notes Markdown.\n` +
    `- \`knowledge/manifest.json\` : données structurées.\n` +
    `- \`knowledge/graph.json\` : graphe des liens.\n`;
}

function makeCodexManifest(context) {
  return {
    app: APP_NAME,
    format: "codex-kb",
    version: 1,
    exportedAt: context.exportedAt,
    noteCount: context.files.length,
    linkCount: context.edges.length,
    repo: repoSummaryPayload(),
    notes: context.files.map((file) => ({
      id: file.id,
      title: file.title,
      slug: file.slug,
      path: file.path,
      folder: file.note.folder,
      starred: isStarred(file.id),
      createdAt: file.note.createdAt,
      updatedAt: file.note.updatedAt,
      memoryTypes: effectiveMemoryTypes(file.note),
      tags: tagsForNote(file.note),
      links: linksForFile(file, context).map((edge) => ({ title: edge.toTitle, path: edge.toSlug ? `knowledge/notes/${edge.toSlug}.md` : null, missing: edge.missing })),
      backlinks: backlinksForFile(file, context).map((edge) => ({ title: edge.fromTitle, path: `knowledge/notes/${edge.fromSlug}.md` })),
    })),
    edges: context.edges.map((edge) => ({
      from: edge.fromTitle,
      fromPath: `knowledge/notes/${edge.fromSlug}.md`,
      to: edge.toTitle,
      toPath: edge.toSlug ? `knowledge/notes/${edge.toSlug}.md` : null,
      missing: edge.missing,
    })),
  };
}

function makeCodexGraph(context) {
  return {
    nodes: context.files.map((file) => ({
      id: file.slug,
      title: file.title,
      path: file.path,
      memoryTypes: effectiveMemoryTypes(file.note),
      tags: tagsForNote(file.note),
    })),
    edges: context.edges.map((edge) => ({
      source: edge.fromSlug,
      target: edge.toSlug,
      targetTitle: edge.toTitle,
      missing: edge.missing,
    })),
  };
}

function buildCodexFiles() {
  const context = buildCodexContext();
  const files = [
    { path: "README-CODEX-EXPORT.md", content: makeCodexReadmeMarkdown() },
    { path: "AGENTS.md", content: makeCodexAgentsMarkdown(context) },
    { path: "knowledge/INDEX.md", content: makeCodexIndexMarkdown(context) },
    { path: "knowledge/manifest.json", content: JSON.stringify(makeCodexManifest(context), null, 2) },
    { path: "knowledge/graph.json", content: JSON.stringify(makeCodexGraph(context), null, 2) },
    ...context.files.map((file) => ({ path: file.path, content: makeCodexNoteMarkdown(file, context), date: file.note.updatedAt })),
  ];
  return { context, files };
}

function joinArchivePath(...parts) {
  return parts
    .filter((part) => part !== null && part !== undefined && String(part).trim() !== "")
    .map((part) => String(part).replaceAll("\\", "/").replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/")
    .replace(/\/+/g, "/");
}

function makePovmindRootAgentsMarkdown(context, basePath, snapshot) {
  const sync = cleanGithubSyncState(state.githubSync);
  const vault = activeVaultRecord();
  const score = calculateLearningScore();
  return `# AGENTS.md\n\n` +
    `Ce repo porte un contexte PovMind versionnable. Avant de coder, lis ce contexte dans cet ordre :\n\n` +
    `1. \`${basePath}/manifest.json\`\n` +
    `2. \`${basePath}/vaults/${state.security.vaultId}/manifest.json\`\n` +
    `3. Les notes pertinentes dans \`${basePath}/vaults/${state.security.vaultId}/notes/\`\n` +
    `4. Le snapshot \`${basePath}/vaults/${state.security.vaultId}/snapshots/latest.json\` si tu dois citer l'état exact du vault\n\n` +
    `## Règles PovMind\n\n` +
    `- Le code du repo reste la source exécutable; PovMind porte le contexte, les décisions et les liens.\n` +
    `- Ne demande jamais le secret \`POVMIND_VAULT_TOKEN\` et ne commit jamais de token, \`.env\` ou bundle MCP privé.\n` +
    `- Si une décision du vault contredit le code, signale explicitement la contradiction.\n` +
    `- Après un changement durable, propose une mise à jour des notes PovMind liées.\n` +
    `- Cite le hash du dernier snapshot quand tu bases une décision sur un état figé.\n\n` +
    `## Boucle cognitive\n\n` +
    `- Lis \`${basePath}/automation/cognitive-loop.json\` pour connaître le score, les phases jour/nuit et les garde-fous.\n` +
    `- Les sorties de rêve ou de nuit sont spéculatives : elles doivent être validées humainement avant d'être traitées comme des décisions.\n` +
    `- Ratio d'auto-amélioration exporté : ${Math.round(score.ratio * 100)}%.\n\n` +
    `## Vault actif\n\n` +
    `- Nom : ${vault?.name || "PovMind"}\n` +
    `- Vault ID : \`${state.security.vaultId}\`\n` +
    `- Notes : ${context.files.length}\n` +
    `- Liens : ${context.edges.length}\n` +
    `- Dernier snapshot : ${snapshot ? `\`${snapshot.hash}\`` : "aucun"}\n` +
    `- Cible GitHub : ${sync.repoFullName || "non renseignée"} · ${sync.branch} · \`${sync.basePath}\`\n`;
}

function makePovmindReadmeMarkdown(basePath) {
  return `# PovMind context\n\n` +
    `Ce dossier est généré par PovMind pour synchroniser un vault avec un repo GitHub.\n\n` +
    `## Contenu\n\n` +
    `- \`AGENTS.md\` : consignes racine pour Codex et les assistants de code.\n` +
    `- \`${basePath}/manifest.json\` : manifest global de contexte.\n` +
    `- \`${basePath}/vaults/*/manifest.json\` : manifest du vault actif.\n` +
    `- \`${basePath}/vaults/*/notes/*.md\` : notes Markdown versionnables.\n` +
    `- \`${basePath}/vaults/*/snapshots/latest.json\` : état figé avec hash global.\n` +
    `- \`${basePath}/vaults/*/mcp-policy.json\` : politique assistant sans secret complet.\n` +
    `- \`${basePath}/vaults/*/repo-manifest.json\` : résumé du repo lié au vault.\n\n` +
    `## Automation\n\n` +
    `- \`${basePath}/automation/cognitive-loop.json\` : spec de la boucle jour/nuit.\n` +
    `- \`${basePath}/automation/cognitive-loop.md\` : version lisible du rythme cognitif.\n` +
    `- \`.github/workflows/povmind-cognitive-loop.yml\` : cron GitHub d'audit du contexte versionné.\n\n` +
    `Le contexte ne contient pas le token assistant complet. Les accès MCP restent protégés par \`POVMIND_VAULT_TOKEN\`.\n`;
}

function assistantAccessPolicyPayload(snapshot = latestSnapshot()) {
  return {
    format: "povmind-assistant-access-policy",
    version: 1,
    exportedAt: nowIso(),
    vaultId: state.security.vaultId,
    tokenSealed: Boolean(state.security.tokenHash),
    tokenHint: state.security.tokenHint,
    tokenHashStoredInPolicy: false,
    algorithm: state.security.algorithm,
    scopes: state.security.scopes,
    tokenEnvironmentVariable: "POVMIND_VAULT_TOKEN",
    latestSnapshot: snapshot ? {
      id: snapshot.id,
      createdAt: snapshot.createdAt,
      contentHash: snapshot.hash,
    } : null,
  };
}

function makePovmindGlobalManifest(context, basePath, snapshot) {
  const vault = activeVaultRecord();
  return {
    app: APP_NAME,
    appVersion: APP_VERSION,
    format: "povmind-github-context",
    version: 1,
    exportedAt: context.exportedAt,
    basePath,
    activeVaultId,
    activeVault: vault ? {
      id: vault.id,
      name: vault.name,
      createdAt: vault.createdAt,
      updatedAt: vault.updatedAt,
      noteCount: state.notes.length,
      tokenSealed: Boolean(state.security.tokenHash),
    } : null,
    github: githubSyncExportPayload(),
    repo: repoSummaryPayload(),
    learning: {
      score: calculateLearningScore(),
      cycles: cognitiveCyclesExportPayload().slice(0, 10),
    },
    snapshot: snapshot ? {
      id: snapshot.id,
      createdAt: snapshot.createdAt,
      contentHash: snapshot.hash,
    } : null,
    paths: {
      vaultManifest: joinArchivePath(basePath, "vaults", state.security.vaultId, "manifest.json"),
      notes: joinArchivePath(basePath, "vaults", state.security.vaultId, "notes"),
      graph: joinArchivePath(basePath, "vaults", state.security.vaultId, "graph.json"),
      latestSnapshot: joinArchivePath(basePath, "vaults", state.security.vaultId, "snapshots", "latest.json"),
      mcpPolicy: joinArchivePath(basePath, "vaults", state.security.vaultId, "mcp-policy.json"),
      repoManifest: joinArchivePath(basePath, "vaults", state.security.vaultId, "repo-manifest.json"),
      cognitiveLoop: joinArchivePath(basePath, "automation", "cognitive-loop.json"),
    },
  };
}

function makePovmindVaultManifest(context, basePath, snapshot) {
  const codexManifest = makeCodexManifest(context);
  const vaultPath = joinArchivePath(basePath, "vaults", state.security.vaultId);
  return {
    ...codexManifest,
    format: "povmind-github-vault",
    version: 1,
    appVersion: APP_VERSION,
    vaultId: state.security.vaultId,
    vaultName: activeVaultRecord()?.name || "PovMind",
    exportedAt: context.exportedAt,
    basePath: vaultPath,
    snapshot: snapshot ? {
      id: snapshot.id,
      createdAt: snapshot.createdAt,
      contentHash: snapshot.hash,
    } : null,
    security: assistantAccessPolicyPayload(snapshot),
    github: githubSyncExportPayload(),
    learning: {
      memory: learningMemoryExportPayload(),
      runs: enrichmentRunsExportPayload().slice(0, 10),
      cycles: cognitiveCyclesExportPayload().slice(0, 12),
      score: calculateLearningScore(),
    },
    notes: codexManifest.notes.map((note) => ({
      ...note,
      path: joinArchivePath(vaultPath, "notes", `${note.slug}.md`),
    })),
  };
}

function buildPovmindContextFiles(snapshot = latestSnapshot()) {
  persistNow(false);
  const exportedAt = nowIso();
  const context = buildCodexContext(exportedAt);
  const basePath = cleanGithubBasePath(state.githubSync?.basePath);
  const vaultPath = joinArchivePath(basePath, "vaults", state.security.vaultId);
  const cognitiveSpec = makeCognitiveLoopSpec(snapshot, calculateLearningScore());
  const files = [
    { path: "AGENTS.md", content: makePovmindRootAgentsMarkdown(context, basePath, snapshot) },
    { path: joinArchivePath(basePath, "README.md"), content: makePovmindReadmeMarkdown(basePath) },
    { path: joinArchivePath(basePath, "manifest.json"), content: JSON.stringify(makePovmindGlobalManifest(context, basePath, snapshot), null, 2) },
    { path: joinArchivePath(basePath, "automation", "cognitive-loop.json"), content: JSON.stringify(cognitiveSpec, null, 2) },
    { path: joinArchivePath(basePath, "automation", "cognitive-loop.md"), content: makeCognitiveLoopMarkdown(cognitiveSpec) },
    { path: ".github/workflows/povmind-cognitive-loop.yml", content: makeGithubCognitiveWorkflow(basePath) },
    { path: joinArchivePath(vaultPath, "manifest.json"), content: JSON.stringify(makePovmindVaultManifest(context, basePath, snapshot), null, 2) },
    { path: joinArchivePath(vaultPath, "INDEX.md"), content: makeCodexIndexMarkdown(context) },
    { path: joinArchivePath(vaultPath, "graph.json"), content: JSON.stringify(makeCodexGraph(context), null, 2) },
    { path: joinArchivePath(vaultPath, "mcp-policy.json"), content: JSON.stringify(assistantAccessPolicyPayload(snapshot), null, 2) },
    { path: joinArchivePath(vaultPath, "repo-manifest.json"), content: JSON.stringify(repoExportPayload(false), null, 2) },
    { path: joinArchivePath(vaultPath, "snapshots", "latest.json"), content: JSON.stringify(snapshot?.payload || null, null, 2) },
    ...context.files.map((file) => ({
      path: joinArchivePath(vaultPath, "notes", `${file.slug}.md`),
      content: makeCodexNoteMarkdown(file, context),
      date: file.note.updatedAt,
    })),
  ];
  return { context, files, basePath, snapshot };
}

function makeMcpAccessManifest(exportedAt = nowIso(), snapshot = latestSnapshot()) {
  return {
    format: "povmind-mcp-access",
    version: 1,
    exportedAt,
    vaultId: state.security.vaultId,
    tokenHash: state.security.tokenHash,
    tokenHint: state.security.tokenHint,
    algorithm: state.security.algorithm,
    scopes: state.security.scopes,
    transport: "stdio",
    tokenEnvironmentVariable: "POVMIND_VAULT_TOKEN",
    latestSnapshot: snapshot ? {
      id: snapshot.id,
      createdAt: snapshot.createdAt,
      contentHash: snapshot.hash,
    } : null,
  };
}

function makeMcpReadmeMarkdown(context) {
  const repo = repoSummaryPayload();
  return `# PovMind MCP bundle\n\n` +
    `Ce bundle expose le vault PovMind via un serveur MCP local protégé par token.\n\n` +
    `## Démarrage rapide\n\n` +
    `1. Copie le token affiché dans PovMind après “Nouveau token”.\n` +
    `2. Lance le serveur avec la variable d'environnement :\n\n` +
    `\`\`\`bash\nPOVMIND_VAULT_TOKEN="povm_..." node mcp/povmind-server.mjs\n\`\`\`\n\n` +
    `3. Dans ton client MCP, configure la commande \`node\`, l'argument \`mcp/povmind-server.mjs\` et l'env \`POVMIND_VAULT_TOKEN\`.\n\n` +
    `## Sécurité\n\n` +
    `Le secret complet n'est pas dans ce zip. Le bundle contient seulement :\n\n` +
    `- \`vaultId\` : ${state.security.vaultId}\n` +
    `- \`tokenHint\` : ${state.security.tokenHint || "non généré"}\n` +
    `- \`tokenHash\` : empreinte SHA-256 du couple \`vaultId:token\`\n\n` +
    `Un assistant sans token ne peut pas lister ni lire les notes via ce serveur MCP.\n\n` +
    `## Outils MCP\n\n` +
    `- \`povmind.search\` : recherche plein texte.\n` +
    `- \`povmind.read_note\` : lecture d'une note par titre, slug ou chemin.\n` +
    `- \`povmind.list_notes\` : liste filtrable des notes.\n` +
    `- \`povmind.vault_manifest\` : métadonnées structurées.\n\n` +
    `Outils code si un repo est lié au vault :\n\n` +
    `- \`povmind.repo_manifest\` : identité Git, branche, commit, hash d'arbre et politique d'indexation.\n` +
    `- \`povmind.repo_list_files\` : liste des fichiers exportés, filtrable par langage.\n` +
    `- \`povmind.repo_search\` : recherche dans les fichiers exportés.\n` +
    `- \`povmind.repo_read_file\` : lecture d'un fichier exporté par chemin.\n\n` +
    `## Version du contexte\n\n` +
    `Le champ \`latestSnapshot\` dans \`mcp/access.json\` pointe vers le dernier snapshot créé, avec son \`contentHash\`. Utilise ce hash pour citer le contexte exact utilisé par l'assistant.\n\n` +
    `## Code repo\n\n` +
    (repo.linked
      ? `Repo lié : ${repo.name || repo.root || "repo"} · ${repo.branch || "branche inconnue"} @ ${repo.commit ? repo.commit.slice(0, 8) : "commit inconnu"} · tree ${repo.treeHash ? repo.treeHash.slice(0, 12) : "inconnu"}.\n\n`
      : `Aucun repo de code n'était lié au moment de l'export.\n\n`) +
    `## Ressources MCP\n\n` +
    `- \`povmind://vault/manifest\`\n` +
    `- \`povmind://notes/{slug}\`\n\n` +
    `- \`povmind://repo/manifest\`\n` +
    `- \`povmind://repo/files/{path}\`\n\n` +
    `Notes exportées : ${context.files.length}. Liens détectés : ${context.edges.length}.\n`;
}

function makeMcpClientConfigExample() {
  return {
    mcpServers: {
      povmind: {
        command: "node",
        args: ["mcp/povmind-server.mjs"],
        env: {
          POVMIND_VAULT_TOKEN: "paste-token-here",
        },
      },
    },
  };
}

function makeMcpServerSource() {
  return `#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const manifest = readJson(path.join(root, "knowledge", "manifest.json"));
const access = readJson(path.join(root, "mcp", "access.json"));
const notes = new Map((manifest.notes || []).map((note) => [note.slug, note]));
const repoManifestPath = path.join(root, "repo", "manifest.json");
const repoManifest = fs.existsSync(repoManifestPath) ? readJson(repoManifestPath) : { linked: false, files: [] };
const repoFiles = new Map((repoManifest.files || []).map((file) => [file.path, file]));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(relativePath) {
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(root)) throw new Error("Path outside vault");
  return fs.readFileSync(resolved, "utf8");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(access.vaultId + ":" + token).digest("hex");
}

function safeCompare(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function authorized() {
  const token = process.env.POVMIND_VAULT_TOKEN || "";
  return safeCompare(hashToken(token), access.tokenHash);
}

function requireAccess() {
  if (!authorized()) {
    const hint = access.tokenHint ? " Token attendu proche de " + access.tokenHint + "." : "";
    throw Object.assign(new Error("PovMind vault locked. Set POVMIND_VAULT_TOKEN." + hint), { code: -32001 });
  }
}

function textResult(text) {
  return { content: [{ type: "text", text: String(text) }] };
}

function jsonText(value) {
  return JSON.stringify(value, null, 2);
}

function noteText(note) {
  return readText(note.path);
}

function repoFileText(file) {
  if (!file) return "";
  if (file.exportPath) return readText(file.exportPath);
  return file.content || file.preview || "";
}

function findNote(input = {}) {
  const needle = String(input.title || input.slug || input.path || "").trim().toLocaleLowerCase("fr-FR");
  if (!needle) return null;
  return (manifest.notes || []).find((note) => {
    return note.slug.toLocaleLowerCase("fr-FR") === needle ||
      note.title.toLocaleLowerCase("fr-FR") === needle ||
      note.path.toLocaleLowerCase("fr-FR") === needle;
  }) || null;
}

function findRepoFile(input = {}) {
  const needle = String(input.path || input.file || "").trim();
  if (!needle) return null;
  return repoFiles.get(needle) || (repoManifest.files || []).find((file) => file.path.toLocaleLowerCase("fr-FR") === needle.toLocaleLowerCase("fr-FR")) || null;
}

function searchNotes(args = {}) {
  const query = String(args.query || "").trim().toLocaleLowerCase("fr-FR");
  const limit = Math.max(1, Math.min(25, Number(args.limit || 8)));
  if (!query) return [];
  return (manifest.notes || [])
    .map((note) => {
      const markdown = noteText(note);
      const haystack = (note.title + "\\n" + note.folder + "\\n" + markdown).toLocaleLowerCase("fr-FR");
      const index = haystack.indexOf(query);
      if (index < 0) return null;
      const plain = markdown.replace(new RegExp("[#*_\\\\x60\\\\[\\\\]]", "g"), " ").replace(/\\s+/g, " ").trim();
      return {
        title: note.title,
        slug: note.slug,
        path: note.path,
        folder: note.folder,
        tags: note.tags,
        excerpt: plain.slice(Math.max(0, index - 80), index + 220),
      };
    })
    .filter(Boolean)
    .slice(0, limit);
}

function listNotes(args = {}) {
  const tag = String(args.tag || "").replace(/^#/, "").toLocaleLowerCase("fr-FR");
  const folder = String(args.folder || "").toLocaleLowerCase("fr-FR");
  return (manifest.notes || [])
    .filter((note) => !tag || (note.tags || []).includes(tag))
    .filter((note) => !folder || note.folder.toLocaleLowerCase("fr-FR") === folder)
    .map((note) => ({
      title: note.title,
      slug: note.slug,
      folder: note.folder,
      path: note.path,
      tags: note.tags,
      links: note.links,
      backlinks: note.backlinks,
      updatedAt: note.updatedAt,
    }));
}

function searchRepoFiles(args = {}) {
  const query = String(args.query || "").trim().toLocaleLowerCase("fr-FR");
  const limit = Math.max(1, Math.min(25, Number(args.limit || 8)));
  if (!query) return [];
  return (repoManifest.files || [])
    .map((file) => {
      const content = repoFileText(file);
      const haystack = (file.path + "\\n" + (file.language || "") + "\\n" + content).toLocaleLowerCase("fr-FR");
      const index = haystack.indexOf(query);
      if (index < 0) return null;
      const plain = content.replace(/\\s+/g, " ").trim();
      return {
        path: file.path,
        language: file.language,
        bytes: file.bytes,
        hash: file.hash,
        excerpt: plain.slice(Math.max(0, index - 80), index + 260),
      };
    })
    .filter(Boolean)
    .slice(0, limit);
}

function listRepoFiles(args = {}) {
  const language = String(args.language || "").toLocaleLowerCase("fr-FR");
  return (repoManifest.files || [])
    .filter((file) => !language || String(file.language || "").toLocaleLowerCase("fr-FR") === language)
    .map((file) => ({
      path: file.path,
      language: file.language,
      bytes: file.bytes,
      hash: file.hash,
      hasContent: Boolean(file.content || file.exportPath),
    }));
}

function resourceForNote(note) {
  return {
    uri: "povmind://notes/" + note.slug,
    name: note.title,
    description: note.folder + " · " + (note.tags || []).map((tag) => "#" + tag).join(" "),
    mimeType: "text/markdown",
  };
}

function resourceForRepoFile(file) {
  return {
    uri: "povmind://repo/files/" + encodeURIComponent(file.path),
    name: file.path,
    description: (file.language || "text") + " · " + (file.hash || "").slice(0, 12),
    mimeType: "text/plain",
  };
}

const tools = [
  {
    name: "povmind.search",
    description: "Search the PovMind vault notes.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query." },
        limit: { type: "number", description: "Maximum results, default 8." },
      },
      required: ["query"],
    },
  },
  {
    name: "povmind.read_note",
    description: "Read one PovMind note by title, slug or path.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        slug: { type: "string" },
        path: { type: "string" },
      },
    },
  },
  {
    name: "povmind.list_notes",
    description: "List PovMind notes, optionally filtered by tag or folder.",
    inputSchema: {
      type: "object",
      properties: {
        tag: { type: "string" },
        folder: { type: "string" },
      },
    },
  },
  {
    name: "povmind.vault_manifest",
    description: "Read structured PovMind vault metadata.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "povmind.repo_manifest",
    description: "Read structured metadata for the code repo linked to this vault.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "povmind.repo_list_files",
    description: "List files exported from the code repo linked to this vault.",
    inputSchema: {
      type: "object",
      properties: {
        language: { type: "string", description: "Optional language filter, for example javascript or markdown." },
      },
    },
  },
  {
    name: "povmind.repo_search",
    description: "Search exported files from the code repo linked to this vault.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query." },
        limit: { type: "number", description: "Maximum results, default 8." },
      },
      required: ["query"],
    },
  },
  {
    name: "povmind.repo_read_file",
    description: "Read one exported repo file by path.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repo-relative file path." },
      },
      required: ["path"],
    },
  },
];

function handleToolCall(name, args) {
  requireAccess();
  if (name === "povmind.search") return textResult(jsonText(searchNotes(args)));
  if (name === "povmind.list_notes") return textResult(jsonText(listNotes(args)));
  if (name === "povmind.repo_manifest") return textResult(jsonText(repoManifest));
  if (name === "povmind.repo_list_files") return textResult(jsonText(listRepoFiles(args)));
  if (name === "povmind.repo_search") return textResult(jsonText(searchRepoFiles(args)));
  if (name === "povmind.repo_read_file") {
    const file = findRepoFile(args);
    if (!file) return textResult("Repo file not found.");
    return textResult(repoFileText(file));
  }
  if (name === "povmind.vault_manifest") return textResult(jsonText({
    app: manifest.app,
    exportedAt: manifest.exportedAt,
    noteCount: manifest.noteCount,
    linkCount: manifest.linkCount,
    notes: manifest.notes,
    edges: manifest.edges,
    access: {
      vaultId: access.vaultId,
      tokenHint: access.tokenHint,
      scopes: access.scopes,
    },
    repo: repoManifest,
  }));
  if (name === "povmind.read_note") {
    const note = findNote(args);
    if (!note) return textResult("Note not found.");
    return textResult(noteText(note));
  }
  throw Object.assign(new Error("Unknown tool: " + name), { code: -32602 });
}

function handleResourceRead(uri) {
  requireAccess();
  if (uri === "povmind://vault/manifest") {
    return { contents: [{ uri, mimeType: "application/json", text: jsonText(manifest) }] };
  }
  if (uri === "povmind://repo/manifest") {
    return { contents: [{ uri, mimeType: "application/json", text: jsonText(repoManifest) }] };
  }
  const repoPrefix = "povmind://repo/files/";
  if (uri.startsWith(repoPrefix)) {
    const filePath = decodeURIComponent(uri.slice(repoPrefix.length));
    const file = findRepoFile({ path: filePath });
    if (!file) throw Object.assign(new Error("Resource not found: " + uri), { code: -32004 });
    return { contents: [{ uri, mimeType: "text/plain", text: repoFileText(file) }] };
  }
  const prefix = "povmind://notes/";
  if (uri.startsWith(prefix)) {
    const slug = uri.slice(prefix.length);
    const note = notes.get(slug);
    if (!note) throw Object.assign(new Error("Resource not found: " + uri), { code: -32004 });
    return { contents: [{ uri, mimeType: "text/markdown", text: noteText(note) }] };
  }
  throw Object.assign(new Error("Resource not found: " + uri), { code: -32004 });
}

function handleRequest(message) {
  const { id, method, params = {} } = message;
  if (method === "initialize") {
    return {
      protocolVersion: params.protocolVersion || "2025-06-18",
      capabilities: { resources: {}, tools: {} },
      serverInfo: { name: "povmind-vault", version: "${APP_VERSION}" },
    };
  }
  if (method === "ping") return {};
  if (method === "tools/list") return { tools };
  if (method === "tools/call") return handleToolCall(params.name, params.arguments || {});
  if (method === "resources/list") {
    requireAccess();
    return {
      resources: [
        { uri: "povmind://vault/manifest", name: "PovMind manifest", mimeType: "application/json" },
        { uri: "povmind://repo/manifest", name: "PovMind repo manifest", mimeType: "application/json" },
        ...(manifest.notes || []).map(resourceForNote),
        ...(repoManifest.files || []).filter((file) => file.content || file.exportPath).map(resourceForRepoFile),
      ],
    };
  }
  if (method === "resources/read") return handleResourceRead(params.uri);
  if (method === "prompts/list") return { prompts: [] };
  if (method && method.startsWith("notifications/")) return undefined;
  throw Object.assign(new Error("Method not found: " + method), { code: -32601 });
}

function send(payload) {
  process.stdout.write(JSON.stringify(payload) + "\\n");
}

function respond(message) {
  if (message.id === undefined || message.id === null) {
    try {
      handleRequest(message);
    } catch (error) {
      process.stderr.write("[povmind-mcp] " + error.message + "\\n");
    }
    return;
  }

  try {
    const result = handleRequest(message);
    if (result !== undefined) send({ jsonrpc: "2.0", id: message.id, result });
  } catch (error) {
    send({
      jsonrpc: "2.0",
      id: message.id,
      error: {
        code: Number(error.code || -32000),
        message: error.message || "PovMind MCP error",
      },
    });
  }
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\\n")) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    try {
      const message = JSON.parse(line);
      if (Array.isArray(message)) message.forEach(respond);
      else respond(message);
    } catch (error) {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    }
  }
});
`;
}

function safeRepoExportPath(file) {
  const hash = String(file.hash || "").slice(0, 10) || safeFilename(file.path).slice(0, 10);
  const base = safeFilename(file.path).slice(0, 90) || "file";
  return `repo/files/${base}-${hash}.txt`;
}

function buildRepoExportFiles() {
  const repo = repoExportPayload(true);
  const files = [];
  const manifest = {
    ...repo,
    files: repo.files.map((file) => {
      const copy = { ...file };
      if (copy.content) {
        copy.exportPath = safeRepoExportPath(copy);
        files.push({ path: copy.exportPath, content: copy.content });
        delete copy.content;
      }
      return copy;
    }),
  };

  files.unshift({ path: "repo/manifest.json", content: JSON.stringify(manifest, null, 2) });
  return files;
}

function buildMcpFiles() {
  const { context, files: codexFiles } = buildCodexFiles();
  const access = makeMcpAccessManifest();
  const repoFiles = buildRepoExportFiles();
  const files = [
    { path: "README-MCP.md", content: makeMcpReadmeMarkdown(context) },
    { path: "mcp/package.json", content: JSON.stringify({ name: "povmind-mcp-vault", version: APP_VERSION, private: true, type: "module", bin: { "povmind-mcp": "./povmind-server.mjs" } }, null, 2) },
    { path: "mcp/povmind-server.mjs", content: makeMcpServerSource() },
    { path: "mcp/access.json", content: JSON.stringify(access, null, 2) },
    { path: "mcp/client-config.example.json", content: JSON.stringify(makeMcpClientConfigExample(), null, 2) },
    ...codexFiles.filter((file) => file.path.startsWith("knowledge/") || file.path === "AGENTS.md"),
    ...repoFiles,
  ];
  return { context, files };
}

function buildSnapshotContent(createdAt) {
  const context = buildCodexContext(createdAt);
  const active = activeNote();
  const stats = graphStats();
  return {
    app: APP_NAME,
    storageVersion: 1,
    vaultId: state.security.vaultId,
    vaultName: activeVaultRecord()?.name || "PovMind",
    activeId: state.activeId,
    activeTitle: active?.title || null,
    view: state.view,
    notes: clonePlain(state.notes),
    starredIds: [...state.starredIds],
    graphPositions: clonePlain(state.graphPositions),
    layout: clonePlain(state.layout),
    security: securityExportPayload(),
    knowledge: {
      manifest: makeCodexManifest(context),
      graph: makeCodexGraph(context),
    },
    mcp: {
      access: makeMcpAccessManifest(createdAt, null),
      tools: ["povmind.search", "povmind.read_note", "povmind.list_notes", "povmind.vault_manifest", "povmind.repo_manifest", "povmind.repo_list_files", "povmind.repo_search", "povmind.repo_read_file"],
      resources: ["povmind://vault/manifest", "povmind://notes/{slug}", "povmind://repo/manifest", "povmind://repo/files/{path}"],
    },
    repo: repoExportPayload(false),
    githubSync: githubSyncExportPayload(),
    learning: {
      memory: learningMemoryExportPayload(),
      runs: enrichmentRunsExportPayload().slice(0, 10),
      cycles: cognitiveCyclesExportPayload().slice(0, 12),
      score: calculateLearningScore(),
    },
    summary: {
      noteCount: stats.notes,
      linkCount: stats.links,
      folderCount: stats.folders,
      starredCount: state.starredIds.size,
      tokenSealed: Boolean(state.security.tokenHash),
      repoLinked: repoIsLinked(),
      repoCommit: state.repo.commit || "",
      repoTreeHash: state.repo.treeHash || "",
      githubLinked: Boolean(state.githubSync.repoFullName),
      enrichmentRunCount: state.enrichmentRuns.length,
      cognitiveCycleCount: state.cognitiveCycles.length,
      learningAccepted: Number(state.learningMemory?.feedback?.accepted || 0),
      learningRejected: Number(state.learningMemory?.feedback?.rejected || 0),
      autoImprovementRatio: calculateLearningScore().ratio,
    },
  };
}

async function createVaultSnapshot(options: { silent?: boolean } = {}) {
  if (!requireVaultUnlocked("créer un snapshot")) return null;
  persistNow(false);
  const createdAt = nowIso();
  const content = buildSnapshotContent(createdAt);
  const hash = await sha256Hex(stableJson(content));
  const id = `vault@${createdAt}`;
  const snapshot = {
    version: 1,
    id,
    createdAt,
    hash,
    hashAlgorithm: "sha256(canonical snapshot.content)",
    summary: {
      ...content.summary,
      activeTitle: content.activeTitle,
    },
    payload: {
      format: "povmind-vault-snapshot",
      version: 1,
      snapshotId: id,
      createdAt,
      contentHash: hash,
      hashAlgorithm: "sha256(canonical snapshot.content)",
      content,
    },
  };

  state.snapshots = [snapshot, ...state.snapshots.filter((item) => item.id !== id)].slice(0, MAX_SNAPSHOTS);
  persistSnapshots();
  renderSnapshotsPanel();
  if (!options.silent) toast(`Snapshot créé : ${hash.slice(0, 12)}…`);
  return snapshot;
}

async function exportSnapshot(snapshotId = null) {
  let snapshot = snapshotId ? state.snapshots.find((item) => item.id === snapshotId) : latestSnapshot();
  if (!snapshot) snapshot = await createVaultSnapshot({ silent: true });
  if (!snapshot) return;
  const filename = `povmind-${safeFilename(snapshot.id)}-${snapshot.hash.slice(0, 12)}.json`;
  downloadFile(filename, JSON.stringify(snapshot.payload, null, 2), "application/json;charset=utf-8");
  toast(`Snapshot exporté : ${snapshot.hash.slice(0, 12)}…`);
}

function exportCodexKnowledgeBase() {
  if (!requireVaultUnlocked("exporter la base Codex")) return;
  persistNow(false);
  const { context, files } = buildCodexFiles();
  const zipBytes = createZipArchive(files);
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(`povmind-codex-kb-${date}.zip`, new Blob([zipBytes], { type: "application/zip" }));
  toast(`Base Codex exportée : ${context.files.length} note(s).`);
}

async function exportMcpBundle() {
  if (!requireVaultUnlocked("exporter le bundle MCP")) return;
  persistNow(false);
  await ensureAssistantTokenForExport();
  if (!state.security.tokenHash) return;
  const { context, files } = buildMcpFiles();
  const zipBytes = createZipArchive(files);
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(`povmind-mcp-vault-${date}.zip`, new Blob([zipBytes], { type: "application/zip" }));
  renderSecurityPanel();
  toast(`Bundle MCP exporté : ${context.files.length} note(s), token requis.`);
}

function syncGithubSettingsFromInputs() {
  if (!els.githubRepoInput) return;
  state.githubSync = cleanGithubSyncState({
    ...state.githubSync,
    repoFullName: els.githubRepoInput.value,
    branch: els.githubBranchInput.value,
    basePath: els.githubPathInput.value,
  });
  persistGithubSyncState();
  renderGithubPanel();
}

async function refreshGithubStatus() {
  try {
    const response = await fetch("/api/github/status", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const status = await response.json();
    state.githubSync.connector = {
      ...state.githubSync.connector,
      configured: Boolean(status.configured),
      authenticated: Boolean(status.authenticated),
      tokenStorage: status.tokenStorage || "server-http-only",
    };
    persistGithubSyncState();
    renderGithubPanel();
    return status;
  } catch {
    state.githubSync.connector = {
      ...state.githubSync.connector,
      configured: false,
      authenticated: false,
    };
    renderGithubPanel();
    return null;
  }
}

async function exportGithubContextBundle(showToast = true) {
  if (!requireVaultUnlocked("exporter le contexte GitHub")) return null;
  syncGithubSettingsFromInputs();
  const snapshot = await createVaultSnapshot({ silent: true });
  const { context, files } = buildPovmindContextFiles(snapshot);
  const zipBytes = createZipArchive(files);
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(`povmind-github-context-${date}.zip`, new Blob([zipBytes], { type: "application/zip" }));
  if (showToast) toast(`Contexte GitHub exporté : ${context.files.length} note(s).`);
  return { context, files, snapshot };
}

async function connectGithub() {
  syncGithubSettingsFromInputs();
  const status = await refreshGithubStatus();
  if (!status?.configured) {
    toast("Connecteur GitHub non configuré sur Cloud Run.");
    return;
  }
  const params = new URLSearchParams({
    repo: state.githubSync.repoFullName,
    branch: state.githubSync.branch,
    path: state.githubSync.basePath,
  });
  window.open(`/auth/github/start?${params.toString()}`, "_blank", "noopener,noreferrer");
  toast("Connexion GitHub ouverte.");
}

async function pushGithubContext() {
  if (!requireVaultUnlocked("pousser le contexte GitHub")) return;
  syncGithubSettingsFromInputs();
  if (!state.githubSync.repoFullName) {
    toast("Renseigne un repo GitHub owner/repo.");
    return;
  }

  const snapshot = await createVaultSnapshot({ silent: true });
  const { files } = buildPovmindContextFiles(snapshot);
  try {
    const response = await fetch("/api/github/push-context", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        repoFullName: state.githubSync.repoFullName,
        branch: state.githubSync.branch,
        basePath: state.githubSync.basePath,
        message: `Sync PovMind context ${snapshot.hash.slice(0, 12)}`,
        files: files.map((file) => ({ path: file.path, content: String(file.content ?? "") })),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || payload.message || `HTTP ${response.status}`);
    state.githubSync.lastSyncedAt = nowIso();
    state.githubSync.lastCommit = payload.commit || "";
    state.githubSync.lastDirection = "push";
    state.githubSync.connector = {
      ...state.githubSync.connector,
      configured: true,
      authenticated: true,
    };
    persistGithubSyncState();
    renderGithubPanel();
    toast(`Contexte poussé sur GitHub : ${(payload.commit || "").slice(0, 8) || "ok"}.`);
  } catch (error) {
    console.error(error);
    toast(`Push GitHub indisponible : ${error.message}`);
  }
}

async function pullGithubContext() {
  if (!requireVaultUnlocked("tirer le contexte GitHub")) return;
  syncGithubSettingsFromInputs();
  if (!state.githubSync.repoFullName) {
    toast("Renseigne un repo GitHub owner/repo.");
    return;
  }

  try {
    const response = await fetch("/api/github/pull-context", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        repoFullName: state.githubSync.repoFullName,
        branch: state.githubSync.branch,
        basePath: state.githubSync.basePath,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || payload.message || `HTTP ${response.status}`);
    const entries = Object.fromEntries((payload.files || []).map((file) => [file.path, file.content || ""]));
    const result = importGithubContextEntries(entries);
    state.githubSync.lastSyncedAt = nowIso();
    state.githubSync.lastCommit = payload.commit || state.githubSync.lastCommit || "";
    state.githubSync.lastDirection = "pull";
    state.githubSync.connector = {
      ...state.githubSync.connector,
      configured: true,
      authenticated: true,
    };
    persistGithubSyncState();
    renderAll();
    toast(result.imported ? "Contexte tiré depuis GitHub." : "Manifest GitHub tiré.");
  } catch (error) {
    console.error(error);
    toast(`Pull GitHub indisponible : ${error.message}`);
  }
}

function exportVault() {
  if (!requireVaultUnlocked("exporter le vault")) return;
  persistNow(false);
  const payload = {
    version: 1,
    exportedAt: nowIso(),
    vault: activeVaultRecord(),
    activeId: state.activeId,
    starredIds: [...state.starredIds],
    security: securityExportPayload(),
    repo: repoExportPayload(true),
    githubSync: githubSyncExportPayload(),
    learningMemory: learningMemoryExportPayload(),
    enrichmentRuns: enrichmentRunsExportPayload(),
    cognitiveCycles: cognitiveCyclesExportPayload(),
    snapshots: state.snapshots,
    notes: state.notes,
  };
  downloadFile("povmind-vault.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  toast("Carnet exporté en JSON.");
}

function exportMarkdown() {
  if (!requireVaultUnlocked("exporter la note")) return;
  const note = activeNote();
  if (!note) return;
  downloadFile(`${safeFilename(note.title)}.md`, note.body || "", "text/markdown;charset=utf-8");
  toast("Note exportée en Markdown.");
}

async function importRepoManifest(file) {
  if (!file) return;
  if (!requireVaultUnlocked("importer un manifest repo")) {
    els.repoManifestInput.value = "";
    return;
  }
  try {
    const parsed = JSON.parse(await file.text());
    const manifest = cleanRepoState({
      ...parsed,
      linked: true,
      importedAt: nowIso(),
    });
    if (!manifest.name && !manifest.root) throw new Error("Nom de repo manquant");
    state.repo = manifest;
    persistRepoState();
    renderRepoPanel();
    toast(`Repo lié : ${manifest.name || manifest.root}.`);
  } catch (error) {
    console.error(error);
    toast("Manifest repo invalide.");
  } finally {
    els.repoManifestInput.value = "";
  }
}

function exportRepoManifest() {
  if (!repoIsLinked()) {
    toast("Aucun repo lié.");
    return;
  }
  const repo = repoExportPayload(true);
  const name = safeFilename(repo.name || repo.root || "repo");
  downloadFile(`povmind-repo-${name}-${(repo.treeHash || "nohash").slice(0, 12)}.json`, JSON.stringify(repo, null, 2), "application/json;charset=utf-8");
  toast("Manifest repo exporté.");
}

function ensureCodeRepoNote() {
  if (!requireVaultUnlocked("créer la note code repo")) return null;
  if (!repoIsLinked()) {
    toast("Importe d'abord un manifest repo.");
    return null;
  }

  const repo = cleanRepoState(state.repo);
  const title = `Code Repo - ${repo.name || repo.root || "Repo"}`;
  const files = repo.files
    .slice(0, 24)
    .map((file) => `- \`${file.path}\` — ${file.language || "texte"}, ${file.bytes || 0} o, ${shortHash(file.hash)}`)
    .join("\n") || "- Aucun fichier indexé.";

  const body = `# ${title}\n\nCe repo est l'ancre exécutable du vault.\n\n## Identité\n\n- Nom : ${repo.name || repo.root || "Repo"}\n- Remote : ${repo.remote || "non renseigné"}\n- Branche : ${repo.branch || "inconnue"}\n- Commit : ${repo.commit || "inconnu"}\n- Dirty : ${repo.dirty === true ? "oui" : repo.dirty === false ? "non" : "inconnu"}\n- Tree hash : \`${repo.treeHash || "inconnu"}\`\n- Fichiers indexés : ${repo.indexedCount}\n\n## Principe\n\nLe vault documente le pourquoi. Le repo contient le code qui peut être testé, déployé et audité. Les snapshots doivent lier les deux.\n\n## Fichiers indexés\n\n${files}\n\n## Liens\n\n- [[PovMind - Code repo]]\n- [[PovMind - Snapshots du vault]]\n\n#repo #code #contexte`;

  const existing = findNoteByTitle(title);
  if (existing) {
    existing.body = body;
    existing.folder = "Code";
    existing.updatedAt = nowIso();
    state.activeId = existing.id;
  } else {
    const createdAt = nowIso();
    state.notes.unshift({
      id: uid(),
      title,
      folder: "Code",
      body,
      createdAt,
      updatedAt: createdAt,
    });
    state.activeId = state.notes[0].id;
  }

  persistNow(false);
  renderAll();
  toast("Note code repo mise à jour.");
  return activeNote();
}

function repoFileNoteLanguage(file) {
  return String(file.language || "text").replace(/[^a-z0-9_+-]/gi, "") || "text";
}

function repoFileFence(content, language) {
  const safeContent = String(content || "").replaceAll("```", "`\u200b``");
  return `\`\`\`${repoFileNoteLanguage({ language })}\n${safeContent}\n\`\`\``;
}

function topRepoFolder(filePath) {
  const first = String(filePath || "").split("/").filter(Boolean)[0] || ROOT_FOLDER;
  return first.includes(".") ? ROOT_FOLDER : first;
}

function isLikelyRepoEntryFile(file) {
  const path = String(file.path || "");
  const name = path.split("/").pop() || "";
  return [
    "README.md",
    "AGENTS.md",
    "package.json",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "vite.config.ts",
    "vite.config.js",
    "next.config.js",
    "server.js",
    "Dockerfile",
    "docker-compose.yml",
    ".github/workflows/ci.yml",
  ].includes(path)
    || /(^|\/)(app|main|index|server|worker|client)\.(ts|tsx|js|mjs|cjs|py|go|rs|jsx)$/i.test(path)
    || /^README(\.[a-z]+)?\.md$/i.test(name);
}

function repoPackageSummary(repo) {
  const packageFile = (repo.files || []).find((file) => file.path === "package.json" && file.content);
  if (!packageFile) return "";
  try {
    const pkg = JSON.parse(packageFile.content);
    const scripts = pkg.scripts && typeof pkg.scripts === "object"
      ? Object.entries(pkg.scripts).slice(0, 12).map(([name, value]) => `- \`${name}\` : \`${value}\``).join("\n")
      : "- Aucun script package.json.";
    const deps = [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
    ].slice(0, 30);
    return `\n## Package.json\n\n- Nom : ${pkg.name || repo.name || "non renseigné"}\n- Version : ${pkg.version || "non renseignée"}\n\n### Scripts\n\n${scripts}\n\n### Dépendances clés\n\n${deps.length ? deps.map((dep) => `- \`${dep}\``).join("\n") : "- Aucune dépendance listée."}\n`;
  } catch {
    return "";
  }
}

function createCommonVaultPatternNotes(addNote, repoName, linkTargets) {
  const decisions = addNote(
    `${repoName} - Journal de décisions`,
    "Patterns",
    `# ${repoName} - Journal de décisions\n\nPattern commun : une décision doit garder le contexte, les options, le choix, l'impact et les liens vers le code ou les notes concernées.\n\n## Décisions\n\n- [ ] Décision : contexte, options, choix, impact, owner, date.\n\n## Liens\n\n- [[${linkTargets.index}]]\n- [[${linkTargets.map}]]\n\n#pattern #decision #contexte`,
  );
  const runbook = addNote(
    `${repoName} - Runbook`,
    "Patterns",
    `# ${repoName} - Runbook\n\nPattern commun : tout vault lié à un système doit contenir les commandes de setup, test, build, déploiement, rollback et debug.\n\n## Setup\n\n- [ ] Installer les dépendances.\n- [ ] Configurer les variables d'environnement sans exposer de secret.\n\n## Vérification\n\n- [ ] Tests automatisés.\n- [ ] Build.\n- [ ] Smoke test local ou prod.\n\n## Liens\n\n- [[${linkTargets.index}]]\n- [[${linkTargets.entries}]]\n\n#pattern #runbook #ops`,
  );
  const quality = addNote(
    `${repoName} - Tests et qualité`,
    "Patterns",
    `# ${repoName} - Tests et qualité\n\nPattern commun : séparer ce qui prouve que le système compile, ce qui prouve le comportement métier, et ce qui protège les flux critiques.\n\n## Checklist\n\n- [ ] Build reproductible.\n- [ ] Tests unitaires ou smoke tests.\n- [ ] Vérification UI si frontend.\n- [ ] Vérification des exports/imports si contexte.\n\n## Liens\n\n- [[${linkTargets.entries}]]\n- [[${runbook.title}]]\n\n#pattern #test #qualite`,
  );
  const security = addNote(
    `${repoName} - Sécurité et accès`,
    "Patterns",
    `# ${repoName} - Sécurité et accès\n\nPattern commun : documenter les frontières de confiance, les secrets attendus, les tokens, les endpoints sensibles et les données que l'assistant peut lire.\n\n## À documenter\n\n- [ ] Secrets et variables d'environnement.\n- [ ] Tokens côté serveur ou navigateur.\n- [ ] Données sensibles exclues du scan.\n- [ ] Endpoints et scopes nécessaires.\n\n## Liens\n\n- [[${linkTargets.manifest}]]\n- [[${linkTargets.index}]]\n\n#pattern #security #token`,
  );
  const questions = addNote(
    `${repoName} - Questions ouvertes`,
    "Patterns",
    `# ${repoName} - Questions ouvertes\n\nPattern commun : transformer les zones floues en questions actionnables avant d'écrire du code.\n\n## Questions\n\n- [ ] Quel est le flux utilisateur principal ?\n- [ ] Quelles données doivent rester locales ou chiffrées ?\n- [ ] Quelle partie du repo est source de vérité ?\n- [ ] Quels tests valident réellement le changement ?\n\n## Liens\n\n- [[${linkTargets.index}]]\n- [[${decisions.title}]]\n\n#pattern #questions #contexte`,
  );
  const index = addNote(
    `${repoName} - Patterns communs`,
    "Patterns",
    `# ${repoName} - Patterns communs\n\nCe dossier donne une structure répétable pour tous les vaults PovMind, qu'ils viennent d'Obsidian, d'un repo GitHub ou d'un contexte produit.\n\n## Patterns\n\n- [[${decisions.title}]]\n- [[${runbook.title}]]\n- [[${quality.title}]]\n- [[${security.title}]]\n- [[${questions.title}]]\n\n## Règle\n\nChaque vault doit permettre à un assistant de répondre à trois questions : quoi faire, pourquoi, et avec quelle preuve.\n\n#pattern #vault #povmind`,
  );
  return { index, decisions, runbook, quality, security, questions };
}

function buildDevVaultImportPayload(repoInput, syncInput = null) {
  const repo = cleanRepoState({
    ...repoInput,
    linked: true,
    importedAt: nowIso(),
  });
  const sync = cleanGithubSyncState(syncInput || {
    repoFullName: cleanGithubRepoFullName(repo.remote),
    branch: repo.branch || "main",
  });
  const createdAt = nowIso();
  const repoName = repo.name || repo.root || sync.repoFullName || "Repo GitHub";
  const usedTitles = new Set();
  const notes = [];
  const fileTitleByPath = new Map();
  const files = (repo.files || []).slice(0, MAX_DEV_CONTEXT_FILES);

  const addNote = (title, folder, body) => {
    const note = {
      id: uid(),
      title: uniqueTitleFromSet(title, usedTitles),
      folder: normalizeFolder(folder),
      body,
      createdAt,
      updatedAt: createdAt,
    };
    notes.push(note);
    return note;
  };

  const indexNote = addNote(
    `${repoName} - Dev Index`,
    "Dev Context",
    "",
  );
  const mapNote = addNote(`${repoName} - Carte du repo`, "Dev Context", "");
  const entryNote = addNote(`${repoName} - Entrées techniques`, "Dev Context", "");
  const manifestNote = addNote(`${repoName} - Manifest repo`, "Dev Context", "");
  const patternNotes = createCommonVaultPatternNotes(addNote, repoName, {
    index: indexNote.title,
    map: mapNote.title,
    entries: entryNote.title,
    manifest: manifestNote.title,
  });

  for (const file of files) {
    const title = uniqueTitleFromSet(`Code · ${file.path}`, usedTitles);
    fileTitleByPath.set(file.path, title);
  }

  const fileLink = (file) => {
    const title = fileTitleByPath.get(file.path);
    return title ? `[[${title}|${file.path}]]` : `\`${file.path}\``;
  };

  const filesByFolder = new Map();
  for (const file of files) {
    const folder = topRepoFolder(file.path);
    if (!filesByFolder.has(folder)) filesByFolder.set(folder, []);
    filesByFolder.get(folder).push(file);
  }
  const folderLines = [...filesByFolder.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "fr"))
    .map(([folder, folderFiles]) => {
      const fileLines = folderFiles
        .slice(0, 18)
        .map((file) => `  - ${fileLink(file)} · ${file.language || "texte"} · ${Number(file.bytes || 0)} o`)
        .join("\n");
      const more = folderFiles.length > 18 ? `\n  - ... ${folderFiles.length - 18} fichier(s) supplémentaire(s)` : "";
      return `- ${folder} · ${folderFiles.length} fichier(s)\n${fileLines}${more}`;
    })
    .join("\n");

  const entryFiles = files.filter(isLikelyRepoEntryFile).slice(0, 18);
  const entryLines = entryFiles.length
    ? entryFiles.map((file) => `- ${fileLink(file)} · ${clampText(file.preview || file.content, 140)}`).join("\n")
    : "- Aucun point d'entrée évident détecté dans l'échantillon.";

  const languageCounts = new Map();
  for (const file of files) {
    const language = file.language || "texte";
    languageCounts.set(language, (languageCounts.get(language) || 0) + 1);
  }
  const languageLines = [...languageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([language, count]) => `- ${language} : ${count}`)
    .join("\n");

  indexNote.body = `# ${indexNote.title}\n\nVault généré depuis un scan GitHub pour garder un contexte de développement exploitable par PovMind, Codex et MCP.\n\n## Repo\n\n- GitHub : ${sync.repoFullName || repo.remote || repoName}\n- Branche : ${repo.branch || sync.branch || "inconnue"}\n- Commit : ${repo.commit || "inconnu"}\n- Tree hash : \`${repo.treeHash || "inconnu"}\`\n- Fichiers indexés : ${repo.indexedCount || files.length}/${repo.fileCount || files.length}\n- Généré : ${repo.generatedAt || createdAt}\n\n## Navigation\n\n- [[${mapNote.title}]]\n- [[${entryNote.title}]]\n- [[${manifestNote.title}]]\n- [[${patternNotes.index.title}]]\n\n## Langages\n\n${languageLines || "- Aucun langage détecté."}\n\n## Prochaines actions\n\n- [ ] Lire les points d'entrée.\n- [ ] Ajouter les décisions techniques importantes comme notes dédiées.\n- [ ] Créer un snapshot après validation du contexte.\n\n#dev #github #repo #contexte`;

  mapNote.body = `# ${mapNote.title}\n\nCarte générée depuis le manifest repo. Les fichiers sont stockés dans le vault comme contexte lisible, tandis que le manifest repo complet reste disponible dans les exports MCP/Codex.\n\n## Dossiers\n\n${folderLines || "- Aucun fichier indexé."}\n`;

  entryNote.body = `# ${entryNote.title}\n\n## Points d'entrée détectés\n\n${entryLines}\n${repoPackageSummary(repo)}\n## Comment l'utiliser\n\n- Commencer par [[${indexNote.title}]].\n- Ouvrir les fichiers d'entrée ci-dessus avant de modifier le code.\n- Lier chaque décision à une note de projet ou de journal.\n\n#dev #architecture`;

  const manifestSummary = {
    format: repo.format,
    version: repo.version,
    name: repo.name,
    root: repo.root,
    remote: repo.remote,
    branch: repo.branch,
    commit: repo.commit,
    treeHash: repo.treeHash,
    generatedAt: repo.generatedAt,
    importedAt: repo.importedAt,
    fileCount: repo.fileCount,
    indexedCount: repo.indexedCount,
    policy: repo.policy,
  };
  manifestNote.body = `# ${manifestNote.title}\n\nCe manifest est le contrat technique du scan. Le manifest complet avec contenu des fichiers reste attaché au vault comme repo lié.\n\n${repoFileFence(JSON.stringify(manifestSummary, null, 2), "json")}\n\n#manifest #repo`;

  for (const file of files) {
    const title = fileTitleByPath.get(file.path);
    const folder = `Code/${topRepoFolder(file.path)}`;
    const content = truncateText(file.content || file.preview || "", MAX_DEV_CONTEXT_NOTE_BYTES);
    notes.push({
      id: uid(),
      title,
      folder: normalizeFolder(folder),
      body: `# ${title}\n\n- Chemin : \`${file.path}\`\n- Langage : ${file.language || "texte"}\n- Taille : ${Number(file.bytes || 0)} o\n- Hash : \`${file.hash || "inconnu"}\`\n\n## Liens\n\n- [[${mapNote.title}]]\n- [[${entryNote.title}]]\n\n## Contenu\n\n${repoFileFence(content, file.language || "text")}\n\n#code #repo`,
      createdAt,
      updatedAt: createdAt,
    });
  }

  return {
    version: 1,
    source: "github-repo-scan",
    importedAt: createdAt,
    vaultName: `Dev - ${repoName}`,
    activeId: indexNote.id,
    starredIds: [indexNote.id, mapNote.id],
    repo,
    githubSync: cleanGithubSyncState({
      ...sync,
      repoFullName: sync.repoFullName || cleanGithubRepoFullName(repo.remote),
      branch: repo.branch || sync.branch,
      lastSyncedAt: createdAt,
      lastCommit: repo.commit || sync.lastCommit,
      lastDirection: "scan",
    }),
    notes,
  };
}

function isRepoContextFolder(folder) {
  const normalized = normalizeFolder(folder);
  return normalized === "Dev Context" || normalized === "Patterns" || normalized.startsWith("Code/");
}

function mergeImportedVaultPayload(parsed) {
  const payload = normalizeVaultImportPayload(parsed);
  if (!payload.notes.length) throw new Error("Aucune note valide");

  const idMap = new Map();
  const usedTitles = new Set(state.notes.map((note) => normalizeTitle(note.title)));
  const titleMap = new Map();
  const existingByTitle = new Map(state.notes.map((note) => [normalizeTitle(note.title), note]));
  const created = [];
  const updated = [];
  for (const note of payload.notes) {
    const normalizedTitle = normalizeTitle(note.title);
    const existing = existingByTitle.get(normalizedTitle);
    if (existing && isRepoContextFolder(existing.folder) && isRepoContextFolder(note.folder)) {
      idMap.set(note.id, existing.id);
      titleMap.set(normalizedTitle, existing.title);
      existing.folder = note.folder;
      existing.body = note.body;
      existing.updatedAt = nowIso();
      updated.push(existing);
      continue;
    }

    const nextId = uid();
    const nextTitle = uniqueTitleFromSet(note.title, usedTitles);
    idMap.set(note.id, nextId);
    titleMap.set(normalizedTitle, nextTitle);
    const nextNote = {
      ...note,
      id: nextId,
      title: nextTitle,
      createdAt: note.createdAt || nowIso(),
      updatedAt: nowIso(),
    };
    created.push(nextNote);
  }
  for (const note of [...created, ...updated]) {
    note.body = rewriteWikiLinkTargets(note.body, titleMap);
  }

  state.notes = [...created, ...state.notes];
  for (const id of payload.starredIds) {
    const nextId = idMap.get(id);
    if (nextId) state.starredIds.add(nextId);
  }
  state.activeId = idMap.get(payload.activeId) || created[0]?.id || updated[0]?.id || state.activeId;
  if (payload.repo) {
    state.repo = cleanRepoState(payload.repo);
    persistRepoState();
  }
  if (payload.githubSync) {
    const nextSync = cleanGithubSyncState(payload.githubSync);
    state.githubSync = cleanGithubSyncState({
      ...nextSync,
      connector: {
        ...nextSync.connector,
        ...(state.githubSync?.connector || {}),
      },
    });
    persistGithubSyncState();
  }
  if (payload.snapshots.length) {
    const importedSnapshots = payload.snapshots.map(cleanSnapshot).filter(Boolean) as VaultSnapshot[];
    const byId = new Map([...state.snapshots, ...importedSnapshots].map((snapshot) => [snapshot.id, snapshot]));
    state.snapshots = [...byId.values()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_SNAPSHOTS);
    persistSnapshots();
  }

  persistStarredIds();
  persistNow(true);
  renderAll();
}

async function scanGithubRepoToVault(mode = "new") {
  if (!requireVaultUnlocked("scanner un repo GitHub")) return;
  syncGithubSettingsFromInputs();
  const sync = cleanGithubSyncState(state.githubSync);
  if (!sync.repoFullName) {
    toast("Renseigne un repo GitHub au format owner/repo.");
    return;
  }

  const activeButton = mode === "enrich" ? els.githubEnrichBtn : els.githubScanBtn;
  const previousLabel = activeButton.textContent;
  els.githubScanBtn.disabled = true;
  els.githubEnrichBtn.disabled = true;
  activeButton.textContent = "Scan...";
  try {
    const response = await fetch("/api/github/scan-repo", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repoFullName: sync.repoFullName,
        branch: sync.branch,
        maxFiles: MAX_DEV_CONTEXT_FILES,
        maxBytes: 45000,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.message || payload.error || "scan GitHub impossible");
    const vaultPayload = buildDevVaultImportPayload(payload.repo, sync);
    if (mode === "enrich") {
      mergeImportedVaultPayload(vaultPayload);
      toast(`Vault actif enrichi depuis ${sync.repoFullName} : ${vaultPayload.notes.length} note(s).`);
    } else {
      await createVaultFromImportPayload(vaultPayload, vaultPayload.vaultName);
      toast(`Vault dev créé depuis ${sync.repoFullName} : ${vaultPayload.repo.indexedCount || vaultPayload.repo.files.length} fichier(s).`);
    }
  } catch (error) {
    console.error(error);
    toast(`Scan GitHub impossible : ${error.message}`);
  } finally {
    activeButton.textContent = previousLabel;
    renderGithubPanel();
  }
}

function rawFileRelativePath(file) {
  return String(file?.webkitRelativePath || file?.name || "").replaceAll("\\", "/");
}

function selectedVaultRootSegment(paths) {
  const firstSegments = paths
    .map((path) => path.split("/").filter(Boolean))
    .filter((segments) => segments.length > 1)
    .map((segments) => segments[0]);
  if (!firstSegments.length) return "";
  return firstSegments.every((segment) => segment === firstSegments[0]) ? firstSegments[0] : "";
}

function stripSelectedVaultRoot(path, rootSegment) {
  const segments = String(path || "").split("/").filter(Boolean);
  if (rootSegment && segments[0] === rootSegment) segments.shift();
  return segments.join("/");
}

function shouldImportObsidianFile(path) {
  const segments = String(path || "").split("/").filter(Boolean);
  if (!segments.length) return false;
  const filename = segments[segments.length - 1];
  if (!/\.md$/i.test(filename)) return false;
  return !segments.some((segment) => OBSIDIAN_IGNORED_DIRS.has(segment) || segment.startsWith("."));
}

function obsidianFolderForPath(path) {
  const segments = String(path || "").split("/").filter(Boolean);
  segments.pop();
  return normalizeFolder(segments.join("/") || ROOT_FOLDER);
}

function obsidianPathWithoutMarkdown(path) {
  return stripMarkdownExtension(String(path || "").replaceAll("\\", "/").replace(/^\/+|\/+$/g, ""));
}

function splitObsidianTarget(rawTarget) {
  const decoded = decodeObsidianPath(rawTarget);
  const markerIndexes = ["#", "^"]
    .map((marker) => decoded.indexOf(marker))
    .filter((index) => index >= 0);
  const markerIndex = markerIndexes.length ? Math.min(...markerIndexes) : -1;
  const notePath = markerIndex >= 0 ? decoded.slice(0, markerIndex) : decoded;
  const fragment = markerIndex >= 0 ? decoded.slice(markerIndex + 1) : "";
  return {
    notePath: notePath.trim(),
    fragment: fragment.trim(),
  };
}

function obsidianTargetHasAttachmentExtension(targetPath) {
  return /\.[a-z0-9]{2,8}$/i.test(targetPath) && !/\.md$/i.test(targetPath);
}

function makeObsidianImportIndexes(entries) {
  const titleCounts = new Map();
  for (const entry of entries) {
    const normalized = normalizeTitle(entry.baseTitle);
    titleCounts.set(normalized, (titleCounts.get(normalized) || 0) + 1);
  }

  const usedTitles = new Set();
  const pathToTitle = new Map();
  const titleToTitle = new Map();
  const duplicateTitles = new Set([...titleCounts.entries()].filter(([, count]) => count > 1).map(([title]) => title));

  for (const entry of entries) {
    const folderLabel = entry.folder === ROOT_FOLDER ? ROOT_FOLDER : entry.folder.replaceAll("/", " / ");
    const duplicate = duplicateTitles.has(normalizeTitle(entry.baseTitle));
    const base = duplicate ? `${entry.baseTitle} · ${folderLabel}` : entry.baseTitle;
    entry.title = uniqueTitleFromSet(base, usedTitles);
    pathToTitle.set(normalizePathKey(entry.pathWithoutMarkdown), entry.title);
  }

  for (const entry of entries) {
    const normalized = normalizeTitle(entry.baseTitle);
    if (!duplicateTitles.has(normalized)) titleToTitle.set(normalized, entry.title);
  }

  return { pathToTitle, titleToTitle };
}

function resolveObsidianNoteTitle(rawTarget, currentTitle, indexes) {
  const { notePath, fragment } = splitObsidianTarget(rawTarget);
  if (!notePath && fragment) return currentTitle;

  const pathTarget = normalizePathKey(obsidianPathWithoutMarkdown(notePath));
  if (pathTarget && indexes.pathToTitle.has(pathTarget)) return indexes.pathToTitle.get(pathTarget);

  const baseTarget = normalizeTitle(basenameWithoutMarkdown(notePath));
  if (baseTarget && indexes.titleToTitle.has(baseTarget)) return indexes.titleToTitle.get(baseTarget);
  if (obsidianTargetHasAttachmentExtension(notePath)) return "";

  return basenameWithoutMarkdown(notePath || rawTarget);
}

function convertObsidianLinks(markdown, currentTitle, indexes) {
  return String(markdown || "").replace(/(!?)\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, embed, rawTarget, rawAlias) => {
    const { notePath } = splitObsidianTarget(rawTarget);
    const pathTarget = normalizePathKey(obsidianPathWithoutMarkdown(notePath));
    const baseTarget = normalizeTitle(basenameWithoutMarkdown(notePath));
    const knownNote = (pathTarget && indexes.pathToTitle.has(pathTarget)) || (baseTarget && indexes.titleToTitle.has(baseTarget));
    if (!knownNote && obsidianTargetHasAttachmentExtension(notePath)) {
      const label = String(rawAlias || basenameWithoutMarkdown(notePath) || notePath).trim();
      return label ? `[Pièce jointe Obsidian non importée : ${label}]` : "";
    }

    const resolvedTitle = resolveObsidianNoteTitle(rawTarget, currentTitle, indexes);
    if (!resolvedTitle) return "";
    const alias = String(rawAlias || "").trim();
    return alias && alias !== resolvedTitle ? `[[${resolvedTitle}|${alias}]]` : `[[${resolvedTitle}]]`;
  });
}

async function buildObsidianImportPayload(files) {
  const allFiles = [...files];
  const rawPaths = allFiles.map(rawFileRelativePath).filter(Boolean);
  const rootSegment = selectedVaultRootSegment(rawPaths);
  const entries = allFiles
    .map((file) => {
      const path = stripSelectedVaultRoot(rawFileRelativePath(file), rootSegment);
      return { file, path };
    })
    .filter((entry) => shouldImportObsidianFile(entry.path))
    .map((entry) => {
      const pathWithoutMarkdown = obsidianPathWithoutMarkdown(entry.path);
      return {
        ...entry,
        pathWithoutMarkdown,
        folder: obsidianFolderForPath(entry.path),
        baseTitle: basenameWithoutMarkdown(entry.path),
        title: "",
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path, "fr"));

  const indexes = makeObsidianImportIndexes(entries);
  const createdAt = nowIso();
  const notes = [];
  for (const entry of entries) {
    const text = await entry.file.text();
    notes.push({
      id: uid(),
      title: entry.title,
      folder: entry.folder,
      body: convertObsidianLinks(text || `# ${entry.title}\n`, entry.title, indexes),
      createdAt,
      updatedAt: createdAt,
    });
  }

  const vaultName = rootSegment || "Vault Obsidian";
  return {
    version: 1,
    source: "obsidian-vault",
    importedAt: createdAt,
    vaultName,
    activeId: notes[0]?.id || "",
    notes,
  };
}

async function importObsidianVault(fileList) {
  const files = [...(fileList || [])];
  if (!files.length) return;
  if (!requireVaultUnlocked("importer un vault Obsidian")) {
    els.obsidianInput.value = "";
    return;
  }

  try {
    const payload = await buildObsidianImportPayload(files);
    if (!payload.notes.length) throw new Error("Aucune note Markdown trouvée");
    await createVaultFromImportPayload(payload, payload.vaultName);
    toast(`Vault Obsidian importé : ${payload.notes.length} note(s).`);
  } catch (error) {
    console.error(error);
    toast("Import Obsidian impossible : sélectionne le dossier du vault contenant des fichiers .md.");
  } finally {
    els.obsidianInput.value = "";
  }
}

function normalizeVaultImportPayload(parsed) {
  const isSnapshot = parsed?.format === "povmind-vault-snapshot" && parsed.content && typeof parsed.content === "object";
  const source = isSnapshot ? parsed.content : parsed;
  const notes = Array.isArray(source?.notes) ? source.notes.map(cleanNote).filter(Boolean) : [];
  const snapshots = Array.isArray(source?.snapshots)
    ? source.snapshots.map(cleanSnapshot).filter(Boolean)
    : [];
  const snapshot = isSnapshot
    ? cleanSnapshot({
        id: parsed.snapshotId,
        createdAt: parsed.createdAt,
        hash: parsed.contentHash,
        summary: source.summary || {},
        payload: parsed,
      })
    : null;
  if (snapshot) snapshots.unshift(snapshot);

  return {
    notes,
    activeId: String(source?.activeId || ""),
    starredIds: new Set(Array.isArray(source?.starredIds) ? source.starredIds.map(String) : []),
    security: source?.security || parsed?.security || null,
    repo: source?.repo || parsed?.repo || null,
    githubSync: source?.githubSync || parsed?.githubSync || parsed?.github || null,
    learningMemory: source?.learningMemory || source?.learning?.memory || parsed?.learningMemory || null,
    enrichmentRuns: Array.isArray(source?.enrichmentRuns)
      ? source.enrichmentRuns
      : Array.isArray(source?.learning?.runs)
        ? source.learning.runs
        : Array.isArray(parsed?.enrichmentRuns)
          ? parsed.enrichmentRuns
          : [],
    cognitiveCycles: Array.isArray(source?.cognitiveCycles)
      ? source.cognitiveCycles
      : Array.isArray(source?.learning?.cycles)
        ? source.learning.cycles
        : Array.isArray(parsed?.cognitiveCycles)
          ? parsed.cognitiveCycles
          : [],
    graphPositions: source?.graphPositions && typeof source.graphPositions === "object" ? source.graphPositions : null,
    layout: source?.layout && typeof source.layout === "object" ? source.layout : null,
    snapshots,
  };
}

function applyImportedVaultPayload(parsed, sourceLabel = "Import") {
  if (!requireVaultUnlocked("importer un contexte")) return;
  const payload = normalizeVaultImportPayload(parsed);
  if (!payload.notes.length) throw new Error("Aucune note valide");

  const replace = confirm(`${sourceLabel}. OK = remplacer toutes les notes, Annuler = fusionner avec les notes existantes.`);
  if (replace) {
    const idMap = new Map();
    state.notes = payload.notes.map((note) => {
      const nextId = uid();
      idMap.set(note.id, nextId);
      return { ...note, id: nextId };
    });
    state.starredIds = new Set([...payload.starredIds].map((id) => idMap.get(id)).filter(Boolean));
    state.activeId = idMap.get(payload.activeId) || state.notes[0]?.id || null;
    state.graphPositions = payload.graphPositions ? clonePlain(payload.graphPositions) : {};
    state.graphRuntimePositions = {};
    if (payload.layout) {
      state.layout = { ...state.layout, ...clonePlain(payload.layout) };
      applyLayoutSettings();
      persistLayoutSettings();
    }
    if (payload.security) {
      const currentEncryption = state.security.encryption;
      state.security = {
        ...cleanSecurityState(payload.security, activeVaultId),
        encryption: currentEncryption,
      };
      state.assistantToken = "";
      persistSecurityState();
    }
    if (payload.repo) {
      state.repo = cleanRepoState(payload.repo);
      persistRepoState();
    }
    if (payload.githubSync) {
      state.githubSync = cleanGithubSyncState(payload.githubSync);
      persistGithubSyncState();
    }
    state.learningMemory = cleanLearningMemory(payload.learningMemory);
    state.enrichmentRuns = Array.isArray(payload.enrichmentRuns)
      ? payload.enrichmentRuns.map(cleanEnrichmentRun).filter(Boolean).slice(0, MAX_ENRICHMENT_RUNS) as EnrichmentRun[]
      : [];
    state.cognitiveCycles = Array.isArray(payload.cognitiveCycles)
      ? payload.cognitiveCycles.map(cleanCognitiveCycle).filter(Boolean).slice(0, MAX_COGNITIVE_CYCLES) as CognitiveCycle[]
      : [];
    state.snapshots = payload.snapshots.map(cleanSnapshot).filter(Boolean).slice(0, MAX_SNAPSHOTS);
    persistSnapshots();
    persistLearningMemory();
    persistEnrichmentRuns();
    persistCognitiveCycles();
    persistGraphPositions();
  } else {
    const idMap = new Map();
    const usedTitles = new Set(state.notes.map((note) => normalizeTitle(note.title)));
    const titleMap = new Map();
    const merged = payload.notes.map((note) => {
      const nextId = uid();
      const nextTitle = uniqueTitleFromSet(note.title, usedTitles);
      idMap.set(note.id, nextId);
      titleMap.set(normalizeTitle(note.title), nextTitle);
      return {
        ...note,
        id: nextId,
        title: nextTitle,
        updatedAt: nowIso(),
      };
    });
    for (const note of merged) {
      note.body = rewriteWikiLinkTargets(note.body, titleMap);
    }
    state.notes = [...merged, ...state.notes];
    if (payload.repo && !repoIsLinked()) {
      state.repo = cleanRepoState(payload.repo);
      persistRepoState();
    }
    if (payload.githubSync && !state.githubSync.repoFullName) {
      state.githubSync = cleanGithubSyncState(payload.githubSync);
      persistGithubSyncState();
    }
    if (payload.snapshots.length) {
      const importedSnapshots = payload.snapshots.map(cleanSnapshot).filter(Boolean) as VaultSnapshot[];
      const byId = new Map([...state.snapshots, ...importedSnapshots].map((snapshot) => [snapshot.id, snapshot]));
      state.snapshots = [...byId.values()]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, MAX_SNAPSHOTS);
      persistSnapshots();
    }
    if (payload.learningMemory) {
      const imported = cleanLearningMemory(payload.learningMemory);
      state.learningMemory = cleanLearningMemory({
        ...state.learningMemory,
        feedback: {
          accepted: Number(state.learningMemory?.feedback?.accepted || 0) + Number(imported.feedback.accepted || 0),
          rejected: Number(state.learningMemory?.feedback?.rejected || 0) + Number(imported.feedback.rejected || 0),
          modified: Number(state.learningMemory?.feedback?.modified || 0) + Number(imported.feedback.modified || 0),
          autoApplied: Number(state.learningMemory?.feedback?.autoApplied || 0) + Number(imported.feedback.autoApplied || 0),
        },
        acceptedPatterns: [...(state.learningMemory?.acceptedPatterns || []), ...(imported.acceptedPatterns || [])],
        rejectedPatterns: [...(state.learningMemory?.rejectedPatterns || []), ...(imported.rejectedPatterns || [])],
        confidenceRules: [...(state.learningMemory?.confidenceRules || []), ...(imported.confidenceRules || [])],
      });
      persistLearningMemory();
    }
    if (Array.isArray(payload.enrichmentRuns) && payload.enrichmentRuns.length) {
      const importedRuns = payload.enrichmentRuns.map(cleanEnrichmentRun).filter(Boolean) as EnrichmentRun[];
      const byId = new Map([...state.enrichmentRuns, ...importedRuns].map((run) => [run.id, run]));
      state.enrichmentRuns = [...byId.values()]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, MAX_ENRICHMENT_RUNS);
      persistEnrichmentRuns();
    }
    if (Array.isArray(payload.cognitiveCycles) && payload.cognitiveCycles.length) {
      const importedCycles = payload.cognitiveCycles.map(cleanCognitiveCycle).filter(Boolean) as CognitiveCycle[];
      const byId = new Map([...state.cognitiveCycles, ...importedCycles].map((cycle) => [cycle.id, cycle]));
      state.cognitiveCycles = [...byId.values()]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, MAX_COGNITIVE_CYCLES);
      persistCognitiveCycles();
    }
    for (const id of payload.starredIds) {
      const nextId = idMap.get(id);
      if (nextId) state.starredIds.add(nextId);
    }
    state.activeId = merged[0]?.id || state.activeId;
  }

  persistStarredIds();
  persistNow(true);
  renderAll();
}

async function createVaultFromImportPayload(parsed, rawName) {
  const payload = normalizeVaultImportPayload(parsed);
  if (!payload.notes.length) throw new Error("Aucune note valide");

  await persistActiveVaultBeforeLeaving();
  const id = createVaultId();
  const createdAt = nowIso();
  const name = cleanVaultName(rawName, `Vault importé ${vaultRegistry.vaults.length + 1}`);
  vaultRegistry.vaults.unshift({
    id,
    name,
    createdAt,
    updatedAt: createdAt,
    noteCount: 0,
    tokenSealed: false,
  });
  activeVaultId = id;
  vaultRegistry.activeId = id;
  persistVaultRegistry();

  const idMap = new Map();
  state.notes = payload.notes.map((note) => {
    const nextId = uid();
    idMap.set(note.id, nextId);
    return { ...note, id: nextId, createdAt: note.createdAt || createdAt, updatedAt: note.updatedAt || createdAt };
  });
  state.activeId = idMap.get(payload.activeId) || state.notes[0]?.id || null;
  state.search = "";
  state.tagFilter = null;
  state.folderFilter = null;
  state.view = "split";
  state.starredIds = new Set([...payload.starredIds].map((noteId) => idMap.get(noteId)).filter(Boolean));
  if (!state.starredIds.size && state.activeId) state.starredIds.add(state.activeId);
  state.layout = { ...DEFAULT_LAYOUT };
  state.layoutDragging = null;
  state.graphFullscreen = false;
  state.graphPositions = payload.graphPositions ? clonePlain(payload.graphPositions) : {};
  state.graphRuntimePositions = {};
  state.graphDragging = null;
  state.graphClickSuppressed = false;
  state.security = cleanSecurityState(null, activeVaultId);
  state.assistantToken = "";
  state.vaultCryptoKey = null;
  state.vaultUnlocked = false;
  state.snapshots = payload.snapshots.map(cleanSnapshot).filter(Boolean).slice(0, MAX_SNAPSHOTS);
  state.repo = payload.repo ? cleanRepoState(payload.repo) : cleanRepoState(null);
  state.githubSync = payload.githubSync ? cleanGithubSyncState(payload.githubSync) : cleanGithubSyncState(null);
  state.learningMemory = cleanLearningMemory(payload.learningMemory);
  state.enrichmentRuns = Array.isArray(payload.enrichmentRuns)
    ? payload.enrichmentRuns.map(cleanEnrichmentRun).filter(Boolean).slice(0, MAX_ENRICHMENT_RUNS) as EnrichmentRun[]
    : [];
  state.cognitiveCycles = Array.isArray(payload.cognitiveCycles)
    ? payload.cognitiveCycles.map(cleanCognitiveCycle).filter(Boolean).slice(0, MAX_COGNITIVE_CYCLES) as CognitiveCycle[]
    : [];
  els.searchInput.value = "";

  localStorage.setItem(vaultStorageKey("view"), state.view);
  persistSecurityState();
  persistRepoState();
  persistGithubSyncState();
  persistLayoutSettings();
  persistGraphPositions();
  persistSnapshots();
  persistLearningMemory();
  persistEnrichmentRuns();
  persistCognitiveCycles();
  persistStarredIds();
  persistNow(true);
  applyLayoutSettings();
  renderAll();
}

async function importVault(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    applyImportedVaultPayload(parsed, "Importer le carnet");
    toast("Import terminé.");
  } catch (error) {
    console.error(error);
    toast("Import impossible : fichier JSON invalide.");
  } finally {
    els.importInput.value = "";
  }
}

function findPovmindSnapshotEntry(entries) {
  const paths = Object.keys(entries);
  return paths.find((path) => /(^|\/)snapshots\/latest\.json$/i.test(path))
    || paths.find((path) => /(^|\/)povmind-vault.*\.json$/i.test(path))
    || paths.find((path) => /(^|\/)latest\.json$/i.test(path));
}

function findPovmindGlobalManifestEntry(entries) {
  return Object.keys(entries).find((path) => /(^|\/)\.povmind\/manifest\.json$/i.test(path))
    || Object.keys(entries).find((path) => /(^|\/)manifest\.json$/i.test(path));
}

function importGithubContextEntries(entries) {
  const snapshotPath = findPovmindSnapshotEntry(entries);
  if (snapshotPath) {
    const parsed = JSON.parse(entries[snapshotPath]);
    applyImportedVaultPayload(parsed, "Importer le contexte GitHub PovMind");
    return { imported: true, source: snapshotPath };
  }

  const manifestPath = findPovmindGlobalManifestEntry(entries);
  if (manifestPath) {
    const manifest = JSON.parse(entries[manifestPath]);
    if (manifest.github) {
      state.githubSync = cleanGithubSyncState(manifest.github);
      persistGithubSyncState();
      renderGithubPanel();
    }
    return { imported: false, source: manifestPath };
  }

  throw new Error("Aucun contexte PovMind trouvé");
}

async function importGithubContextFile(file) {
  if (!file) return;
  try {
    const isZip = /\.zip$/i.test(file.name || "") || file.type === "application/zip";
    if (isZip) {
      const entries = await readStoredZipEntries(file);
      const result = importGithubContextEntries(entries);
      toast(result.imported ? "Contexte GitHub importé." : "Manifest GitHub importé.");
      return;
    }

    const parsed = JSON.parse(await file.text());
    applyImportedVaultPayload(parsed, "Importer le contexte GitHub PovMind");
    toast("Contexte GitHub importé.");
  } catch (error) {
    console.error(error);
    toast("Import GitHub impossible : export PovMind invalide.");
  } finally {
    els.githubContextInput.value = "";
  }
}

function loadActiveVaultState() {
  state.search = "";
  state.tagFilter = null;
  state.folderFilter = null;
  state.view = readVaultStoredValue("view", VIEW_KEY, LEGACY_VIEW_KEY) || "split";
  state.starredIds = loadStarredIds();
  state.layout = loadLayoutSettings();
  state.graphPositions = loadGraphPositions();
  state.graphRuntimePositions = {};
  state.graphDragging = null;
  state.graphClickSuppressed = false;
  state.security = loadSecurityState();
  state.assistantToken = "";
  state.vaultCryptoKey = null;
  state.vaultUnlocked = false;
  state.snapshots = vaultEncrypted() ? [] : loadSnapshots();
  state.repo = loadRepoState();
  state.githubSync = loadGithubSyncState();
  state.learningMemory = vaultEncrypted() ? cleanLearningMemory(null) : loadLearningMemory();
  state.enrichmentRuns = vaultEncrypted() ? [] : loadEnrichmentRuns() as EnrichmentRun[];
  state.cognitiveCycles = vaultEncrypted() ? [] : loadCognitiveCycles() as CognitiveCycle[];
  els.searchInput.value = "";
  loadStore();
  ensureDocumentationVault({ silent: true });
  applyLayoutSettings();
}

async function switchVault(vaultId) {
  if (!vaultRegistry.vaults.some((vault) => vault.id === vaultId) || vaultId === activeVaultId) return;
  await persistActiveVaultBeforeLeaving();
  activeVaultId = vaultId;
  vaultRegistry.activeId = vaultId;
  persistVaultRegistry();
  loadActiveVaultState();
  renderAll();
  toast(`Vault ouvert : ${activeVaultRecord()?.name || "PovMind"}.`);
}

async function createVaultWithName(rawName) {
  const name = cleanVaultName(rawName, `Vault ${vaultRegistry.vaults.length + 1}`);
  await persistActiveVaultBeforeLeaving();
  const id = createVaultId();
  const createdAt = nowIso();
  vaultRegistry.vaults.unshift({
    id,
    name,
    createdAt,
    updatedAt: createdAt,
    noteCount: 0,
    tokenSealed: false,
  });
  activeVaultId = id;
  vaultRegistry.activeId = id;
  persistVaultRegistry();
  loadActiveVaultState();
  renderAll();
  toast(`Vault créé : ${name}.`);
}

function renameActiveVaultToName(rawName) {
  const current = activeVaultRecord();
  if (!current) return;
  const name = cleanVaultName(rawName, current.name);
  current.name = name;
  current.updatedAt = nowIso();
  persistVaultRegistry();
  renderVaultSwitcher();
  toast(`Vault renommé : ${name}.`);
}

function openVaultDialog(mode = "create") {
  const current = activeVaultRecord();
  state.vaultDialogMode = mode;
  const isRename = mode === "rename";
  els.vaultDialogTitle.textContent = isRename ? "Renommer le vault" : "Nouveau vault";
  els.vaultDialogInput.value = isRename ? current?.name || "PovMind" : `Vault ${vaultRegistry.vaults.length + 1}`;
  els.vaultDialogConfirmBtn.textContent = isRename ? "Renommer" : "Créer";
  els.vaultDialog.hidden = false;
  requestAnimationFrame(() => {
    els.vaultDialogInput.focus();
    els.vaultDialogInput.select();
  });
}

function closeVaultDialog() {
  els.vaultDialog.hidden = true;
  state.vaultDialogMode = "";
}

function confirmVaultDialog() {
  const value = els.vaultDialogInput.value;
  const mode = state.vaultDialogMode;
  closeVaultDialog();
  if (mode === "rename") {
    renameActiveVaultToName(value);
  } else {
    void createVaultWithName(value);
  }
}

function createVault() {
  openVaultDialog("create");
}

function renameActiveVault() {
  openVaultDialog("rename");
}

function cycleView() {
  const order = ["split", "edit", "preview"];
  const current = order.indexOf(state.view);
  state.view = order[(current + 1) % order.length];
  localStorage.setItem(vaultStorageKey("view"), state.view);
  renderActiveNote();
}

function defaultTemplateTitle(template) {
  const date = formatLocalDate();
  if (template.id === "project") return `Projet ${state.notes.filter((note) => normalizeFolder(note.folder) === "Projets").length + 1}`;
  if (template.id === "meeting") return `Réunion - ${date}`;
  if (template.id === "research") return `Recherche - ${date}`;
  if (template.id === "daily") return `Journal - ${date}`;
  return `Note ${state.notes.length + 1}`;
}

function createNoteFromTemplate(templateId) {
  const template = NOTE_TEMPLATES.find((item) => item.id === templateId);
  if (!template) return;
  if (template.id === "daily") {
    createDailyNote();
    closeTemplatePicker();
    return;
  }

  const title = defaultTemplateTitle(template);
  createNote(title, template.body(title), { folder: template.folder });
  closeTemplatePicker();
}

function createDailyNote() {
  if (!requireVaultUnlocked("ouvrir le journal")) return null;
  const template = NOTE_TEMPLATES.find((item) => item.id === "daily");
  const title = `Journal - ${formatLocalDate()}`;
  const existing = state.notes.find((note) => normalizeFolder(note.folder) === "Journal" && normalizeTitle(note.title) === normalizeTitle(title));
  if (existing) {
    selectNote(existing.id);
    toast("Journal du jour ouvert.");
    return existing;
  }
  const note = createNote(title, template.body(title), { folder: "Journal" });
  toast("Journal du jour créé.");
  return note;
}

function renderTemplatePicker() {
  els.templateList.innerHTML = NOTE_TEMPLATES.map((template) => `
    <button class="template-card" type="button" data-template-id="${attr(template.id)}">
      ${escapeHtml(template.name)}
      <span>${escapeHtml(template.folder)} · ${escapeHtml(defaultTemplateTitle(template))}</span>
    </button>`)
    .join("");
}

function openTemplatePicker() {
  renderTemplatePicker();
  els.templatePicker.hidden = false;
}

function closeTemplatePicker() {
  els.templatePicker.hidden = true;
}

function toggleActiveStar() {
  const note = activeNote();
  if (!note) return;
  if (isStarred(note.id)) {
    state.starredIds.delete(note.id);
    toast("Favori retiré.");
  } else {
    state.starredIds.add(note.id);
    toast("Note ajoutée aux favoris.");
  }
  persistStarredIds();
  persistNow(false);
  renderAll();
}

function resetGraphLayout() {
  state.graphPositions = {};
  state.graphRuntimePositions = {};
  persistGraphPositions();
  renderGraph();
  toast("Graphe réorganisé.");
}

function resetPanelLayout(kind = "all") {
  if (kind === "sidebar" || kind === "all") state.layout.sidebarWidth = DEFAULT_LAYOUT.sidebarWidth;
  if (kind === "inspector" || kind === "all") state.layout.inspectorWidth = DEFAULT_LAYOUT.inspectorWidth;
  if (kind === "editor" || kind === "all") state.layout.editorPaneWidth = DEFAULT_LAYOUT.editorPaneWidth;
  if (kind === "graph" || kind === "all") state.layout.graphHeight = DEFAULT_LAYOUT.graphHeight;
  applyLayoutSettings(kind === "all" ? null : kind);
  persistLayoutSettings();
  toast(kind === "all" ? "Fenêtres réinitialisées." : "Fenêtre réinitialisée.");
}

function currentEditorPaneWidth() {
  return els.editorGrid?.querySelector(".editor-panel")?.getBoundingClientRect().width || 0;
}

function startLayoutResize(kind, event) {
  if (window.matchMedia("(max-width: 1180px)").matches && kind !== "editor" && kind !== "graph") return;
  const base = kind === "sidebar"
    ? state.layout.sidebarWidth
    : kind === "inspector"
      ? state.layout.inspectorWidth
      : kind === "graph"
        ? state.layout.graphHeight
        : currentEditorPaneWidth();

  state.layoutDragging = {
    kind,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    base,
  };

  const handle = kind === "sidebar"
    ? els.sidebarResizer
    : kind === "inspector"
      ? els.inspectorResizer
      : kind === "graph"
        ? els.graphResizeHandle
        : els.editorResizer;

  handle?.classList.add("active");
  handle?.setPointerCapture?.(event.pointerId);
  els.editorGrid.classList.toggle("resizing", kind === "editor");
  els.graphCard.classList.toggle("resizing", kind === "graph");
  document.querySelector(".app-shell")?.classList.toggle("resizing", kind !== "editor");
  document.body.style.cursor = kind === "graph" ? "row-resize" : "col-resize";
  event.preventDefault();
}

function updateLayoutResize(event) {
  const drag = state.layoutDragging;
  if (!drag || drag.pointerId !== event.pointerId) return;

  const dx = event.clientX - drag.startX;
  if (drag.kind === "sidebar") {
    state.layout.sidebarWidth = drag.base + dx;
  }
  if (drag.kind === "inspector") {
    state.layout.inspectorWidth = drag.base - dx;
  }
  if (drag.kind === "editor") {
    state.layout.editorPaneWidth = drag.base + dx;
  }
  if (drag.kind === "graph") {
    state.layout.graphHeight = drag.base + (event.clientY - drag.startY);
  }

  applyLayoutSettings(drag.kind);
  event.preventDefault();
}

function stopLayoutResize(event) {
  const drag = state.layoutDragging;
  if (!drag || drag.pointerId !== event.pointerId) return;

  const handle = drag.kind === "sidebar"
    ? els.sidebarResizer
    : drag.kind === "inspector"
      ? els.inspectorResizer
      : drag.kind === "graph"
        ? els.graphResizeHandle
        : els.editorResizer;

  handle?.classList.remove("active");
  handle?.releasePointerCapture?.(event.pointerId);
  els.editorGrid.classList.remove("resizing");
  els.graphCard.classList.remove("resizing");
  document.querySelector(".app-shell")?.classList.remove("resizing");
  document.body.style.cursor = "";
  state.layoutDragging = null;
  persistLayoutSettings();
}

function nudgePanelLayout(kind, direction) {
  const step = 24 * direction;
  if (kind === "sidebar") state.layout.sidebarWidth += step;
  if (kind === "inspector") state.layout.inspectorWidth -= step;
  if (kind === "editor") state.layout.editorPaneWidth = (state.layout.editorPaneWidth || currentEditorPaneWidth()) + step;
  if (kind === "graph") state.layout.graphHeight += step;
  applyLayoutSettings(kind);
  persistLayoutSettings();
}

function handleResizerKeydown(kind, event) {
  if (event.key === "Enter") {
    event.preventDefault();
    resetPanelLayout(kind);
    return;
  }
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
  nudgePanelLayout(kind, direction);
}

function toggleGraphFullscreen(force = !state.graphFullscreen) {
  state.graphFullscreen = Boolean(force);
  els.graphCard.classList.toggle("graph-fullscreen", state.graphFullscreen);
  document.body.classList.toggle("graph-modal-open", state.graphFullscreen);
  els.graphFullscreenBtn.setAttribute("aria-label", state.graphFullscreen ? "Quitter le plein écran" : "Afficher le graphe en plein écran");
  els.graphFullscreenBtn.title = state.graphFullscreen ? "Quitter le plein écran" : "Plein écran";
  els.graphFullscreenBtn.textContent = state.graphFullscreen ? "×" : "⛶";
}

function commandDefinitions(query = "") {
  const cleanQuery = query.trim();
  const commands = [
    {
      title: "Nouvelle note",
      detail: "Créer une note vide",
      run: () => createNote(`Note ${state.notes.length + 1}`, "# Nouvelle note\n\n"),
    },
    {
      title: "Journal du jour",
      detail: "Ouvrir ou créer la note quotidienne",
      run: createDailyNote,
    },
    {
      title: "Ouvrir la documentation PovMind",
      detail: "Créer ou ouvrir le vault qui documente l'app",
      run: () => ensureDocumentationVault({ select: true }),
    },
    {
      title: "Nouveau vault",
      detail: "Créer un vault local isolé",
      run: createVault,
    },
    {
      title: "Renommer le vault",
      detail: activeVaultRecord()?.name || "Vault actif",
      run: renameActiveVault,
    },
    {
      title: "Choisir un template",
      detail: "Projet, réunion, recherche ou journal",
      run: openTemplatePicker,
    },
    {
      title: isStarred(state.activeId) ? "Retirer des favoris" : "Ajouter aux favoris",
      detail: activeNote()?.title || "Note active",
      run: toggleActiveStar,
    },
    {
      title: "Changer de vue",
      detail: "Basculer édition, aperçu ou split",
      run: cycleView,
    },
    {
      title: "Exporter la note",
      detail: "Télécharger la note active en Markdown",
      run: exportMarkdown,
    },
    {
      title: "Exporter le carnet",
      detail: "Télécharger toutes les notes en JSON",
      run: exportVault,
    },
    {
      title: "Importer vault Obsidian",
      detail: "Créer un vault depuis un dossier Obsidian",
      run: () => els.obsidianInput.click(),
    },
    {
      title: "Créer un snapshot",
      detail: "Figer le vault avec hash global",
      run: createVaultSnapshot,
    },
    {
      title: "Cycle cognitif jour",
      detail: "Contexte court, analyse et snapshot",
      run: () => runCognitiveDayCycle(),
    },
    {
      title: "Cycle cognitif nuit",
      detail: "Synthèse nocturne et mode rêve",
      run: () => runCognitiveNightCycle(),
    },
    {
      title: "Cycle cognitif réveil",
      detail: "Agenda de validation et delta snapshots",
      run: () => runCognitiveWakeCycle(),
    },
    {
      title: "Exporter cron cognitif",
      detail: ".povmind/automation + workflow GitHub",
      run: () => exportCognitiveCronBundle(),
    },
    {
      title: "Exporter le dernier snapshot",
      detail: "Télécharger le snapshot JSON complet",
      run: () => exportSnapshot(),
    },
    {
      title: "Créer la note Code Repo",
      detail: repoIsLinked() ? "Documenter le repo lié" : "Aucun repo lié",
      run: ensureCodeRepoNote,
    },
    {
      title: "Exporter le manifest repo",
      detail: repoIsLinked() ? "Télécharger le contexte code" : "Aucun repo lié",
      run: exportRepoManifest,
    },
    {
      title: "Exporter contexte GitHub",
      detail: ".povmind + AGENTS.md pour versionner le vault",
      run: exportGithubContextBundle,
    },
    {
      title: "Connecter GitHub",
      detail: state.githubSync.repoFullName || "Configurer owner/repo",
      run: connectGithub,
    },
    {
      title: "Scanner GitHub en nouveau vault",
      detail: state.githubSync.repoFullName || "Configurer owner/repo",
      run: () => scanGithubRepoToVault("new"),
    },
    {
      title: "Enrichir le vault actif depuis GitHub",
      detail: state.githubSync.repoFullName || "Configurer owner/repo",
      run: () => scanGithubRepoToVault("enrich"),
    },
    {
      title: "Pousser contexte GitHub",
      detail: state.githubSync.repoFullName || "Configurer owner/repo",
      run: pushGithubContext,
    },
    {
      title: "Tirer contexte GitHub",
      detail: state.githubSync.repoFullName || "Configurer owner/repo",
      run: pullGithubContext,
    },
    {
      title: "Exporter Codex KB",
      detail: "Générer un zip de base de connaissance",
      run: exportCodexKnowledgeBase,
    },
    {
      title: "Exporter MCP sécurisé",
      detail: "Générer un serveur MCP protégé par token",
      run: exportMcpBundle,
    },
    {
      title: "Générer un token assistant",
      detail: "Créer un token crypto pour ce vault",
      run: generateAssistantToken,
    },
    {
      title: "Réinitialiser le graphe",
      detail: "Effacer les positions manuelles",
      run: resetGraphLayout,
    },
    {
      title: state.graphFullscreen ? "Quitter le plein écran du graphe" : "Graphe en plein écran",
      detail: "Agrandir ou fermer la carte du graphe",
      run: () => toggleGraphFullscreen(),
    },
    {
      title: "Réinitialiser les fenêtres",
      detail: "Revenir aux largeurs par défaut",
      run: () => resetPanelLayout("all"),
    },
  ];

  if (cleanQuery && !findNoteByTitle(cleanQuery)) {
    commands.unshift({
      title: `Créer « ${cleanQuery} »`,
      detail: state.folderFilter || activeNote()?.folder || ROOT_FOLDER,
      run: () => createNote(cleanQuery, `# ${cleanQuery}\n\n`, { folder: state.folderFilter || activeNote()?.folder || ROOT_FOLDER }),
    });
  }

  return commands;
}

function buildCommandItems(query = "") {
  const needle = query.trim().toLocaleLowerCase("fr-FR");
  const baseCommands = commandDefinitions(query).map((command) => ({ ...command, type: "Commande" }));
  const noteCommands = state.notes.map((note) => ({
    title: note.title,
    detail: `${normalizeFolder(note.folder)} · ${clampText(note.body.replace(/[#*_`\[\]]/g, ""), 74) || "Note vide"}`,
    type: "Note",
    run: () => selectNote(note.id),
  }));

  return [...baseCommands, ...noteCommands]
    .filter((item) => {
      if (!needle) return true;
      return `${item.title}\n${item.detail}\n${item.type}`.toLocaleLowerCase("fr-FR").includes(needle);
    })
    .slice(0, 48);
}

function renderCommandPalette() {
  const query = els.commandInput.value;
  const items = buildCommandItems(query);
  state.commandItems = items;
  state.commandIndex = clamp(state.commandIndex, 0, Math.max(0, items.length - 1));

  if (!items.length) {
    els.commandResults.innerHTML = `<div class="empty-state">Aucun résultat.</div>`;
    return;
  }

  els.commandResults.innerHTML = items
    .map((item, index) => `
      <button class="command-item${index === state.commandIndex ? " active" : ""}" type="button" data-command-index="${index}" role="option" aria-selected="${index === state.commandIndex}">
        ${escapeHtml(item.title)}
        <span>${escapeHtml(item.type)} · ${escapeHtml(item.detail)}</span>
      </button>`)
    .join("");
}

function openCommandPalette(initialQuery = "") {
  state.commandIndex = 0;
  els.commandPalette.hidden = false;
  els.commandInput.value = initialQuery;
  renderCommandPalette();
  requestAnimationFrame(() => els.commandInput.focus());
}

function closeCommandPalette() {
  els.commandPalette.hidden = true;
  state.commandItems = [];
}

function runCommandItem(index = state.commandIndex) {
  const item = state.commandItems[index];
  if (!item) return;
  closeCommandPalette();
  item.run();
}

let toastTimer = null;
function toast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function resetDemo() {
  if (!requireVaultUnlocked("réinitialiser le vault")) return;
  const ok = confirm("Réinitialiser le carnet avec les notes de démonstration ? Les notes actuelles seront remplacées.");
  if (!ok) return;
  state.notes = seedNotes();
  state.activeId = state.notes[0].id;
  state.tagFilter = null;
  state.folderFilter = null;
  state.search = "";
  state.starredIds = new Set([state.notes[0].id]);
  state.graphPositions = {};
  state.graphRuntimePositions = {};
  state.snapshots = [];
  state.repo = cleanRepoState(null);
  state.githubSync = cleanGithubSyncState(null);
  state.learningMemory = cleanLearningMemory(null);
  state.enrichmentRuns = [];
  state.cognitiveCycles = [];
  els.searchInput.value = "";
  ensureDocumentationVault({ silent: true });
  persistStarredIds();
  persistGraphPositions();
  persistSnapshots();
  persistRepoState();
  persistGithubSyncState();
  persistLearningMemory();
  persistEnrichmentRuns();
  persistCognitiveCycles();
  persistNow(true);
  renderAll();
  toast("Démo réinitialisée.");
}

function handleEditorInput() {
  const note = activeNote();
  if (!note) return;
  updateActiveNote({ body: els.editor.value });
  els.wordCount.textContent = `${countWords(els.editor.value)} ${countWords(els.editor.value) > 1 ? "mots" : "mot"}`;
  renderPreview();
  renderVaultStats();
  renderBacklinks();
  renderNoteTags();
  renderOutgoingLinks();
  renderLearningPanel();
  renderTagFilters();
  renderNotesList();
  renderGraph();
}

function handleTitleInput() {
  const note = activeNote();
  if (!note) return;
  updateActiveNote({ title: els.titleInput.value || "Sans titre" });
  renderPreview();
  renderVaultStats();
  renderBacklinks();
  renderNoteTags();
  renderOutgoingLinks();
  renderLearningPanel();
  renderTagFilters();
  renderFolderSuggestions();
  renderStarredList();
  renderNotesList();
  renderGraph();
}

function handleFolderInput() {
  const note = activeNote();
  if (!note) return;
  updateActiveNote({ folder: normalizeFolder(els.folderInput.value) });
  renderVaultStats();
  renderFolderFilters();
  renderFolderSuggestions();
  renderStarredList();
  renderNotesList();
  renderLearningPanel();
}

function bindEvents() {
  els.newNoteBtn.addEventListener("click", () => createNote(`Note ${state.notes.length + 1}`, "# Nouvelle note\n\n"));
  els.ribbonNewNoteBtn.addEventListener("click", () => createNote(`Note ${state.notes.length + 1}`, "# Nouvelle note\n\n"));
  els.tabNewNoteBtn.addEventListener("click", () => createNote(`Note ${state.notes.length + 1}`, "# Nouvelle note\n\n"));
  els.ribbonSearchBtn.addEventListener("click", () => {
    els.searchInput.focus();
    els.searchInput.select();
  });
  els.ribbonGraphBtn.addEventListener("click", () => toggleGraphFullscreen());
  els.graphTabBtn.addEventListener("click", () => toggleGraphFullscreen());
  els.ribbonDailyBtn.addEventListener("click", createDailyNote);
  els.ribbonMcpBtn.addEventListener("click", exportMcpBundle);
  els.vaultSelect.addEventListener("change", () => switchVault(els.vaultSelect.value));
  els.newVaultBtn.addEventListener("click", createVault);
  els.renameVaultBtn.addEventListener("click", renameActiveVault);
  els.dailyNoteBtn.addEventListener("click", createDailyNote);
  els.docVaultBtn.addEventListener("click", () => ensureDocumentationVault({ select: true }));
  els.commandPaletteBtn.addEventListener("click", () => openCommandPalette());
  els.deleteNoteBtn.addEventListener("click", deleteActiveNote);
  els.starNoteBtn.addEventListener("click", toggleActiveStar);
  els.templateBtn.addEventListener("click", openTemplatePicker);
  els.viewModeBtn.addEventListener("click", cycleView);
  els.exportVaultBtn.addEventListener("click", exportVault);
  els.createSnapshotBtn.addEventListener("click", () => createVaultSnapshot());
  els.exportSnapshotBtn.addEventListener("click", () => exportSnapshot());
  els.runEnrichmentBtn.addEventListener("click", () => runDeterministicEnrichment());
  els.createEnrichmentReportBtn.addEventListener("click", () => {
    const report = createEnrichmentReport(latestEnrichmentRun() || runDeterministicEnrichment(false));
    if (!report) return;
    renderAll();
    toast("Rapport d'enrichissement créé.");
  });
  els.runDayCycleBtn.addEventListener("click", () => void runCognitiveDayCycle());
  els.runNightCycleBtn.addEventListener("click", () => void runCognitiveNightCycle());
  els.runWakeCycleBtn.addEventListener("click", () => void runCognitiveWakeCycle());
  els.exportCognitiveCronBtn.addEventListener("click", () => void exportCognitiveCronBundle());
  els.importRepoBtn.addEventListener("click", () => els.repoManifestInput.click());
  els.repoManifestInput.addEventListener("change", (event) => importRepoManifest(event.target.files?.[0]));
  els.exportRepoBtn.addEventListener("click", exportRepoManifest);
  els.codeRepoNoteBtn.addEventListener("click", ensureCodeRepoNote);
  els.githubRepoInput.addEventListener("change", syncGithubSettingsFromInputs);
  els.githubBranchInput.addEventListener("change", syncGithubSettingsFromInputs);
  els.githubPathInput.addEventListener("change", syncGithubSettingsFromInputs);
  els.githubConnectBtn.addEventListener("click", connectGithub);
  els.githubScanBtn.addEventListener("click", () => scanGithubRepoToVault("new"));
  els.githubEnrichBtn.addEventListener("click", () => scanGithubRepoToVault("enrich"));
  els.githubPushBtn.addEventListener("click", pushGithubContext);
  els.githubPullBtn.addEventListener("click", pullGithubContext);
  els.exportGithubContextBtn.addEventListener("click", () => exportGithubContextBundle());
  els.importGithubContextBtn.addEventListener("click", () => els.githubContextInput.click());
  els.githubContextInput.addEventListener("change", (event) => importGithubContextFile(event.target.files?.[0]));
  els.exportMcpBtn.addEventListener("click", exportMcpBundle);
  els.exportCodexBtn.addEventListener("click", exportCodexKnowledgeBase);
  els.exportMdBtn.addEventListener("click", exportMarkdown);
  els.resetDemoBtn.addEventListener("click", resetDemo);
  els.generateTokenBtn.addEventListener("click", () => generateAssistantToken());
  els.copyTokenBtn.addEventListener("click", copyAssistantToken);
  els.securityExportMcpBtn.addEventListener("click", exportMcpBundle);
  els.enableVaultCryptoBtn.addEventListener("click", enableVaultEncryption);
  els.unlockVaultBtn.addEventListener("click", unlockVault);
  els.lockVaultBtn.addEventListener("click", lockVault);
  els.vaultPassphraseInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (vaultLocked()) unlockVault();
    else if (!vaultEncrypted()) enableVaultEncryption();
  });
  els.importBtn.addEventListener("click", () => els.importInput.click());
  els.importInput.addEventListener("change", (event) => importVault(event.target.files?.[0]));
  els.importObsidianBtn.addEventListener("click", () => els.obsidianInput.click());
  els.obsidianInput.addEventListener("change", (event) => importObsidianVault(event.target.files));

  els.snapshotsList.addEventListener("click", (event) => {
    const row = event.target.closest("[data-snapshot-id]");
    if (row) exportSnapshot(row.dataset.snapshotId);
  });

  els.memoryTypeChips.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-memory-type]");
    if (chip) toggleActiveNoteMemoryType(chip.dataset.memoryType);
  });

  els.suggestionsList.addEventListener("click", (event) => {
    const accept = event.target.closest("[data-proposal-accept]");
    const reject = event.target.closest("[data-proposal-reject]");
    if (accept) void applyEnrichmentProposal(accept.dataset.proposalAccept);
    if (reject) rejectEnrichmentProposal(reject.dataset.proposalReject);
  });

  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value;
    renderNotesList();
  });

  els.notesList.addEventListener("click", (event) => {
    const row = event.target.closest("[data-note-id]");
    if (row) selectNote(row.dataset.noteId);
  });

  els.starredList.addEventListener("click", (event) => {
    const row = event.target.closest("[data-note-id]");
    if (row) selectNote(row.dataset.noteId);
  });

  els.backlinks.addEventListener("click", (event) => {
    const row = event.target.closest("[data-note-id]");
    if (row) selectNote(row.dataset.noteId);
  });

  els.tagFilters.addEventListener("click", (event) => {
    const clear = event.target.closest("[data-tag-clear]");
    const tag = event.target.closest("[data-tag]");
    if (clear) state.tagFilter = null;
    if (tag) state.tagFilter = tag.dataset.tag;
    renderAll();
  });

  els.folderFilters.addEventListener("click", (event) => {
    const clear = event.target.closest("[data-folder-clear]");
    const folder = event.target.closest("[data-folder]");
    if (clear) state.folderFilter = null;
    if (folder) state.folderFilter = folder.dataset.folder;
    renderAll();
  });

  els.noteTags.addEventListener("click", (event) => {
    const tag = event.target.closest("[data-tag]");
    if (!tag) return;
    state.tagFilter = tag.dataset.tag;
    renderAll();
  });

  els.editor.addEventListener("input", handleEditorInput);
  els.titleInput.addEventListener("input", handleTitleInput);
  els.folderInput.addEventListener("input", handleFolderInput);
  els.folderInput.addEventListener("blur", renderActiveNote);

  els.preview.addEventListener("click", (event) => {
    const link = event.target.closest("[data-note-title]");
    if (!link) return;
    event.preventDefault();
    const title = link.dataset.noteTitle;
    const note = findNoteByTitle(title) || createNote(title, `# ${title}\n\n`);
    if (!note) return;
    selectNote(note.id);
  });

  els.outgoingLinks.addEventListener("click", (event) => {
    const link = event.target.closest("[data-note-title]");
    if (!link) return;
    const title = link.dataset.noteTitle;
    const note = findNoteByTitle(title) || createNote(title, `# ${title}\n\n`);
    if (!note) return;
    selectNote(note.id);
  });

  els.templateList.addEventListener("click", (event) => {
    const template = event.target.closest("[data-template-id]");
    if (template) createNoteFromTemplate(template.dataset.templateId);
  });

  els.closeTemplateBtn.addEventListener("click", closeTemplatePicker);
  els.templatePicker.addEventListener("click", (event) => {
    if (event.target === els.templatePicker) closeTemplatePicker();
  });
  els.vaultDialogCancelBtn.addEventListener("click", closeVaultDialog);
  els.vaultDialogSecondaryBtn.addEventListener("click", closeVaultDialog);
  els.vaultDialogConfirmBtn.addEventListener("click", confirmVaultDialog);
  els.vaultDialog.addEventListener("click", (event) => {
    if (event.target === els.vaultDialog) closeVaultDialog();
  });
  els.vaultDialogInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      confirmVaultDialog();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeVaultDialog();
    }
  });

  els.commandInput.addEventListener("input", () => {
    state.commandIndex = 0;
    renderCommandPalette();
  });

  els.commandInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      state.commandIndex = clamp(state.commandIndex + 1, 0, Math.max(0, state.commandItems.length - 1));
      renderCommandPalette();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      state.commandIndex = clamp(state.commandIndex - 1, 0, Math.max(0, state.commandItems.length - 1));
      renderCommandPalette();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      runCommandItem();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeCommandPalette();
    }
  });

  els.commandResults.addEventListener("mousemove", (event) => {
    const item = event.target.closest("[data-command-index]");
    if (!item) return;
    const index = Number(item.dataset.commandIndex);
    if (Number.isInteger(index) && index !== state.commandIndex) {
      state.commandIndex = index;
      renderCommandPalette();
    }
  });

  els.commandResults.addEventListener("click", (event) => {
    const item = event.target.closest("[data-command-index]");
    if (!item) return;
    runCommandItem(Number(item.dataset.commandIndex));
  });

  els.commandPalette.addEventListener("click", (event) => {
    if (event.target === els.commandPalette) closeCommandPalette();
  });

  els.graph.addEventListener("pointerdown", handleGraphPointerDown);
  els.graph.addEventListener("pointermove", handleGraphPointerMove);
  els.graph.addEventListener("pointerup", handleGraphPointerUp);
  els.graph.addEventListener("pointercancel", handleGraphPointerUp);
  els.graph.addEventListener("lostpointercapture", handleGraphPointerUp);

  els.graph.addEventListener("click", (event) => {
    if (state.graphClickSuppressed) {
      state.graphClickSuppressed = false;
      event.preventDefault();
      return;
    }

    const node = event.target.closest("[data-node-id]");
    if (!node) return;
    openGraphNode(node.dataset.nodeId, node.dataset.noteTitle);
  });

  els.graph.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const node = event.target.closest("[data-node-id]");
    if (!node) return;
    event.preventDefault();
    openGraphNode(node.dataset.nodeId, node.dataset.noteTitle);
  });

  els.graphFullscreenBtn.addEventListener("click", () => toggleGraphFullscreen());
  if (els.graphRelayoutBtn) {
    els.graphRelayoutBtn.addEventListener("click", () => {
      // Wipe stored positions so resolveGraphPositions re-runs the
      // force-directed sim from scratch. Persisted to localStorage so
      // the reset survives reload.
      state.graphPositions = {};
      persistGraphPositions();
      renderGraph();
    });
  }
  els.graphResizeHandle.addEventListener("pointerdown", (event) => startLayoutResize("graph", event));
  els.graphResizeHandle.addEventListener("dblclick", () => resetPanelLayout("graph"));
  els.graphResizeHandle.addEventListener("keydown", (event) => handleResizerKeydown("graph", event));

  els.sidebarResizer.addEventListener("pointerdown", (event) => startLayoutResize("sidebar", event));
  els.inspectorResizer.addEventListener("pointerdown", (event) => startLayoutResize("inspector", event));
  els.editorResizer.addEventListener("pointerdown", (event) => startLayoutResize("editor", event));
  els.sidebarResizer.addEventListener("dblclick", () => resetPanelLayout("sidebar"));
  els.inspectorResizer.addEventListener("dblclick", () => resetPanelLayout("inspector"));
  els.editorResizer.addEventListener("dblclick", () => resetPanelLayout("editor"));
  els.sidebarResizer.addEventListener("keydown", (event) => handleResizerKeydown("sidebar", event));
  els.inspectorResizer.addEventListener("keydown", (event) => handleResizerKeydown("inspector", event));
  els.editorResizer.addEventListener("keydown", (event) => handleResizerKeydown("editor", event));
  document.addEventListener("pointermove", updateLayoutResize);
  document.addEventListener("pointerup", stopLayoutResize);
  document.addEventListener("pointercancel", stopLayoutResize);
  window.addEventListener("resize", () => {
    applyLayoutSettings();
    persistLayoutSettings();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (state.graphFullscreen) {
        toggleGraphFullscreen(false);
        return;
      }
      if (!els.commandPalette.hidden) {
        closeCommandPalette();
        return;
      }
      if (!els.templatePicker.hidden) {
        closeTemplatePicker();
        return;
      }
      if (!els.vaultDialog.hidden) {
        closeVaultDialog();
        return;
      }
    }

    if (!els.commandPalette.hidden || !els.templatePicker.hidden || !els.vaultDialog.hidden) return;

    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier) return;
    const key = event.key.toLocaleLowerCase("fr-FR");
    if (key === "n") {
      event.preventDefault();
      createNote(`Note ${state.notes.length + 1}`, "# Nouvelle note\n\n");
    }
    if (key === "k") {
      event.preventDefault();
      els.searchInput.focus();
      els.searchInput.select();
    }
    if (key === "p") {
      event.preventDefault();
      openCommandPalette();
    }
    if (key === "d") {
      event.preventDefault();
      createDailyNote();
    }
    if (key === "e") {
      event.preventDefault();
      cycleView();
    }
    if (key === "s") {
      event.preventDefault();
      persistNow(true);
      toast("Sauvegardé.");
    }
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // L'ouverture directe en file:// ne permet pas d'enregistrer un service worker.
    });
  });
}

loadActiveVaultState();
bindEvents();
renderAll();
refreshGithubStatus();
registerServiceWorker();

// ----------------------------------------------------------------------
// One-shot server-vault import — povchat-created vaults that aren't
// yet in this browser's localStorage. Triggered by URL parameter
// `?import-vault=<id>` (e.g. povchat surfaces a "Open in PovMind" link).
//
// What it does:
//   1. Parse the param.
//   2. If the vault id is already in our local registry, just activate
//      it (and clean the URL). No-op data-wise.
//   3. Otherwise GET /api/vaults/<id>/pull to fetch server-side
//      metadata + notes.
//   4. Register the vault locally (push into vaultRegistry), persist
//      the notes payload at `vaultStorageKey("notes")`, set as active.
//   5. Reload state from local + render. Strip the param from the URL.
// ----------------------------------------------------------------------
async function maybeImportServerVault(): Promise<void> {
  let params: URLSearchParams;
  try { params = new URLSearchParams(window.location.search); } catch { return; }
  const serverVaultId = params.get("import-vault");
  if (!serverVaultId) return;
  // Strip the param straight away so reloads don't re-trigger.
  try {
    const cleaned = new URL(window.location.href);
    cleaned.searchParams.delete("import-vault");
    history.replaceState(null, "", cleaned.toString());
  } catch { /* ignore */ }

  const known = (vaultRegistry as any).vaults.find((v: any) => v.id === serverVaultId);
  if (known) {
    (window as any).activeVaultId = serverVaultId;
    (vaultRegistry as any).activeId = serverVaultId;
    (persistVaultRegistry as any)();
    (loadActiveVaultState as any)();
    (renderAll as any)();
    if (typeof (toast as any) === "function") (toast as any)(`Vault « ${known.name} » activé.`);
    return;
  }

  if (typeof (toast as any) === "function") (toast as any)("Import du vault depuis povchat…");
  try {
    // sync.html stores a bearer token under "povmind:sync:token". Reuse
    // it so /api/vaults/:id/pull authenticates the same way as doPull().
    const syncToken = (localStorage.getItem("povmind:sync:token") || "").trim();
    const headers: Record<string, string> = {};
    if (syncToken) headers["Authorization"] = "Bearer " + syncToken;
    const resp = await fetch(`/api/vaults/${encodeURIComponent(serverVaultId)}/pull`, {
      credentials: "include",
      headers,
    });
    const data: any = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
      if (resp.status === 401 && typeof (toast as any) === "function") {
        (toast as any)("Import refusé : configure d'abord ton token sur /sync.html, puis reviens cliquer le lien.");
      } else if (typeof (toast as any) === "function") {
        (toast as any)(`Import refusé (HTTP ${resp.status}).`);
      }
      // Stash the requested id so /sync.html can offer a retry shortcut.
      try { localStorage.setItem("povmind:import:pending", serverVaultId); } catch { /* ignore */ }
      return;
    }
    // Clear any previously-stashed pending import on success.
    try { localStorage.removeItem("povmind:import:pending"); } catch { /* ignore */ }
    const v = data.vault || {};
    const name = String(v.name || "Vault importé");
    const serverNotes: any[] = Array.isArray(v.notes) ? v.notes : [];

    const now = (nowIso as any)();
    const localNotes = serverNotes.map((n: any) => ({
      id: (uid as any)(),
      title: String(n.title || "Sans titre"),
      folder: "",
      body: String(n.body || ""),
      createdAt: n.updated_at || now,
      updatedAt: n.updated_at || now,
    }));

    (vaultRegistry as any).vaults.unshift({
      id: serverVaultId,
      name,
      createdAt: now,
      updatedAt: now,
      noteCount: localNotes.length,
      tokenSealed: false,
    });
    (window as any).activeVaultId = serverVaultId;
    (vaultRegistry as any).activeId = serverVaultId;
    (persistVaultRegistry as any)();

    const notesPayload = {
      version: 1,
      vaultId: serverVaultId,
      notes: localNotes,
      activeId: localNotes[0]?.id || null,
    };
    localStorage.setItem((vaultStorageKey as any)("notes", serverVaultId), JSON.stringify(notesPayload, null, 2));

    (loadActiveVaultState as any)();
    (renderAll as any)();
    if (typeof (toast as any) === "function") (toast as any)(`Vault « ${name} » importé (${localNotes.length} note(s)).`);
  } catch (err) {
    console.error("[import-vault] failed:", err);
    if (typeof (toast as any) === "function") (toast as any)("Échec de l'import. Réseau ou auth ?");
  }
}

maybeImportServerVault();
