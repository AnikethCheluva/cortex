// @vitest-environment jsdom
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/Dashboard";
import type { VaultData } from "./types";

vi.mock("next/dynamic", () => ({
  default: (
    loader: () => Promise<
      React.ComponentType | { default: React.ComponentType }
    >,
  ) => {
    const Component = React.lazy(async () => {
      const module = await loader();
      return typeof module === "function" ? { default: module } : module;
    });
    return function Lazy() {
      return (
        <React.Suspense>
          <Component />
        </React.Suspense>
      );
    };
  },
}));
vi.mock("@/components/TodayTab", () => ({
  TodayTab: () => <h1>Capture today</h1>,
}));
vi.mock("@/components/CalendarTab", () => ({
  CalendarTab: () => <h1>Your calendar</h1>,
}));
vi.mock("@/components/Overview", () => ({
  Overview: () => <h1>Desktop overview</h1>,
}));
vi.mock("@/components/CommandPalette", () => ({ CommandPalette: ({ open }: { open: boolean }) => open ? <div role="dialog" aria-label="Search or ask Codex" /> : null }));
vi.mock("@/components/LiveVault", () => ({ useLiveVault: () => null }));
vi.mock("./useTaskWorkspace", () => ({
  useTaskWorkspace: () => ({ tasks: [] }),
}));
vi.mock("./settings", () => {
  const tabOrder = ["overview", "today", "daily", "calendar", "wiki", "tasks"];
  return {
    useSettings: () => ({ tabOrder, hiddenTabs: [] }),
    TAB_LABEL: {
      overview: "Overview",
      today: "Today",
      daily: "Daily",
      calendar: "Calendar",
      wiki: "Wiki",
      tasks: "Tasks",
    },
  };
});
const data = {
  wiki: [],
  tasks: [],
  daily: [],
  log: [],
  planned: [],
  notes: [],
  noteFolders: [],
  builtAt: "",
} as VaultData;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("scrollTo", vi.fn());
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function () {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value: function () {
        this.open = false;
      },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const viewport = (matches: boolean) =>
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener() {},
    removeEventListener() {},
  }));
describe("phone entry and hidden navigation", () => {
  it("opens Today on phones and navigates through a dismissible menu", async () => {
    viewport(true);
    render(<Dashboard data={data} />);
    expect(
      await screen.findByRole("heading", { name: "Capture today" }),
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const dialog = screen.getByRole("dialog", { name: "Navigate workspace" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Calendar" }));
    expect(
      await screen.findByRole("heading", { name: "Your calendar" }),
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    const tabbar = within(screen.getByRole("navigation", { name: "Tab bar" }));
    expect(tabbar.getByRole("button", { name: "Calendar" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(tabbar.getByRole("button", { name: "Today" }));
    expect(await screen.findByRole("heading", { name: "Capture today" })).toBeTruthy();
  });
  it("opens global search from the phone bubble", async () => {
    viewport(true);
    render(<Dashboard data={data} />);
    fireEvent.click(await screen.findByRole("button", { name: "Search workspace" }));
    expect(screen.getByRole("dialog", { name: "Search or ask Codex" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Search workspace" })).toBeNull();
  });
  it("keeps Overview as the desktop entry", async () => {
    viewport(false);
    render(<Dashboard data={data} />);
    expect(
      await screen.findByRole("heading", { name: "Desktop overview" }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Capture today" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Tab bar" })).toBeNull();
  });
});
