"use client";

// Password gate for the whole app, with optional "Sign in with Google".
//
// Login is OPT-IN: with neither APP_PASSWORD nor a Google allowlist configured,
// the session endpoint reports `enabled: false` and this renders its children
// straight through, so a local clone needs nothing.
//
// When it is enabled the write API enforces the same session server-side (see
// lib/apiauth.ts), so this screen is the front door rather than decoration.
import { useCallback, useEffect, useRef, useState } from "react";

type State = "checking" | "open" | "locked" | "authed";
type Session = {
  enabled: boolean;
  authed: boolean;
  password: boolean;
  google: boolean;
  googleClientId: string;
  googleProblem: string | null;
};

const GSI = "https://accounts.google.com/gsi/client";

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.reload();
}

export function LoginGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const googleSlot = useRef<HTMLDivElement>(null);

  const check = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/session", { cache: "no-store" });
      const s = (await r.json()) as Session;
      setSession(s);
      setState(!s.enabled ? "open" : s.authed ? "authed" : "locked");
    } catch {
      // If the check itself fails (offline, static preview), don't strand the
      // user behind a door we can't verify.
      setState("open");
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  // Render Google's button once we know sign-in is offered.
  useEffect(() => {
    if (state !== "locked" || !session?.google || !googleSlot.current) return;
    let cancelled = false;

    const onCredential = async (resp: { credential?: string }) => {
      setBusy(true);
      setErr("");
      try {
        const r = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: resp.credential }),
        });
        const b = (await r.json()) as { ok?: boolean; error?: string };
        if (!r.ok || !b.ok) setErr(b.error || "Google sign-in failed.");
        else window.location.reload();
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy(false);
      }
    };

    const render = () => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const g = (window as any).google;
      if (cancelled || !g?.accounts?.id || !googleSlot.current) return;
      g.accounts.id.initialize({
        client_id: session.googleClientId,
        callback: onCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      g.accounts.id.renderButton(googleSlot.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "signin_with",
        shape: "pill",
      });
      /* eslint-enable @typescript-eslint/no-explicit-any */
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.accounts?.id) render();
    else {
      const s = document.createElement("script");
      s.src = GSI;
      s.async = true;
      s.defer = true;
      s.onload = render;
      s.onerror = () => !cancelled && setErr("Could not load Google sign-in.");
      document.head.appendChild(s);
    }
    return () => {
      cancelled = true;
    };
  }, [state, session]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const b = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !b.ok) {
        setErr(b.error || "Sign-in failed.");
        setPassword("");
      } else {
        window.location.reload();
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking")
    return <div className="login-boot" aria-busy="true" />;
  if (state === "open" || state === "authed") return <>{children}</>;

  const showPassword = session?.password ?? true;

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="login-mark"
          src="/icon.svg"
          alt=""
          width={72}
          height={72}
        />
        <h1 className="login-title">Cortex</h1>

        {session?.google && (
          <>
            <div className="login-google" ref={googleSlot} />
            {showPassword && (
              <div className="login-or">
                <span>or</span>
              </div>
            )}
          </>
        )}

        {showPassword && (
          <>
            <label className="login-label" htmlFor="cortex-password">
              Password
            </label>
            <input
              id="cortex-password"
              className="login-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={busy}
            />
          </>
        )}

        {err && (
          <div className="login-err" role="alert">
            {err}
          </div>
        )}

        {showPassword && (
          <button
            className="btn btn-primary login-btn"
            type="submit"
            disabled={busy || !password}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        )}

        <p className="login-foot">
          {session?.googleProblem
            ? session.googleProblem
            : "Access is limited to approved accounts."}
        </p>
      </form>
    </div>
  );
}
