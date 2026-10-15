"use client";

import { useEffect, useState } from "react";

/** Follow the visible viewport while a phone text editor owns focus. */
export function useMobileEditing(enabled: boolean) {
  const [state, setState] = useState({ editing: false, height: 0 });
  useEffect(() => {
    if (!enabled) { setState({ editing: false, height: 0 }); return; }
    let frame = 0;
    const viewport = window.visualViewport;
    function update() {
      const target = document.activeElement;
      const editing = target instanceof HTMLElement && (target.isContentEditable || target.matches('textarea, input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="password"], input[type="number"], input[type="tel"]'));
      setState({ editing, height: Math.round(viewport?.height ?? window.innerHeight) });
    }
    function queue() { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); }
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", queue);
    viewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", queue);
      viewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, [enabled]);
  return state;
}
