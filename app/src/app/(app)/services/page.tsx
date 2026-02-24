import Link from "next/link";
import { serverFetch } from "@/lib/server-api";

export default async function ServicesPage() {
  const [vmsRes, gsRes] = await Promise.all([
    serverFetch("/vms"),
    serverFetch("/game-servers"),
  ]);
  const vms = vmsRes.ok ? await vmsRes.json() : [];
  const games = gsRes.ok ? await gsRes.json() : [];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Mes services</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">VPS</h2>
        {vms.length === 0 ? (
          <div className="card p-4">Aucune VM</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {vms.map((vm: any) => (
              <Link key={vm.id} href={`/vms/${vm.id}`} className="card p-4 hover:bg-white/5">
                <div className="font-semibold">{vm.name}</div>
                <div className="text-sm text-muted">{vm.status} · {vm.type} · VMID {vm.vmid}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Gaming</h2>
        {games.length === 0 ? (
          <div className="card p-4">Aucun serveur gaming</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {games.map((gs: any) => (
              <div key={gs.id} className="card p-4">
                <div className="font-semibold">{gs.name}</div>
                <div className="text-sm text-muted">{gs.status}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
