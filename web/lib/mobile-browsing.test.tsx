// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DailyTab } from "@/components/DailyTab";
import { WikiTab } from "@/components/WikiTab";
import type { DailyNote, WikiPage } from "./types";
vi.mock("@/lib/useMobile", () => ({ useMobile: () => true }));
vi.mock("@/components/DayEditor", () => ({
  DayEditor: ({ stem }: { stem: string }) => (
    <div data-testid="day-editor">{stem}</div>
  ),
}));
vi.mock("@/components/QuizSection", () => ({ QuizSection: () => null }));
vi.mock("@/components/DayQuiz", () => ({ DayQuiz: () => null }));
vi.mock("./markdown", () => ({
  Markdown: ({ body }: { body: string }) => <article>{body}</article>,
}));
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("scrollTo", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const notes: DailyNote[] = [
  {
    file: "10-8-26",
    date: "2026-10-08",
    label: "Oct 8",
    body: "Robotics lab",
    preview: "Morning work",
  },
  {
    file: "10-7-26",
    date: "2026-10-07",
    label: "Oct 7",
    body: "Linear algebra",
    preview: "Class notes",
  },
];
it("searches full daily-note text and filters by date", () => {
  render(<DailyTab notes={notes} compact />);
  fireEvent.change(screen.getByLabelText("Search daily notes"), {
    target: { value: "algebra" },
  });
  expect(screen.getByRole("button", { name: /Oct 7/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Oct 8/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  fireEvent.change(screen.getByLabelText("Filter notes by date"), {
    target: { value: "2026-10-08" },
  });
  expect(screen.getByRole("button", { name: /Oct 8/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Oct 7/ })).toBeNull();
});
it("previews a scrubbed date and opens it on release, with button alternatives", () => {
  render(<DailyTab notes={notes} compact />);
  fireEvent.click(screen.getByRole("button", { name: /Oct 8/ }));
  const slider = screen.getByRole("slider", { name: "Scrub daily notes" });
  fireEvent.change(slider, { target: { value: "0" } });
  expect(screen.getByTestId("day-editor").textContent).toBe("10-8-26");
  fireEvent.pointerUp(slider);
  expect(screen.getByTestId("day-editor").textContent).toBe("10-7-26");
  fireEvent.click(screen.getByRole("button", { name: "Newer note" }));
  expect(screen.getByTestId("day-editor").textContent).toBe("10-8-26");
});
const pages: WikiPage[] = [
  {
    slug: "robotics",
    title: "Robotics",
    summary: "Learning to move",
    body: "Policy experiments",
    tags: [],
    updated: "",
    sources: [],
  },
  {
    slug: "algebra",
    title: "Algebra",
    summary: "Vectors",
    body: "Matrix notes",
    tags: [],
    updated: "",
    sources: [],
  },
];
function Library() {
  const [slug, setSlug] = useState<string | null>(null);
  return <WikiTab pages={pages} slug={slug} setSlug={setSlug} compact />;
}
it("uses the header view selector and preserves it when returning from a page", () => {
  render(<><div id="workspace-phone-actions" /><Library /></>);
  expect(screen.queryByLabelText("Search wiki pages")).toBeNull();
  fireEvent.change(screen.getByLabelText("Wiki view"), { target: { value: "all" } });
  fireEvent.click(screen.getByRole("button", { name: /Robotics Learning/ }));
  expect(screen.getByRole("article").textContent).toBe("Policy experiments");
  expect(screen.queryByLabelText("Wiki view")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /All pages/ }));
  expect(screen.getByLabelText("Wiki view")).toHaveProperty("value", "all");
  expect(screen.getByRole("button", { name: /Algebra Vectors/ })).toBeTruthy();
});
