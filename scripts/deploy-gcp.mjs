import { spawnSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const project = process.env.GCP_PROJECT || "campaign-truth-prod";
const region = process.env.GCP_REGION || "europe-west1";
const service = process.env.GCP_SERVICE || "povmind";
const gcloud = process.env.GCLOUD_BIN || "/Users/fredericarnaud-meyer/MarieFrancoise34/google-cloud-sdk/bin/gcloud";

function run(command, args, options = {}) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`Commande échouée: ${command} ${args.join(" ")}`);
  }
}

console.log(`Déploiement PovMind ${pkg.version} -> Cloud Run ${service} (${project}/${region})`);

run("node", ["scripts/sync-version.mjs"]);
run("npm", ["run", "check"]);
run(gcloud, [
  "run",
  "deploy",
  service,
  "--source",
  ".",
  "--project",
  project,
  "--region",
  region,
  "--allow-unauthenticated",
  "--quiet",
]);
run("node", ["scripts/verify-online.mjs"]);

console.log(`Synchronisation terminée: local = prod = ${pkg.version}`);
