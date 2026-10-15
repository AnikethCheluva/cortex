// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { includeGoogleCalendar } from "./sources";
import { eventKey, readEventColors, COLOR_STORAGE_KEY } from "./colors";

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  localStorage.setItem("gcal_token", JSON.stringify({ accessToken: "test-token", expiry: Date.now() + 60000 }));
});
afterEach(() => vi.unstubAllGlobals());

it("excludes Canvas subscriptions by original or display name without excluding unrelated calendars", () => {
  expect(includeGoogleCalendar({ id: "1", summary: "Canvas Calendar" })).toBe(false);
  expect(includeGoogleCalendar({ id: "1", summary: "School", summaryOverride: "canvas deadlines" })).toBe(false);
  expect(includeGoogleCalendar({ id: "1", summary: "Canvas Calendar", summaryOverride: "School" })).toBe(false);
  expect(includeGoogleCalendar({ id: "1", summary: "Research" })).toBe(true);
});

it("skips Canvas requests, reads all pages, and preserves event colors over calendar defaults", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({items: [{id: "canvas", summary: "Canvas Calendar"}], nextPageToken: "cal-page-2"}))
    .mockResolvedValueOnce(Response.json({items: [{id: "work", summary: "Work", backgroundColor: "#123456", accessRole: "owner"}]}))
    .mockResolvedValueOnce(Response.json({items: [{id: "one", colorId: "5", hangoutLink: "https://meet.google.com/abc-defg-hij", description: "<p>Agenda</p>", start: {dateTime: "2026-10-13T09:00:00Z"}, end: {dateTime: "2026-10-13T10:00:00Z"}}], nextPageToken: "event-page-2"}))
    .mockResolvedValueOnce(Response.json({items: [{id: "two", start: {date: "2026-10-13"}, end: {date: "2026-10-14"}}]}));
  vi.stubGlobal("fetch", fetcher);
  const {googleListEvents} = await import("./google");
  const events = await googleListEvents("2026-10-13T00:00:00Z", "2026-10-14T00:00:00Z");
  expect(events).toHaveLength(2);
  expect(events[0]).toMatchObject({color: "#fbd75b", colorId: "5", colorReadOnly: false, meetingUrl: "https://meet.google.com/abc-defg-hij", description: "Agenda"});
  expect(events[1]).toMatchObject({color: "#123456"});
  expect(fetcher.mock.calls.every(([url]) => !url.includes("/calendars/canvas/"))).toBe(true);
  expect(fetcher.mock.calls[3][0]).toContain("pageToken=event-page-2");
});

it("patches only the selected event color and removes the override on reset", async () => {
  const fetcher = vi.fn().mockImplementation(async () => Response.json({}));
  vi.stubGlobal("fetch", fetcher);
  const {googleSetEventColor} = await import("./google");
  const event = {id: "event/id", calendarId: "work@example.com", provider: "google" as const, title: "Focus", start: "", end: "", allDay: false};
  await googleSetEventColor(event, "5");
  expect(fetcher.mock.calls[0][0]).toContain("work%40example.com/events/event%2Fid");
  expect(fetcher.mock.calls[0][1]).toMatchObject({method: "PATCH", body: '{"colorId":"5"}'});
  await googleSetEventColor(event, "");
  expect(fetcher.mock.calls[1][1].body).toBe('{"colorId":null}');
});

it("isolates local colors by provider and calendar and tolerates invalid stored preferences", () => {
  expect(eventKey({provider: "google", calendarId: "one", id: "same"})).not.toBe(eventKey({provider: "google", calendarId: "two", id: "same"}));
  localStorage.setItem(COLOR_STORAGE_KEY, '{"good":"5","bad":"junk"}');
  expect(readEventColors()).toEqual({good: "5"});
  localStorage.setItem(COLOR_STORAGE_KEY, "null");
  expect(readEventColors()).toEqual({});
});
