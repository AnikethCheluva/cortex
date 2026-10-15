// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { CalendarTab } from "@/components/CalendarTab";
import { dateKey, HOUR_PX, selectionRange, monthDays, addDays } from "./layout";
const api = vi.hoisted(() => ({
  connections: vi.fn(),
  listEvents: vi.fn(),
  createEvent: vi.fn(),
  deleteEvent: vi.fn(),
  setGoogleEventColor: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/calendar", () => ({
  ...api,
  providerConfigured: () => true,
  PROVIDER_LABEL: {
    google: "Google",
    microsoft: "Outlook",
    tasks: "Task deadlines",
    planned: "Planned",
  },
}));
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  constructor(
    type: string,
    options: MouseEventInit & { pointerId?: number; pointerType?: string } = {},
  ) {
    super(type, options);
    this.pointerId = options.pointerId ?? 1;
    this.pointerType = options.pointerType ?? "mouse";
  }
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.stubGlobal("React", React);
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  Object.defineProperties(HTMLElement.prototype, {
    setPointerCapture: { configurable: true, value: () => {} },
    hasPointerCapture: { configurable: true, value: () => true },
    releasePointerCapture: { configurable: true, value: () => {} },
  });
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
  api.connections.mockResolvedValue({
    google: true,
    microsoft: true,
    planned: false,
    tasks: false,
  });
  api.listEvents.mockResolvedValue([]);
  api.createEvent.mockResolvedValue("created");
  api.setGoogleEventColor.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("drag-to-create calendar events", () => {
  it.each(["google", "microsoft"])(
    "uses the dragged range and writes to the selected %s calendar",
    async (provider) => {
      render(<CalendarTab openTask={vi.fn()} rescheduleTask={vi.fn()} />);
      await waitFor(() =>
        expect(
          (
            screen.getByRole("button", {
              name: "New event",
              exact: true,
            }) as HTMLButtonElement
          ).disabled,
        ).toBe(false),
      );
      const today = dateKey(new Date());
      const slot = screen.getByRole("button", {
        name: `New event ${today} 9 AM`,
        exact: true,
      });
      const column = slot.parentElement!;
      fireEvent.pointerDown(slot, {
        clientY: 9 * HOUR_PX,
        button: 0,
        pointerId: 1,
        pointerType: "mouse",
      });
      fireEvent.pointerMove(column, {
        clientY: 10.5 * HOUR_PX,
        pointerId: 1,
        pointerType: "mouse",
      });
      fireEvent.pointerUp(column, {
        clientY: 10.5 * HOUR_PX,
        pointerId: 1,
        pointerType: "mouse",
      });
      const dialog = within(
        screen.getByRole("dialog", { name: "New calendar event" }),
      );
      expect((dialog.getByLabelText("Starts") as HTMLInputElement).value).toBe(
        `${today}T09:00`,
      );
      expect((dialog.getByLabelText("Ends") as HTMLInputElement).value).toBe(
        `${today}T10:30`,
      );
      fireEvent.change(dialog.getByLabelText("Event name"), {
        target: { value: "Research focus" },
      });
      fireEvent.change(dialog.getByLabelText("Calendar"), {
        target: { value: provider },
      });
      fireEvent.click(dialog.getByRole("button", { name: "Create event" }));
      await waitFor(() =>
        expect(api.createEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            provider,
            title: "Research focus",
            start: new Date(`${today}T09:00`).toISOString(),
            end: new Date(`${today}T10:30`).toISOString(),
            allDay: false,
          }),
        ),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(api.listEvents).toHaveBeenCalledTimes(2);
    },
  );
  it("cancels an in-progress drag with Escape", async () => {
    render(<CalendarTab openTask={vi.fn()} rescheduleTask={vi.fn()} />);
    const slot = await screen.findByRole("button", {
      name: `New event ${dateKey(new Date())} 9 AM`,
      exact: true,
    });
    fireEvent.pointerDown(slot, { clientY: 9 * HOUR_PX, button: 0 });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(slot.parentElement!, { clientY: 10 * HOUR_PX });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.createEvent).not.toHaveBeenCalled();
  });
  it("creates on a touch tap without treating a scroll as an event", async () => {
    render(<CalendarTab openTask={vi.fn()} rescheduleTask={vi.fn()} />);
    const slot = await screen.findByRole("button", {
      name: `New event ${dateKey(new Date())} 9 AM`,
      exact: true,
    });
    fireEvent.pointerDown(slot, {
      clientY: 9 * HOUR_PX,
      button: 0,
      pointerType: "touch",
    });
    fireEvent.pointerUp(slot.parentElement!, {
      clientY: 11 * HOUR_PX,
      pointerType: "touch",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.pointerDown(slot, {
      clientY: 9 * HOUR_PX,
      button: 0,
      pointerType: "touch",
    });
    fireEvent.pointerUp(slot.parentElement!, {
      clientY: 9 * HOUR_PX,
      pointerType: "touch",
    });
    expect(screen.getByLabelText("Starts")).toHaveProperty(
      "value",
      `${dateKey(new Date())}T09:00`,
    );
    expect(api.createEvent).not.toHaveBeenCalled();
  });
  it("supports reverse selection and clamps the final slot at midnight", () => {
    expect(selectionRange(660, 540)).toEqual({ start: 540, end: 660 });
    expect(selectionRange(1425, 1460)).toEqual({ start: 1425, end: 1440 });
    expect(selectionRange(600, 600)).toEqual({ start: 600, end: 630 });
  });
});

