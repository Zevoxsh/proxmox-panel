import { auth } from "@/lib/auth";
import { serverFetch } from "@/lib/server-api";
import { Button } from "@/components/ui/button";
import { Server, Plus, Cpu, HardDrive, Gamepad2, CreditCard, TrendingUp } from "lucide-react";
import Link from "next/link";
import { formatBytes, getStatusBg, formatCurrency } from "@/lib/utils";
import { GameStatusBadge } from "@/components/game-servers/game-status-badge";
import { GameIcon } from "@/components/game-servers/game-icon";
import { VMStatusBadge } from "@/components/vms/vm-status-badge";
import { redirect } from "next/navigation";

type DashboardVM = {
  id: string;
  name: string;
  status: string;
  vmid: number;
  type: string;
  ip?: string | null;
  plan: { name: string };
  node: { name: string };
};

type DashboardGameServer = {
  id: string;
  name: string;
  status: string;
  plan: { name: string; game: string };
};

type DashboardSubscription = {
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan: { name: string; cpu: number; ramMb: number; diskGb: number; priceMonthly: number };
};

type DashboardInvoice = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const res = await serverFetch("/client/dashboard");
  const data = res.ok ? await res.json() : {
    vms: [],
    gameServers: [],
    subscription: null,
    invoices: [],
    totalVMs: 0,
    totalGameServers: 0,
    runningCount: 0,
    runningGameServers: 0,
  };
  const {
    vms,
    gameServers,
    subscription,
    invoices,
    totalVMs,
    totalGameServers,
    runningCount,
    runningGameServers,
  } = data;

  const typedVMs = vms as DashboardVM[];
  const typedGameServers = gameServers as DashboardGameServer[];
  const typedSubscription = subscription as DashboardSubscription | null;
  const typedInvoices = invoices as DashboardInvoice[];

  const firstName = session!.user.name?.split(" ")[0] ?? session!.user.email?.split("@")[0];

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Bonjour, {firstName} 👋</p>
          <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        </div>
        <Button asChild size="sm" className="shadow-md shadow-primary/20">
          <Link href="/vms/new">
            <Plus className="mr-1.5 h-4 w-4" />
            Nouvelle VM
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Service(s) Actif"
          value={`${runningCount}/${totalVMs}`}
          sub=""
          icon={Server}
          accent={runningCount > 0 ? "emerald" : "zinc"}
        />
        <StatCard
          title="flemme"
          value={`${runningGameServers}/${totalGameServers}`}
          sub="En ligne / Total"
          icon={Gamepad2}
          accent={runningGameServers > 0 ? "emerald" : "zinc"}
        />
        <StatCard
          title="flemme"
          value={typedSubscription ? typedSubscription.plan.name : "Aucun"}
          sub={
            typedSubscription
              ? `${typedSubscription.plan.cpu} vCPU · ${formatBytes(typedSubscription.plan.ramMb)}`
              : "Choisir un plan"
          }
          icon={Cpu}
          accent="violet"
        />
        <StatCard
          title="flemme"
          value={
            typedInvoices[0]
              ? formatCurrency(typedInvoices[0].amount, typedInvoices[0].currency.toUpperCase())
              : "—"
          }
          sub={typedInvoices[0] ? "Payée" : "Aucune facture"}
          icon={CreditCard}
          accent="zinc"
        />
      </div>

      {/* Game servers */}
      {totalGameServers > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-base font-semibold flex items-center gap-2">
              <Gamepad2 className="h-4 w-4 text-muted-foreground" />
              Serveurs Gaming
            </h2>
            <Link
              href="/game-servers"
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              Voir tout <TrendingUp className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {typedGameServers.map((s) => (
              <Link
                key={s.id}
                href={`/game-servers/${s.id}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card hover:border-border hover:bg-accent/40 transition-all"
              >
                <GameIcon game={s.plan.game} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{s.plan.game}</p>
                </div>
                <GameStatusBadge status={s.status} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* VMs récentes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-semibold flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            Machines virtuelles
          </h2>
          <Link
            href="/vms"
            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            Voir tout <TrendingUp className="h-3 w-3" />
          </Link>
        </div>

        {typedVMs.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card flex flex-col items-center justify-center py-14 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center border border-primary/15">
              <Server className="h-7 w-7 text-primary/60" />
            </div>
            <div className="text-center">
              <p className="font-medium mb-1">Aucune VM pour le moment</p>
              <p className="text-sm text-muted-foreground">Créez votre première machine virtuelle</p>
            </div>
            <Button asChild size="sm">
              <Link href="/vms/new">
                <Plus className="mr-1.5 h-4 w-4" />
                Créer ma première VM
              </Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            {typedVMs.map((vm, i) => (
              <Link
                key={vm.id}
                href={`/vms/${vm.id}`}
                className={`flex items-center justify-between px-4 py-3 hover:bg-accent/40 transition-all group ${
                  i < vms.length - 1 ? "border-b border-border/50" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Server className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                      {vm.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {vm.type} · {vm.node.name} · {vm.plan.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {vm.ip && (
                    <span className="text-xs text-muted-foreground font-mono hidden sm:block">
                      {vm.ip}
                    </span>
                  )}
                  <VMStatusBadge status={vm.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type Accent = "emerald" | "violet" | "zinc" | "amber";

const accentMap: Record<Accent, { icon: string; value: string }> = {
  emerald: { icon: "bg-emerald-500/10 text-emerald-400",  value: "text-emerald-400" },
  violet:  { icon: "bg-primary/10 text-primary",           value: "text-foreground" },
  zinc:    { icon: "bg-zinc-500/10 text-zinc-400",          value: "text-foreground" },
  amber:   { icon: "bg-amber-500/10 text-amber-400",        value: "text-amber-400" },
};

function StatCard({
  title, value, sub, icon: Icon, accent = "zinc",
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: Accent;
}) {
  const a = accentMap[accent];
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${a.icon}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className={`font-display text-2xl font-bold ${a.value}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>}
    </div>
  );
}
