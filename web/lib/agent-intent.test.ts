import { describe, expect, it } from "vitest";
import { isAgentPrompt, isTimeboxCommand } from "./agent-intent";

describe("agent prompt detection", () => {
  it.each(["plan my research week", "Can you summarize my open tasks?", "> review the calendar", "I need help organizing this project"])("recognizes %s as an agent request", (input) => {
    expect(isAgentPrompt(input)).toBe(true);
  });
  it.each(["research notes", "PURA", "CS 2050 finals"])("keeps %s as a vault search", (input) => {
    expect(isAgentPrompt(input)).toBe(false);
  });
});

describe("isTimeboxCommand", () => {
  it("recognizes task scheduling commands", () => {
    expect(isTimeboxCommand("can you time box my tasks onto my calendar")).toBe(true);
    expect(isTimeboxCommand("schedule my tasks for this week")).toBe(true);
  });

  it("does not turn ordinary planning questions into calendar actions", () => {
    expect(isTimeboxCommand("explain my research plan")).toBe(false);
    expect(isTimeboxCommand("calendar")).toBe(false);
  });
});