describe("event colors", () => {
  const event = () => ({
    id: "focus",
    provider: "google",
    calendarId: "work",
    title: "Research focus",
    start: `${dateKey(new Date())}T09:00:00`,
    end: `${dateKey(new Date())}T10:00:00`,
    allDay: false,
    color: "#123456",
    calendarColor: "#123456",
  });
  const openEvent = async () => {
    const buttons = await screen.findAllByRole("button", {
      name: /Research focus/,
    });
    fireEvent.click(buttons[0]);
    return within(screen.getByRole("dialog", { name: "Research focus" }));
  };
  it("preserves provider colors, syncs an individual Google color, and resets to the calendar", async () => {
    api.listEvents.mockResolvedValue([event()]);
    render(<CalendarTab openTask={vi.fn()} rescheduleTask={vi.fn()} />);
    const dialog = await openEvent();
    expect(
      document
        .querySelector<HTMLElement>(".time-event")
        ?.style.getPropertyValue("--ev"),
    ).toBe("#123456");
    fireEvent.click(dialog.getByRole("button", { name: /Event color/ }));
    fireEvent.click(
      dialog.getByRole("button", { name: "Banana", exact: true }),
    );
    await waitFor(() =>
      expect(api.setGoogleEventColor).toHaveBeenCalledWith(
        expect.objectContaining({ id: "focus", calendarId: "work" }),
        "5",
      ),
    );
    await waitFor(() =>
      expect(
        dialog.getByRole("button", { name: /Event color/ }).textContent,
      ).toContain("Banana"),
    );
    expect(
      document
        .querySelector<HTMLElement>(".time-event")
        ?.style.getPropertyValue("--ev"),
    ).toBe("#fbd75b");
    fireEvent.click(dialog.getByRole("button", { name: /Event color/ }));
    fireEvent.click(dialog.getByRole("button", { name: "Calendar default" }));
    await waitFor(() =>
      expect(
        document
          .querySelector<HTMLElement>(".time-event")
          ?.style.getPropertyValue("--ev"),
      ).toBe("#123456"),
    );
  });
  it("leaves the old color selected when Google rejects a save", async () => {
    api.listEvents.mockResolvedValue([event()]);
    api.setGoogleEventColor.mockRejectedValue(new Error("Google 403"));
    render(<CalendarTab openTask={vi.fn()} rescheduleTask={vi.fn()} />);
    const dialog = await openEvent();
    fireEvent.click(dialog.getByRole("button", { name: /Event color/ }));
    fireEvent.click(
      dialog.getByRole("button", { name: "Banana", exact: true }),
    );
    expect(await dialog.findByRole("alert")).toHaveProperty(
      "textContent",
      "Could not save color. Google 403",
    );
    expect(
      document
        .querySelector<HTMLElement>(".time-event")
        ?.style.getPropertyValue("--ev"),
    ).toBe("#123456");
  });
  it("keeps Outlook colors after remount and across calendar views", async () => {
    api.listEvents.mockResolvedValue([{ ...event(), provider: "microsoft" }]);
    const props = { openTask: vi.fn(), rescheduleTask: vi.fn() };
    const mounted = render(<CalendarTab {...props} />);
    const dialog = await openEvent();
    fireEvent.click(dialog.getByRole("button", { name: /Event color/ }));
    fireEvent.click(dialog.getByRole("button", { name: "Grape", exact: true }));
    await waitFor(() =>
      expect(
        dialog.getByRole("button", { name: /Event color/ }).textContent,
      ).toContain("Grape"),
    );
    mounted.unmount();
    render(<CalendarTab {...props} />);
    await screen.findByRole("button", { name: /Research focus/ });
    for (const [view, selector] of [
      ["day", ".time-event"],
      ["month", ".calendar-event-chip"],
      ["agenda", ".agenda-event"],
    ]) {
      fireEvent.change(
        screen.getByRole("combobox", { name: "Calendar view" }),
        { target: { value: view } },
      );
      await waitFor(() =>
        expect(
          document
            .querySelector<HTMLElement>(selector)
            ?.style.getPropertyValue("--ev"),
        ).toBe("#dbadff"),
      );
    }
    expect(api.setGoogleEventColor).not.toHaveBeenCalled();
  });
  it("sends the chosen color when creating a Google event", async () => {
    render(<CalendarTab openTask={vi.fn()} rescheduleTask={vi.fn()} />);
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "New event",
            exact: true,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "New event", exact: true }),
    );
    fireEvent.change(screen.getByLabelText("Event name"), {
      target: { value: "Colored event" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Event color/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Tangerine", exact: true }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create event" }));
    await waitFor(() =>
      expect(api.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({ colorId: "6" }),
      ),
    );
  });
});

