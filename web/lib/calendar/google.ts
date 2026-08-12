"use client";

// Google Calendar via Google Identity Services (client-side OAuth, no secret) +
// the Calendar REST API. The access token lives in the browser only — no server
// storage. It's persisted in localStorage (survives across sessions/tabs), and a
// "connected before" flag lets us silently re-grant a fresh token on load with no
// popup (as long as the user is still signed into Google in this browser), so the
// connection stays put without re-consenting. Needs NEXT_PUBLIC_GOOGLE_CLIENT_ID
// (a Web OAuth client with this app's origin as an authorized JavaScript origin).
import type { CalEvent, NewEvent } from "./types";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const SCOPE = "https://www.googleapis.com/auth/calendar";
const GSI = "https://accounts.google.com/gsi/client";
const API = "https://www.googleapis.com/calendar/v3";
const TOKEN_KEY = "gcal_token"; // cached access token + expiry (localStorage)
const CONNECTED_KEY = "gcal_connected"; // "1" once the user has granted access

export const googleConfigured = () => Boolean(CLIENT_ID);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TokenClient = any;

let gsi: Promise<void> | null = null;
let tokenClient: TokenClient = null;
let accessToken = "";
let expiry = 0;

function loadGsi(): Promise<void> {
  if (gsi) return gsi;
  gsi = new Promise<void>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.accounts?.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = GSI;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
  return gsi;
}

async function client(): Promise<TokenClient> {
  await loadGsi();
  if (!tokenClient) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: () => {},
    });
  }
  return tokenClient;
}

function restoreCached() {
  if (accessToken) return;
  try {
    const c = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
    if (c) {
      accessToken = c.accessToken;
      expiry = c.expiry;
    }
  } catch {
    /* ignore */
  }
}

function request(prompt: "" | "consent"): Promise<string> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tokenClient.callback = (resp: any) => {
      if (resp.error) return reject(new Error(resp.error));
      accessToken = resp.access_token;
      expiry = Date.now() + (resp.expires_in ? resp.expires_in * 1000 : 3_600_000) - 60_000;
      localStorage.setItem(TOKEN_KEY, JSON.stringify({ accessToken, expiry }));
      localStorage.setItem(CONNECTED_KEY, "1"); // remember the grant for silent re-auth
      resolve(accessToken);
    };
    tokenClient.requestAccessToken({ prompt });
  });
}

export async function googleSignIn(): Promise<void> {
  await client();
  await request("consent");
}

export function googleSignOut(): void {
  accessToken = "";
  expiry = 0;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CONNECTED_KEY); // forget the grant → next time asks again
}

export function googleConnected(): boolean {
  restoreCached();
  return Boolean(accessToken) && Date.now() < expiry;
}

// Persistent connect: true if we already hold a live token, or can silently
// mint one because the user granted access before (no popup). Called on load so
// the calendar stays connected across sessions. Returns false only when Google
// actually needs interaction (signed out / grant revoked) → the UI shows Connect.
export async function googleEnsureConnected(): Promise<boolean> {
  restoreCached();
  if (accessToken && Date.now() < expiry) return true;
  if (typeof localStorage === "undefined" || localStorage.getItem(CONNECTED_KEY) !== "1") {
    return false; // never connected on this browser — don't trigger any GIS UI
  }
  try {
    await client();
    // Silent (prompt: "") — GIS returns a token without UI when the Google
    // session + prior consent exist; times out fast rather than hanging the UI.
    await Promise.race([
      request(""),
      new Promise((_, rej) => setTimeout(() => rej(new Error("silent auth timed out")), 8000)),
    ]);
    return Boolean(accessToken) && Date.now() < expiry;
  } catch {
    return false; // interaction required → fall back to the Connect button
  }
}

async function token(): Promise<string> {
  restoreCached();
  if (accessToken && Date.now() < expiry) return accessToken;
  await client();
  return request(""); // silent refresh if a prior grant exists
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`Google ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export async function googleListEvents(timeMin: string, timeMax: string): Promise<CalEvent[]> {
  const cals = await api<{
    items?: { id: string; selected?: boolean; backgroundColor?: string }[];
  }>(`/users/me/calendarList`);
  const out: CalEvent[] = [];
  for (const cal of (cals.items ?? []).filter((c) => c.selected !== false)) {
    const qs = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ev = await api<{ items?: any[] }>(`/calendars/${encodeURIComponent(cal.id)}/events?${qs}`);
    for (const e of ev.items ?? []) {
      const allDay = Boolean(e.start?.date);
      out.push({
        id: e.id,
        provider: "google",
        calendarId: cal.id,
        title: e.summary || "(no title)",
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        allDay,
        location: e.location,
        description: e.description,
        link: e.htmlLink,
        color: cal.backgroundColor,
      });
    }
  }
  return out;
}

export async function googleCreate(ev: NewEvent): Promise<void> {
  const body = ev.allDay
    ? {
        summary: ev.title,
        location: ev.location,
        description: ev.description,
        start: { date: ev.start.slice(0, 10) },
        end: { date: ev.end.slice(0, 10) },
      }
    : {
        summary: ev.title,
        location: ev.location,
        description: ev.description,
        start: { dateTime: ev.start },
        end: { dateTime: ev.end },
      };
  await api(`/calendars/primary/events`, { method: "POST", body: JSON.stringify(body) });
}

export async function googleDelete(calendarId: string, id: string): Promise<void> {
  await api(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}
