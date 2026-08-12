import { Dashboard } from "@/components/Dashboard";
import { loadVault } from "@/lib/vault";

// Server component: reads the entire vault from the repo at BUILD time and
// hands it to the client SPA. No runtime filesystem access — the output is a
// static site Vercel serves from its CDN. Re-reads on every deploy (git push).
export const dynamic = "force-static";

export default async function Home() {
  const data = await loadVault();
  return <Dashboard data={data} />;
}
