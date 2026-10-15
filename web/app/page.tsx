import { headers } from "next/headers";
import { Dashboard } from "@/components/Dashboard";
import { LoginGate } from "@/components/LoginGate";
import { loadVault } from "@/lib/vault";
import { hasSession } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Home() {
  const request = new Request("http://localhost", { headers: await headers() });
  if (!hasSession(request)) return <LoginGate><p>Reloading workspace…</p></LoginGate>;
  const data = await loadVault();
  return <LoginGate><Dashboard data={data} /></LoginGate>;
}
