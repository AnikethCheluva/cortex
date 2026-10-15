"use client";

import { useEffect, useState } from "react";
import { connections, prepareConnection, providerConfigured, PROVIDER_LABEL, signIn, type ConnectedProvider } from "@/lib/calendar";

const providers: ConnectedProvider[] = ["google", "microsoft"];

export function CalendarConnectionSettings() {
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<ConnectedProvider | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let active = true;
    providers.filter(providerConfigured).forEach(provider => {
      prepareConnection(provider).then(() => { if (active) setReady(value => ({...value, [provider]: true})); }).catch(() => { if (active) { setReady(value => ({...value, [provider]: true})); setError("Sign-in could not preload. Check your connection, then tap Reconnect calendar to retry."); } });
    });
    connections().then(value => { if (active) setConnected(value); }).catch(() => {});
    return () => { active = false; };
  }, []);

  async function reconnect(provider: ConnectedProvider) {
    setBusy(provider); setMessage(""); setError("");
    try {
      // Ask the provider to authorize again without first removing existing access.
      await signIn(provider);
      setConnected(value => ({...value, [provider]: true}));
      setMessage(`${PROVIDER_LABEL[provider]} calendar reconnected.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not reconnect your calendar. Please try again.");
    } finally { setBusy(null); }
  }

  return <section className="set-block">
    <h3 className="set-h">Calendars</h3>
    <p className="set-sub">Reconnect if events stop syncing. Calendar access is saved on this device.</p>
    {providers.map(provider => <div className="set-row calendar-connection-row" key={provider}>
      <div><div className="set-row-title">{PROVIDER_LABEL[provider]} Calendar</div><div className="set-row-hint">{!providerConfigured(provider) ? "Not configured" : connected[provider] ? "Connected" : "Reconnect to restore access"}</div></div>
      <button type="button" className="btn small" aria-label={`Reconnect ${PROVIDER_LABEL[provider]} calendar`} disabled={Boolean(busy) || !providerConfigured(provider) || !ready[provider]} onClick={() => reconnect(provider)}>{busy === provider ? "Connecting…" : providerConfigured(provider) && !ready[provider] ? "Preparing…" : "Reconnect calendar"}</button>
    </div>)}
    {message && <p className="set-sub" role="status">{message}</p>}
    {error && <p className="agent-error" role="alert">{error}</p>}
  </section>;
}
