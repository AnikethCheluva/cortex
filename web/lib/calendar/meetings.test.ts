import { expect, it } from "vitest";
import { findMeetingUrl, plainEventText, meetingLabel } from "./meetings";

it("prioritizes provider conference links over forwarded meeting links", () => {
  expect(
    findMeetingUrl(
      ["https://meet.google.com/abc-defg-hij"],
      ["Old invite: https://example.zoom.us/j/123"],
    ),
  ).toBe("https://meet.google.com/abc-defg-hij");
});
it("finds meeting links in HTML descriptions and preserves passwords", () => {
  expect(
    findMeetingUrl(
      [],
      [
        '<a href="https://school.zoom.us/j/123?pwd=secret&amp;from=calendar">Join Zoom</a>',
      ],
    ),
  ).toBe("https://school.zoom.us/j/123?pwd=secret&from=calendar");
  expect(
    findMeetingUrl([], ["Join (https://meet.google.com/abc-defg-hij)."]),
  ).toBe("https://meet.google.com/abc-defg-hij");
  expect(
    findMeetingUrl(
      [],
      ["https://teams.microsoft.com/l/meetup-join/123?context=%7B%7D"],
    ),
  ).toContain("meetup-join");
});
it("ignores unsafe URLs and unrelated links instead of presenting them as meetings", () => {
  expect(
    findMeetingUrl([
      "javascript:alert(1)",
      "https://user:password@example.com",
    ]),
  ).toBeUndefined();
  expect(
    findMeetingUrl(
      [],
      ["https://zoom.us.evil.example/j/123 https://example.org/homework"],
    ),
  ).toBeUndefined();
});
it("normalizes descriptions without rendering their HTML", () => {
  expect(
    plainEventText(
      "<p>Hello &amp; welcome</p><script>alert(1)</script><div>Agenda</div>",
    ),
  ).toBe("Hello & welcome\nAgenda");
  expect(meetingLabel("https://school.zoom.us/j/123")).toBe("Zoom");
});