it("offers meeting links in every view and opens a compact nonmodal event inspector", async () => {
  const date = dateKey(new Date());
  api.listEvents.mockResolvedValue([
    {
      id: "meeting",
      provider: "google",
      calendarId: "work",
      title: "Team sync",
      start: `${date}T09:00:00`,
      end: `${date}T09:30:00`,
      allDay: false,
      meetingUrl: "https://meet.google.com/abc-defg-hij",
      organizer: "Team organizer",
      attendees: [{ name: "A participant", response: "accepted" }],
      recurring: true,
    },
  ]);
  render(<CalendarTab openTask={vi.fn()} rescheduleTask={vi.fn()} />);
  expect(
    await screen.findByRole("link", { name: "Join meeting: Team sync" }),
  ).toHaveProperty("href", "https://meet.google.com/abc-defg-hij");
  fireEvent.click(screen.getByRole("button", { name: /Team sync/ }));
  const dialog = screen.getByRole("dialog", { name: "Team sync" });
  expect(dialog.tagName).toBe("ASIDE");
  expect(
    within(dialog).getByRole("link", { name: "Join meeting" }),
  ).toHaveProperty("target", "_blank");
  expect(within(dialog).queryByRole("button", { name: "Banana" })).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: /Event color/ }));
  fireEvent.keyDown(within(dialog).getByRole("button", { name: "Banana" }), {
    key: "Escape",
  });
  expect(screen.getByRole("dialog", { name: "Team sync" })).toBeTruthy();
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  for (const view of ["day", "month", "agenda"]) {
    fireEvent.change(screen.getByRole("combobox", { name: "Calendar view" }), {
      target: { value: view },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Join meeting: Team sync" }),
      ).toHaveProperty("href", "https://meet.google.com/abc-defg-hij"),
    );
  }
  expect(api.createEvent).not.toHaveBeenCalled();
});

it("does not switch back to a previous event when its color finishes saving", async () => {
  const date = dateKey(new Date());
  const base = {
    provider: "google",
    calendarId: "work",
    start: `${date}T09:00:00`,
    end: `${date}T10:00:00`,
    allDay: false,
  };
  api.listEvents.mockResolvedValue([
    { ...base, id: "one", title: "First meeting" },
    { ...base, id: "two", title: "Second meeting" },
  ]);
  let finish!: () => void;
  api.setGoogleEventColor.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  render(<CalendarTab openTask={vi.fn()} rescheduleTask={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: /First meeting/ }));
  fireEvent.click(screen.getByRole("button", { name: /Event color/ }));
  fireEvent.click(screen.getByRole("button", { name: "Banana", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: /Second meeting/ }));
  finish();
  await waitFor(() =>
    expect(screen.getByRole("dialog", { name: "Second meeting" })).toBeTruthy(),
  );
  expect(screen.queryByRole("dialog", { name: "First meeting" })).toBeNull();
});

