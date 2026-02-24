import { auth } from "@/lib/auth";
import { serverFetch } from "@/lib/server-api";
import { Button } from "@/components/ui/button";
import { GameStatusBadge } from "@/components/game-servers/game-status-badge";
import { VMStatusBadge } from "@/components/vms/vm-status-badge";
import { Gamepad2, Plus, Server, ExternalLink, Activity } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

type VMRow = {
  id: string;
  name: string;
  status: string;
  vmid: number;
  type: string;
  ip: string | null;
  plan: { name: string; cpu: number; ramMb: number; diskGb: number; priceMonthly: number; type: string };
  node: { name: string };
};

type GameServerRow = {
  id: string;
  name: string;
  status: string;
  plan: { name: string; game: string; ramMb: number; diskMb: number };
};

export default async function ServicesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [vmsRes, gsRes] = await Promise.all([
    serverFetch("/vms"),
    serverFetch("/game-servers"),
  ]);

  const vms = (vmsRes.ok ? await vmsRes.json() : []) as VMRow[];
  const gameServers = (gsRes.ok ? await gsRes.json() : []) as GameServerRow[];

  const runningVms = vms.filter((v) => v.status === "RUNNING").length;
  const runningGames = gameServers.filter((g) => g.status === "RUNNING").length;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Mes services</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {vms.length + gameServers.length} service(s) · {runningVms + runningGames} en ligne
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/order">
              Commander <ExternalLink className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/vms/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Nouvelle VM
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Server className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">VMs</p>
            <p className="text-lg font-semibold">{runningVms}/{vms.length}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Gamepad2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Gaming</p>
            <p className="text-lg font-semibold">{runningGames}/{gameServers.length}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Disponibilité</p>
            <p className="text-lg font-semibold">99.9%</p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-base font-semibold">Machines virtuelles</h2>
          </div>
          <Link href="/vms" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            Tout voir
          </Link>
        </div>

        {vms.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-8 text-center">
            <p className="font-medium mb-1">Aucune VM</p>
            <p className="text-sm text-muted-foreground">Commandez votre première VM en quelques minutes.</p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/vms/new">Commander une VM</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {vms.map((vm) => (
              <Link
                key={vm.id}
                href={`/vms/${vm.id}`}
                className="rounded-xl border border-border/60 bg-card p-4 hover:border-primary/40 hover:bg-accent/40 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{vm.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {vm.plan.name} · {vm.node.name}
                    </p>
                  </div>
                  <VMStatusBadge status={vm.status} />
                </div>
                <div className="mt-3 grid grid-cols-3 text-xs text-muted-foreground">
                  <span>{vm.plan.cpu} vCPU</span>
                  <span>{vm.plan.ramMb} Mo</span>
                  <span>{vm.plan.diskGb} Go</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-base font-semibold">Serveurs gaming</h2>
          </div>
          <Link href="/game-servers" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            Tout voir
          </Link>
        </div>

        {gameServers.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-8 text-center">
            <p className="font-medium mb-1">Aucun serveur gaming</p>
            <p className="text-sm text-muted-foreground">Choisissez un jeu et lancez un serveur en 2 minutes.</p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/game-servers/new">Commander un serveur</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {gameServers.map((server) => (
              <Link
                key={server.id}
                href={`/game-servers/${server.id}`}
                className="rounded-xl border border-border/60 bg-card p-4 hover:border-primary/40 hover:bg-accent/40 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{server.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                      {server.plan.game} · {server.plan.name}
                    </p>
                  </div>
                  <GameStatusBadge status={server.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 text-xs text-muted-foreground">
                  <span>{server.plan.ramMb} Mo RAM</span>
                  <span>{server.plan.diskMb} Mo SSD</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
