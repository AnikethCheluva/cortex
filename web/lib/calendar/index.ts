"use client";

// Unified calendar facade over Google + Microsoft. Everything is client-side; a
// provider is only queried when it's both configured (has a client ID) and
// connected (signed in this browser).
import type { CalEvent, CalProvider, NewEvent } from "./types";
import * as g from "./google";
import * as m from "./microsoft";

export type { CalEvent, CalProvider, NewEvent } from "./types";
export { PROVIDER_LABEL } from "./types";

export const providerConfigured = (p: CalProvider) =>
  p === "google" ? g.googleConfigured() : p === "microsoft" ? m.microsoftConfigured() : false;

export const anyConfigured = () => g.googleConfigured() || m.microsoftConfigured();

export async function connections(): Promise<Record<CalProvider, boolean>> {
  const [google, microsoft] = await Promise.all([
    g.googleConfigured() ? g.googleEnsureConnected().catch(() => false) : Promise.resolve(false),
    m.microsoftConfigured() ? m.microsoftConnected().catch(() => false) : Promise.resolve(false),
  ]);
  return {
    google, // silently re-grants on load if the user connected before (no popup)
    microsoft, // MSAL already persists + silently refreshes via localStorage cache
    planned: false, // not an OAuth source — its visibility is a UI toggle
  };
}

export const signIn = (p: CalProvider) => (p === "google" ? g.googleSignIn() : m.microsoftSignIn());
export const signOut = (p: CalProvider) =>
  p === "google" ? Promise.resolve(g.googleSignOut()) : m.microsoftSignOut();

export async function listEvents(startISO: string, endISO: string): Promise<CalEvent[]> {
  const tasks: Promise<CalEvent[]>[] = [];
  if (g.googleConfigured() && g.googleConnected())
    tasks.push(g.googleListEvents(startISO, endISO).catch(() => []));
  if (m.microsoftConfigured() && (await m.microsoftConnected().catch(() => false)))
    tasks.push(m.microsoftListEvents(startISO, endISO).catch(() => []));
  const results = await Promise.all(tasks);
  return results.flat().sort((a, b) => a.start.localeCompare(b.start));
}

export const createEvent = (ev: NewEvent) =>
  ev.provider === "google" ? g.googleCreate(ev) : m.microsoftCreate(ev);

export const deleteEvent = (ev: CalEvent) =>
  ev.provider === "google"
    ? g.googleDelete(ev.calendarId, ev.id)
    : ev.provider === "microsoft"
      ? m.microsoftDelete(ev.id)
      : Promise.reject(new Error("Planned deliverables are managed by the ingest"));