it.each(["day", "three-day", "agenda"])(
  "opens a phone event card with Join meeting and basic actions in %s view",
  async (view) => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    const date = dateKey(new Date());
    api.listEvents.mockResolvedValue([{
      id: "phone-meeting", provider: "google", calendarId: "work",
      title: "Phone team sync", start: `${date}T09:00:00`,
      end: `${date}T09:30:00`, allDay: false,
      meetingUrl: "https://meet.google.com/abc-defg-hij",
      link: "https://calendar.google.com/calendar/event?eid=example",
      organizer: "Team organizer", description: "Weekly planning",
    }]);
    render(<CalendarTab openTask={vi.fn()} rescheduleTask={vi.fn()} />);
    await screen.findByRole("button", { name: /Phone team sync/ });
    fireEvent.change(screen.getByRole("combobox", { name: "Calendar view" }), {
      target: { value: view },
    });
    fireEvent.click((await screen.findAllByRole("button", { name: /Phone team sync/ }))[0]);
    const card = screen.getByRole("dialog", { name: "Phone team sync" });
    expect(card.tagName).toBe("DIALOG");
    expect(card).toHaveProperty("open", true);
    const content = within(card);
    expect(content.getByRole("link", { name: "Join meeting" })).toHaveProperty("href", "https://meet.google.com/abc-defg-hij");
    expect(content.getByRole("link", { name: /Open calendar/ })).toBeTruthy();
    expect(card.querySelector(".event-extra-details")).toHaveProperty("open", false);
    expect(content.getByRole("button", { name: /Delete/ })).toBeTruthy();
    fireEvent.click(content.getByRole("button", { name: /Event color/ }));
    expect(content.getByRole("button", { name: "Banana", exact: true })).toBeTruthy();
    fireEvent.click(content.getByRole("button", { name: "Close event" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.deleteEvent).not.toHaveBeenCalled();
  },
);

describe("continuous date scrolling", () => {
  const props = { openTask: vi.fn(), rescheduleTask: vi.fn() };

  it.each([false, true])("commits an aligned day after native scrolling without refetching (phone=%s)", async (phone) => {
    vi.stubGlobal("matchMedia", () => ({ matches: phone, addEventListener() {}, removeEventListener() {} }));
    render(<CalendarTab {...props} />);
    await waitFor(() => expect(api.listEvents).toHaveBeenCalledTimes(1));
    const surface = screen.getByRole("region", { name: /Calendar period/ });
    const scroller = screen.getByLabelText("Scrollable calendar");
    const label = () => screen.getByRole("heading", { level: 2 }).textContent;
    const initial = label();
    // The browser owns wheel/touch movement: handlers must not jump dates.
    fireEvent.wheel(surface, { deltaX: 96, deltaY: 0 });
    fireEvent.pointerDown(surface, { clientX: 300, clientY: 260, pointerId: 8, pointerType: "touch" });
    fireEvent.pointerUp(surface, { clientX: 180, clientY: 270, pointerId: 8, pointerType: "touch" });
    expect(label()).toBe(initial);
    scroller.scrollTop += 100;
    fireEvent.scroll(scroller);
    expect(label()).toBe(initial);
    scroller.scrollLeft += 100;
    fireEvent.scroll(scroller);
    expect(label()).toBe(initial);
    await waitFor(() => expect(label()).not.toBe(initial));
    const start = new Date(); start.setDate(start.getDate() + 1);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    if (!phone) expect(label()).toBe(
      `${start.toLocaleDateString([], { month: "short", day: "numeric" })} – ${end.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`,
    );
    expect(api.listEvents).toHaveBeenCalledTimes(1);
  });

  it("preserves mounted events and vertical position while an adjacent range refresh is pending", async () => {
    const date = new Date(); date.setDate(date.getDate() + 9);
    const event = { id: "cached", provider: "google", calendarId: "work", title: "Cached meeting",
      start: `${dateKey(date)}T09:00:00`, end: `${dateKey(date)}T10:00:00`, allDay: false };
    api.listEvents.mockResolvedValueOnce([event]);
    let finish!: (events: typeof event[]) => void;
    api.listEvents.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<CalendarTab {...props} />);
    const original = await screen.findByRole("button", { name: /Cached meeting/ });
    const scroller = screen.getByLabelText("Scrollable calendar");
    scroller.scrollTop = 400;
    scroller.scrollLeft += 800;
    fireEvent.scroll(scroller);
    await waitFor(() => expect(api.listEvents).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: /Cached meeting/ })).toBe(original);
    expect(scroller.scrollTop).toBe(400);
    expect(scroller.scrollLeft).toBe(1400);
    finish([{ ...event, title: "Updated meeting" }]);
    await screen.findByRole("button", { name: /Updated meeting/ });
    expect(screen.queryByRole("button", { name: /Cached meeting/ })).toBeNull();
  });
});

