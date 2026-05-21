import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = String(pkg.version || "").trim();

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Version package.json invalide: ${version}`);
}

function updateFile(relativePath, transform) {
  const filePath = path.join(root, relativePath);
  const before = fs.readFileSync(filePath, "utf8");
  const after = transform(before);
  if (after !== before) fs.writeFileSync(filePath, after);
}

updateFile("index.html", (source) => {
  let next = source
    .replace(/<meta name="povmind-version" content="[^"]*" \/>/, `<meta name="povmind-version" content="${version}" />`)
    .replace(/styles\.css\?v=[^"]+/g, `styles.css?v=${version}`)
    .replace(/app\.js\?v=[^"]+/g, `app.js?v=${version}`);

  if (!next.includes('name="povmind-version"')) {
    next = next.replace(
      /(<meta name="description"[^>]*>\n)/,
      `$1  <meta name="povmind-version" content="${version}" />\n`
    );
  }
  return next;
});

updateFile("sync.html", (source) => (
  source
    .replace(/styles\.css(?:\?v=[^"]+)?/g, `styles.css?v=${version}`)
    .replace(/sync\.js(?:\?v=[^"]+)?/g, `sync.js?v=${version}`)
    .replace(/auto-sync\.js(?:\?v=[^"]+)?/g, `auto-sync.js?v=${version}`)
));

updateFile("sw.js", (source) => (
  source.replace(/const CACHE_NAME = "povmind-cache-v[^"]+";/, `const CACHE_NAME = "povmind-cache-v${version}";`)
));

for (const appPath of ["src/app.ts", "app.js"]) {
  if (!fs.existsSync(path.join(root, appPath))) continue;
  updateFile(appPath, (source) => (
    source.replace(/const APP_VERSION = "[^"]+";/, `const APP_VERSION = "${version}";`)
  ));
}

console.log(`PovMind version synchronisée: ${version}`);
