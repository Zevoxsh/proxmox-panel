import Link from "next/link";
import { serverFetch } from "@/lib/server-api";

export default async function OrderPage() {
  const [vmRes, gameRes] = await Promise.all([
    serverFetch("/vms/plans"),
    serverFetch("/game-servers/plans"),
  ]);
  const vmPlans = vmRes.ok ? await vmRes.json() : [];
  const gamePlans = gameRes.ok ? await gameRes.json() : [];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Commander</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">VPS Proxmox</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {vmPlans.map((plan: any) => (
            <div key={plan.id} className="card p-4 space-y-2">
              <div className="font-semibold">{plan.name}</div>
              <div className="text-sm text-muted">{plan.cpu} vCPU · {plan.ramMb} Mo · {plan.diskGb} Go</div>
              <div className="text-lg">{plan.priceMonthly} €/mois</div>
              <Link className="btn btn-primary w-full" href={`/vms/new/${plan.id}`}>Configurer</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Serveurs Gaming</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {gamePlans.map((plan: any) => (
            <div key={plan.id} className="card p-4 space-y-2">
              <div className="font-semibold">{plan.name}</div>
              <div className="text-sm text-muted">{plan.game} · {plan.ramMb} Mo</div>
              <div className="text-lg">{plan.priceMonthly} €/mois</div>
              <Link className="btn btn-primary w-full" href={`/game-servers/new?planId=${plan.id}`}>Configurer</Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
