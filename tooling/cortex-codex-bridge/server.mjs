import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CodexAppServer } from "./app-server.mjs";

const DEFAULT_ORIGIN = "http://localhost:3000";
const here = path.dirname(fileURLToPath(import.meta.url));

function sameSecret(received, expected) {
  const a = Buffer.from(received || "");
  const b = Buffer.from(expected || "");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

async function readJson(request, limit = 64 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error("Request is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function send(response, status, body, origin) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...(origin ? { "access-control-allow-origin": origin, vary: "Origin" } : {}),
  });
  response.end(JSON.stringify(body));
}

export function createBridgeServer({ token, allowedOrigin = DEFAULT_ORIGIN, appServer }) {
  if (!token || token.length < 32) throw new Error("CORTEX_BRIDGE_TOKEN must be at least 32 characters.");
  return createServer(async (request, response) => {
    const origin = request.headers.origin || "";
    if (origin && origin !== allowedOrigin) return send(response, 403, { error: "Origin is not allowed." });
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "access-control-allow-origin": allowedOrigin,
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "authorization, content-type",
        vary: "Origin",
      });
      return response.end();
    }
    const bearer = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!sameSecret(bearer, token)) return send(response, 401, { error: "Unauthorized." }, origin);
    try {
      if (request.method === "GET" && request.url === "/health") {
        await appServer.start();
        return send(response, 200, appServer.health(), origin);
      }
      if (request.method === "POST" && request.url === "/prompt") {
        const body = await readJson(request);
        const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
        const context = typeof body.context === "string" ? body.context.slice(0, 30_000) : "";
        const mode = body.mode === "estimate" ? "estimate" : "chat";
        if (!prompt || prompt.length > 16_000) return send(response, 400, { error: "Enter a prompt under 16,000 characters." }, origin);
        const conversationId = body.conversationId ?? "default";
        if (typeof conversationId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(conversationId)) return send(response, 400, { error: "Invalid conversation." }, origin);
        return send(response, 200, await appServer.prompt({ prompt, context, mode, conversationId }), origin);
      }
      return send(response, 404, { error: "Not found." }, origin);
    } catch (error) {
      return send(response, 502, { error: error.message || "Codex request failed." }, origin);
    }
  });
}

export function defaultAppServer() {
  return new CodexAppServer({
    codexBin: process.env.CORTEX_CODEX_BIN || path.join(os.homedir(), ".local/bin/codex"),
    stateDir: process.env.CORTEX_BRIDGE_STATE_DIR || path.join(os.homedir(), "Library/Application Support/Cortex Codex Bridge"),
    model: process.env.CORTEX_CODEX_MODEL || "",
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(here, "server.mjs")) {
  const appServer = defaultAppServer();
  const server = createBridgeServer({
    token: process.env.CORTEX_BRIDGE_TOKEN,
    allowedOrigin: process.env.CORTEX_ALLOWED_ORIGIN || DEFAULT_ORIGIN,
    appServer,
  });
  const port = Number(process.env.PORT || 4317);
  server.listen(port, "127.0.0.1", async () => {
    try {
      await appServer.start();
      process.stdout.write(`Cortex Codex bridge ready on http://127.0.0.1:${port}\n`);
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
      server.close();
    }
  });
  const stop = () => { appServer.stop(); server.close(() => process.exit(0)); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
