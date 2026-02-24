import { serverFetch } from "@/lib/server-api";
import { Users, Server, CreditCard, Activity, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { VMStatusBadge } from "@/components/vms/vm-status-badge";

type RecentUser = {
  id: string;
  email: string;
  name?: string | null;
  role: "USER" | "ADMIN";
  _count: { vms: number };
};

type RecentVM = {
  id: string;
  name: string;
  status: string;
  user: { email: string };
  node: { name: string };
  plan: { name: string };
};

export default async function AdminOverviewPage() {
  const res = await serverFetch("/admin/overview");
  const data = (res.ok ? await res.json() : {
    totalUsers: 0,
    totalVMs: 0,
    runningVMs: 0,
    totalRevenue: 0,
    recentUsers: [],
    recentVMs: [],
  }) as {
    totalUsers: number;
    totalVMs: number;
    runningVMs: number;
    totalRevenue: number;
    recentUsers: RecentUser[];
    recentVMs: RecentVM[];
  };
  const {
    totalUsers,
    totalVMs,
    runningVMs,
    totalRevenue,
    recentUsers,
    recentVMs,
  } = data;

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">Control Center</p>
        <h1 className="font-display text-2xl font-bold">Vue globale</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Supervision de l&apos;infrastructure, utilisateurs et revenus
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <AdminStatCard title="Utilisateurs" value={totalUsers.toString()} icon={Users} />
        <AdminStatCard title="VMs totales" value={totalVMs.toString()} icon={Server} />
        <AdminStatCard
          title="VMs actives"
          value={runningVMs.toString()}
          icon={Activity}
          accent="emerald"
        />
        <AdminStatCard
          title="Revenus cumulés"
          value={formatCurrency(totalRevenue ?? 0)}
          icon={CreditCard}
          accent="primary"
        />
      </div>

      {/* Tableaux récents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Derniers utilisateurs */}
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Derniers utilisateurs</h2>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border/40">
          {recentUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-5 py-3 hover:bg-accent/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/12 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {(u.name ?? u.email)[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground font-mono">{u._count.vms} VM</span>
                  {u.role === "ADMIN" && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      Admin
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dernières VMs */}
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Dernières VMs déployées</h2>
            <Server className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border/40">
          {recentVMs.map((vm) => (
              <div key={vm.id} className="flex items-center justify-between px-5 py-3 hover:bg-accent/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{vm.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {vm.user.email} · {vm.node.name}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">{vm.plan.name}</span>
                  <VMStatusBadge status={vm.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Highlight pills */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <HighlightCard
          icon={Activity}
          label="VMs en cours"
          value={`${runningVMs} / ${totalVMs}`}
          sub="Ratio actif/total"
        />
        <HighlightCard
          icon={Server}
          label="Stockage"
          value={`${totalVMs} disque(s)`}
          sub="Volumes actifs"
        />
        <HighlightCard
          icon={TrendingUp}
          label="Revenus"
          value={formatCurrency(totalRevenue ?? 0)}
          sub="Factures payées"
          accent
        />
      </div>
    </div>
  );
}

type Accent = "emerald" | "primary" | undefined;

function AdminStatCard({
  title, value, icon: Icon, accent,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: Accent;
}) {
  const iconClass =
    accent === "emerald"
      ? "bg-emerald-500/10 text-emerald-400"
      : accent === "primary"
      ? "bg-primary/10 text-primary"
      : "bg-secondary text-muted-foreground";
  const valClass =
    accent === "emerald" ? "text-emerald-400" : "";

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className={`font-display text-2xl font-bold ${valClass}`}>{value}</p>
    </div>
  );
}

function HighlightCard({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-5 py-4 flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground mb-1">{sub}</p>
        <p className="text-sm font-semibold">{label}</p>
        <p className={`font-display text-xl font-bold mt-1 ${accent ? "text-primary" : ""}`}>{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}
