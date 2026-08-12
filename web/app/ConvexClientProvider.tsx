"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { LiveVaultBridge, LiveVaultContext } from "@/components/LiveVault";

// Optional Convex live-mirror. When NEXT_PUBLIC_CONVEX_URL is set, wrap the app
// in a Convex client + the live-vault bridge; otherwise pass through with a null
// live vault so the app cleanly falls back to its build-time data.
const url = process.env.NEXT_PUBLIC_CONVEX_URL;
const client = url ? new ConvexReactClient(url) : null;

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  if (!client) {
    return <LiveVaultContext.Provider value={null}>{children}</LiveVaultContext.Provider>;
  }
  return (
    <ConvexProvider client={client}>
      <LiveVaultBridge>{children}</LiveVaultBridge>
    </ConvexProvider>
  );
}
