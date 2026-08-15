"use client";

// Header palette switcher — one click to change theme, without a trip to the
// settings page. Same store as Settings → Appearance, so both stay in sync.
import { useEffect, useRef, useState } from "react";
import { THEMES, setSettings, useSettings } from "@/lib/settings";

export function ThemeMenu({ onOpenSettings }: { onOpenSettings: () => void }) {
  const s = useSettings();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = THEMES.find((t) => t.id === s.theme) ?? THEMES[0];

  return (
    <div className="theme-menu" ref={wrap}>
      <button
        className="hdr-btn"
        onClick={() => setOpen((o) => !o)}
        title={`Theme — ${active.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="theme-dot" style={{ background: active.swatch[2] }} aria-hidden="true" />
        <span className="hdr-btn-label">Theme</span>
      </button>

      {open && (
        <div className="menu-pop" role="menu">
          <div className="menu-head">Theme</div>
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="menuitemradio"
              aria-checked={t.id === s.theme}
              className={`menu-item ${t.id === s.theme ? "active" : ""}`}
              onClick={() => {
                setSettings({ theme: t.id });
                setOpen(false);
              }}
            >
              <span className="menu-swatch" aria-hidden="true">
                {t.swatch.map((c, i) => (
                  <span key={i} style={{ background: c }} />
                ))}
              </span>
              <span className="menu-label">{t.label}</span>
              {t.id === s.theme && <span className="menu-check">✓</span>}
            </button>
          ))}
          <div className="menu-sep" />
          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
          >
            <span className="menu-label">All settings…</span>
          </button>
        </div>
      )}
    </div>
  );
}
