import { serverFetch } from "@/lib/server-api";

export default async function GameServersPage() {
  const res = await serverFetch("/game-servers");
  const servers = res.ok ? await res.json() : [];
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Serveurs gaming</h1>
      {servers.length === 0 ? (
        <div className="card p-4">Aucun serveur gaming</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {servers.map((s: any) => (
            <div key={s.id} className="card p-4">
              <div className="font-semibold">{s.name}</div>
              <div className="text-sm text-muted">{s.status}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