// Scheduling must use the complete planning window, not the phone's one-day view.
describe("deadline-aware automatic planning", () => {
  const planningTask = {
    id: "deadline-task", title: "Finish report", status: "todo" as const,
    priority: "high" as const, due_date: "2026-10-15", estimate_minutes: 120,
    project: "", tags: [], page_slug: "", created_at: "", updated_at: "",
    completed_at: "", timebox_start: "", body: "",
  };
  afterEach(() => vi.useRealTimers());

  it("fetches all 14 days on a phone and preserves the saved estimate", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 14, 9));
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const save = vi.fn().mockResolvedValue(undefined);
    render(<CalendarTab tasks={[planningTask]} openTask={vi.fn()} rescheduleTask={vi.fn()}
      saveTimeboxes={save} estimateTasks={async () => ({ "deadline-task": 30 })} />);
    await waitFor(() => expect(api.listEvents).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Auto timebox" }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(api.listEvents).toHaveBeenCalledWith(
      new Date(2026, 9, 14).toISOString(), new Date(2026, 9, 28).toISOString(),
    );
    expect(save.mock.calls[0][0][0].minutes).toBe(120);
  });

  it("does not save a plan when the full calendar cannot be loaded", async () => {
    const save = vi.fn();
    render(<CalendarTab tasks={[planningTask]} openTask={vi.fn()} rescheduleTask={vi.fn()} saveTimeboxes={save} />);
    await waitFor(() => expect(api.listEvents).toHaveBeenCalled());
    api.listEvents.mockRejectedValueOnce(new Error("Calendar unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "Auto timebox" }));
    await screen.findByText(/Could not timebox your tasks.*Calendar unavailable/);
    expect(save).not.toHaveBeenCalled();
  });
});

it("does not show a dedicated calendar search on phones", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  render(<CalendarTab openTask={vi.fn()} rescheduleTask={vi.fn()} />);
  expect(screen.queryByRole("textbox", { name: "Search calendar" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Open calendar search" })).toBeNull();
});

it("browses weeks in the phone month dropdown without moving the timeline, then restores its month label", async () => {
  vi.stubGlobal("matchMedia", () => ({matches:true, addEventListener() {}, removeEventListener() {}}));
  const height = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
  try {
    render(<CalendarTab openTask={vi.fn()} rescheduleTask={vi.fn()} />);
    await waitFor(() => expect(api.listEvents).toHaveBeenCalled());
    const calls = api.listEvents.mock.calls.length;
    const toggle = screen.getByRole("button", {name:"Choose calendar date"});
    const originalLabel = toggle.textContent;
    fireEvent.click(toggle);
    const scroller = screen.getByRole("region", {name:"Month calendar. Scroll vertically by week."});
    const firstRow = scroller.firstElementChild;
    expect(scroller.scrollTop).toBe(600);
    scroller.scrollTop += 100;
    fireEvent.scroll(scroller);
    expect(scroller.firstElementChild).toBe(firstRow);
    scroller.scrollTop = 1100;
    fireEvent.scroll(scroller);
    const expected = addDays(monthDays(new Date())[0], 38).toLocaleDateString([], {month:"long", year:"numeric"});
    await waitFor(() => expect(toggle.textContent).toContain(expected));
    expect(api.listEvents.mock.calls.length).toBe(calls);
    expect(screen.getByLabelText("Scrollable calendar")).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.textContent).toBe(originalLabel);
    expect(screen.queryByRole("region", {name:"Month calendar. Scroll vertically by week."})).toBeNull();
    expect(screen.queryByLabelText("Calendar date")).toBeNull();
  } finally { height.mockRestore(); }
});
