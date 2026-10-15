import { randomBytes } from "node:crypto";
import { chmod, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const source = path.dirname(fileURLToPath(import.meta.url));
const installDir = path.join(os.homedir(), "Library/Application Support/Cortex Codex Bridge");
const label = "org.cortex.cortex-codex-bridge";
const plist = path.join(os.homedir(), "Library/LaunchAgents", `${label}.plist`);

function command(name) {
  return execFileSync("/usr/bin/which", [name], { encoding: "utf8" }).trim();
}

const files = ["app-server.mjs", "server.mjs", "run-with-tunnel.mjs", "network.mjs", "vercel.mjs"];
await mkdir(installDir, { recursive: true, mode: 0o700 });
for (const file of files) await cp(path.join(source, file), path.join(installDir, file));

let existing = {};
try { existing = JSON.parse(await readFile(path.join(installDir, "bridge-config.json"), "utf8")); }
catch { /* first installation */ }
const config = {
  token: existing.token || randomBytes(32).toString("hex"),
  allowedOrigin: process.env.CORTEX_ALLOWED_ORIGIN || existing.allowedOrigin || "http://localhost:3000",
  productionDomain: process.env.CORTEX_PRODUCTION_DOMAIN || existing.productionDomain || "",
  vercelProject: process.env.CORTEX_VERCEL_PROJECT || existing.vercelProject || "",
  vercelScope: process.env.CORTEX_VERCEL_SCOPE || existing.vercelScope || "",
  port: 4317,
  model: "",
  nodeBin: command("node"),
  npxBin: command("npx"),
  cloudflaredBin: command("cloudflared"),
  codexBin: command("codex"),
  path: process.env.PATH,
};
if (!config.productionDomain || !config.vercelProject || !config.vercelScope) throw new Error("Set CORTEX_PRODUCTION_DOMAIN, CORTEX_VERCEL_PROJECT, and CORTEX_VERCEL_SCOPE before installing hosted reconnection.");
await writeFile(path.join(installDir, "bridge-config.json"), JSON.stringify(config, null, 2), { mode: 0o600 });
await chmod(path.join(installDir, "bridge-config.json"), 0o600);
await mkdir(path.dirname(plist), { recursive: true });
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array>
    <string>${config.nodeBin}</string><string>${path.join(installDir, "run-with-tunnel.mjs")}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>20</integer>
  <key>StandardOutPath</key><string>${path.join(installDir, "bridge.log")}</string>
  <key>StandardErrorPath</key><string>${path.join(installDir, "bridge.error.log")}</string>
</dict></plist>\n`;
await writeFile(plist, xml, { mode: 0o600 });
process.stdout.write(`${plist}\n`);
