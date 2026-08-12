// Choose which vault the web app reads: your OWN existing vault, or the bundled
// empty starter. It just writes VAULT_PATH into web/.env.local (gitignored), which
// the app and scripts pick up.
//
//   node scripts/use-vault.mjs /path/to/your/obsidian-vault   # use your own
//   node scripts/use-vault.mjs examples/demo-vault            # the populated demo
//   node scripts/use-vault.mjs --empty                        # the empty starter (default)
//
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(repoRoot, "web", ".env.local");
const arg = process.argv[2];

if (!arg || arg === "-h" || arg === "--help") {
  console.log(`Choose the vault the web app reads.

  node scripts/use-vault.mjs <path>       point at your own vault (dir with sources/ + wiki/)
  node scripts/use-vault.mjs examples/demo-vault   use the populated demo
  node scripts/use-vault.mjs --empty      use the bundled empty starter (default)

Then:  cd web && npm run dev`);
  process.exit(arg ? 0 : 1);
}

// Read existing .env.local (if any) and drop any prior VAULT_PATH line.
let lines = [];
if (fs.existsSync(envFile)) {
  lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/).filter((l) => !/^\s*VAULT_PATH\s*=/.test(l));
}

if (arg === "--empty") {
  fs.writeFileSync(envFile, lines.join("\n").replace(/\n+$/, "") + "\n");
  console.log("✓ Using the bundled empty starter vault (examples/vault). Removed VAULT_PATH override.");
  process.exit(0);
}

const abs = path.resolve(process.cwd(), arg);
if (!fs.existsSync(abs)) {
  console.error(`✗ Path not found: ${abs}`);
  process.exit(1);
}
const hasStructure = fs.existsSync(path.join(abs, "sources")) || fs.existsSync(path.join(abs, "wiki"));
if (!hasStructure) {
  console.warn(`⚠ ${abs}\n  doesn't contain a sources/ or wiki/ folder yet. Pointing at it anyway —`);
  console.warn(`  see CLAUDE.md + examples/vault/ for the structure the app expects.`);
}

lines.push(`VAULT_PATH=${abs}`);
fs.writeFileSync(envFile, lines.join("\n").replace(/\n+$/, "") + "\n");
console.log(`✓ web app will read your vault at:\n  ${abs}\n\nNext:  cd web && npm run dev`);
