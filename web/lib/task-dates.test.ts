import { describe, expect, it } from "vitest";
import { validTaskDate, shiftDate, dueLabel } from "./task-dates";
import { buildTaskFile, parseTask } from "./parse";
import { setFrontmatterField } from "./frontmatter";
describe("task dates", () => {
  it("accepts clearing a date and validates actual days, including leap years", () => {
    for (const value of ["", "2028-02-29", "2026-10-08"])
      expect(validTaskDate(value)).toBe(true);
    for (const value of [
      null,
      4,
      "tomorrow",
      "2026-2-01",
      "2026-02-29",
      "2026-04-31",
      "2026-13-01",
    ])
      expect(validTaskDate(value)).toBe(false);
  });
  it("keeps date shortcuts stable across month/year and DST boundaries", () => {
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDate("2026-03-07", 7)).toBe("2026-03-14");
    expect(dueLabel("2026-10-09", "2026-10-08")).toBe("Tomorrow");
    expect(dueLabel("", "2026-10-08")).toBe("No date");
  });
  it("round-trips dates and safely quotes title/project punctuation", () => {
    const raw = buildTaskFile({
      title: "Review: # next steps",
      project: "Research: notes",
      due_date: "2026-10-08",
      today: "2026-10-01",
    });
    expect(parseTask("test", raw)).toMatchObject({
      title: "Review: # next steps",
      project: "Research: notes",
      due_date: "2026-10-08",
    });
    expect(
      parseTask("test", setFrontmatterField(raw, "due_date", "")),
    ).toMatchObject({ due_date: "" });
  });
});
