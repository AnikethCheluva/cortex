import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBridgeServer } from "./server.mjs";
import { CodexAppServer } from "./app-server.mjs";
import { requestJson } from "./network.mjs";
import { publishConnection, tunnelAddress } from "./vercel.mjs";

const home = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(await readFile(path.join(home, "bridge-config.json"), "utf8"));
const port = Number(config.port || 4317);

let connecting = false;
let connectionTimer;
async function configureVercel(url) {
  if (connecting) return;
  connecting = true;
  try {
    await publishConnection(config, url, {
      load: async () => { try { return JSON.parse(await readFile(path.join(home, "connection.json"), "utf8")); } catch { return null; } },
      save: value => writeFile(path.join(home, "connection.json"), JSON.stringify(value), { mode: 0o600 }),
    });
    process.stdout.write("Cortex connected to Codex.\n");
  } catch (error) {
    process.stderr.write(`Cortex reconnection pending: ${error.message} Retrying in 30 seconds.\n`);
    if (!stopping && tunnelUrl === url) connectionTimer = setTimeout(() => void configureVercel(url), 30_000);
  } finally {
    connecting = false;
    if (!stopping && tunnelUrl && tunnelUrl !== url) void configureVercel(tunnelUrl);
  }
}

const appServer = new CodexAppServer({
  codexBin: config.codexBin,
  stateDir: path.join(home, "state"),
  model: config.model || "",
});
const server = createBridgeServer({
  token: config.token,
  allowedOrigin: config.allowedOrigin,
  appServer,
});
server.listen(port, "127.0.0.1", async () => {
  try {
    await appServer.start();
    process.stdout.write(`Local Cortex Codex companion ready on port ${port}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
});

let stopping = false;
let tunnelRestartTimer;
let tunnelAttempts = 0;
let tunnel;
function startTunnel() {
  configured = false;
  tunnelOutput = "";
  tunnelUrl = "";
  tunnelFailures = 0;
  tunnel = spawn(config.cloudflaredBin, [
    "tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${port}`,
  ], { env: { ...process.env, PATH: config.path }, stdio: ["ignore", "pipe", "pipe"] });
  tunnel.stdout.on("data", onTunnelOutput);
  tunnel.stderr.on("data", onTunnelOutput);
  tunnel.once("error", () => process.stderr.write("Cloudflare could not start. Check the installed binary.\n"));
  tunnel.once("close", () => {
    if (stopping) return;
    clearTimeout(connectionTimer);
    const rateLimited = /status 429/.test(tunnelOutput);
    const delay = rateLimited ? 900_000 : Math.min(900_000, 30_000 * 2 ** Math.min(tunnelAttempts++, 5));
    tunnelUrl = "";
    process.stderr.write(`Cloudflare disconnected${rateLimited ? " (rate limited)" : ""}; retrying in ${delay / 1000} seconds.\n`);
    tunnelRestartTimer = setTimeout(startTunnel, delay);
  });
}
let configured = false;
let tunnelOutput = "";
let tunnelUrl = "";
let tunnelFailures = 0;
let checkingTunnel = false;

async function checkTunnel() {
  if (!tunnelUrl || checkingTunnel) return;
  checkingTunnel = true;
  try {
    await requestJson(`${tunnelUrl}/health`, {
      headers: { authorization: `Bearer ${config.token}` }, timeoutMs: 10_000,
    });
    tunnelFailures = 0;
    tunnelAttempts = 0;
  } catch {
    tunnelFailures += 1;
  } finally {
    checkingTunnel = false;
  }
  if (tunnelFailures >= 6) {
    process.stderr.write("Cortex tunnel stopped forwarding; restarting tunnel.\n");
    tunnel.kill("SIGTERM");
  }
}

const healthTimer = setInterval(() => void checkTunnel(), 45_000);
healthTimer.unref();

function onTunnelOutput(chunk) {
  const text = chunk.toString();
  tunnelOutput = `${tunnelOutput}${text}`.slice(-12_000);
  if (process.env.CORTEX_BRIDGE_DEBUG === "1") process.stderr.write(text);
  const address = tunnelAddress(tunnelOutput);
  if (!configured && address) {
    configured = true;
    tunnelUrl = address;
    process.stdout.write(`Cloudflare tunnel ready at ${address}\n`);
    void configureVercel(address);
  }
}
startTunnel();

const stop = () => {
  stopping = true;
  clearTimeout(tunnelRestartTimer);
  clearInterval(healthTimer);
  clearTimeout(connectionTimer);
  tunnel.kill("SIGTERM");
  appServer.stop();
  server.close(() => process.exit(0));
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
