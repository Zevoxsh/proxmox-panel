import { serverFetch } from "@/lib/server-api";
import { VMStatusBadge } from "@/components/vms/vm-status-badge";
import { formatDate } from "@/lib/utils";
import { Cpu, Activity, HardDrive, Server } from "lucide-react";
import Link from "next/link";

type AdminVM = {
  id: string;
  name: string;
  status: string;
  vmid: number;
  type: string;
  createdAt: string;
  user: { name?: string | null; email: string };
  node: { name: string };
  plan: { name: string };
};

export default async function AdminVMsPage() {
  const res = await serverFetch("/admin/vms");
  const data = res.ok ? await res.json() : { vms: [], stats: [] };
  const vms = (data.vms ?? []) as AdminVM[];
  const stats = data.stats ?? [];

  const running = stats.find((s: { status: string }) => s.status === "RUNNING")?.count ?? 0;
  const stopped = stats.find((s: { status: string }) => s.status === "STOPPED")?.count ?? 0;

  return (
    <div className="space-y-5 animate-in">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">Infrastructure</p>
        <h1 className="font-display text-2xl font-bold">Toutes les VMs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {vms.length} VM(s) · {running} actives · {stopped} arrêtées
        </p>
      </div>

      {/* Stats pills */}
      <div className="grid grid-cols-3 gap-3">
        <StatPill icon={Activity} label="Actives" value={running.toString()} accent="emerald" />
        <StatPill icon={HardDrive} label="Arrêtées" value={stopped.toString()} />
        <StatPill icon={Cpu} label="Total" value={vms.length.toString()} />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60">
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                VM
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Statut
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                Client
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                Node
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                Plan
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">
                Créée le
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {vms.map((vm) => (
              <tr key={vm.id} className="hover:bg-accent/30 transition-colors group">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                      <Server className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <Link
                        href={`/vms/${vm.id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {vm.name}
                      </Link>
                      <p className="text-xs text-muted-foreground font-mono">
                        {vm.type} · {vm.vmid}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <VMStatusBadge status={vm.status} />
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell">
                  <p className="text-sm">{vm.user.name ?? vm.user.email}</p>
                  <p className="text-xs text-muted-foreground">{vm.user.email}</p>
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell text-xs text-muted-foreground">
                  {vm.node.name}
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell text-sm font-medium">
                  {vm.plan.name}
                </td>
                <td className="px-5 py-3.5 hidden xl:table-cell text-xs text-muted-foreground">
                  {formatDate(new Date(vm.createdAt))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatPill({
  icon: Icon, label, value, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: "emerald";
}) {
  const iconClass = accent === "emerald"
    ? "bg-emerald-500/10 text-emerald-400"
    : "bg-primary/10 text-primary";
  const valClass = accent === "emerald" ? "text-emerald-400" : "";

  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-4 flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`font-display text-2xl font-bold ${valClass}`}>{value}</p>
      </div>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconClass}`}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}
