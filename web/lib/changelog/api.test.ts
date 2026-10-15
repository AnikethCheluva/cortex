import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  enabled: false,
  authorized: true,
  read: vi.fn(),
}));
vi.mock("../storage", () => ({ readVaultFile: state.read }));
vi.mock("../auth", () => ({ authEnabled: () => state.enabled }));
vi.mock("../apiauth", () => ({
  apiAuthorized: () => state.authorized,
  readAuthorized: () => !state.enabled || state.authorized,
  unauthorized: () => ({ error: "unauthorized" }),
}));
import { GET } from "@/app/api/changelog/route";
beforeEach(() => {
  state.enabled = false;
  state.authorized = true;
  state.read.mockReset();
  state.read.mockResolvedValue(null);
});
it("returns an empty day and rejects invalid dates before reading", async () => {
  const response = await GET(
    new Request("http://localhost/api/changelog?date=2026-09-02"),
  );
  expect(await response.json()).toMatchObject({
    version: 1,
    date: "2026-09-02",
    records: [],
  });
  state.read.mockClear();
  expect(
    (await GET(new Request("http://localhost/api/changelog?date=2026-02-30")))
      .status,
  ).toBe(400);
  expect(state.read).not.toHaveBeenCalled();
});
it("requires the existing session/token when login is enabled", async () => {
  state.enabled = true;
  state.authorized = false;
  expect(
    (await GET(new Request("http://localhost/api/changelog"))).status,
  ).toBe(401);
  expect(state.read).not.toHaveBeenCalled();
});
