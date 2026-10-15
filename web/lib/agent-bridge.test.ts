import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { bridgeRequest } from "./agent-bridge";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("Codex connection feedback", () => {
  it("explains offline connections without retrying a prompt", async () => {
    vi.stubEnv("CODEX_BRIDGE_URL", "https://bridge.example");
    const fetcher = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetcher);
    await expect(bridgeRequest("/prompt", { prompt: "hello" })).rejects.toThrow("Mac is awake and online");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("distinguishes slow answers from offline connections", async () => {
    vi.stubEnv("CODEX_BRIDGE_URL", "https://bridge.example");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")));
    await expect(bridgeRequest("/prompt", {})).rejects.toThrow("too long");
  });
  it("handles non-JSON gateway errors", async () => {
    vi.stubEnv("CODEX_BRIDGE_URL", "https://bridge.example");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>gateway failure</html>", { status: 502 })));
    await expect(bridgeRequest("/health")).rejects.toThrow("reconnecting");
  });
});
