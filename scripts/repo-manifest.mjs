import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const repoArg = args.find((arg) => !arg.startsWith("--")) || ".";
const repoRoot = path.resolve(repoArg);
const includeLocalPath = args.includes("--include-local-path");
const stdout = args.includes("--stdout");
const maxFiles = numberArg("--max-files", 220);
const maxBytes = numberArg("--max-bytes", 240000);
const outputArg = stringArg("--output");
const outputPath = outputArg ? path.resolve(outputArg) : path.join(process.cwd(), "povmind-repo-manifest.json");

if (!fs.existsSync(repoRoot) || !fs.statSync(repoRoot).isDirectory()) {
  throw new Error(`Repo introuvable: ${repoRoot}`);
}

function numberArg(name, fallback) {
  const item = args.find((arg) => arg.startsWith(`${name}=`));
  if (!item) return fallback;
  const value = Number(item.slice(name.length + 1));
  return Number.isFinite(value) ? value : fallback;
}

function stringArg(name) {
  const item = args.find((arg) => arg.startsWith(`${name}=`));
  return item ? item.slice(name.length + 1) : "";
}

function runGit(gitArgs) {
  const result = spawnSync("git", gitArgs, { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function languageFor(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const map = {
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    ts: "typescript",
    tsx: "typescript",
    jsx: "javascript",
    css: "css",
    html: "html",
    json: "json",
    md: "markdown",
    yml: "yaml",
    yaml: "yaml",
    py: "python",
    sh: "shell",
    Dockerfile: "dockerfile",
  };
  return map[ext] || map[path.basename(filePath)] || ext || "text";
}

function looksSecretPath(relativePath) {
  const normalized = relativePath.toLowerCase();
  return [
    ".env",
    ".pem",
    ".key",
    ".p12",
    ".pfx",
    "id_rsa",
    "credentials",
    "secret",
    "token",
    "node_modules/",
    ".git/",
    "dist/",
    "build/",
    "coverage/",
    "output/",
    ".playwright-cli/",
    "playwright-report/",
    "test-results/",
    ".next/",
    ".nuxt/",
    ".cache/",
    ".ds_store",
  ].some((pattern) => normalized.includes(pattern));
}

function isLikelyText(buffer) {
  if (!buffer.length) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  return !sample.includes(0);
}

function gitFileList() {
  const output = runGit(["ls-files", "-co", "--exclude-standard"]);
  return output ? output.split("\n").filter(Boolean) : [];
}

function walkFileList(dir = repoRoot, prefix = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (looksSecretPath(relativePath)) continue;
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFileList(absolutePath, relativePath));
    if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

const branch = runGit(["branch", "--show-current"]);
const commit = runGit(["rev-parse", "HEAD"]);
const remote = runGit(["config", "--get", "remote.origin.url"]);
const dirty = runGit(["status", "--porcelain"]) ? true : false;
const gitFiles = gitFileList();
const candidates = (gitFiles.length ? gitFiles : walkFileList())
  .filter((filePath) => !looksSecretPath(filePath))
  .sort((left, right) => left.localeCompare(right))
  .slice(0, maxFiles);

const files = [];
for (const relativePath of candidates) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) continue;
  const bytes = fs.statSync(absolutePath).size;
  if (bytes > maxBytes) continue;
  const buffer = fs.readFileSync(absolutePath);
  if (!isLikelyText(buffer)) continue;
  const content = buffer.toString("utf8");
  files.push({
    path: relativePath.replaceAll("\\", "/"),
    bytes,
    hash: sha256(content),
    language: languageFor(relativePath),
    preview: content.replace(/\s+/g, " ").trim().slice(0, 420),
    content,
  });
}

const treeHash = sha256(stableJson(files.map((file) => ({
  path: file.path,
  bytes: file.bytes,
  hash: file.hash,
}))));

const manifest = {
  format: "povmind-repo-manifest",
  version: 1,
  generatedAt: new Date().toISOString(),
  name: path.basename(repoRoot),
  root: path.basename(repoRoot),
  localPath: includeLocalPath ? repoRoot : "",
  remote,
  branch,
  commit,
  dirty,
  treeHash,
  fileCount: candidates.length,
  indexedCount: files.length,
  policy: {
    mode: "read-only",
    secretsExcluded: true,
    respectsGitignore: Boolean(gitFiles.length),
    maxFiles,
    maxBytes,
  },
  files,
};

const json = `${JSON.stringify(manifest, null, 2)}\n`;
if (stdout) {
  process.stdout.write(json);
} else {
  fs.writeFileSync(outputPath, json);
  console.log(`Manifest PovMind repo écrit: ${outputPath}`);
  console.log(`${files.length}/${candidates.length} fichier(s) indexé(s), tree ${treeHash.slice(0, 12)}…`);
}
