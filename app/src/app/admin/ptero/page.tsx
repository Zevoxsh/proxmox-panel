import { serverFetch } from "@/lib/server-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GameStatusBadge } from "@/components/game-servers/game-status-badge";
import { GameIcon } from "@/components/game-servers/game-icon";
import { Gamepad2, Server, Users, ExternalLink, Activity, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

type PteroPanel = {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  _count: { servers: number; gamePlans: number };
};

type RecentGameServer = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  plan: { name: string; game: string };
  user: { email: string; name?: string | null };
};

export default async function AdminPteroPage() {
  const res = await serverFetch("/admin/ptero/overview");
  const data = (res.ok ? await res.json() : {
    panels: [],
    totalServers: 0,
    running: 0,
    gamePlans: 0,
    recentServers: [],
  }) as {
    panels: PteroPanel[];
    totalServers: number;
    running: number;
    gamePlans: number;
    recentServers: RecentGameServer[];
  };
  const { panels, totalServers, running, gamePlans, recentServers } = data;

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Gaming Cloud</p>
          <h1 className="font-display text-3xl font-semibold">Pterodactyl</h1>
          <p className="text-muted-foreground mt-2">{panels.length} panel(s) · {totalServers} serveurs</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2 text-xs font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Supervision active
          </span>
          <Button variant="outline" asChild>
            <Link href="/admin/ptero/panels">Gérer les panels</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/game-plans">Gérer les offres</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Panels", value: panels.length, icon: Server },
          { label: "Offres actives", value: gamePlans, icon: Gamepad2 },
          { label: "Serveurs totaux", value: totalServers, icon: Users },
          { label: "En ligne", value: running, icon: Activity, green: true },
        ].map((s) => (
          <Card key={s.label} className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.green ? "text-emerald-500" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`font-display text-2xl font-semibold ${s.green ? "text-emerald-600" : ""}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {panels.map((panel) => (
          <Card key={panel.id} className="border-border/70 bg-card/80 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold">{panel.name}</p>
                  <a
                    href={panel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    {panel.url} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className={`h-2.5 w-2.5 rounded-full mt-1 ${panel.isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>{panel._count.servers} serveurs</span>
                <span>{panel._count.gamePlans} offres</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Derniers serveurs déployés</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border/70">
                <th className="text-left px-6 py-3 font-semibold">Serveur</th>
                <th className="text-left px-6 py-3 font-semibold">Statut</th>
                <th className="text-left px-6 py-3 font-semibold hidden md:table-cell">Client</th>
                <th className="text-left px-6 py-3 font-semibold hidden lg:table-cell">Créé le</th>
              </tr>
            </thead>
            <tbody>
              {recentServers.map((s) => (
                <tr key={s.id} className="border-b border-border/60 hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <GameIcon game={s.plan.game} size="sm" />
                      <div>
                        <Link href={`/game-servers/${s.id}`} className="font-semibold hover:text-primary transition-colors">
                          {s.name}
                        </Link>
                        <p className="text-xs text-muted-foreground capitalize">{s.plan.game} · {s.plan.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <GameStatusBadge status={s.status} />
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell text-sm text-muted-foreground">
                    {s.user.name ?? s.user.email}
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell text-xs text-muted-foreground">
                    {formatDate(new Date(s.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
