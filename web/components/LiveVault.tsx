"use client";

import { createContext, useContext } from "react";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { VaultData } from "@/lib/types";

// Live vault from Convex, exposed via context so the Dashboard can prefer it
// over the build-time snapshot. `null` when Convex isn't configured or hasn't
// loaded yet → the app falls back to build-time data.
export const LiveVaultContext = createContext<VaultData | null>(null);

export function useLiveVault(): VaultData | null {
  return useContext(LiveVaultContext);
}

// Rendered only inside a ConvexProvider (i.e. when NEXT_PUBLIC_CONVEX_URL is
// set). Subscribes to the reactive getVault query and republishes it.
export function LiveVaultBridge({ children }: { children: React.ReactNode }) {
  const data = useQuery(anyApi.wiki.getVault, {}) as VaultData | undefined;
  return (
    <LiveVaultContext.Provider value={data ?? null}>{children}</LiveVaultContext.Provider>
  );
}
