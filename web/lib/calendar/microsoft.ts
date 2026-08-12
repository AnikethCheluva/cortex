"use client";

// Outlook / Microsoft 365 calendar via MSAL (client-side OAuth, no secret) + MS
// Graph. Tokens are cached in the browser by MSAL — no server storage. Needs
// NEXT_PUBLIC_MS_CLIENT_ID (an Azure "SPA" app registration with this app's
// origin as a redirect URI). `common` authority covers personal + work accounts.
import { PublicClientApplication, type AuthenticationResult } from "@azure/msal-browser";
import type { CalEvent, NewEvent } from "./types";

const CLIENT_ID = process.env.NEXT_PUBLIC_MS_CLIENT_ID || "";
const SCOPES = ["Calendars.ReadWrite", "User.Read"];
const GRAPH = "https://graph.microsoft.com/v1.0";

export const microsoftConfigured = () => Boolean(CLIENT_ID);

let init: Promise<PublicClientApplication> | null = null;

function app(): Promise<PublicClientApplication> {
  if (!init) {
    const pca = new PublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: "https://login.microsoftonline.com/common",
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: "localStorage" },
    });
    init = pca.initialize().then(() => pca);
  }
  return init;
}

async function account(p?: PublicClientApplication) {
  const pca = p ?? (await app());
  return pca.getAllAccounts()[0] ?? null;
}

export async function microsoftSignIn(): Promise<void> {
  const p = await app();
  await p.loginPopup({ scopes: SCOPES });
}

export async function microsoftSignOut(): Promise<void> {
  const p = await app();
  const acc = await account(p);
  if (acc) await p.logoutPopup({ account: acc });
}

export async function microsoftConnected(): Promise<boolean> {
  return Boolean(await account());
}

async function token(): Promise<string> {
  const p = await app();
  const acc = await account(p);
  if (!acc) throw new Error("not signed in to Microsoft");
  try {
    const r: AuthenticationResult = await p.acquireTokenSilent({ scopes: SCOPES, account: acc });
    return r.accessToken;
  } catch {
    const r = await p.acquireTokenPopup({ scopes: SCOPES, account: acc });
    return r.accessToken;
  }
}

async function graph<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token();
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
      Prefer: 'outlook.timezone="UTC"',
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`Graph ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

// Graph returns dateTime in the Prefer timezone (UTC here) WITHOUT a trailing Z.
const asUtc = (dt: string) => (dt && !/[Z+]/.test(dt.slice(10)) ? `${dt}Z` : dt);

export async function microsoftListEvents(startISO: string, endISO: string): Promise<CalEvent[]> {
  const qs = new URLSearchParams({
    startDateTime: startISO,
    endDateTime: endISO,
    $orderby: "start/dateTime",
    $top: "250",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await graph<{ value?: any[] }>(`/me/calendarView?${qs}`);
  return (data.value ?? []).map((e) => ({
    id: e.id as string,
    provider: "microsoft" as const,
    calendarId: "primary",
    title: (e.subject as string) || "(no title)",
    start: e.isAllDay ? String(e.start?.dateTime).slice(0, 10) : asUtc(String(e.start?.dateTime)),
    end: e.isAllDay ? String(e.end?.dateTime).slice(0, 10) : asUtc(String(e.end?.dateTime)),
    allDay: Boolean(e.isAllDay),
    location: e.location?.displayName || undefined,
    description: e.bodyPreview || undefined,
    link: e.webLink || undefined,
  }));
}

export async function microsoftCreate(ev: NewEvent): Promise<void> {
  const strip = (iso: string) => iso.replace(/\.\d+Z?$/, "").replace(/Z$/, ""); // Graph wants naive + timeZone
  const body = ev.allDay
    ? {
        subject: ev.title,
        location: { displayName: ev.location || "" },
        body: { contentType: "text", content: ev.description || "" },
        isAllDay: true,
        start: { dateTime: `${ev.start.slice(0, 10)}T00:00:00`, timeZone: "UTC" },
        end: { dateTime: `${ev.end.slice(0, 10)}T00:00:00`, timeZone: "UTC" },
      }
    : {
        subject: ev.title,
        location: { displayName: ev.location || "" },
        body: { contentType: "text", content: ev.description || "" },
        start: { dateTime: strip(ev.start), timeZone: "UTC" },
        end: { dateTime: strip(ev.end), timeZone: "UTC" },
      };
  await graph(`/me/events`, { method: "POST", body: JSON.stringify(body) });
}

export async function microsoftDelete(id: string): Promise<void> {
  await graph(`/me/events/${encodeURIComponent(id)}`, { method: "DELETE" });
}
