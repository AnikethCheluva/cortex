import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createBridgeServer } from "./server.mjs";

const token = "test-token-that-is-longer-than-thirty-two-characters";
const servers = [];
afterEach(() => servers.splice(0).forEach((server) => server.close()));

async function fixture(overrides = {}) {
  const fake = {
    async start() {},
    health: () => ({ ready: true, accountType: "chatgpt", planType: "promax" }),
    prompt: async ({ mode }) => mode === "estimate"
      ? { estimates: [{ taskId: "draft", minutes: 90 }] }
      : { response: "Ready." },
  };
  const server = createBridgeServer({ token, appServer: { ...fake, ...overrides } });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
}

describe("Cortex Codex bridge", () => {
  it("requires its bearer token", async () => {
    const url = await fixture();
    assert.equal((await fetch(`${url}/health`)).status, 401);
    const response = await fetch(`${url}/health`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).planType, "promax");
  });

  it("rejects other browser origins", async () => {
    const url = await fixture();
    const response = await fetch(`${url}/health`, {
      headers: { authorization: `Bearer ${token}`, origin: "https://example.com" },
    });
    assert.equal(response.status, 403);
  });

  it("returns chat and estimate responses", async () => {
    const url = await fixture();
    const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    const chat = await fetch(`${url}/prompt`, { method: "POST", headers, body: JSON.stringify({ prompt: "Plan today" }) });
    assert.deepEqual(await chat.json(), { response: "Ready." });
    const estimate = await fetch(`${url}/prompt`, { method: "POST", headers, body: JSON.stringify({ prompt: "Estimate", mode: "estimate" }) });
    assert.deepEqual(await estimate.json(), { estimates: [{ taskId: "draft", minutes: 90 }] });
  });
  it("forwards conversation identity and rejects unsafe identifiers", async () => {
    const calls = [];
    const url = await fixture({ prompt: async (value) => { calls.push(value); return { response: "Ready." }; } });
    const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    const good = await fetch(`${url}/prompt`, { method: "POST", headers, body: JSON.stringify({ prompt: "hello", conversationId: "chat-a" }) });
    assert.equal(good.status, 200);
    assert.equal(calls[0].conversationId, "chat-a");
    const bad = await fetch(`${url}/prompt`, { method: "POST", headers, body: JSON.stringify({ prompt: "hello", conversationId: "../other" }) });
    assert.equal(bad.status, 400);
    assert.equal(calls.length, 1);
  });

});
