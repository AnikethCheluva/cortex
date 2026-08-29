import { describe, it, expect } from "vitest";
import {
  splitDayNote,
  combineDayNote,
  mergeDayNote,
  VOICE_MARKER,
  QUIZ_MARKER,
} from "@/lib/daynote";

describe("splitDayNote", () => {
  it("treats everything as written when there's no marker", () => {
    const { written, voice } = splitDayNote("# hi\n\nsome notes");
    expect(written).toBe("# hi\n\nsome notes");
    expect(voice).toEqual([]);
  });

  it("splits the written part from the voice entries", () => {
    const md = `written stuff\n\n${VOICE_MARKER}\n## Voice notes\n\n- first note\n- second note`;
    const { written, voice } = splitDayNote(md);
    expect(written).toBe("written stuff");
    expect(voice).toEqual(["first note", "second note"]);
  });

  it("ignores the heading and blank lines inside the voice section", () => {
    const md = `w\n${VOICE_MARKER}\n## Voice notes\n\n\n- only one\n\n`;
    expect(splitDayNote(md).voice).toEqual(["only one"]);
  });

  it("handles empty input", () => {
    expect(splitDayNote("")).toEqual({ written: "", voice: [], quiz: "" });
  });
});

describe("combineDayNote", () => {
  it("returns just the written notes when there are no voice entries", () => {
    expect(combineDayNote("hello", [])).toBe("hello\n");
    expect(combineDayNote("", [])).toBe("");
  });

  it("appends a marked voice section after the written notes", () => {
    const out = combineDayNote("hello", ["a note", "b note"]);
    expect(out).toContain(VOICE_MARKER);
    expect(out).toContain("- a note");
    expect(out.indexOf("hello")).toBeLessThan(out.indexOf(VOICE_MARKER));
  });

  it("collapses newlines within an entry so one entry stays one bullet", () => {
    expect(combineDayNote("w", ["line one\nline two"])).toContain("- line one line two");
  });

  it("drops blank entries", () => {
    const out = combineDayNote("w", ["   ", "real"]);
    expect(out).toContain("- real");
    expect(out.match(/^- /gm)?.length).toBe(1);
  });
});

describe("quiz section", () => {
  const quiz = `${QUIZ_MARKER}\n## Recall quiz\n<!-- ids: a,b -->\n\n1. q one`;

  it("carves the quiz block out during split", () => {
    const p = splitDayNote(`written\n\n${quiz}`);
    expect(p.written).toBe("written");
    expect(p.quiz).toBe(quiz);
  });

  it("keeps written, voice, and quiz separate", () => {
    const md = `w\n\n${VOICE_MARKER}\n## Voice notes\n\n- v1\n\n${quiz}`;
    const p = splitDayNote(md);
    expect(p.written).toBe("w");
    expect(p.voice).toEqual(["v1"]);
    expect(p.quiz).toBe(quiz);
  });

  it("preserves the quiz verbatim when written/voice are re-saved", () => {
    const md = `old\n\n${VOICE_MARKER}\n## Voice notes\n\n- v1\n\n${quiz}`;
    const { voice, quiz: q } = splitDayNote(md);
    const out = combineDayNote("new written", voice, q);
    expect(out).toContain("new written");
    expect(out).toContain("- v1");
    expect(out).toContain("<!-- ids: a,b -->");
    expect(out.indexOf(VOICE_MARKER)).toBeLessThan(out.indexOf(QUIZ_MARKER));
  });

  it("round-trips written + voice + quiz", () => {
    const out = combineDayNote("W", ["v"], quiz);
    const p = splitDayNote(out);
    expect(p).toEqual({ written: "W", voice: ["v"], quiz });
  });
});

describe("mergeDayNote — the quiz block is server-managed", () => {
  const QUIZ = `${QUIZ_MARKER}\n## Recall quiz — Friday\n<!-- ids: a,b -->\n\n1. What is a policy?`;
  const onDisk = `Morning thoughts.\n\n${QUIZ}`;

  it("keeps the existing quiz when the client sends a body without one", () => {
    // The exact 8-28-26 regression: a tab loaded before the morning routine
    // ran saves a body with no quiz block, clobbering the day's questions.
    const merged = mergeDayNote("Egoverse 2.0 plan", onDisk);
    expect(merged).toContain(QUIZ_MARKER);
    expect(merged).toContain("What is a policy?");
    expect(merged).toContain("Egoverse 2.0 plan");
    expect(merged).not.toContain("Morning thoughts");
  });

  it("prefers the client's quiz when it round-tripped one", () => {
    const fresh = `${QUIZ_MARKER}\n## Recall quiz — Saturday\n<!-- ids: c -->\n\n1. Newer?`;
    const merged = mergeDayNote(`Notes.\n\n${fresh}`, onDisk);
    expect(merged).toContain("Newer?");
    expect(merged).not.toContain("What is a policy?");
  });

  it("preserves voice notes alongside a recovered quiz", () => {
    const incoming = `Wrote things.\n\n${VOICE_MARKER}\n## Voice notes\n\n- spoken idea`;
    const merged = mergeDayNote(incoming, onDisk);
    expect(merged).toContain("- spoken idea");
    expect(merged).toContain(QUIZ_MARKER);
  });

  it("is a no-op when neither side has a quiz", () => {
    expect(mergeDayNote("just text", "older text")).toBe("just text\n");
  });
});
