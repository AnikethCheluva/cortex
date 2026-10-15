// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { normalizeTheme, THEME_BOOT, THEMES } from "./themes";

describe("theme migration", () => {
  it.each([
    ["notebook", "dune"], ["midnight", "slate"], ["plum", "slate"],
    ["forest", "sage"], ["ocean", "slate"], ["ember", "dune"],
    ["sepia", "porcelain"], ["mono", "mono"], ["missing", "slate"],
    ["__proto__", "slate"], [null, "slate"],
  ])("migrates %s consistently before and after hydration", (previous, expected) => {
    expect(normalizeTheme(previous)).toBe(expected);
    localStorage.setItem("cortex:settings", JSON.stringify({ theme: previous }));
    window.eval(THEME_BOOT);
    expect(document.documentElement.dataset.theme).toBe(expected);
  });
  it("names the Apple appearances without invalidating saved palette IDs", () => {
    expect(THEMES.find(t => t.id === "slate")?.label).toBe("Apple Dark");
    expect(THEMES.find(t => t.id === "porcelain")?.label).toBe("Apple Light");
    expect(THEMES.map(t => t.id)).toEqual([
      "slate", "porcelain", "dune", "sage", "graphite", "nord", "mono", "parchment", "daylight",
    ]);
  });
});
