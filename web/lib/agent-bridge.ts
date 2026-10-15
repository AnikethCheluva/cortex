import "server-only";

const CORTEX_ORIGIN = "http://localhost:3000";

export function bridgeConfigured() {
  return Boolean(process.env.CODEX_BRIDGE_URL);
}

export async function bridgeRequest(
  path: string,
  body?: unknown,
  timeoutMs = 240_000,
) {
  const base = process.env.CODEX_BRIDGE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("Codex is not connected yet.");
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      origin: process.env.APP_ORIGIN || CORTEX_ORIGIN,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(process.env.CODEX_BRIDGE_TOKEN
        ? { authorization: `Bearer ${process.env.CODEX_BRIDGE_TOKEN}` }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const name = (error as Error).name;
    throw new Error(name === "TimeoutError" || name === "AbortError"
      ? "Codex took too long to respond. Please try again in a moment."
      : "Cortex couldn’t reach the Codex companion on your Mac. Make sure your Mac is awake and online; the connection will recover automatically.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(data?.error || (response.status === 401
      ? "The Codex connection needs to reconnect. Please try again shortly."
      : "The Codex companion is reconnecting. Please try again shortly."));
  return data;
}
