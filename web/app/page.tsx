import { Dashboard } from "@/components/Dashboard";
import { LoginGate } from "@/components/LoginGate";
import { loadVault } from "@/lib/vault";

// Server component: reads the entire vault from the repo at BUILD time and
// hands it to the client SPA. No runtime filesystem access — the output is a
// static site Vercel serves from its CDN. Re-reads on every deploy (git push).
export const dynamic = "force-static";

export default async function Home() {
  const data = await loadVault();
  // LoginGate is a no-op unless APP_PASSWORD is set on the deployment. The page
  // itself stays static; the gate asks the server about the session on mount.
  return (
    <LoginGate>
      <Dashboard data={data} />
    </LoginGate>
  );
}
