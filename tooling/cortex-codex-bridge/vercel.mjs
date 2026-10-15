import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { requestJson } from "./network.mjs";

export async function vercelClient(config) {
  const authPath = path.join(os.homedir(), "Library/Application Support/com.vercel.cli/auth.json");
  const auth = JSON.parse(await readFile(authPath, "utf8"));
  if (!auth.token) throw new Error("Sign in to the Vercel CLI again to reconnect Cortex.");
  return (endpoint, options = {}) => {
    const url = new URL(endpoint, "https://api.vercel.com");
    url.searchParams.set("slug", config.vercelScope);
    return requestJson(url, { ...options, headers: { authorization: `Bearer ${auth.token}` } });
  };
}

// Keep the tunnel alive while Vercel recovers; retry this operation without
// downloading a CLI, changing the URL, or putting credentials in process args.
export async function publishConnection(config, url, {
  api, load = async () => null, save = async () => {},
  wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  api ??= await vercelClient(config);
  const project = await api(`/v9/projects/${config.vercelProject}`);
  const result = await api(`/v10/projects/${config.vercelProject}/env?upsert=true`, {
    method: "POST", body: [
      { key: "CODEX_BRIDGE_URL", value: url, type: "plain", target: ["production"] },
      { key: "CODEX_BRIDGE_TOKEN", value: config.token, type: "sensitive", target: ["production"] },
    ],
  });
  if (result.error) throw new Error("Could not update the Cortex connection settings.");
  let pending = await load();
  if (pending?.url !== url || !pending?.deploymentId) {
    if (!project.targets?.production?.id) throw new Error("No production deployment is available to reconnect.");
    const created = await api("/v13/deployments", { method: "POST", body: {
      name: project.name, project: config.vercelProject,
      deploymentId: project.targets.production.id, target: "production",
    } });
    pending = { url, deploymentId: created.id };
    if (!pending.deploymentId) throw new Error("Vercel did not return a deployment ID.");
    await save(pending);
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    const deployment = await api(`/v13/deployments/${pending.deploymentId}`);
    if (deployment.readyState === "READY") {
      const connection = { ...pending, deployment: deployment.url, connectedAt: new Date().toISOString() };
      await save(connection);
      return connection;
    }
    if (["ERROR", "CANCELED"].includes(deployment.readyState)) {
      await save({ url });
      throw new Error("Cortex reconnection deployment failed; it will retry.");
    }
    await wait(10_000);
  }
  throw new Error("Cortex is still deploying; connection checks will continue.");
}

export function tunnelAddress(output) {
  // Excludes Cloudflare's control API hostname, which also appears in errors.
  return output.match(/https:\/\/[a-z0-9]+(?:-[a-z0-9]+)+\.trycloudflare\.com\b/i)?.[0] || null;
}
