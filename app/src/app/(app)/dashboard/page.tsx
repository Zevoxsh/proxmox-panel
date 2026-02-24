import { serverFetch } from "@/lib/server-api";

export default async function DashboardPage() {
  const [vmsRes, gsRes] = await Promise.all([
    serverFetch("/vms/plans"),
    serverFetch("/game-servers/plans"),
  ]);
  const vms = vmsRes.ok ? await vmsRes.json() : [];
  const games = gsRes.ok ? await gsRes.json() : [];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-sm text-muted">Plans VPS disponibles</div>
          <div className="text-2xl font-bold mt-2">{vms.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-muted">Plans Gaming disponibles</div>
          <div className="text-2xl font-bold mt-2">{games.length}</div>
        </div>
      </div>
    </div>
  );
}
