import fs from "node:fs";
import process from "node:process";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const expectedVersion = String(pkg.version);
const serviceUrl = process.env.POVMIND_SERVICE_URL || "https://povmind-472136847189.europe-west1.run.app";

async function readJson(pathname) {
  const response = await fetch(`${serviceUrl}${pathname}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${pathname} HTTP ${response.status}`);
  return response.json();
}

async function readText(pathname) {
  const response = await fetch(`${serviceUrl}${pathname}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${pathname} HTTP ${response.status}`);
  return response.text();
}

const version = await readJson("/version");
if (version.version !== expectedVersion) {
  throw new Error(`Version prod ${version.version} != locale ${expectedVersion}`);
}

const health = await readJson("/health");
if (!health.ok || health.version !== expectedVersion) {
  throw new Error(`Health prod invalide: ${JSON.stringify(health)}`);
}

const html = await readText(`/index.html?v=${expectedVersion}`);
const requiredFragments = [
  `name="povmind-version" content="${expectedVersion}"`,
  `styles.css?v=${expectedVersion}`,
  `app.js?v=${expectedVersion}`,
];

for (const fragment of requiredFragments) {
  if (!html.includes(fragment)) throw new Error(`Fragment absent en prod: ${fragment}`);
}

console.log(`Prod synchronisée avec PovMind ${expectedVersion}: ${serviceUrl}`);
