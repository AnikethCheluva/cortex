"use client";

import { useEffect, useState } from "react";

export const AGENT_PINS_KEY = "cortex:agent-pins";
const EVENT = "cortex-agent-pins";

export function readAgentPins(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(AGENT_PINS_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function setAgentPins(pins: string[]) {
  const unique = [...new Set(pins)].slice(0, 12);
  localStorage.setItem(AGENT_PINS_KEY, JSON.stringify(unique));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useAgentPins() {
  const [pins, setPins] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setPins(readAgentPins());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return {
    pins,
    toggle(slug: string) {
      setAgentPins(pins.includes(slug) ? pins.filter((item) => item !== slug) : [...pins, slug]);
    },
    remove(slug: string) {
      setAgentPins(pins.filter((item) => item !== slug));
    },
  };
}
